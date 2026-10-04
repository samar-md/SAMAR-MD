require("dotenv").config();
const express=require("express"),cors=require("cors"),path=require("path"),fs=require("fs"),pino=require("pino");
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason,Browsers}=require("@whiskeysockets/baileys");
const {Boom}=require("@hapi/boom"),{handle}=require("./commands");
const app=express(),PORT=Number(process.env.PORT||3000),ROOT=process.cwd(),SESS=path.join(ROOT,"sessions"),DATA=path.join(ROOT,"data"),UF=path.join(DATA,"users.json");
fs.mkdirSync(SESS,{recursive:true});fs.mkdirSync(DATA,{recursive:true});
let users={};try{users=JSON.parse(fs.readFileSync(UF,"utf8"))}catch{}
const sockets=new Map(),pairing=new Map();
const REACTIONS=["❤️","🩷","🧡","💛","💚","🩵","💙","💜","🤎","🖤","🩶","🤍","💖","💗","💓","💞","💕","💘","💝","💟","❣️","💌","❤️‍🔥","❤️‍🩹","😍","🥰","😘","😻","🤩","😊","☺️","😇","🥹","😂","🤣","😄","😁","😆","😅","🙂","🙃","😉","😌","🤗","🤭","😎","🥳","🤠","🫶","👍","👏","🙌","🙏","💪","🤝","👌","✌️","🤞","🫰","🤟","✨","🌟","⭐","💫","🔥","💯","🎉","🎊","🎁","🏆","🥇","🚀","🌈","☀️","🌸","🌹","🌺","🌻","🌷","🍀","🌿","💎","👑","🕊️","☮️"];
const clean=x=>String(x||"").replace(/\D/g,"").replace(/^00/,"");
const getUser=p=>users[p]||(users[p]={phone:p,connected:false,settings:{autoread:true,autoreact:true,statusview:true,statusDelayMs:3000,fixedreact:null,autotyping:false,welcome:true,goodbye:true,antilink:false},customCommands:{}});
const save=()=>fs.writeFileSync(UF,JSON.stringify(users,null,2));
async function start(phone,pair=false){
 phone=clean(phone);if(sockets.has(phone))return sockets.get(phone);
 const u=getUser(phone),folder=path.join(SESS,phone);fs.mkdirSync(folder,{recursive:true});
 const {state,saveCreds}=await useMultiFileAuthState(folder);
 const sock=makeWASocket({auth:state,logger:pino({level:"silent"}),browser:Browsers.windows("Chrome"),markOnlineOnConnect:false,syncFullHistory:false});
 sockets.set(phone,sock);sock.ev.on("creds.update",saveCreds);
 sock.ev.on("connection.update",({connection,lastDisconnect})=>{
  if(connection==="open"){u.connected=true;save();console.log(`[${phone}] CONNECTED`)}
  if(connection==="close"){u.connected=false;save();sockets.delete(phone);const c=new Boom(lastDisconnect?.error)?.output?.statusCode;if(c!==DisconnectReason.loggedOut)setTimeout(()=>start(phone).catch(console.error),4000)}
 });
 sock.ev.on("messages.upsert",async({messages})=>{for(const msg of messages){try{if(!msg?.message)continue;const j=msg.key?.remoteJid;if(!j||j==="status@broadcast")continue;if(u.settings.autoread&&!msg.key.fromMe)try{await sock.readMessages([msg.key])}catch{}await handle({sock,msg,user:u,save,groupMeta:j=>sock.groupMetadata(j)})}catch(e){console.error("message",e.stack||e.message)}}});
 sock.ev.on("messages.upsert",async({messages})=>{if(!u.settings.statusview&&!u.settings.autoreact)return;for(const msg of messages){const key=msg?.key;if(key?.remoteJid!=="status@broadcast")continue;const p=key.participant||key.participantAlt;if(!p)continue;const d=Math.max(0,Math.min(60000,Number(u.settings.statusDelayMs)||0));if(u.settings.statusview)setTimeout(()=>sock.readMessages([key]).catch(e=>console.error("status read",e.message)),d);if(u.settings.autoreact){const em=u.settings.fixedreact||REACTIONS[Math.floor(Math.random()*REACTIONS.length)];setTimeout(()=>sock.sendMessage("status@broadcast",{react:{text:em,key}},{statusJidList:[p]}).then(()=>console.log(`[${phone}] reacted ${em}`)).catch(e=>console.error("status react",e.message)),d)}}});
 if(pair&&!state.creds.registered&&!pairing.has(phone)){pairing.set(phone,1);setTimeout(async()=>{try{global.pairingCodes||={};global.pairingCodes[phone]=await sock.requestPairingCode(phone)}catch(e){console.error("pair",e.message)}finally{pairing.delete(phone)}},1800)}
 return sock;
}
app.use(cors());app.use(express.json());app.use(express.static(path.join(ROOT,"public")));
app.get("/api/health",(q,r)=>r.json({ok:true,bot:process.env.BOT_NAME||"SAMAR-MD",team:process.env.TEAM_NAME||"The-RUDE-x Cyber Team",sessions:Object.keys(users).length,connected:Object.values(users).filter(x=>x.connected).length,uptime:Math.floor(process.uptime())}));
app.post("/api/pair",async(q,r)=>{const p=clean(q.body?.phone);if(!/^\d{10,15}$/.test(p))return r.status(400).json({ok:false,message:"Use international digits only."});try{if(getUser(p).connected)return r.json({ok:true,connected:true});await start(p,true);r.json({ok:true,pending:true})}catch(e){r.status(500).json({ok:false,message:e.message})}});
app.get("/api/pair/:phone",(q,r)=>{const p=clean(q.params.phone);if(users[p]?.connected)return r.json({ok:true,connected:true});const c=global.pairingCodes?.[p];r.json(c?{ok:true,code:String(c).match(/.{1,4}/g)?.join("-")}:{ok:false,pending:true})});
app.get("/api/user/:phone",(q,r)=>{const u=getUser(clean(q.params.phone));r.json({phone:u.phone,connected:u.connected,settings:u.settings,customCommands:Object.keys(u.customCommands)})});
app.patch("/api/user/:phone/settings",(q,r)=>{const u=getUser(clean(q.params.phone));for(const k of ["autoread","autoreact","statusview","autotyping","welcome","goodbye","antilink"])if(typeof q.body?.[k]==="boolean")u.settings[k]=q.body[k];save();r.json({ok:true,settings:u.settings})});
app.get("/api/reactions",(q,r)=>r.json({ok:true,reactions:REACTIONS}));
app.get("*",(q,r)=>r.sendFile(path.join(ROOT,"public","index.html")));
app.listen(PORT,()=>{console.log(`SAMAR-MD dashboard on ${PORT}`);for(const p of Object.keys(users))start(p).catch(e=>console.error(p,e.message))});
