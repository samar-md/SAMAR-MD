const PREFIX = process.env.PREFIX || ".";
const OWNERS = (process.env.OWNER_NUMBERS || "").split(",").map(x => x.trim()).filter(Boolean);

const num = jid => String(jid || "").split("@")[0].split(":")[0];
const isOwner = jid => OWNERS.includes(num(jid));

function unwrap(message) {
  let x = message?.message || {};
  for (const k of ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "documentWithCaptionMessage"]) {
    if (x[k]?.message) x = x[k].message;
  }
  return x || {};
}

function getText(message) {
  const x = unwrap(message);
  return x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.videoMessage?.caption || x.documentMessage?.caption || "";
}

function parseCommand(body) {
  if (!body.startsWith(PREFIX)) return null;
  const parts = body.slice(PREFIX.length).trim().split(/\s+/);
  const command = (parts.shift() || "").toLowerCase();
  return { command, args: parts, raw: body };
}

const randomReactions = ["❤️","🔥","😍","😂","👍","💯","😎","👏","✨","🤩","🥰","🙌","🤯","😇","💙","🫶"];

const menu = () => `╭━━〔 *SAMAR-MD* 〕━━╮
┃ 👑 *The-RUDE-x Cyber Team*
╰━━━━━━━━━━━━━━━━╯

⚡ *GENERAL*
• ${PREFIX}menu • ${PREFIX}help • ${PREFIX}ping • ${PREFIX}ping2
• ${PREFIX}alive • ${PREFIX}uptime • ${PREFIX}id • ${PREFIX}owner
• ${PREFIX}info • ${PREFIX}botinfo • ${PREFIX}settings • ${PREFIX}runtime
• ${PREFIX}jid • ${PREFIX}version • ${PREFIX}support

🛡️ *AUTO / STATUS*
• ${PREFIX}autoread on/off • ${PREFIX}autoreact on/off
• ${PREFIX}statusview on/off • ${PREFIX}statuslike on/off
• ${PREFIX}autotyping on/off • ${PREFIX}setdelay 0-60
• ${PREFIX}setreact random/emoji • ${PREFIX}statushelp

👥 *GROUP*
• ${PREFIX}tagall • ${PREFIX}hidetag • ${PREFIX}admins • ${PREFIX}ginfo
• ${PREFIX}groupid • ${PREFIX}members • ${PREFIX}listadmin
• ${PREFIX}antilink on/off • ${PREFIX}welcome on/off • ${PREFIX}goodbye on/off
• ${PREFIX}promote @user • ${PREFIX}demote @user
• ${PREFIX}kick @user • ${PREFIX}add 923xx
• ${PREFIX}subject name • ${PREFIX}desc text • ${PREFIX}link

🔤 *TEXT / UTILITY*
• ${PREFIX}tiny • ${PREFIX}circle • ${PREFIX}gothic • ${PREFIX}reverse
• ${PREFIX}upper • ${PREFIX}lower • ${PREFIX}length • ${PREFIX}count
• ${PREFIX}quote • ${PREFIX}emoji • ${PREFIX}calc • ${PREFIX}time
• ${PREFIX}date • ${PREFIX}say • ${PREFIX}8ball • ${PREFIX}choose
• ${PREFIX}truth • ${PREFIX}dare • ${PREFIX}fact • ${PREFIX}motivate

🧰 *OWNER / CUSTOM*
• ${PREFIX}addcmd • ${PREFIX}delcmd • ${PREFIX}cmds • ${PREFIX}broadcast
• ${PREFIX}setprefix • ${PREFIX}restart • ${PREFIX}stats

📌 Official Channel:
${process.env.CHANNEL_LINK || ""}`;

function toggle(settings, key, value) {
  if (!["on", "off"].includes(value)) return `Use: ${PREFIX}${key} on/off`;
  settings[key] = value === "on";
  return `✅ ${key}: ${settings[key] ? "ON" : "OFF"}`;
}

function fancy(input, alphabet) {
  return [...input].map(ch => {
    const i = ch.toLowerCase().charCodeAt(0) - 97;
    return i >= 0 && i < 26 ? alphabet[i] : ch;
  }).join("");
}
const tiny = s => fancy(s, "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ");
const circle = s => fancy(s, "ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ");
const gothic = s => fancy(s, "𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷");

const facts = ["Octopuses have three hearts.","Honey can remain edible for an extremely long time when stored properly.","Bananas are berries botanically, but strawberries are not.","A day on Venus is longer than its year."];
const motivations = ["Keep going — consistency beats intensity.","Small progress is still progress. 🔥","Build quietly, let the results speak.","Your future self will thank you for starting today."];
const truths = ["What is one goal you have never told anyone about?","What is a habit you want to change?","What was your funniest recent mistake?"];
const dares = ["Send a positive message to someone you appreciate.","Change your status to something motivational for 10 minutes.","Do 10 seconds of your best victory dance. 😎"];
const eight = ["Yes.","No.","Definitely.","Probably.","Ask again later.","Without a doubt.","Very unlikely."];

async function handle({ sock, msg, user, save, groupMeta }) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || from;
  const parsed = parseCommand(getText(msg));
  if (!parsed) return false;
  const { command, args } = parsed;
  const arg = args.join(" ");
  const send = text => sock.sendMessage(from, { text: String(text) }, { quoted: msg });
  const mentionIds = () => (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []);
  const groupOnly = () => from.endsWith("@g.us");
  const meta = async () => groupMeta(from);

  if (user.customCommands?.[command]) { await send(user.customCommands[command]); return true; }

  if (["menu","help","commands"].includes(command)) { await send(menu()); return true; }
  if (["ping","ping2"].includes(command)) { await send(`🏓 PONG!\n⚡ SAMAR-MD online\n⏱️ ${Math.floor(process.uptime())}s`); return true; }
  if (["alive","botinfo","info"].includes(command)) { await send(`🤖 *SAMAR-MD*\n👑 The-RUDE-x Cyber Team\n🟢 Multi-session WhatsApp bot\n🛡️ Status automation: ON\n⏱️ Uptime: ${Math.floor(process.uptime())}s`); return true; }
  if (["uptime","runtime"].includes(command)) { await send(`⏱️ Uptime: ${Math.floor(process.uptime())} seconds`); return true; }
  if (["id","jid"].includes(command)) { await send(`🆔 Chat: ${from}\n👤 Sender: ${sender}`); return true; }
  if (["owner","support"].includes(command)) { await send(`👑 *SAMAR-MD OWNER / SUPPORT*\nThe-RUDE-x Cyber Team\n📢 ${process.env.CHANNEL_LINK || "Official channel not configured"}`); return true; }
  if (command === "version") { await send("📦 SAMAR-MD v5 • Baileys multi-session"); return true; }
  if (command === "settings") { await send("⚙️ " + JSON.stringify(user.settings, null, 2)); return true; }
  if (command === "statushelp") { await send(`🛡️ STATUS HELP\n${PREFIX}autoreact on/off\n${PREFIX}statusview on/off\n${PREFIX}statuslike on/off\n${PREFIX}setdelay 0-60\n${PREFIX}setreact random/❤️`); return true; }

  for (const key of ["autoread","autoreact","statusview","autotyping","antilink","welcome","goodbye"]) {
    if (command === key) { await send(toggle(user.settings, key, args[0]?.toLowerCase())); await save(); return true; }
  }
  if (command === "statuslike") {
    const v = args[0]?.toLowerCase();
    if (!["on","off"].includes(v)) { await send(`Use: ${PREFIX}statuslike on/off`); return true; }
    user.settings.statusview = v === "on"; user.settings.autoreact = v === "on"; await save();
    await send(`💚 *STATUS LIKE ${v.toUpperCase()}*\n👀 Seen: ${user.settings.statusview}\n❤️ Reaction: ${user.settings.autoreact}`); return true;
  }
  if (command === "setdelay") {
    const n = Number(args[0]);
    if (!Number.isFinite(n) || n < 0 || n > 60) { await send(`Use: ${PREFIX}setdelay 0-60`); return true; }
    user.settings.statusDelayMs = Math.round(n * 1000); await save(); await send(`⏱️ Status delay: ${n}s`); return true;
  }
  if (command === "setreact") {
    const value = (arg || "random").trim();
    user.settings.fixedreact = value.toLowerCase() === "random" ? null : [...value].slice(0, 4).join("");
    await save(); await send(`❤️ Reaction: ${user.settings.fixedreact || "random"}`); return true;
  }

  if (["tagall","hidetag","admins","ginfo","groupid","members","listadmin","link"].includes(command)) {
    if (!groupOnly()) { await send("❌ Group only"); return true; }
    const m = await meta();
    const ids = m.participants.map(x => x.id);
    if (["ginfo","groupid"].includes(command)) { await send(`👥 ${m.subject}\n👤 Members: ${ids.length}\n🆔 ${from}`); return true; }
    if (["members"].includes(command)) { await send(`👥 Members (${ids.length})\n` + ids.map(x => "@" + num(x)).join("\n")); return true; }
    if (["admins","listadmin"].includes(command)) { const a = m.participants.filter(x => x.admin).map(x => x.id); await sock.sendMessage(from,{text:"👮 ADMINS\n"+a.map(x=>"@"+num(x)).join("\n"),mentions:a},{quoted:msg}); return true; }
    if (command === "link") { try { await send("🔗 " + await sock.groupInviteCode(from).then(c => `https://chat.whatsapp.com/${c}`)); } catch { await send("❌ Could not get group link."); } return true; }
    await sock.sendMessage(from,{text:command === "tagall" ? `📢 ${ids.map(x=>"@"+num(x)).join(" ")}` : (arg || "📢"),mentions:ids},{quoted:msg}); return true;
  }

  if (["promote","demote","kick"].includes(command)) {
    if (!groupOnly()) { await send("❌ Group only"); return true; }
    if (!isOwner(sender)) { await send("❌ Owner only"); return true; }
    const ids = mentionIds(); if (!ids.length) { await send(`Use: ${PREFIX}${command} @user`); return true; }
    const action = command === "promote" ? "promote" : command === "demote" ? "demote" : "remove";
    try { await sock.groupParticipantsUpdate(from, ids, action); await send(`✅ ${command} completed.`); } catch(e) { await send("❌ Failed: " + (e.message || "permission error")); } return true;
  }
  if (["add"].includes(command)) {
    if (!groupOnly() || !isOwner(sender)) { await send("❌ Owner/group only"); return true; }
    const raw = args.map(x=>x.replace(/\D/g,"")).filter(Boolean); if(!raw.length){await send(`Use: ${PREFIX}add 923001234567`);return true;}
    try { await sock.groupParticipantsUpdate(from, raw.map(x=>x+"@s.whatsapp.net"), "add"); await send("✅ Add request sent."); } catch(e){await send("❌ Failed: "+e.message);} return true;
  }
  if (["subject","desc"].includes(command)) {
    if (!groupOnly() || !isOwner(sender)) { await send("❌ Owner/group only"); return true; }
    if(!arg){await send(`Use: ${PREFIX}${command} text`);return true;}
    try { if(command === "subject") await sock.groupUpdateSubject(from,arg); else await sock.groupUpdateDescription(from,arg); await send("✅ Updated."); } catch(e){await send("❌ Failed: "+e.message);} return true;
  }

  if (command === "tiny") { await send(tiny(arg) || `Use: ${PREFIX}tiny text`); return true; }
  if (command === "circle") { await send(circle(arg) || `Use: ${PREFIX}circle text`); return true; }
  if (command === "gothic") { await send(gothic(arg) || `Use: ${PREFIX}gothic text`); return true; }
  if (command === "reverse") { await send([...arg].reverse().join("") || `Use: ${PREFIX}reverse text`); return true; }
  if (command === "upper") { await send(arg.toUpperCase() || `Use: ${PREFIX}upper text`); return true; }
  if (command === "lower") { await send(arg.toLowerCase() || `Use: ${PREFIX}lower text`); return true; }
  if (command === "length") { await send(`📏 Length: ${arg.length}`); return true; }
  if (command === "count") { await send(`🔢 Words: ${arg ? arg.trim().split(/\s+/).length : 0}\nCharacters: ${arg.length}`); return true; }
  if (command === "say") { await send(arg || `Use: ${PREFIX}say text`); return true; }
  if (command === "quote") { await send(`💬 “${arg || "Make it happen."}”\n— SAMAR-MD`); return true; }
  if (command === "emoji") { await send(randomReactions.join(" ")); return true; }
  if (command === "calc") { try { if(!/^[0-9+\-*/().%\s]+$/.test(arg)) throw Error(); const value = Function(`"use strict";return (${arg})`)(); await send(`🧮 ${arg} = ${value}`); } catch { await send("❌ Invalid calculation."); } return true; }
  if (command === "time") { await send("🕒 " + new Intl.DateTimeFormat("en-US",{dateStyle:"full",timeStyle:"medium",timeZone:process.env.BOT_TIMEZONE||"UTC"}).format(new Date())); return true; }
  if (command === "date") { await send("📅 " + new Intl.DateTimeFormat("en-US",{dateStyle:"full",timeZone:process.env.BOT_TIMEZONE||"UTC"}).format(new Date())); return true; }
  if (command === "8ball") { await send("🎱 " + eight[Math.floor(Math.random()*eight.length)]); return true; }
  if (command === "choose") { const choices = arg.split("|").map(x=>x.trim()).filter(Boolean); await send(choices.length ? "🎯 " + choices[Math.floor(Math.random()*choices.length)] : `Use: ${PREFIX}choose tea | coffee`); return true; }
  if (command === "truth") { await send("🧠 TRUTH: " + truths[Math.floor(Math.random()*truths.length)]); return true; }
  if (command === "dare") { await send("🔥 DARE: " + dares[Math.floor(Math.random()*dares.length)]); return true; }
  if (command === "fact") { await send("💡 FACT: " + facts[Math.floor(Math.random()*facts.length)]); return true; }
  if (command === "motivate") { await send("🚀 " + motivations[Math.floor(Math.random()*motivations.length)]); return true; }

  if (command === "addcmd") { if (!isOwner(sender)) { await send("❌ Owner only"); return true; } const name=(args.shift()||"").toLowerCase().replace(/[^a-z0-9_]/g,""); if(!name||!args.length){await send(`Use: ${PREFIX}addcmd name reply`);return true;} user.customCommands[name]=args.join(" "); await save(); await send(`✅ ${PREFIX}${name} added`); return true; }
  if (command === "delcmd") { if(!isOwner(sender)){await send("❌ Owner only");return true;} delete user.customCommands[(args[0]||"").toLowerCase()]; await save(); await send("✅ Deleted"); return true; }
  if (command === "cmds") { await send("🧰 Custom commands:\n"+(Object.keys(user.customCommands||{}).map(x=>PREFIX+x).join("\n")||"None")); return true; }
  if (command === "stats") { if(!isOwner(sender)){await send("❌ Owner only");return true;} await send(`📊 SAMAR-MD\n⏱️ ${Math.floor(process.uptime())}s uptime\n🧰 ${Object.keys(user.customCommands||{}).length} custom commands`); return true; }
  if (command === "broadcast") { if(!isOwner(sender)){await send("❌ Owner only");return true;} await send("📢 Broadcast requires an approved target list; use a dedicated broadcast workflow to avoid accidental spam."); return true; }
  if (command === "setprefix") { if(!isOwner(sender)){await send("❌ Owner only");return true;} await send("ℹ️ Prefix is configured with the PREFIX environment variable. Restart after changing it."); return true; }
  if (command === "restart") { if(!isOwner(sender)){await send("❌ Owner only");return true;} await send("♻️ Restart requested. Restart the Render service/server process."); return true; }

  return false;
}

module.exports = { handle, getText, unwrap, parseCommand, randomReactions };
