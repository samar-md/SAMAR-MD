require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const { handle, randomReactions } = require("./commands");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();
const SESSIONS = path.join(ROOT, "sessions");
const DATA = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA, "users.json");
const LOGO = path.join(ROOT, "public", "logo.jpg");
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");

fs.mkdirSync(SESSIONS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

let users = {};
try {
  users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
} catch {
  users = {};
}

const sockets = new Map();
const starting = new Set();
const pairingCodes = new Map();

const cleanPhone = value => String(value || "").replace(/\D/g, "").replace(/^00/, "");

function defaultUser(phone) {
  return {
    phone,
    connected: false,
    settings: {
      autoread: true,
      autoreact: true,
      statusview: true,
      statusDelayMs: 1500,
      fixedreact: null,
      autotyping: false,
      antilink: false,
      welcome: false,
      goodbye: false
    },
    customCommands: {}
  };
}

function getUser(phone) {
  const p = cleanPhone(phone);
  if (!users[p]) users[p] = defaultUser(p);
  return users[p];
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setProfilePicture(sock) {
  try {
    if (!fs.existsSync(LOGO) || !sock.user?.id) return;
    await sock.updateProfilePicture(sock.user.id, { url: LOGO });
    console.log("[" + cleanPhone(sock.user.id) + "] profile picture updated");
  } catch (e) {
    // Some WhatsApp accounts/devices can reject profile-picture updates.
    console.log("[DP] skipped:", e?.message || "unknown error");
  }
}

async function startSession(phone, requestPairing = false) {
  phone = cleanPhone(phone);
  if (!phone) throw new Error("Invalid phone");
  if (sockets.has(phone)) return sockets.get(phone);
  if (starting.has(phone)) return null;

  starting.add(phone);
  try {
    const user = getUser(phone);
    const folder = path.join(SESSIONS, phone);
    fs.mkdirSync(folder, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(folder);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
      },
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined
    });

    sockets.set(phone, sock);
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async update => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) console.log(`[${phone}] QR available`);

      if (connection === "open") {
        user.connected = true;
        saveUsers();
        console.log(`[${phone}] CONNECTED as ${sock.user?.id || phone}`);
        await setProfilePicture(sock);
      }

      if (connection === "close") {
        user.connected = false;
        saveUsers();
        sockets.delete(phone);

        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`[${phone}] CLOSED status=${statusCode || "unknown"} loggedOut=${loggedOut}`);

        if (!loggedOut) {
          setTimeout(() => startSession(phone).catch(err => console.error(`[${phone}] reconnect`, err.message)), 3000);
        } else {
          pairingCodes.delete(phone);
        }
      }
    });

    // Normal messages + commands.
    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages || []) {
        try {
          if (!msg?.message) continue;
          const remote = msg.key?.remoteJid;
          if (!remote || remote === "status@broadcast") continue;

          if (user.settings.autoread && !msg.key.fromMe) {
            try { await sock.readMessages([msg.key]); } catch {}
          }

          // Auto reaction for normal incoming chats
          if (user.settings.autoreact && !msg.key.fromMe) {
            try {
              const emoji = user.settings.fixedreact || randomReactions[Math.floor(Math.random() * randomReactions.length)];
              await sock.sendMessage(remote, { react: { text: emoji, key: msg.key } });
              console.log(`[${phone}] message reacted ${emoji}`);
            } catch (e) {
              console.log(`[${phone}] auto reaction failed:`, e?.message || e);
            }
          }

          if (user.settings.autotyping && remote.endsWith("@g.us") || user.settings.autotyping && remote.endsWith("@s.whatsapp.net")) {
            try {
              await sock.sendPresenceUpdate("composing", remote);
              setTimeout(() => sock.sendPresenceUpdate("paused", remote).catch(() => {}), 1800);
            } catch {}
          }

          if (user.settings.antilink && remote.endsWith("@g.us") && !msg.key.fromMe) {
            const body = String(require("./commands").getText(msg) || "");
            if (/https?:\/\/|www\.|chat\.whatsapp\.com\//i.test(body)) {
              try { await sock.sendMessage(remote, { delete: msg.key }); } catch {}
              continue;
            }
          }

          await handle({
            sock,
            msg,
            user,
            save: async () => saveUsers(),
            groupMeta: jid => sock.groupMetadata(jid)
          });
        } catch (e) {
          console.error(`[${phone}] message error:`, e?.stack || e?.message || e);
        }
      }
    });

    // Status automation. Kept separate so status messages are never filtered
    // by the normal-chat handler.
    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages || []) {
        try {
          if (!msg?.message || msg.key?.remoteJid !== "status@broadcast") continue;

          const participant = msg.key?.participantAlt || msg.key?.participant;
          if (!participant) {
            console.log(`[${phone}] status received without participant`);
            continue;
          }

          const delay = Math.max(0, Math.min(60000, Number(user.settings.statusDelayMs) || 0));

          if (msg.key?.fromMe) continue;
          if (delay) await sleep(delay);

          if (user.settings.statusview) {
            try {
              await sock.readMessages([msg.key]);
              console.log(`[${phone}] status seen from ${participant}`);
            } catch (e) {
              console.log(`[${phone}] status read failed:`, e?.message || e);
            }
          }

          if (user.settings.autoreact) {
            const emoji = user.settings.fixedreact || randomReactions[Math.floor(Math.random() * randomReactions.length)];
            const reactionKey = {
              remoteJid: "status@broadcast",
              id: msg.key.id,
              participant: msg.key.participant,
              participantAlt: msg.key.participantAlt,
              fromMe: false
            };
            let reacted = false;
            for (const target of [...new Set([msg.key.participantAlt, msg.key.participant].filter(Boolean))]) {
              try {
                await sock.sendMessage(
                  "status@broadcast",
                  { react: { text: emoji, key: reactionKey } },
                  { statusJidList: [target] }
                );
                reacted = true;
                console.log(`[${phone}] status reacted ${emoji} -> ${target}`);
                break;
              } catch (e) {
                console.log(`[${phone}] status reaction attempt failed for ${target}:`, e?.message || e);
              }
            }
            if (!reacted) console.log(`[${phone}] status reaction failed after all participant formats`);
          }
        } catch (e) {
          console.error(`[${phone}] status handler error:`, e?.stack || e?.message || e);
        }
      }
    });

    sock.ev.on("group-participants.update", async update => {
      try {
        const group = update.id;
        const action = update.action;
        const people = update.participants || [];
        if (!group || !people.length) return;
        if (action !== "add" && action !== "remove") return;
        const enabled = action === "add" ? user.settings.welcome : user.settings.goodbye;
        if (!enabled) return;
        const text = action === "add"
          ? `👋 Welcome ${people.map(x => "@" + x.split("@")[0]).join(", ")} to the group!\n🤖 SAMAR-MD`
          : `👋 Goodbye ${people.map(x => "@" + x.split("@")[0]).join(", ")}!\n🤖 SAMAR-MD`;
        await sock.sendMessage(group, { text, mentions: people });
      } catch (e) {
        console.log(`[${phone}] welcome/goodbye error:`, e?.message || e);
      }
    });

    if (requestPairing && !state.creds.registered && !pairingCodes.has(phone)) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone);
          pairingCodes.set(phone, String(code));
          console.log(`[${phone}] PAIRING CODE: ${code}`);
        } catch (e) {
          console.error(`[${phone}] pairing error:`, e?.message || e);
        }
      }, 2000);
    }

    return sock;
  } finally {
    starting.delete(phone);
  }
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    bot: process.env.BOT_NAME || "SAMAR-MD",
    team: process.env.TEAM_NAME || "The-RUDE-x Cyber Team",
    sessions: Object.keys(users).length,
    connected: Object.values(users).filter(x => x.connected).length,
    uptime: Math.floor(process.uptime())
  });
});

app.post("/api/pair", async (req, res) => {
  const phone = cleanPhone(req.body?.phone);
  if (!/^\d{10,15}$/.test(phone)) {
    return res.status(400).json({ ok: false, message: "Use international digits only, e.g. 923001234567" });
  }

  try {
    const user = getUser(phone);
    if (user.connected) return res.json({ ok: true, connected: true });
    await startSession(phone, true);
    return res.json({ ok: true, pending: true, message: "Pairing code is being generated." });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Pairing failed" });
  }
});

app.get("/api/pair/:phone", (req, res) => {
  const phone = cleanPhone(req.params.phone);
  if (users[phone]?.connected) return res.json({ ok: true, connected: true });
  const code = pairingCodes.get(phone);
  if (code) {
    return res.json({
      ok: true,
      code: String(code).match(/.{1,4}/g)?.join("-") || String(code)
    });
  }
  return res.json({ ok: false, pending: true });
});

app.get("/api/user/:phone", (req, res) => {
  const user = getUser(req.params.phone);
  res.json({
    phone: user.phone,
    connected: user.connected,
    settings: user.settings,
    customCommands: Object.keys(user.customCommands || {})
  });
});

app.patch("/api/user/:phone/settings", (req, res) => {
  const user = getUser(req.params.phone);
  const allowed = ["autoread","autoreact","statusview","autotyping","antilink","welcome","goodbye"];
  for (const key of allowed) {
    if (typeof req.body?.[key] === "boolean") user.settings[key] = req.body[key];
  }
  if (Number.isFinite(Number(req.body?.statusDelayMs))) {
    user.settings.statusDelayMs = Math.max(0, Math.min(60000, Number(req.body.statusDelayMs)));
  }
  saveUsers();
  res.json({ ok: true, settings: user.settings });
});

app.get("/api/channel", (req, res) => {
  res.json({ channel: process.env.CHANNEL_LINK || "" });
});

app.get("/robots.txt", (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

app.get("/sitemap.xml", (req, res) => {
  const base = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`);
});

app.get("/manifest.webmanifest", (req, res) => {
  res.json({name:"SAMAR-MD - The-RUDE-x Cyber Team",short_name:"SAMAR-MD",start_url:"/",display:"standalone",theme_color:"#05070b",background_color:"#05070b",icons:[{src:"/logo.jpg",sizes:"512x512",type:"image/jpeg"}]});
});


app.get("*", (req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SAMAR-MD dashboard running on port ${PORT}`);
  for (const phone of Object.keys(users)) {
    startSession(phone).catch(e => console.error(`[${phone}] restore`, e.message));
  }
});
