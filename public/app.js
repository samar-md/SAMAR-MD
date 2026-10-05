const $ = s => document.querySelector(s);

async function json(url, options) {
  const r = await fetch(url, options);
  return r.json();
}

async function loadChannel() {
  try {
    const data = await json("/api/channel");
    for (const id of ["channelTop","channelHero","channelCard"]) {
      const el = $("#" + id);
      if (el && data.channel) el.href = data.channel;
    }
  } catch {}
}

async function health() {
  try {
    const h = await json("/api/health");
    $("#healthStatus").textContent = h.ok ? "ONLINE" : "OFFLINE";
    $("#sessions").textContent = h.sessions;
    $("#connected").textContent = h.connected;
    $("#uptime").textContent = h.uptime + "s";
  } catch {
    $("#healthStatus").textContent = "OFFLINE";
  }
}

$("#pairBtn").addEventListener("click", async () => {
  const phone = $("#phone").value.trim();
  const out = $("#pairResult");
  if (!/^\d{10,15}$/.test(phone)) {
    out.textContent = "❌ Enter international digits only.";
    return;
  }

  $("#pairBtn").disabled = true;
  out.textContent = "⏳ Starting secure pairing…";

  try {
    const start = await json("/api/pair", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({phone})
    });

    if (start.connected) {
      out.textContent = "✅ This number is already connected.";
      return;
    }

    let found = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const result = await json("/api/pair/" + encodeURIComponent(phone));
      if (result.connected) {
        out.textContent = "✅ Connected! Check WhatsApp Linked Devices.";
        found = true;
        break;
      }
      if (result.code) {
        out.innerHTML = "🔐 Pairing code: <strong>" + result.code + "</strong><br><small>WhatsApp → Linked devices → Link with phone number instead</small>";
        found = true;
        break;
      }
    }
    if (!found) out.textContent = "⌛ Code is still being generated. Refresh/check again in a few seconds.";
  } catch (e) {
    out.textContent = "❌ Pairing request failed.";
  } finally {
    $("#pairBtn").disabled = false;
  }
});

$("#year").textContent = new Date().getFullYear();
loadChannel();
health();
setInterval(health, 10000);
