// ============================================================
// PULSESHIP — chat.js  v9
// ============================================================

let ME=null, activeUser=null, activeGroup=null, stalkedUserId=null;
let privateSub=null, groupSub=null, incomingDMSub=null, presenceCh=null;
let unreadCount=0, editAvatarSeed=null, editAvatarStyle=null, editTypesArr=[];
let pwaPrompt=null, postImageFile=null, ctxMsgId=null, ctxMsgTable=null, ctxMsgOwn=false;
let typingCh=null, typingTimeout=null;
let leaderboardTimer=null, anonMatchId=null, anonSlot=null, anonTimer=null;
let anonSub=null, anonQueueSub=null, anonHeartShown=false, myHeartPressed=false, anonMatchesLeft=10;
let qrInstance=null, html5QrScanner=null, tradeImageFile=null;
let calcValue='0', calcPrev='', calcOp='', calcReset=false, tlTimer=null;
// Draw Battle solo
let soloCanvas=null, soloCtx=null, drawIsDrawing=false;
let drawColor='#7b6ef6', drawSize=5, drawEraser=false, drawFsMode=false;
let currentDrawPrompt='', currentDrawCategory='';
// Draw detail / rating
let viewingDrawId=null, myRatingForDraw=0;
const DRAW_COLORS=['#7b6ef6','#f43f5e','#22d47a','#f59e0b','#3b82f6','#ec4899','#000000','#ffffff','#ff7f00','#00e5ff'];
const DRAW_PROMPTS={
  'Animals':    ['Dog','Cat','Elephant','Giraffe','Lion','Penguin','Octopus','Horse','Bear','Owl','Shark','Butterfly','Frog','Parrot','Wolf'],
  'Characters': ['Spider-Man','Hulk','Iron Man','Batman','Pikachu','Naruto','Luffy','Goku','Elsa','Shrek','Mario','Minion','Snorlax','Deadpool','Thor'],
  'Food':       ['Pizza','Sushi','Burger','Ramen','Taco','Ice cream','Donut','Cake','Boba','Hotdog','Pasta','Dumpling','Pancake','Waffle','Croissant'],
  'Objects':    ['Guitar','Rocket','Bicycle','Umbrella','Camera','Telescope','Lantern','Compass','Anchor','Trophy','Hourglass','Microscope','Sword','Clock','Backpack'],
  'Places':     ['Beach','Mountain','Castle','Lighthouse','Library','Treehouse','Volcano','Waterfall','City skyline','Farm','Desert oasis','Pirate ship','Jungle'],
  'Vehicles':   ['Race car','Spaceship','Submarine','Hot air balloon','Skateboard','Helicopter','Train','Sailboat','Motorbike','Fire truck'],
};
const PROMPT_CATS=Object.keys(DRAW_PROMPTS);

// ── Viewport ──────────────────────────────────────────────────
(function(){function s(){const h=window.visualViewport?window.visualViewport.height:window.innerHeight;document.documentElement.style.setProperty('--vh',h+'px');}s();if(window.visualViewport)window.visualViewport.addEventListener('resize',s);window.addEventListener('resize',s);})();

// ── Theme ─────────────────────────────────────────────────────
function applyGlobalTheme(){
  const t=localStorage.getItem('ps-theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  const icon=document.getElementById('sl-theme-icon'),lbl=document.getElementById('sl-theme-label');
  if(icon&&t==='dark') icon.innerHTML='<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  else if(icon) icon.innerHTML='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  if(lbl) lbl.textContent=t==='dark'?'Switch to Light Mode':'Switch to Dark Mode';
}
function toggleTheme(){const cur=document.documentElement.getAttribute('data-theme')||'dark';localStorage.setItem('ps-theme',cur==='dark'?'light':'dark');applyGlobalTheme();}
applyGlobalTheme();

// ── PWA ──────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pwaPrompt=e;const b=document.getElementById('pwa-install-btn');if(b)b.style.display='';});
function installPWA(){if(pwaPrompt){pwaPrompt.prompt();pwaPrompt=null;const b=document.getElementById('pwa-install-btn');if(b)b.style.display='none';}}
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(reg=>{
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='open-chat')switchPanel('chats');});
}).catch(()=>{});

// ── INIT ─────────────────────────────────────────────────────
(async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(!session) return redirect();
  const{data:p}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(!p) return redirect();
  ME=p;
  initUI();
  initPresence();
  cleanupWorld();
  loadWorldChat();
  loadConversations();
  loadGroups();
  loadProfilePanel();
  loadMyPosts();
  subscribeIncomingDMs();
  pingLeaderboard();
  leaderboardTimer=setInterval(pingLeaderboard,60000);
  checkAnonDaily();
})();
function redirect(){window.location.href='index.html';}

function initUI(){
  const av=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);
  document.getElementById('nav-avatar').src=av;
  // Keyboard handlers
  ['world-input','thread-input','group-input'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();id==='world-input'?sendWorld():id==='thread-input'?sendPrivate():sendGroup();}else if(id==='thread-input')sendTyping();});
  });
  document.getElementById('anon-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAnon();}});
  document.getElementById('add-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')searchByCode();});
  document.addEventListener('click',e=>{
    if(!e.target.closest('#dot-menu')&&e.target.id!=='dot-btn') document.getElementById('dot-menu').style.display='none';
    if(!e.target.closest('.ctx-menu')) document.getElementById('ctx-menu').style.display='none';
  });
}

// ── Push notifications ────────────────────────────────────────
async function requestNotifPermission(){
  const btn=document.getElementById('notif-btn'),status=document.getElementById('notif-status');
  if(!('Notification' in window)){if(status)status.textContent='Not supported on this browser.';return;}
  const p=await Notification.requestPermission();
  if(status) status.textContent=p==='granted'?'Notifications enabled!':p==='denied'?'Blocked — enable in browser settings':'Not enabled';
  if(btn) btn.style.display=p==='granted'?'none':'';
}
function updateNotifStatus(){
  const status=document.getElementById('notif-status'),btn=document.getElementById('notif-btn');
  if(!status)return;
  if(!('Notification' in window)){status.textContent='Not supported.';if(btn)btn.style.display='none';return;}
  const p=Notification.permission;
  status.textContent=p==='granted'?'Notifications are enabled':p==='denied'?'Blocked — enable in browser settings':'Not yet enabled';
  if(btn) btn.style.display=p==='granted'?'none':'';
}
function pushNotif(title,body){
  if(Notification.permission!=='granted'||document.hasFocus()) return;
  new Notification(title,{body,icon:'icon-192.png'});
}

// ── Panel switching ───────────────────────────────────────────
function switchPanel(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`${name}-panel`)?.classList.add('active');
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  if(name==='chats'){unreadCount=0;updateDMBadge();}
  if(name==='games'){showGamesHome();}
  if(name==='profile'){loadProfilePanel();}
}
function updateDMBadge(){const b=document.getElementById('dm-badge');if(!b)return;b.style.display=unreadCount>0?'':(b.style.display='none','none');b.textContent=unreadCount>9?'9+':unreadCount;}

// ── Chats sub-tabs ─────────────────────────────────────────────
function switchChatsTab(tab){
  document.querySelectorAll('.ctab[data-ctab]').forEach(b=>b.classList.toggle('active',b.dataset.ctab===tab));
  document.querySelectorAll('.chats-sub').forEach(s=>s.classList.toggle('active',s.id===`chats-${tab}-sub`));
  const add=document.getElementById('act-add'),grp=document.getElementById('act-grp');
  if(add)add.style.display=tab==='dm'?'flex':'none';
  if(grp)grp.style.display=tab==='groups'?'flex':'none';
  if(tab==='groups')loadGroups();
}

// ── Presence ──────────────────────────────────────────────────
function initPresence(){
  presenceCh=sb.channel('ps-presence',{config:{presence:{key:ME.id}}});
  presenceCh.on('presence',{event:'sync'},()=>{const n=Object.keys(presenceCh.presenceState()).length;const el=document.getElementById('online-label');if(el)el.textContent=n+' online';}).subscribe(async s=>{if(s==='SUBSCRIBED')await presenceCh.track({userId:ME.id});});
}

// ── Leaderboard ───────────────────────────────────────────────
async function pingLeaderboard(){
  const{data:ex}=await sb.from('leaderboard').select('score').eq('user_id',ME.id).maybeSingle();
  await sb.from('leaderboard').upsert({user_id:ME.id,user_name:displayName(ME),score:(ex?.score||0)+60,updated_at:new Date().toISOString()});
}

// ── World chat ────────────────────────────────────────────────
async function cleanupWorld(){await sb.rpc('cleanup_world_messages').catch(()=>{});}
async function loadWorldChat(){
  const{data}=await sb.from('world_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)').order('created_at',{ascending:true}).limit(120);
  const area=document.getElementById('world-msgs');area.innerHTML='';
  (data||[]).forEach(m=>appendWorldMsg(m));scrollBottom(area);
  sb.channel('world-rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'world_messages'},async pl=>{
    const{data:full}=await sb.from('world_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)').eq('id',pl.new.id).single();
    if(full){appendWorldMsg(full);scrollBottom(document.getElementById('world-msgs'));}
  }).subscribe();
}
function appendWorldMsg(msg){
  const area=document.getElementById('world-msgs');
  const p=msg.profiles||{},isMine=msg.user_id===ME.id;
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url),border=p.border_style||'none';
  let bubble='';
  if(msg.content)bubble+=`<div class="msg-text">${linkify(msg.content)}</div>`;
  if(msg.image_url)bubble+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;
  const el=document.createElement('div');el.className=`msg${isMine?' mine':''}`;el.dataset.id=msg.id;el.dataset.table='world_messages';
  el.innerHTML=`<div class="msg-av-wrap" onclick="openProfileModal('${msg.user_id}')"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div><div class="msg-body"><div class="msg-meta"><span class="msg-name" onclick="openProfileModal('${msg.user_id}')">${isMine?'You':escHtml(displayName(p))}</span>${renderBadge(p.badge)}<span>${timeAgo(msg.created_at)}</span></div><div class="msg-bubble border-bubble-${border}">${bubble}</div></div>`;
  addMsgCtx(el,msg.id,'world_messages',msg.user_id===ME.id);
  area.appendChild(el);
}
async function sendWorld(){const inp=document.getElementById('world-input'),txt=inp.value.trim();if(!txt)return;inp.value='';await sb.from('world_messages').insert({user_id:ME.id,content:txt});}
async function uploadWorldImage(input){const file=input.files[0];if(!file)return;const path=`${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);await sb.from('world_messages').insert({user_id:ME.id,image_url:publicUrl});input.value='';}

// ── Context menu ──────────────────────────────────────────────
function addMsgCtx(el,msgId,table,isOwn){
  const show=e=>{ctxMsgId=msgId;ctxMsgTable=table;ctxMsgOwn=isOwn;const m=document.getElementById('ctx-menu');m.style.display='block';m.style.left=Math.min(e.clientX||e.pageX,window.innerWidth-160)+'px';m.style.top=Math.min(e.clientY||e.pageY,window.innerHeight-80)+'px';const btn=document.getElementById('ctx-delete-btn');if(btn)btn.childNodes[2].textContent=isOwn?' Delete for everyone':' Delete for me';};
  el.addEventListener('contextmenu',e=>{e.preventDefault();show(e);});
  let t;el.addEventListener('touchstart',e=>{t=setTimeout(()=>show(e.touches[0]),600);},{passive:true});el.addEventListener('touchend',()=>clearTimeout(t));
}
async function deleteCtxMsg(){
  document.getElementById('ctx-menu').style.display='none';if(!ctxMsgId)return;
  if(ctxMsgOwn)await sb.from(ctxMsgTable).delete().eq('id',ctxMsgId);
  else if(ctxMsgTable==='private_messages'){const{data:m}=await sb.from('private_messages').select('deleted_by').eq('id',ctxMsgId).single();await sb.from('private_messages').update({deleted_by:[...(m?.deleted_by||[]),ME.id]}).eq('id',ctxMsgId);}
  document.querySelector(`[data-id="${ctxMsgId}"]`)?.remove();
}

// ── Incoming DMs ──────────────────────────────────────────────
function subscribeIncomingDMs(){
  incomingDMSub=sb.channel(`incoming-${ME.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:`receiver_id=eq.${ME.id}`},async pl=>{
    const sid=pl.new.sender_id;
    const ex=document.querySelector(`.convo-item[data-uid="${sid}"]`);
    if(!ex){const{data:p}=await sb.from('profiles').select('*').eq('id',sid).single();if(p)prependConvoItem(p,pl.new.content||'Image',false);}
    else{ex.querySelector('.convo-preview').textContent=pl.new.content||'Image';const list=document.getElementById('convo-list');if(list.firstChild!==ex)list.insertBefore(ex,list.firstChild);}
    if(activeUser!==sid){unreadCount++;updateDMBadge();const{data:p}=await sb.from('profiles').select('name,surname').eq('id',sid).single();pushNotif(`New message from ${p?displayName(p):'Someone'}`,pl.new.content||'Image');}
    else{appendPrivateMsg(pl.new);scrollBottom(document.getElementById('thread-msgs'));markSeen(pl.new.id);}
  }).subscribe();
}

// ── Typing ────────────────────────────────────────────────────
function sendTyping(){if(!activeUser||!typingCh)return;typingCh.send({type:'broadcast',event:'typing',payload:{userId:ME.id}});}
function subscribeTyping(userId){if(typingCh)sb.removeChannel(typingCh);const ch=[ME.id,userId].sort().join('-');typingCh=sb.channel(`typ-${ch}`).on('broadcast',{event:'typing'},()=>{const el=document.getElementById('thread-typing');if(el){el.textContent='typing…';clearTimeout(typingTimeout);typingTimeout=setTimeout(()=>{if(el)el.textContent='';},2000);}}).subscribe();}

// ── Seen ──────────────────────────────────────────────────────
async function markSeen(msgId){await sb.from('private_messages').update({is_read:true,seen_at:new Date().toISOString()}).eq('id',msgId);}
function showSeenBar(seenAt){const bar=document.getElementById('seen-indicator');if(!bar)return;if(seenAt){bar.style.display='';bar.textContent=`✓✓ Seen ${fmtTime(seenAt)}`;}else bar.style.display='none';}

// ── Conversations ─────────────────────────────────────────────
async function loadConversations(){
  const{data:msgs}=await sb.from('private_messages').select('sender_id,receiver_id,content,created_at').or(`sender_id.eq.${ME.id},receiver_id.eq.${ME.id}`).order('created_at',{ascending:false});
  const list=document.getElementById('convo-list');
  if(!msgs?.length){list.innerHTML='<div class="convo-empty">No chats yet.<br>Tap + to add!</div>';return;}
  const seen=new Set(),ids=[],previews={};
  msgs.forEach(m=>{const pid=m.sender_id===ME.id?m.receiver_id:m.sender_id;if(!seen.has(pid)){seen.add(pid);ids.push(pid);previews[pid]=m.content||'Image';}});
  const{data:profiles}=await sb.from('profiles').select('*').in('id',ids);
  list.innerHTML='';
  ids.map(id=>profiles?.find(p=>p.id===id)).filter(Boolean).forEach(p=>prependConvoItem(p,previews[p.id],true));
}
function prependConvoItem(p,preview,append=false){
  const list=document.getElementById('convo-list');
  if(list.querySelector(`.convo-item[data-uid="${p.id}"]`)){list.querySelector(`.convo-item[data-uid="${p.id}"] .convo-preview`).textContent=preview||'';return;}
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);
  const el=document.createElement('div');el.className='convo-item';el.dataset.uid=p.id;
  el.onclick=()=>openThread(p.id,displayName(p),p.avatar_seed,p.avatar_style,p.avatar_url);
  el.innerHTML=`<div class="convo-av"><img src="${av}" loading="lazy"></div><div class="convo-info"><div class="convo-name">${escHtml(displayName(p))}</div><div class="convo-preview">${escHtml(preview||'')}</div></div>`;
  if(append)list.appendChild(el);else{if(list.querySelector('.convo-empty'))list.innerHTML='';if(list.firstChild)list.insertBefore(el,list.firstChild);else list.appendChild(el);}
}
function filterConvos(q){document.querySelectorAll('#convo-list .convo-item').forEach(el=>{el.style.display=el.querySelector('.convo-name')?.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';});}

// ── Thread ────────────────────────────────────────────────────
async function openThread(userId,name,seed,style,avatarUrl){
  activeUser=userId;
  document.getElementById('thread-panel').classList.add('active');
  document.getElementById('thread-typing').textContent='';
  document.getElementById('thread-av').src=getAvatar(seed,style,avatarUrl);
  document.getElementById('thread-name').textContent=name;
  document.querySelectorAll('.convo-item').forEach(el=>el.classList.remove('active'));
  document.querySelector(`.convo-item[data-uid="${userId}"]`)?.classList.add('active');
  const theme=getThemeForContact(userId);applyCtTheme(theme,false);
  subscribeTyping(userId);
  const area=document.getElementById('thread-msgs');area.innerHTML='<div class="spinner"></div>';
  const{data}=await sb.from('private_messages').select('*').or(`and(sender_id.eq.${ME.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${ME.id})`).order('created_at',{ascending:true}).limit(150);
  area.innerHTML='';
  (data||[]).forEach(m=>{if(!m.deleted_by?.includes(ME.id))appendPrivateMsg(m);});
  scrollBottom(area);
  const last=[...(data||[])].reverse().find(m=>m.sender_id===ME.id&&m.seen_at);showSeenBar(last?.seen_at);
  for(const m of (data||[]).filter(m=>m.sender_id===userId&&!m.is_read))await markSeen(m.id);
}
function closeThread(){document.getElementById('thread-panel').classList.remove('active');activeUser=null;if(typingCh)sb.removeChannel(typingCh);}

// ── Chat theme ────────────────────────────────────────────────
function applyCtTheme(theme,save=true){
  if(save&&activeUser)setThemeForContact(activeUser,theme);
  const t=CHAT_THEMES[theme]||CHAT_THEMES.default;
  const area=document.getElementById('thread-msgs');
  if(area)area.style.background=t.bg||'';
  document.documentElement.style.setProperty('--ct-bubble',t.bubble);
  document.querySelectorAll('.ct-dot').forEach(d=>d.classList.toggle('active',d.dataset.t===theme));
}
window.applyCtTheme=applyCtTheme;

// ── Private messages ──────────────────────────────────────────
function appendPrivateMsg(msg){
  const area=document.getElementById('thread-msgs'),isMine=msg.sender_id===ME.id;
  const isPoll=msg.content?.startsWith('📊 Poll:'), isTrade=msg.content?.startsWith('🤝 Trade Offer'), isLoc=msg.content?.startsWith('📍 Location:');
  let inner='';
  if(isPoll)inner=renderPollCard(msg.content);
  else if(isTrade)inner=renderTradeCard(msg.content,msg.image_url);
  else if(isLoc)inner=renderLocationCard(msg.content);
  else{let b='';if(msg.content)b+=`<div class="msg-text">${linkify(msg.content)}</div>`;if(msg.image_url)b+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;inner=`<div class="msg-bubble" style="${isMine?`background:var(--ct-bubble);border-color:var(--ct-bubble);color:#fff`:'background:var(--sur2);border:1px solid var(--border)'}">${b}</div>`;}
  const el=document.createElement('div');el.className=`msg${isMine?' mine':''}${(isPoll||isTrade||isLoc)?' msg-card-wrap':''}`;el.dataset.id=msg.id;el.dataset.table='private_messages';
  el.innerHTML=`<div class="msg-body" style="max-width:${isPoll||isTrade?'94':'82'}%"><div class="msg-meta"><span>${timeAgo(msg.created_at)}</span></div>${inner}</div>`;
  addMsgCtx(el,msg.id,'private_messages',isMine);area.appendChild(el);
}
function renderPollCard(content){const lines=content.split('\n'),q=lines[0].replace('📊 Poll: ','');const optHtml=lines.slice(1).filter(Boolean).map(l=>`<div class="poll-option"><div class="poll-option-bar"><div class="poll-fill"></div></div><span class="poll-option-label">${escHtml(l)}</span></div>`).join('');return `<div class="poll-card-standalone"><div class="poll-card-hdr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> Poll</div><div class="poll-card-q">${escHtml(q)}</div><div class="poll-options">${optHtml}</div></div>`;}
function renderTradeCard(content,imageUrl){const lines=content.split('\n');const offer=lines.find(l=>l.startsWith('Offer: '))?.replace('Offer: ','')||'?',want=lines.find(l=>l.startsWith('Want: '))?.replace('Want: ','')||'?',note=lines.find(l=>l.startsWith('Note: '))?.replace('Note: ','')||'';return `<div class="trade-card-standalone">${imageUrl?`<img class="trade-card-img" src="${escHtml(imageUrl)}" onclick="openImgFull(this.src)" loading="lazy">`:''}<div class="trade-card-hdr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Trade Offer</div><div class="trade-card-cols"><div class="trade-card-col"><div class="trade-card-lbl">I Offer</div><div class="trade-card-val">${escHtml(offer)}</div></div><div class="trade-card-div">⇄</div><div class="trade-card-col"><div class="trade-card-lbl">I Want</div><div class="trade-card-val">${escHtml(want)}</div></div></div>${note?`<div class="trade-card-note">Note: ${escHtml(note)}</div>`:''}</div>`;}
function renderLocationCard(content){const url=content.replace('📍 Location: ','');const coords=url.split('?q=')[1]||'';const[lat,lng]=(coords.split(','));const mapImg=lat&&lng?`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=300x140&markers=${lat},${lng}&format=png`:'';return `<div class="loc-card-standalone"><div class="loc-card-hdr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Location</div>${mapImg?`<img class="loc-map-img" src="${escHtml(mapImg)}" loading="lazy" alt="Map">`:''}<div class="loc-card-foot"><a href="${escHtml(url)}" target="_blank" rel="noopener" class="btn-accent-sm">Open in Maps</a></div></div>`;}

async function sendPrivate(){
  if(!activeUser)return;const inp=document.getElementById('thread-input'),txt=inp.value.trim();if(!txt)return;inp.value='';
  const{data}=await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:txt}).select().single();
  if(data){appendPrivateMsg(data);scrollBottom(document.getElementById('thread-msgs'));showSeenBar(null);const prev=document.querySelector(`.convo-item[data-uid="${activeUser}"] .convo-preview`);if(prev)prev.textContent=txt;}
}
async function uploadPmImage(input){if(!activeUser)return;const file=input.files[0];if(!file)return;const path=`pm/${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);const{data}=await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,image_url:publicUrl}).select().single();if(data){appendPrivateMsg(data);scrollBottom(document.getElementById('thread-msgs'));}input.value='';}

function toggleDotMenu(){const m=document.getElementById('dot-menu');m.style.display=m.style.display==='none'?'':'none';}
function openPoll(){document.getElementById('dot-menu').style.display='none';document.getElementById('poll-question').value='';[...document.querySelectorAll('.poll-opt')].forEach((o,i)=>{if(i>1)o.closest('.form-group').remove();else o.value='';});document.getElementById('poll-modal').style.display='flex';}
function addPollOption(){const wrap=document.getElementById('poll-options-wrap'),c=wrap.querySelectorAll('.poll-opt').length+1;if(c>5)return;const d=document.createElement('div');d.className='form-group';d.innerHTML=`<label>Option ${c}</label><input type="text" class="poll-opt" placeholder="Option ${c}" maxlength="100">`;wrap.appendChild(d);}
async function submitPoll(){if(!activeUser)return;const q=document.getElementById('poll-question').value.trim(),opts=[...document.querySelectorAll('.poll-opt')].map(i=>i.value.trim()).filter(Boolean);if(!q)return alert('Question required.');if(opts.length<2)return alert('Need 2+ options.');document.getElementById('poll-modal').style.display='none';await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`📊 Poll: ${q}\n${opts.map((o,i)=>`${i+1}. ${o}`).join('\n')}`});}

function setTradeImage(input){tradeImageFile=input.files[0];document.getElementById('trade-img-name').textContent=tradeImageFile?tradeImageFile.name:'Choose image…';}
function openTradeModal(){document.getElementById('dot-menu').style.display='none';if(!activeUser)return;document.getElementById('trade-to-label').textContent=`To: ${document.getElementById('thread-name').textContent}`;document.getElementById('trade-offer').value='';document.getElementById('trade-want').value='';document.getElementById('trade-note').value='';tradeImageFile=null;document.getElementById('trade-img-name').textContent='Choose image…';document.getElementById('trade-modal').style.display='flex';}
async function sendTrade(){if(!activeUser)return;const offer=document.getElementById('trade-offer').value.trim(),want=document.getElementById('trade-want').value.trim(),note=document.getElementById('trade-note').value.trim();if(!offer||!want)return alert('Fill both fields.');let imageUrl=null;if(tradeImageFile){const path=`trade/${ME.id}/${Date.now()}-${tradeImageFile.name}`;await sb.storage.from('chat-images').upload(path,tradeImageFile);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);imageUrl=publicUrl;}document.getElementById('trade-modal').style.display='none';await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`🤝 Trade Offer\nOffer: ${offer}\nWant: ${want}${note?'\nNote: '+note:''}`,image_url:imageUrl||undefined});}

function sendLocation(){document.getElementById('dot-menu').style.display='none';if(!activeUser)return;if(!navigator.geolocation)return alert('Not supported.');navigator.geolocation.getCurrentPosition(async pos=>{const{latitude:lat,longitude:lng}=pos.coords;await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`📍 Location: https://www.google.com/maps?q=${lat},${lng}`});},()=>alert('Location denied.'));}

// ── Add contact / QR ──────────────────────────────────────────
function openAddModal(){document.getElementById('add-modal').style.display='flex';document.getElementById('add-code-input').value='';document.getElementById('add-result').innerHTML='';setTimeout(()=>document.getElementById('add-code-input').focus(),100);}
function closeAddModal(){document.getElementById('add-modal').style.display='none';stopQRScanner();}
function switchAddTab(tab){document.querySelectorAll('#add-modal .ctab').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase().includes(tab==='code'?'code':'scan')));document.getElementById('add-tab-code').style.display=tab==='code'?'':'none';document.getElementById('add-tab-scan').style.display=tab==='scan'?'':'none';if(tab==='scan')startQRScanner();else stopQRScanner();}
function startQRScanner(){if(html5QrScanner)return;html5QrScanner=new Html5Qrcode('qr-reader');html5QrScanner.start({facingMode:'environment'},{fps:10,qrbox:200},code=>{stopQRScanner();const match=code.match(/(\d{6})/);if(match){document.getElementById('add-code-input').value=match[1];switchAddTab('code');searchByCode();}else document.getElementById('qr-scan-result').textContent='Invalid QR.';}).catch(()=>{document.getElementById('qr-scan-result').textContent='Camera access denied.';});}
function stopQRScanner(){if(html5QrScanner){html5QrScanner.stop().catch(()=>{});html5QrScanner=null;}}
async function searchByCode(){const raw=document.getElementById('add-code-input').value.trim().replace('#',''),code=raw.padStart(6,'0'),res=document.getElementById('add-result');if(!raw){res.innerHTML='<div class="search-err">Enter a code.</div>';return;}res.innerHTML='<div class="spinner" style="margin:10px auto"></div>';const{data}=await sb.from('profiles').select('*').eq('user_code',code).maybeSingle();if(!data){res.innerHTML=`<div class="search-err">No user #${code}</div>`;return;}if(data.id===ME.id){res.innerHTML='<div class="search-err">That\'s you!</div>';return;}res.innerHTML=`<div class="search-result-card"><img src="${getAvatar(data.avatar_seed,data.avatar_style,data.avatar_url)}" class="src-av"><div class="src-info"><div class="src-name">${escHtml(displayName(data))}</div><div class="src-code">#${data.user_code}</div></div><button class="btn-sm" onclick="startChatFromSearch('${data.id}','${escAttr(displayName(data))}','${escAttr(data.avatar_seed)}','${escAttr(data.avatar_style)}','${escAttr(data.avatar_url||'')}')">Chat</button></div>`;}
async function startChatFromSearch(uid,name,seed,style,url){closeAddModal();switchPanel('chats');await openThread(uid,name,seed,style,url||null);}

// ── Profile stalk modal ───────────────────────────────────────
async function openProfileModal(userId){
  if(!userId)return;
  if(userId===ME.id){switchPanel('profile');return;}
  stalkedUserId=userId;
  const{data:p}=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();if(!p)return;
  document.getElementById('sm-border-ring').className=`avatar-border-ring sm-border-ring border-ring-${p.border_style||'none'}`;
  document.getElementById('sm-avatar').src=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);
  document.getElementById('sm-code').textContent=`#${p.user_code||'------'}`;
  document.getElementById('sm-name').textContent=displayName(p);
  document.getElementById('sm-badge').innerHTML=renderBadge(p.badge);
  document.getElementById('sm-bio').innerHTML=p.bio?linkify(p.bio):'';
  document.getElementById('sm-types').innerHTML=renderTypeTags(p.user_types||[]);
  const{data:posts}=await sb.from('posts').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(5);
  document.getElementById('sm-posts').innerHTML=(posts||[]).map(renderPostCard).join('')||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No posts yet</div>';
  document.getElementById('profile-modal').style.display='flex';
}
function messageFromModal(){if(!stalkedUserId)return;const name=document.getElementById('sm-name').textContent;document.getElementById('profile-modal').style.display='none';sb.from('profiles').select('avatar_seed,avatar_style,avatar_url').eq('id',stalkedUserId).single().then(({data:p})=>{if(p){switchPanel('chats');openThread(stalkedUserId,name,p.avatar_seed,p.avatar_style,p.avatar_url);}});}

// ── Profile Panel ─────────────────────────────────────────────
function loadProfilePanel(){
  const av=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);
  const big=document.getElementById('pp-av-big');if(big)big.src=av;
  document.getElementById('nav-avatar').src=av;
  const n=document.getElementById('pp-name');if(n)n.textContent=displayName(ME);
  const c=document.getElementById('pp-code');if(c)c.textContent=`#${ME.user_code||'------'}`;
  const b=document.getElementById('pp-bio');if(b)b.innerHTML=ME.bio?linkify(ME.bio):'';
  const ty=document.getElementById('pp-types');if(ty)ty.innerHTML=renderTypeTags(ME.user_types||[]);
  const ring=document.getElementById('pp-border-ring');if(ring)ring.className=`avatar-border-ring border-ring-${ME.border_style||'none'}`;
  // Header summary
  const pph=document.getElementById('pp-avatar-wrap');if(pph){const img=pph.querySelector('img');if(img)img.src=av;}
  loadMyPosts();
}
async function quickPhotoUpload(input){
  const file=input.files[0];if(!file)return;
  const path=`${ME.id}/${Date.now()}-${file.name}`;const{error}=await sb.storage.from('avatars').upload(path,file,{upsert:true});if(error)return alert('Upload failed');
  const{data:{publicUrl}}=sb.storage.from('avatars').getPublicUrl(path);await sb.from('profiles').update({avatar_url:publicUrl}).eq('id',ME.id);ME.avatar_url=publicUrl;loadProfilePanel();
}

// Posts
function setPostImage(input){postImageFile=input.files[0];document.getElementById('post-img-label').textContent=postImageFile?postImageFile.name:'';}
async function submitPost(){const txt=document.getElementById('post-input').value.trim();if(!txt&&!postImageFile)return;let imgUrl=null;if(postImageFile){const path=`posts/${ME.id}/${Date.now()}-${postImageFile.name}`;await sb.storage.from('chat-images').upload(path,postImageFile);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);imgUrl=publicUrl;}await sb.from('posts').insert({user_id:ME.id,content:txt||null,image_url:imgUrl});document.getElementById('post-input').value='';document.getElementById('post-img-label').textContent='';postImageFile=null;loadMyPosts();}
async function loadMyPosts(){const{data}=await sb.from('posts').select('*').eq('user_id',ME.id).order('created_at',{ascending:false}).limit(20);const el=document.getElementById('my-posts');if(el)el.innerHTML=(data||[]).map(renderPostCard).join('')||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:14px">No posts yet</div>';}
function renderPostCard(post){return `<div class="post-card">${post.content?`<div class="post-text">${linkify(post.content)}</div>`:''} ${post.image_url?`<img class="post-img" src="${escHtml(post.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`:''}<div class="post-time">${timeAgo(post.created_at)}</div></div>`;}
function renderTypeTags(types){return(types||[]).map(id=>{const t=USER_TYPES.find(x=>x.id===id);return t?`<span class="type-tag">${t.emoji} ${t.label}</span>`:''}).join('');}

// ── Settings ──────────────────────────────────────────────────
let sPageStack=[];
function openSettings(){
  document.getElementById('settings-fs').style.display='flex';
  loadSettingsProfile();
  document.getElementById('sp-privacy-policy-body').innerHTML=PRIVACY_POLICY_HTML;
  document.getElementById('sp-privacy-center-body').innerHTML=PRIVACY_CENTER_HTML;
  document.getElementById('sp-help-body').innerHTML=HELP_CENTER_HTML;
  applyGlobalTheme();updateNotifStatus();
}
function closeSettings(){document.getElementById('settings-fs').style.display='none';sPageStack=[];document.querySelectorAll('.spage').forEach(p=>{p.classList.remove('active');p.style.transform='';});document.getElementById('sp-main').classList.add('active');}
function openSPage(id){
  const cur=document.querySelector('.spage.active');
  if(cur){cur.style.transform='translateX(-100%)';setTimeout(()=>{cur.classList.remove('active');cur.style.transform='';},280);}
  const next=document.getElementById(id);
  next.style.transform='translateX(100%)';next.classList.add('active');setTimeout(()=>{next.style.transform='';},10);
  sPageStack.push(id);
  if(id==='sp-notifications')updateNotifStatus();
  if(id==='sp-share')renderShareProfile();
  if(id==='sp-edit-profile')openEditProfile();
}
function closeSPage(){
  const cur=document.querySelector('.spage.active');if(!cur||cur.id==='sp-main')return;
  cur.style.transform='translateX(100%)';setTimeout(()=>{cur.classList.remove('active');cur.style.transform='';},280);
  sPageStack.pop();const prev=document.getElementById(sPageStack[sPageStack.length-1]||'sp-main');prev.classList.add('active');
}
function loadSettingsProfile(){
  const av=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);
  const spcAv=document.getElementById('spc-avatar');if(spcAv)spcAv.src=av;
  const n=document.getElementById('spc-name');if(n)n.textContent=displayName(ME);
  const c=document.getElementById('spc-code');if(c)c.textContent=`#${ME.user_code||'------'}`;
  const b=document.getElementById('spc-bio');if(b)b.textContent=ME.bio||'';
  const ring=document.getElementById('spc-border-ring');if(ring)ring.className=`avatar-border-ring border-ring-${ME.border_style||'none'}`;
  applyGlobalTheme();
}

// Edit profile
let editTypesArrSub=[];
function openEditProfile(){
  editAvatarSeed=ME.avatar_seed;editAvatarStyle=ME.avatar_style;editTypesArrSub=[...(ME.user_types||[])];
  document.getElementById('edit-avatar-preview').src=getAvatar(editAvatarSeed,editAvatarStyle,ME.avatar_url);
  document.getElementById('edit-name').value=ME.name||'';document.getElementById('edit-middle').value=ME.middle_name||'';document.getElementById('edit-surname').value=ME.surname||'';document.getElementById('edit-bio').value=ME.bio||'';
  const hint=document.getElementById('name-change-hint');
  if(ME.name_changed_at){const next=new Date(ME.name_changed_at);next.setDate(next.getDate()+30);const d=Math.ceil((next-Date.now())/86400000);if(d>0){document.getElementById('edit-name').disabled=true;if(hint)hint.textContent=`(change in ${d} days)`;}else{document.getElementById('edit-name').disabled=false;if(hint)hint.textContent='';}}else{document.getElementById('edit-name').disabled=false;if(hint)hint.textContent='';}
  document.getElementById('edit-avatar-grid').innerHTML=AVATAR_LIST.map(av=>`<div class="av-opt ${av.seed===editAvatarSeed?'selected':''}" onclick="pickEditAv('${av.seed}','${av.style}')"><img src="${getAvatar(av.seed,av.style)}" loading="lazy"></div>`).join('');
  document.getElementById('edit-types').innerHTML=USER_TYPES.map(t=>`<div class="type-chip ${editTypesArrSub.includes(t.id)?'active':''}" onclick="toggleTypeSub('${t.id}')">${t.emoji} ${t.label}</div>`).join('');
}
function pickEditAv(seed,style){editAvatarSeed=seed;editAvatarStyle=style;if(!ME.avatar_url)document.getElementById('edit-avatar-preview').src=getAvatar(seed,style);document.querySelectorAll('#edit-avatar-grid .av-opt').forEach((el,i)=>el.classList.toggle('selected',AVATAR_LIST[i].seed===seed));}
async function uploadEditPhoto(input){const file=input.files[0];if(!file)return;const path=`${ME.id}/${Date.now()}-${file.name}`;const{error}=await sb.storage.from('avatars').upload(path,file,{upsert:true});if(error)return alert('Upload failed');const{data:{publicUrl}}=sb.storage.from('avatars').getPublicUrl(path);await sb.from('profiles').update({avatar_url:publicUrl}).eq('id',ME.id);ME.avatar_url=publicUrl;document.getElementById('edit-avatar-preview').src=publicUrl;}
function toggleTypeSub(id){if(editTypesArrSub.includes(id)){editTypesArrSub=editTypesArrSub.filter(x=>x!==id);}else{if(editTypesArrSub.length>=3){alert('Max 3!');return;}editTypesArrSub.push(id);}document.getElementById('edit-types').innerHTML=USER_TYPES.map(t=>`<div class="type-chip ${editTypesArrSub.includes(t.id)?'active':''}" onclick="toggleTypeSub('${t.id}')">${t.emoji} ${t.label}</div>`).join('');}
async function saveProfile(){
  const name=document.getElementById('edit-name').value.trim(),middle=document.getElementById('edit-middle').value.trim(),surname=document.getElementById('edit-surname').value.trim(),bio=document.getElementById('edit-bio').value.trim();
  if(!name)return alert('Name required.');if(!surname)return alert('Surname required.');
  const upd={middle_name:middle||null,surname,bio:bio||null,user_types:editTypesArrSub,avatar_seed:editAvatarSeed,avatar_style:editAvatarStyle};
  if(name!==ME.name){if(ME.name_changed_at){const next=new Date(ME.name_changed_at);next.setDate(next.getDate()+30);if(Date.now()<next)return alert('Name can only be changed every 30 days.');}upd.name=name;upd.name_changed_at=new Date().toISOString();}
  const{error}=await sb.from('profiles').update(upd).eq('id',ME.id);if(error)return alert('Save failed: '+error.message);
  Object.assign(ME,{...upd,name:name||ME.name});loadProfilePanel();loadSettingsProfile();closeSPage();
}

function renderShareProfile(){const c=document.getElementById('share-qr-container');c.innerHTML='';const code=ME.user_code||'000000';try{new QRCode(c,{text:`pulseship://u/${code}`,width:160,height:160,colorDark:document.documentElement.getAttribute('data-theme')==='light'?'#111':'#7b6ef6',colorLight:'transparent',correctLevel:QRCode.CorrectLevel.H});}catch(e){c.textContent='QR unavailable';}document.getElementById('share-code-display').textContent=`#${code}`;}
function copyProfileCode(){navigator.clipboard?.writeText(`#${ME.user_code}`).then(()=>alert('Copied!'));}
function downloadQR(){const canvas=document.querySelector('#share-qr-container canvas');if(!canvas)return;const a=document.createElement('a');a.download='pulseship-qr.png';a.href=canvas.toDataURL();a.click();}
async function submitReport(){const type=document.getElementById('report-type').value,desc=document.getElementById('report-desc').value.trim();if(!desc)return alert('Please describe the issue.');await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:ME.id,content:`[REPORT] ${type}: ${desc}`}).catch(()=>{});alert('Report sent!');closeSPage();}
function confirmDeleteAccount(){document.getElementById('delete-confirm-input').value='';document.getElementById('delete-error').style.display='none';document.getElementById('delete-modal').style.display='flex';}
async function deleteAccount(){const typed=document.getElementById('delete-confirm-input').value.trim(),err=document.getElementById('delete-error');if(typed.toLowerCase()!==displayName(ME).toLowerCase()){err.textContent=`Type exactly: "${displayName(ME)}"`;err.style.display='';return;}await sb.from('profiles').delete().eq('id',ME.id);await sb.auth.signOut();window.location.href='index.html';}

// ── Groups ────────────────────────────────────────────────────
async function loadGroups(){
  const{data:mems}=await sb.from('group_members').select('group_id').eq('user_id',ME.id);
  const list=document.getElementById('group-list');
  if(!mems?.length){list.innerHTML='<div class="convo-empty">No groups yet.</div>';return;}
  const{data:groups}=await sb.from('group_chats').select('*').in('id',mems.map(m=>m.group_id));
  list.innerHTML=(groups||[]).map(g=>`<div class="convo-item" data-gid="${g.id}" onclick="openGroup(${g.id},'${escAttr(g.name)}')"><div class="convo-av" style="background:var(--sur2);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div class="convo-info"><div class="convo-name">${escHtml(g.name)}</div><div class="convo-preview">Group chat</div></div></div>`).join('')||'<div class="convo-empty">No groups yet</div>';
}
async function openGroup(groupId,name){
  activeGroup=groupId;document.getElementById('group-thread-panel').classList.add('active');document.getElementById('group-thread-name').textContent=name;document.querySelectorAll('#group-list .convo-item').forEach(el=>el.classList.remove('active'));document.querySelector(`[data-gid="${groupId}"]`)?.classList.add('active');
  const area=document.getElementById('group-msgs');area.innerHTML='<div class="spinner"></div>';
  const{data}=await sb.from('group_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)').eq('group_id',groupId).order('created_at',{ascending:true}).limit(150);
  area.innerHTML='';(data||[]).forEach(m=>{if(!m.deleted_by?.includes(ME.id))appendGroupMsg(m);});scrollBottom(area);
  if(groupSub)sb.removeChannel(groupSub);
  groupSub=sb.channel(`grp-${groupId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'group_messages',filter:`group_id=eq.${groupId}`},async pl=>{const{data:full}=await sb.from('group_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)').eq('id',pl.new.id).single();if(full){appendGroupMsg(full);scrollBottom(area);}}).subscribe();
}
function appendGroupMsg(msg){const area=document.getElementById('group-msgs'),p=msg.profiles||{},isMine=msg.sender_id===ME.id;const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url),border=p.border_style||'none';let bubble='';if(msg.content)bubble+=`<div class="msg-text">${linkify(msg.content)}</div>`;if(msg.image_url)bubble+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;const el=document.createElement('div');el.className=`msg${isMine?' mine':''}`;el.dataset.id=msg.id;el.dataset.table='group_messages';el.innerHTML=`<div class="msg-av-wrap"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div><div class="msg-body"><div class="msg-meta"><span class="msg-name">${isMine?'You':escHtml(displayName(p))}</span>${renderBadge(p.badge)}<span>${timeAgo(msg.created_at)}</span></div><div class="msg-bubble">${bubble}</div></div>`;addMsgCtx(el,msg.id,'group_messages',isMine);area.appendChild(el);}
async function sendGroup(){if(!activeGroup)return;const inp=document.getElementById('group-input'),txt=inp.value.trim();if(!txt)return;inp.value='';await sb.from('group_messages').insert({group_id:activeGroup,sender_id:ME.id,content:txt});}
async function uploadGrpImage(input){if(!activeGroup)return;const file=input.files[0];if(!file)return;const path=`grp/${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);await sb.from('group_messages').insert({group_id:activeGroup,sender_id:ME.id,image_url:publicUrl});input.value='';}
function closeGroupThread(){document.getElementById('group-thread-panel').classList.remove('active');activeGroup=null;}
function openCreateGroup(){document.getElementById('create-group-modal').style.display='flex';}
async function createGroup(){const name=document.getElementById('group-name-input').value.trim();if(!name)return alert('Name required.');const codes=document.getElementById('group-members-input').value.split(',').map(s=>s.trim().replace('#','').padStart(6,'0')).filter(Boolean);const{data:grp,error}=await sb.from('group_chats').insert({name,created_by:ME.id}).select().single();if(error){alert('Failed: '+error.message);return;}await sb.from('group_members').insert({group_id:grp.id,user_id:ME.id});if(codes.length){const{data:others}=await sb.from('profiles').select('id').in('user_code',codes);if(others?.length)await sb.from('group_members').insert(others.filter(o=>o.id!==ME.id).map(o=>({group_id:grp.id,user_id:o.id})));}document.getElementById('create-group-modal').style.display='none';await loadGroups();openGroup(grp.id,name);}
async function openGroupInfo(){if(!activeGroup)return;document.getElementById('group-info-name').textContent=document.getElementById('group-thread-name').textContent;document.getElementById('group-info-modal').style.display='flex';const{data:mems}=await sb.from('group_members').select('*, profiles(name,surname,user_code)').eq('group_id',activeGroup);document.getElementById('group-member-list').innerHTML=(mems||[]).map(m=>`<div class="convo-item" style="padding:8px 0;border:none"><div class="convo-info"><div class="convo-name">${escHtml(displayName(m.profiles))}</div><div class="convo-preview">#${m.profiles?.user_code||'------'}</div></div></div>`).join('');}
async function addGroupMember(){const code=document.getElementById('add-member-code').value.trim().replace('#','').padStart(6,'0');const{data:p}=await sb.from('profiles').select('id').eq('user_code',code).maybeSingle();if(!p)return alert('User not found.');await sb.from('group_members').insert({group_id:activeGroup,user_id:p.id});document.getElementById('add-member-code').value='';openGroupInfo();}

// ══════════════════════════════════════════════════════════════
// GAMES PANEL
// ══════════════════════════════════════════════════════════════
function showGamesHome(){
  document.getElementById('games-home').style.display='';
  document.getElementById('draw-section').style.display='none';
  document.getElementById('new-draw-btn').style.display='none';
}
function openGameSection(section){
  document.getElementById('games-home').style.display='none';
  if(section==='draw-battle'){
    document.getElementById('draw-section').style.display='';
    document.getElementById('new-draw-btn').style.display='flex';
    loadDrawGallery();
  }
}

// ── Draw tabs ─────────────────────────────────────────────────
function switchDrawTab(tab){
  document.querySelectorAll('[data-dtab]').forEach(b=>b.classList.toggle('active',b.dataset.dtab===tab));
  document.querySelectorAll('.draw-tab-content').forEach(s=>s.classList.toggle('active',s.id===`dtab-${tab}`));
  if(tab==='gallery')loadDrawGallery();else loadMyDrawings();
}

// ── Draw Gallery (all users) ──────────────────────────────────
async function loadDrawGallery(){
  const{data}=await sb.from('draw_battles').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url)').order('created_at',{ascending:false}).limit(40);
  const el=document.getElementById('draw-gallery');
  if(!data?.length){el.innerHTML='<div class="convo-empty">No drawings yet.<br>Be the first to post!</div>';return;}
  el.innerHTML=`<div class="draw-card-grid">${(data||[]).map(d=>drawCard(d)).join('')}</div>`;
}
async function loadMyDrawings(){
  const{data}=await sb.from('draw_battles').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url)').eq('user_id',ME.id).order('created_at',{ascending:false}).limit(20);
  const el=document.getElementById('draw-mine');
  if(!data?.length){el.innerHTML='<div class="convo-empty">You haven\'t posted any drawings yet.<br>Click "New Drawing" to start!</div>';return;}
  el.innerHTML=`<div class="draw-card-grid">${(data||[]).map(d=>drawCard(d)).join('')}</div>`;
}
function drawCard(d){
  const p=d.profiles||{};
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);
  return `<div class="draw-card" onclick="openDrawDetail('${d.id}')">
    <img class="draw-card-img" src="${escHtml(d.image_url)}" loading="lazy" alt="${escHtml(d.prompt||'')}">
    <div class="draw-card-info">
      <div class="draw-card-user"><img src="${av}" class="draw-card-av"><span>${escHtml(displayName(p))}</span></div>
      <div class="draw-card-prompt">${escHtml(d.prompt||'')}</div>
      <div class="draw-card-stats">
        <span class="draw-stars">${renderStars(d.avg_rating||0)}</span>
        <span style="font-size:11px;color:var(--muted)">${d.comment_count||0} comments</span>
      </div>
    </div>
  </div>`;
}
function renderStars(rating){const r=Math.round(rating);return[1,2,3,4,5].map(i=>`<svg viewBox="0 0 24 24" fill="${i<=r?'#f59e0b':'none'}" stroke="#f59e0b" stroke-width="2" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');}

// ── Draw Detail / Comments / Rating ───────────────────────────
async function openDrawDetail(drawId){
  viewingDrawId=drawId;myRatingForDraw=0;
  const{data:d}=await sb.from('draw_battles').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url)').eq('id',drawId).single();
  if(!d)return;
  document.getElementById('dd-image').src=d.image_url;
  document.getElementById('dd-name').textContent=displayName(d.profiles||{});
  document.getElementById('dd-prompt').textContent=d.prompt||'';
  document.getElementById('dd-avatar').src=getAvatar(d.profiles?.avatar_seed,d.profiles?.avatar_style,d.profiles?.avatar_url);
  document.getElementById('dd-rating-display').innerHTML=renderStars(d.avg_rating||0)+`<span style="font-size:11px;color:var(--muted);margin-left:4px">${(d.avg_rating||0).toFixed(1)}</span>`;
  // Star input
  const starInput=document.getElementById('dd-star-input');
  starInput.innerHTML=[1,2,3,4,5].map(i=>`<svg class="star-clickable" data-v="${i}" viewBox="0 0 24 24" fill="${i<=myRatingForDraw?'#f59e0b':'none'}" stroke="#f59e0b" stroke-width="2" width="22" height="22" onclick="rateDrawing(${i})" style="cursor:pointer"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');
  // Check existing rating
  const{data:myR}=await sb.from('draw_ratings').select('rating').eq('draw_id',drawId).eq('user_id',ME.id).maybeSingle();
  if(myR){myRatingForDraw=myR.rating;starInput.innerHTML=[1,2,3,4,5].map(i=>`<svg class="star-clickable" data-v="${i}" viewBox="0 0 24 24" fill="${i<=myRatingForDraw?'#f59e0b':'none'}" stroke="#f59e0b" stroke-width="2" width="22" height="22" onclick="rateDrawing(${i})" style="cursor:pointer"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('');}
  // Own drawing → hide rating
  document.getElementById('dd-rate-row').style.display=d.user_id===ME.id?'none':'flex';
  // Load comments
  loadDrawComments(drawId);
  document.getElementById('draw-detail-modal').style.display='flex';
}
async function loadDrawComments(drawId){
  const{data:cmts}=await sb.from('draw_comments').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url)').eq('draw_id',drawId).order('created_at',{ascending:true}).limit(50);
  const el=document.getElementById('dd-comments');
  el.innerHTML=(cmts||[]).map(c=>{const p=c.profiles||{};const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);return `<div class="dd-comment"><img src="${av}" class="draw-card-av"><div><div class="dd-cmt-name">${escHtml(displayName(p))}</div><div class="dd-cmt-text">${escHtml(c.content)}</div></div></div>`;}).join('')||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">No comments yet</div>';
}
async function rateDrawing(rating){
  if(!viewingDrawId||!ME)return;
  myRatingForDraw=rating;
  document.querySelectorAll('#dd-star-input .star-clickable').forEach(el=>{el.setAttribute('fill',parseInt(el.dataset.v)<=rating?'#f59e0b':'none');});
  await sb.from('draw_ratings').upsert({draw_id:viewingDrawId,user_id:ME.id,rating});
  // Recalculate avg
  const{data:ratings}=await sb.from('draw_ratings').select('rating').eq('draw_id',viewingDrawId);
  if(ratings?.length){const avg=ratings.reduce((s,r)=>s+r.rating,0)/ratings.length;await sb.from('draw_battles').update({avg_rating:avg}).eq('id',viewingDrawId);}
}
async function submitDrawComment(){
  const inp=document.getElementById('dd-comment-input'),txt=inp.value.trim();if(!txt||!viewingDrawId)return;inp.value='';
  await sb.from('draw_comments').insert({draw_id:viewingDrawId,user_id:ME.id,content:txt});
  await sb.from('draw_battles').update({comment_count:1}).eq('id',viewingDrawId);// rough count, works
  loadDrawComments(viewingDrawId);
}

// ══════════════════════════════════════════════════════════════
// SOLO DRAW CANVAS
// ══════════════════════════════════════════════════════════════
function newDrawPrompt(){
  const cat=PROMPT_CATS[Math.floor(Math.random()*PROMPT_CATS.length)];
  const words=DRAW_PROMPTS[cat];
  const word=words[Math.floor(Math.random()*words.length)];
  currentDrawPrompt=word;currentDrawCategory=cat;
  const wEl=document.getElementById('draw-prompt-word');if(wEl)wEl.textContent=`${word} (${cat})`;
  const tEl=document.getElementById('draw-prompt-tag');if(tEl)tEl.textContent=`Prompt: ${word}`;
}
function openDrawCanvas(){
  document.getElementById('draw-canvas-overlay').style.display='flex';
  if(!soloCanvas){initSoloCanvas();}
  else resizeSoloCanvas();
  newDrawPrompt();
}
function closeDrawCanvas(){document.getElementById('draw-canvas-overlay').style.display='none';}
function toggleDrawFs(){
  drawFsMode=!drawFsMode;
  document.getElementById('draw-canvas-overlay').classList.toggle('draw-fs',drawFsMode);
  setTimeout(()=>resizeSoloCanvas(),60);
}
function resizeSoloCanvas(){
  if(!soloCanvas)return;
  const modal=document.getElementById('draw-canvas-modal');
  const hdr=modal.querySelector('.draw-canvas-hdr');
  const tools=modal.querySelector('.draw-tools');
  const submit=modal.querySelector('.draw-submit-bar');
  const taken=(hdr?.offsetHeight||0)+(tools?.offsetHeight||0)+(submit?.offsetHeight||0);
  soloCanvas.width=modal.clientWidth;
  soloCanvas.height=Math.max(180,modal.clientHeight-taken);
  // Refill white
  soloCtx.fillStyle='#ffffff';soloCtx.fillRect(0,0,soloCanvas.width,soloCanvas.height);
}
function initSoloCanvas(){
  soloCanvas=document.getElementById('solo-canvas');
  soloCtx=soloCanvas.getContext('2d');
  resizeSoloCanvas();
  // Init color dots
  const el=document.getElementById('draw-colors');
  el.innerHTML=DRAW_COLORS.map(c=>`<div class="draw-color-dot ${c===drawColor?'active':''}" style="background:${c}" onclick="setDrawColor('${c}')"></div>`).join('');
  document.getElementById('draw-brush').oninput=e=>drawSize=+e.target.value;
  // Mouse
  soloCanvas.addEventListener('mousedown',e=>{drawIsDrawing=true;soloCtx.beginPath();const p=getSoloPos(e);soloCtx.moveTo(p.x,p.y);});
  soloCanvas.addEventListener('mousemove',e=>{if(!drawIsDrawing)return;const p=getSoloPos(e);drawSoloPt(p);});
  soloCanvas.addEventListener('mouseup',()=>drawIsDrawing=false);
  soloCanvas.addEventListener('mouseleave',()=>drawIsDrawing=false);
  // Touch
  soloCanvas.addEventListener('touchstart',e=>{e.preventDefault();drawIsDrawing=true;soloCtx.beginPath();const p=getSoloPos(e.touches[0]);soloCtx.moveTo(p.x,p.y);},{passive:false});
  soloCanvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawIsDrawing)return;drawSoloPt(getSoloPos(e.touches[0]));},{passive:false});
  soloCanvas.addEventListener('touchend',()=>drawIsDrawing=false);
}
function getSoloPos(e){const r=soloCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(soloCanvas.width/r.width),y:(e.clientY-r.top)*(soloCanvas.height/r.height)};}
function drawSoloPt(p){
  soloCtx.lineWidth=drawEraser?24:drawSize;soloCtx.strokeStyle=drawEraser?'#ffffff':drawColor;
  soloCtx.lineCap='round';soloCtx.lineJoin='round';soloCtx.lineTo(p.x,p.y);soloCtx.stroke();
  soloCtx.beginPath();soloCtx.moveTo(p.x,p.y);
}
function clearDrawCanvas(){soloCtx?.fillStyle&&(soloCtx.fillStyle='#ffffff',soloCtx.fillRect(0,0,soloCanvas.width,soloCanvas.height));}
function setDrawColor(c){drawColor=c;drawEraser=false;document.querySelectorAll('.draw-color-dot').forEach(d=>d.classList.toggle('active',d.style.background===c));document.getElementById('draw-eraser-btn')?.classList.remove('active');}
function toggleDrawEraser(){drawEraser=!drawEraser;document.getElementById('draw-eraser-btn')?.classList.toggle('active',drawEraser);}

async function uploadDrawing(){
  if(!soloCanvas)return;
  const btn=document.querySelector('.draw-submit-bar .btn');
  if(btn){btn.disabled=true;btn.textContent='Uploading…';}
  // Convert canvas to blob
  soloCanvas.toBlob(async blob=>{
    if(!blob){if(btn){btn.disabled=false;btn.textContent='Post Drawing';}return;}
    const path=`draw/${ME.id}/${Date.now()}.png`;
    const{error}=await sb.storage.from('chat-images').upload(path,blob,{contentType:'image/png'});
    if(error){alert('Upload failed');if(btn){btn.disabled=false;btn.textContent='Post Drawing';}return;}
    const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);
    await sb.from('draw_battles').insert({user_id:ME.id,image_url:publicUrl,prompt:currentDrawPrompt,category:currentDrawCategory,avg_rating:0,comment_count:0});
    closeDrawCanvas();
    // Go to gallery to see it
    switchPanel('games');openGameSection('draw-battle');
    if(btn){btn.disabled=false;btn.textContent='Post Drawing';}
  },'image/png');
}

// ══════════════════════════════════════════════════════════════
// ANONYMOUS MATCH
// ══════════════════════════════════════════════════════════════
async function checkAnonDaily(){const today=new Date().toISOString().split('T')[0];const{data}=await sb.from('anon_daily').select('count').eq('user_id',ME.id).eq('date',today).maybeSingle();anonMatchesLeft=Math.max(0,10-(data?.count||0));const el=document.getElementById('match-daily-count');if(el)el.textContent=`${anonMatchesLeft} left today`;const btn=document.getElementById('match-start-btn');if(btn){btn.disabled=anonMatchesLeft<=0;if(anonMatchesLeft<=0)btn.textContent='Come back tomorrow!';}}
function openMatchFs(){if(anonMatchesLeft<=0)return;const fs=document.getElementById('match-fs');fs.style.display='flex';document.getElementById('match-fs-waiting').style.display='';document.getElementById('match-fs-chat').style.display='none';document.getElementById('match-fs-ended').style.display='none';document.getElementById('mfs-avatar').src=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);document.getElementById('mfs-daily').textContent=`${anonMatchesLeft} left today`;startMatching();}
async function startMatching(){await sb.from('anon_queue').upsert({user_id:ME.id,joined_at:new Date().toISOString()});const{data:others}=await sb.from('anon_queue').select('user_id').neq('user_id',ME.id).order('joined_at',{ascending:true}).limit(1);if(others?.length){const pid=others[0].user_id;await sb.from('anon_queue').delete().in('user_id',[ME.id,pid]);const{data:match}=await sb.from('anon_matches').insert({user1_id:ME.id,user2_id:pid}).select().single();if(match){anonSlot=1;startAnonChat(match);}}else{if(anonQueueSub)sb.removeChannel(anonQueueSub);anonQueueSub=sb.channel(`queue-${ME.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'anon_matches',filter:`user2_id=eq.${ME.id}`},pl=>{if(anonSlot)return;anonSlot=2;startAnonChat(pl.new);sb.removeChannel(anonQueueSub);}).subscribe();}}
async function startAnonChat(match){anonMatchId=match.id;anonHeartShown=false;myHeartPressed=false;document.getElementById('match-fs-waiting').style.display='none';document.getElementById('match-fs-chat').style.display='flex';document.getElementById('anon-msgs').innerHTML='';document.getElementById('heart-btn').style.display='none';const today=new Date().toISOString().split('T')[0];const{data:ex}=await sb.from('anon_daily').select('count').eq('user_id',ME.id).eq('date',today).maybeSingle();if(ex)await sb.from('anon_daily').update({count:(ex.count||0)+1}).eq('user_id',ME.id).eq('date',today);else await sb.from('anon_daily').insert({user_id:ME.id,date:today,count:1});anonMatchesLeft=Math.max(0,anonMatchesLeft-1);if(anonSub)sb.removeChannel(anonSub);anonSub=sb.channel(`anon-${anonMatchId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'anon_messages',filter:`match_id=eq.${anonMatchId}`},pl=>{if(pl.new.slot!==anonSlot){const el=document.createElement('div');el.className='msg';el.innerHTML=`<div class="msg-body" style="max-width:80%"><div class="msg-bubble">${linkify(pl.new.content)}</div></div>`;document.getElementById('anon-msgs').appendChild(el);scrollBottom(document.getElementById('anon-msgs'));}}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'anon_matches',filter:`id=eq.${anonMatchId}`},pl=>{if(pl.new.user1_heart&&pl.new.user2_heart)bothHeart();else if((anonSlot===1&&pl.new.user2_heart)||(anonSlot===2&&pl.new.user1_heart)){const btn=document.getElementById('heart-btn');btn.style.display='';btn.textContent='💌';}}).subscribe();let secs=120;anonTimer=setInterval(()=>{secs--;const m=Math.floor(secs/60),s=secs%60;document.getElementById('match-timer-text').textContent=`${m}:${String(s).padStart(2,'0')}`;if(secs===60&&!anonHeartShown){anonHeartShown=true;document.getElementById('heart-btn').style.display='';}if(secs<=0){clearInterval(anonTimer);timeUp();}},1000);}
async function sendAnon(){const inp=document.getElementById('anon-input'),txt=inp.value.trim();if(!txt||!anonMatchId)return;inp.value='';await sb.from('anon_messages').insert({match_id:anonMatchId,slot:anonSlot,content:txt});const el=document.createElement('div');el.className='msg mine';el.innerHTML=`<div class="msg-body" style="max-width:80%"><div class="msg-bubble" style="background:var(--accent);color:#fff;border-color:var(--accent)">${linkify(txt)}</div></div>`;document.getElementById('anon-msgs').appendChild(el);scrollBottom(document.getElementById('anon-msgs'));}
async function pressHeart(){if(!anonMatchId||myHeartPressed)return;myHeartPressed=true;document.getElementById('heart-btn').textContent='❤️';const f=anonSlot===1?{user1_heart:true}:{user2_heart:true};await sb.from('anon_matches').update(f).eq('id',anonMatchId);}
async function bothHeart(){clearInterval(anonTimer);const{data:match}=await sb.from('anon_matches').select('user1_id,user2_id').eq('id',anonMatchId).single();const pid=anonSlot===1?match.user2_id:match.user1_id;await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:pid,content:'💕 We matched from Pulseship anonymous chat! Hi!'});await sb.from('anon_matches').update({connected:true,ended_at:new Date().toISOString()}).eq('id',anonMatchId);if(anonSub)sb.removeChannel(anonSub);document.getElementById('match-fs-chat').style.display='none';document.getElementById('match-fs-ended').style.display='flex';document.getElementById('ended-icon').textContent='💕';document.getElementById('ended-title').textContent="It's a match!";document.getElementById('ended-msg').textContent="You're now connected! Check Messages.";switchPanel('chats');const{data:p}=await sb.from('profiles').select('*').eq('id',pid).single();if(p)openThread(pid,displayName(p),p.avatar_seed,p.avatar_style,p.avatar_url);}
function timeUp(){if(anonSub)sb.removeChannel(anonSub);if(anonMatchId)sb.from('anon_matches').update({ended_at:new Date().toISOString()}).eq('id',anonMatchId);document.getElementById('match-fs-chat').style.display='none';document.getElementById('match-fs-ended').style.display='flex';document.getElementById('ended-icon').textContent='⏱';document.getElementById('ended-title').textContent="Time's up!";document.getElementById('ended-msg').textContent=myHeartPressed?'No mutual match this time.':'Session ended.';}
function endMatch(){if(anonTimer)clearInterval(anonTimer);timeUp();}
function resetMatch(){anonMatchId=null;anonSlot=null;anonHeartShown=false;myHeartPressed=false;document.getElementById('match-fs-ended').style.display='none';document.getElementById('match-fs-waiting').style.display='';startMatching();}
async function cancelMatch(){if(anonQueueSub)sb.removeChannel(anonQueueSub);await sb.from('anon_queue').delete().eq('user_id',ME.id);closeMatchFs();}
function closeMatchFs(){document.getElementById('match-fs').style.display='none';if(anonTimer)clearInterval(anonTimer);}

// ══════════════════════════════════════════════════════════════
// TOOLBOX  (desktop drag, mobile fixed, resizable)
// ══════════════════════════════════════════════════════════════
let toolboxMinimized=false;
function toggleToolbox(){const tb=document.getElementById('toolbox');tb.style.display=tb.style.display==='none'?'flex':'none';}
function switchTool(name){document.querySelectorAll('.tbtn').forEach(b=>b.classList.toggle('active',b.onclick?.toString().includes(`'${name}'`)));document.querySelectorAll('.tool-panel').forEach(p=>p.classList.toggle('active',p.id===`tool-${name}`));}
function minimizeToolbox(){toolboxMinimized=!toolboxMinimized;const tb=document.getElementById('toolbox');tb.classList.toggle('minimized',toolboxMinimized);}

// Desktop-only drag
(function(){
  const isMob=()=>window.innerWidth<=640;
  let dx=0,dy=0,drag=false,el;
  document.addEventListener('DOMContentLoaded',()=>{
    el=document.getElementById('toolbox');
    const hdr=document.getElementById('toolbox-drag-hdr');if(!hdr||!el)return;
    hdr.addEventListener('mousedown',e=>{if(isMob()||e.target.closest('.tbtn,.tbtn-ctrl'))return;drag=true;const r=el.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;e.preventDefault();});
    document.addEventListener('mousemove',e=>{if(!drag||isMob())return;el.style.left=(e.clientX-dx)+'px';el.style.top=(e.clientY-dy)+'px';el.style.right='auto';el.style.bottom='auto';});
    document.addEventListener('mouseup',()=>drag=false);
  });
})();

// Calculator
function calcAction(v){
  const disp=document.getElementById('calc-display');
  if(v==='clear'){calcValue='0';calcPrev='';calcOp='';calcReset=false;}
  else if(v==='sign'){calcValue=(parseFloat(calcValue)*-1).toString();}
  else if(v==='percent'){calcValue=(parseFloat(calcValue)/100).toString();}
  else if(['+','−','×','÷'].includes(v)){calcPrev=calcValue;calcOp=v;calcReset=true;}
  else if(v==='='){if(!calcOp||!calcPrev)return;const a=parseFloat(calcPrev),b=parseFloat(calcValue);let r=0;if(calcOp==='+')r=a+b;else if(calcOp==='−')r=a-b;else if(calcOp==='×')r=a*b;else if(calcOp==='÷')r=b!==0?a/b:0;const hist=document.getElementById('calc-history');hist.textContent=`${calcPrev} ${calcOp} ${calcValue} =`;calcValue=r.toString();calcOp='';calcPrev='';calcReset=false;}
  else if(v==='.'){if(calcReset){calcValue='0.';calcReset=false;}else if(!calcValue.includes('.'))calcValue+='.';}
  else{if(calcReset||calcValue==='0'){calcValue=v;calcReset=false;}else calcValue+=v;}
  if(disp) disp.textContent=parseFloat(calcValue).toLocaleString('en',{maximumFractionDigits:10})||'0';
}

// Translator
let tlTimer=null;
async function translateNow(){const txt=document.getElementById('tl-input')?.value.trim();const out=document.getElementById('tl-output');if(!txt){if(out)out.textContent='Translation will appear here';return;}const from=document.getElementById('tl-from')?.value,to=document.getElementById('tl-to')?.value;if(out)out.textContent='Translating…';try{const res=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=${from}|${to}`);const d=await res.json();if(out)out.textContent=d.responseData?.translatedText||'Translation failed.';}catch{if(out)out.textContent='Network error.';}}
function translateDebounce(){clearTimeout(tlTimer);tlTimer=setTimeout(translateNow,700);}
function swapLangs(){const f=document.getElementById('tl-from'),t=document.getElementById('tl-to'),tmp=f.value;f.value=t.value;t.value=tmp;translateNow();}
function copyTranslation(){const txt=document.getElementById('tl-output')?.textContent;if(txt)navigator.clipboard?.writeText(txt).then(()=>alert('Copied!'));}

// ── Logout ────────────────────────────────────────────────────
async function doLogout(){clearInterval(leaderboardTimer);if(presenceCh)await presenceCh.untrack();await sb.auth.signOut();window.location.href='index.html';}

// ── Helpers ───────────────────────────────────────────────────
function scrollBottom(el){if(el)el.scrollTop=el.scrollHeight;}
function openImgFull(src){const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out';ov.innerHTML=`<img src="${src}" style="max-width:92vw;max-height:92vh;border-radius:8px">`;ov.onclick=()=>ov.remove();document.body.appendChild(ov);}