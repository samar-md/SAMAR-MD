const fs=require("fs"),path=require("path"),{execFile}=require("child_process");
const PREFIX=process.env.PREFIX||".";
const OWN=(process.env.OWNER_NUMBERS||"").split(",").map(x=>x.trim()).filter(Boolean);
const num=j=>(j||"").split("@")[0].split(":")[0];
const owner=j=>OWN.includes(num(j));
function unwrap(m){let x=m?.message||{};for(const k of ["ephemeralMessage","viewOnceMessage","viewOnceMessageV2"])if(x[k])x=x[k].message;return x||{}}
function text(m){const x=unwrap(m);return x.conversation||x.extendedTextMessage?.text||x.imageMessage?.caption||x.videoMessage?.caption||""}
function parse(s){if(!s.startsWith(PREFIX))return null;const p=s.slice(PREFIX.length).trim().split(/\s+/);return{command:(p.shift()||"").toLowerCase(),args:p}}

/*
 * Positive reaction pack.
 * This intentionally contains a broad set of positive/love/happy/supportive
 * Unicode emoji, including skin-tone variants where useful.
 */
const randomReactions=[
"❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤎","🖤","🩶","🤍",
"💖","💗","💓","💞","💕","💘","💝","💟","❣️","💌","❤️‍🔥","❤️‍🩹",
"😍","🥰","😘","😗","😙","😚","😻","🤩","😊","☺️","😇","🥹",
"😂","🤣","😄","😁","😆","😅","🙂","🙃","😉","😌","🤗","🤭",
"😎","🥳","🤠","🫶","🫰","🤟","🤞","✌️","👌","👍","👎","👏",
"🙌","🙏","💪","🤝","👐","🤲","🤜","🤛","✍️","🤌","🤏",
"✨","🌟","⭐","💫","🔥","💯","🎉","🎊","🎁","🏆","🥇","🥈","🥉",
"🚀","⚡","🌈","☀️","🌞","🌸","🌹","🌺","🌻","🌷","🌼","💐",
"🍀","🌿","🌱","🌳","🪷","🕊️","🦋","🐝","🐞","🐬","🦄",
"💎","👑","🎯","🎵","🎶","❤️‍🔥","☮️","☀️","🌙","💡",
"🫂","🙋","🙋‍♂️","🙋‍♀️","💃","🕺","👯","👯‍♂️","👯‍♀️",
"🥂","🍾","🍰","🍫","🍓","🍒","🍎","🍉","🌹","🌺","🌸",
"🎈","🎀","🪄","🧿","🔱","☘️","🌻","🌼","🌷","💙","💚","💜"
];
const reacts=randomReactions;

const menu=()=>`╭━━〔 *SAMAR-MD* 〕━━╮
┃ 👑 *The-RUDE-x Cyber Team*
╰━━━━━━━━━━━━━━━━╯
⚡ *GENERAL*
• ${PREFIX}menu  ${PREFIX}help  ${PREFIX}ping  ${PREFIX}ping2
• ${PREFIX}alive  ${PREFIX}uptime  ${PREFIX}id  ${PREFIX}owner
• ${PREFIX}info  ${PREFIX}settings
🛡️ *AUTO / STATUS*
• ${PREFIX}autoread on/off
• ${PREFIX}autoreact on/off
• ${PREFIX}statusview on/off
• ${PREFIX}statuslike on/off
• ${PREFIX}autotyping on/off
• ${PREFIX}setdelay 0-60
• ${PREFIX}setreact random/emoji
• ${PREFIX}emojis / ${PREFIX}reacts
👥 *GROUP*
• ${PREFIX}tagall  ${PREFIX}hidetag  ${PREFIX}admins
• ${PREFIX}ginfo  ${PREFIX}antilink on/off
• ${PREFIX}welcome on/off  ${PREFIX}goodbye on/off
🔤 *TEXT*
• ${PREFIX}tiny  ${PREFIX}circle  ${PREFIX}gothic  ${PREFIX}reverse
🧰 *TOOLS*
• ${PREFIX}addcmd  ${PREFIX}delcmd  ${PREFIX}cmds
• ${PREFIX}video URL  ${PREFIX}yt URL  ${PREFIX}audio URL
💖 *REACTION PACK*
• ${reacts.length}+ positive/love/happy/support reactions`;

function tog(k,v,s){if(!["on","off"].includes(v))return`Use: ${PREFIX}${k} on/off`;s[k]=v==="on";return`✅ ${k}: ${s[k]?"ON":"OFF"}`}
function tiny(s){const a="ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";return[...s].map(c=>a[c.toLowerCase().charCodeAt(0)-97]||c).join("")}
function circle(s){const a="ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ";return[...s].map(c=>a[c.toLowerCase().charCodeAt(0)-97]||c).join("")}
function gothic(s){const a="𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷";return[...s].map(c=>a[c.toLowerCase().charCodeAt(0)-97]||c).join("")}
function ytdlp(url,mode,out){return new Promise((res,rej)=>{const bin=require.resolve("yt-dlp-exec/bin/yt-dlp");const a=mode==="audio"?["-x","--audio-format","mp3","-o",out,url]:["-f","mp4/best","--merge-output-format","mp4","-o",out,url];execFile(bin,a,{timeout:120000},e=>e?rej(e):res(out))})}

async function handle({sock,msg,user,save,groupMeta}){
 const from=msg.key.remoteJid,sender=msg.key.participant||from,p=parse(text(msg));if(!p)return false;
 const {command,args}=p,send=t=>sock.sendMessage(from,{text:t},{quoted:msg}),arg=args.join(" ");
 if(user.customCommands?.[command]){await send(user.customCommands[command]);return true}
 if(["menu","help"].includes(command)){await send(menu());return true}
 if(command==="ping"){await send("🏓 PONG! • SAMAR-MD online");return true}
 if(command==="ping2"){await send("🏓 PONG 2 • connection active");return true}
 if(command==="alive"){await send(`🟢 SAMAR-MD ALIVE\n👑 The-RUDE-x Cyber Team\n⏱️ ${Math.floor(process.uptime())}s`);return true}
 if(command==="uptime"){await send(`⏱️ ${Math.floor(process.uptime())} seconds`);return true}
 if(command==="id"){await send(`🆔 Chat: ${from}\n👤 Sender: ${sender}`);return true}
 if(command==="owner"){await send("👑 SAMAR-MD OWNER\nThe-RUDE-x Cyber Team");return true}
 if(command==="info"){await send("🤖 SAMAR-MD v3.0\n⚡ The-RUDE-x Cyber Team\n🟢 Multi-session");return true}
 if(command==="settings"){await send("⚙️ "+JSON.stringify(user.settings,null,2));return true}

 if(["emojis","reacts"].includes(command)){
   await send(`💖 *SAMAR-MD POSITIVE REACTION PACK* (${reacts.length}+)\n\n${reacts.join(" ")}`);
   return true;
 }
 if(command==="emoji" || command==="randomreact"){
   await send(reacts[Math.floor(Math.random()*reacts.length)]);
   return true;
 }

 for(const k of ["autoread","autoreact","statusview","autotyping","welcome","goodbye","antilink"])
   if(command===k){await send(tog(k,args[0]?.toLowerCase(),user.settings));await save();return true}

 if(command==="statuslike"){
   const v=args[0]?.toLowerCase();
   if(!["on","off"].includes(v)){await send(`Use: ${PREFIX}statuslike on/off`);return true}
   user.settings.statusview=v==="on";user.settings.autoreact=v==="on";
   await save();
   await send(`💚 STATUS LIKE ${v.toUpperCase()}\n👀 Seen: ${user.settings.statusview}\n❤️ Random reaction: ${user.settings.autoreact}`);
   return true
 }

 if(command==="setdelay"){
   const n=Number(args[0]);
   if(!Number.isFinite(n)){await send(`Use: ${PREFIX}setdelay 0-60`);return true}
   user.settings.statusDelayMs=Math.max(0,Math.min(60,n))*1000;
   await save();await send(`⏱️ Delay: ${n}s`);return true
 }

 if(command==="setreact"){
   const value=arg.trim();
   if(!value || value.toLowerCase()==="random" || value.toLowerCase()==="off"){
     user.settings.fixedreact=null;
     await save();await send(`🔀 Reaction: RANDOM (${reacts.length}+ positive emojis)`);return true
   }
   user.settings.fixedreact=value;
   await save();await send(`📌 Fixed reaction: ${value}`);return true
 }

 if(["tagall","hidetag"].includes(command)){
   if(!from.endsWith("@g.us")){await send("❌ Group only");return true}
   const m=await groupMeta(from),ms=m.participants.map(x=>x.id),body=command==="tagall"?`📢 ${ms.map(x=>"@"+num(x)).join(" ")}`:(arg||"📢");
   await sock.sendMessage(from,{text:body,mentions:ms},{quoted:msg});return true
 }
 if(command==="admins"){
   if(!from.endsWith("@g.us")){await send("❌ Group only");return true}
   const m=await groupMeta(from),ms=m.participants.filter(x=>x.admin),ids=ms.map(x=>x.id);
   await sock.sendMessage(from,{text:"👮 ADMINS\n"+ids.map(x=>"@"+num(x)).join("\n"),mentions:ids},{quoted:msg});return true
 }
 if(command==="ginfo"){
   if(!from.endsWith("@g.us")){await send("❌ Group only");return true}
   const m=await groupMeta(from);await send(`👥 ${m.subject}\n👤 Members: ${m.participants.length}\n🆔 ${from}`);return true
 }
 if(command==="tiny"){await send(tiny(arg)||`Use: ${PREFIX}tiny text`);return true}
 if(command==="circle"){await send(circle(arg)||`Use: ${PREFIX}circle text`);return true}
 if(command==="gothic"){await send(gothic(arg)||`Use: ${PREFIX}gothic text`);return true}
 if(command==="reverse"){await send([...arg].reverse().join("")||`Use: ${PREFIX}reverse text`);return true}
 if(command==="addcmd"){
   if(!owner(sender)){await send("❌ Owner only");return true}
   const n=(args.shift()||"").toLowerCase().replace(/[^a-z0-9_]/g,"");
   if(!n||!args.length){await send(`Use: ${PREFIX}addcmd name reply`);return true}
   user.customCommands[n]=args.join(" ");await save();await send(`✅ ${PREFIX}${n} added`);return true
 }
 if(command==="delcmd"){
   if(!owner(sender)){await send("❌ Owner only");return true}
   delete user.customCommands[(args[0]||"").toLowerCase()];await save();await send("✅ Deleted");return true
 }
 if(command==="cmds"){await send("🧰 Custom:\n"+(Object.keys(user.customCommands).map(x=>PREFIX+x).join("\n")||"None"));return true}
 if(["video","yt","audio"].includes(command)){
   if(!/^https?:\/\//i.test(arg)){await send(`Use: ${PREFIX}${command} <url>`);return true}
   const dir=path.join(process.cwd(),"data","downloads");fs.mkdirSync(dir,{recursive:true});
   const audio=command==="audio",out=path.join(dir,Date.now()+"."+(audio?"mp3":"mp4"));
   try{
     await send("⏳ Downloading…");await ytdlp(arg,audio?"audio":"video",out);
     const max=Number(process.env.MAX_VIDEO_MB||45)*1048576;
     if(fs.statSync(out).size>max)throw Error("large");
     if(audio)await sock.sendMessage(from,{audio:fs.readFileSync(out),mimetype:"audio/mpeg"},{quoted:msg});
     else await sock.sendMessage(from,{video:fs.readFileSync(out),mimetype:"video/mp4",caption:"🎬 SAMAR-MD"},{quoted:msg})
   }catch{await send("❌ Download failed or source is unavailable/too large.")}
   finally{try{fs.unlinkSync(out)}catch{}}
   return true
 }
 return false
}

module.exports={handle,text,unwrap,randomReactions,reacts};
