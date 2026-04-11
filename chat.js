// ============================================================
// PULSESHIP — chat.js  v7
// ============================================================

let ME=null, activeUser=null, activeGroup=null, stalkedUserId=null;
let privateSub=null, groupSub=null, incomingDMSub=null, presenceCh=null;
let unreadCount=0, editSelSeed=null, editSelStyle=null, editTypes=[];
let pwaPrompt=null, postImageFile=null, ctxMsgId=null, ctxMsgTable=null, ctxMsgOwn=false;
let typingTimer=null, typingCh=null, typingTimeout=null;
let leaderboardTimer=null, sessionStart=Date.now();
// Match
let anonMatchId=null, anonSlot=null, anonTimer=null, anonSub=null, anonQueueSub=null;
let anonHeartShown=false, myHeartPressed=false, anonMatchesLeft=10;
// Draw game
let drawCanvas=null, drawCtx=null, drawSub=null, drawIsDrawing=false;
let drawColor='#7b6ef6', drawSize=5, drawEraser=false;
let gameIsFs=false, drawStrokes=[];
const DRAW_COLORS=['#7b6ef6','#f43f5e','#22d47a','#f59e0b','#3b82f6','#ec4899','#000000','#ffffff'];

// ── Viewport ──────────────────────────────────────────────────
(function(){function s(){const h=window.visualViewport?window.visualViewport.height:window.innerHeight;document.documentElement.style.setProperty('--vh',h+'px');}s();if(window.visualViewport)window.visualViewport.addEventListener('resize',s);window.addEventListener('resize',s);})();

// ── Theme ─────────────────────────────────────────────────────
function applyGlobalTheme(){
  const t=localStorage.getItem('ps-theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  const icon=document.getElementById('theme-icon'), lbl=document.getElementById('theme-label');
  if(icon) icon.textContent = t==='dark'?'☀️':'🌙';
  if(lbl)  lbl.textContent  = t==='dark'?'Switch to Light':'Switch to Dark';
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  const next=cur==='dark'?'light':'dark';
  localStorage.setItem('ps-theme',next);
  applyGlobalTheme();
}
applyGlobalTheme();

// ── PWA ───────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pwaPrompt=e;document.getElementById('pwa-install-btn').style.display='';});
function installPWA(){if(pwaPrompt){pwaPrompt.prompt();pwaPrompt=null;document.getElementById('pwa-install-btn').style.display='none';}}
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

// ── INIT ──────────────────────────────────────────────────────
(async()=>{
  const{data:{session}}=await sb.auth.getSession();
  if(!session) return redirect();
  const{data:p}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(!p) return redirect();
  ME=p;
  initUI();
  initPresence();
  requestNotif();
  cleanupWorld();
  loadWorldChat();
  loadConversations();
  loadGroups();
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
  loadProfileView();
  ['world-input','thread-input','group-input'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(id==='world-input')sendWorld();else if(id==='thread-input')sendPrivate();else sendGroup();}else if(id==='thread-input')sendTyping();});
  });
  document.getElementById('anon-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAnon();}});
  document.addEventListener('click',e=>{
    const dm=document.getElementById('dot-menu');
    if(dm&&!dm.contains(e.target)&&e.target.id!=='dot-btn') dm.style.display='none';
    if(!e.target.closest('.ctx-menu')) document.getElementById('ctx-menu').style.display='none';
  });
}

// ── Notifications ─────────────────────────────────────────────
async function requestNotif(){
  if(!('Notification' in window)) return;
  if(Notification.permission==='default') await Notification.requestPermission().catch(()=>{});
}
function pushNotif(title,body,onClick){
  if(Notification.permission!=='granted'||document.hasFocus()) return;
  const n=new Notification(title,{body,icon:'icon-192.png'});
  if(onClick) n.onclick=onClick;
}

// ── Panel switching ───────────────────────────────────────────
function switchPanel(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`${name}-panel`)?.classList.add('active');
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  if(name==='chats'){unreadCount=0;updateDMBadge();}
  if(name==='settings'){showMyProfile();}
}
function updateDMBadge(){const b=document.getElementById('dm-badge');if(unreadCount>0){b.textContent=unreadCount>9?'9+':unreadCount;b.style.display='';}else b.style.display='none';}

// ── Chats sub-tabs ─────────────────────────────────────────────
function switchChatsTab(tab){
  document.querySelectorAll('.ctab').forEach(b=>b.classList.toggle('active',b.dataset.ctab===tab));
  document.querySelectorAll('.chats-sub').forEach(s=>s.classList.toggle('active',s.id===`chats-${tab}-sub`));
  const addBtn=document.getElementById('chats-add-btn'), grpBtn=document.getElementById('chats-grp-btn');
  if(addBtn) addBtn.style.display = tab==='dm'?'':'none';
  if(grpBtn) grpBtn.style.display = tab==='groups'?'':'none';
  if(tab==='groups') loadGroups();
}

// ── Presence ─────────────────────────────────────────────────
function initPresence(){
  presenceCh=sb.channel('ps-presence',{config:{presence:{key:ME.id}}});
  presenceCh.on('presence',{event:'sync'},()=>{
    const n=Object.keys(presenceCh.presenceState()).length;
    document.getElementById('online-label').textContent=n+' online';
    document.getElementById('draw-players')&&(document.getElementById('draw-players').textContent=n+' online');
  }).subscribe(async s=>{if(s==='SUBSCRIBED') await presenceCh.track({userId:ME.id});});
}

// ── Leaderboard ───────────────────────────────────────────────
async function pingLeaderboard(){
  const score=(((await sb.from('leaderboard').select('score').eq('user_id',ME.id).maybeSingle()).data?.score)||0)+60;
  await sb.from('leaderboard').upsert({user_id:ME.id,user_name:displayName(ME),score,updated_at:new Date().toISOString()});
}

// ── World chat ────────────────────────────────────────────────
async function cleanupWorld(){await sb.rpc('cleanup_world_messages').catch(()=>{});}
async function loadWorldChat(){
  const{data}=await sb.from('world_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)').order('created_at',{ascending:true}).limit(120);
  const area=document.getElementById('world-msgs'); area.innerHTML='';
  (data||[]).forEach(m=>appendWorldMsg(m)); scrollBottom(area);
  sb.channel('world-rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'world_messages'},async pl=>{
    const{data:full}=await sb.from('world_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)').eq('id',pl.new.id).single();
    if(full){appendWorldMsg(full);scrollBottom(document.getElementById('world-msgs'));}
  }).subscribe();
}
function appendWorldMsg(msg){
  const area=document.getElementById('world-msgs');
  const p=msg.profiles||{}, isMine=msg.user_id===ME.id;
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url), border=p.border_style||'none';
  let bubble='';
  if(msg.content) bubble+=`<div class="msg-text">${linkify(msg.content)}</div>`;
  if(msg.image_url) bubble+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;
  const el=document.createElement('div');
  el.className=`msg${isMine?' mine':''}`;el.dataset.id=msg.id;el.dataset.table='world_messages';
  el.innerHTML=`<div class="msg-av-wrap" onclick="openProfilePage('${msg.user_id}')"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div><div class="msg-body"><div class="msg-meta"><span class="msg-name" onclick="openProfilePage('${msg.user_id}')">${isMine?'You':escHtml(displayName(p))}</span>${renderBadge(p.badge)}<span>${timeAgo(msg.created_at)}</span></div><div class="msg-bubble border-bubble-${border}">${bubble}</div></div>`;
  addMsgCtx(el,msg.id,'world_messages',msg.user_id===ME.id);
  area.appendChild(el);
}
async function sendWorld(){const inp=document.getElementById('world-input'),txt=inp.value.trim();if(!txt)return;inp.value='';await sb.from('world_messages').insert({user_id:ME.id,content:txt});}
async function uploadWorldImage(input){const file=input.files[0];if(!file)return;const path=`${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);await sb.from('world_messages').insert({user_id:ME.id,image_url:publicUrl});input.value='';}

// ── Context menu ──────────────────────────────────────────────
function addMsgCtx(el,msgId,table,isOwn){
  function show(e){ctxMsgId=msgId;ctxMsgTable=table;ctxMsgOwn=isOwn;const m=document.getElementById('ctx-menu');m.style.display='block';m.style.left=Math.min((e.clientX||e.pageX),window.innerWidth-160)+'px';m.style.top=Math.min((e.clientY||e.pageY),window.innerHeight-80)+'px';document.getElementById('ctx-delete-btn').textContent=isOwn?'🗑 Delete for everyone':'🗑 Delete for me';}
  el.addEventListener('contextmenu',e=>{e.preventDefault();show(e);});
  let t;el.addEventListener('touchstart',e=>{t=setTimeout(()=>show(e.touches[0]),600);},{passive:true});
  el.addEventListener('touchend',()=>clearTimeout(t));
}
async function deleteCtxMsg(){
  document.getElementById('ctx-menu').style.display='none';if(!ctxMsgId)return;
  if(ctxMsgOwn){await sb.from(ctxMsgTable).delete().eq('id',ctxMsgId);}
  else if(ctxMsgTable==='private_messages'){const{data:m}=await sb.from('private_messages').select('deleted_by').eq('id',ctxMsgId).single();await sb.from('private_messages').update({deleted_by:[...(m?.deleted_by||[]),ME.id]}).eq('id',ctxMsgId);}
  document.querySelector(`[data-id="${ctxMsgId}"]`)?.remove();
}

// ── Incoming DMs ──────────────────────────────────────────────
function subscribeIncomingDMs(){
  incomingDMSub=sb.channel(`incoming-${ME.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'private_messages',filter:`receiver_id=eq.${ME.id}`},async pl=>{
    const sid=pl.new.sender_id;
    const existing=document.querySelector(`.convo-item[data-uid="${sid}"]`);
    if(!existing){const{data:p}=await sb.from('profiles').select('*').eq('id',sid).single();if(p)prependConvoItem(p,pl.new.content||'📷',false);}
    else{existing.querySelector('.convo-preview').textContent=pl.new.content||'📷';document.getElementById('convo-list').insertBefore(existing,document.getElementById('convo-list').firstChild);}
    if(activeUser!==sid){unreadCount++;updateDMBadge();const{data:p}=await sb.from('profiles').select('name,surname').eq('id',sid).single();pushNotif(`New message from ${p?displayName(p):'Someone'}`,pl.new.content||'📷');}
    else{appendPrivateMsg(pl.new);scrollBottom(document.getElementById('thread-msgs'));markSeen(pl.new.id);}
  }).subscribe();
}

// ── Typing ────────────────────────────────────────────────────
function sendTyping(){if(!activeUser||!typingCh)return;typingCh.send({type:'broadcast',event:'typing',payload:{userId:ME.id}});}
function subscribeTyping(userId){if(typingCh)sb.removeChannel(typingCh);const chId=[ME.id,userId].sort().join('-');typingCh=sb.channel(`typing-${chId}`).on('broadcast',{event:'typing'},()=>{const el=document.getElementById('thread-typing');if(el){el.textContent='typing…';clearTimeout(typingTimeout);typingTimeout=setTimeout(()=>{if(el)el.textContent='';},2000);}}).subscribe();}

// ── Seen ──────────────────────────────────────────────────────
async function markSeen(msgId){await sb.from('private_messages').update({is_read:true,seen_at:new Date().toISOString()}).eq('id',msgId);}
function showSeenBar(seenAt){const bar=document.getElementById('seen-indicator');if(!bar)return;if(seenAt){bar.style.display='';bar.textContent=`* Seen ${fmtTime(seenAt)}`;}else bar.style.display='none';}

// ── Conversations ─────────────────────────────────────────────
async function loadConversations(){
  const{data:msgs}=await sb.from('private_messages').select('sender_id,receiver_id,content,created_at').or(`sender_id.eq.${ME.id},receiver_id.eq.${ME.id}`).order('created_at',{ascending:false});
  const list=document.getElementById('convo-list');
  if(!msgs?.length){list.innerHTML=`<div class="convo-empty">No chats yet.<br>Tap <strong>+</strong> to add!</div>`;return;}
  const seen=new Set(),ids=[],previews={};
  msgs.forEach(m=>{const pid=m.sender_id===ME.id?m.receiver_id:m.sender_id;if(!seen.has(pid)){seen.add(pid);ids.push(pid);previews[pid]=m.content||'📷 Image';}});
  const{data:profiles}=await sb.from('profiles').select('*').in('id',ids);
  list.innerHTML='';
  ids.map(id=>profiles?.find(p=>p.id===id)).filter(Boolean).forEach(p=>prependConvoItem(p,previews[p.id],true));
}
function prependConvoItem(p,preview,append=false){
  const list=document.getElementById('convo-list');
  const existing=list.querySelector(`.convo-item[data-uid="${p.id}"]`);
  if(existing){existing.querySelector('.convo-preview').textContent=preview||'';return;}
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);
  const el=document.createElement('div');el.className='convo-item';el.dataset.uid=p.id;
  el.onclick=()=>openThread(p.id,displayName(p),p.avatar_seed,p.avatar_style,p.avatar_url);
  el.innerHTML=`<div class="convo-av"><img src="${av}" loading="lazy"></div><div class="convo-info"><div class="convo-name">${escHtml(displayName(p))}</div><div class="convo-preview">${escHtml(preview||'')}</div></div>`;
  if(append)list.appendChild(el);else{if(list.querySelector('.convo-empty'))list.innerHTML='';if(list.firstChild)list.insertBefore(el,list.firstChild);else list.appendChild(el);}
}
function filterConvos(q){document.querySelectorAll('#convo-list .convo-item').forEach(el=>{el.style.display=el.querySelector('.convo-name')?.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';});}

// ── Open thread ───────────────────────────────────────────────
async function openThread(userId,name,seed,style,avatarUrl){
  activeUser=userId;
  // Show thread panel over chats panel on mobile, side by side on desktop
  document.getElementById('thread-panel').classList.add('active');
  document.getElementById('thread-typing').textContent='';
  document.getElementById('thread-av').src=getAvatar(seed,style,avatarUrl);
  document.getElementById('thread-name').textContent=name;
  document.querySelectorAll('.convo-item').forEach(el=>el.classList.remove('active'));
  document.querySelector(`.convo-item[data-uid="${userId}"]`)?.classList.add('active');

  // Apply per-contact theme
  const theme=getThemeForContact(userId);
  applyCtTheme(theme,false);

  subscribeTyping(userId);
  const area=document.getElementById('thread-msgs');
  area.innerHTML='<div class="spinner"></div>';
  const{data}=await sb.from('private_messages').select('*').or(`and(sender_id.eq.${ME.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${ME.id})`).order('created_at',{ascending:true}).limit(150);
  area.innerHTML='';
  (data||[]).forEach(m=>{if(!m.deleted_by?.includes(ME.id))appendPrivateMsg(m);});
  scrollBottom(area);
  const lastSeen=[...(data||[])].reverse().find(m=>m.sender_id===ME.id&&m.seen_at);
  showSeenBar(lastSeen?.seen_at);
  const unread=(data||[]).filter(m=>m.sender_id===userId&&!m.is_read);
  for(const m of unread) await markSeen(m.id);
}
function closeThread(){
  document.getElementById('thread-panel').classList.remove('active');
  activeUser=null;if(typingCh)sb.removeChannel(typingCh);
}

function appendPrivateMsg(msg){
  const area=document.getElementById('thread-msgs'),isMine=msg.sender_id===ME.id;
  const isPoll  = msg.content?.startsWith('📊 Poll:');
  const isTrade = msg.content?.startsWith('🤝 Trade offer');
  const isCard  = isPoll || isTrade;

  let inner='';
  if(isPoll)  inner = renderPollCard(msg.content);
  else if(isTrade) inner = renderTradeCard(msg.content);
  else {
    let bubble='';
    if(msg.content)   bubble+=`<div class="msg-text">${linkify(msg.content)}</div>`;
    if(msg.image_url) bubble+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;
    inner=`<div class="msg-bubble ct-bubble">${bubble}</div>`;
  }
  // If it's an image-only standalone (no content) show image directly
  if(!msg.content && msg.image_url) inner=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;

  const el=document.createElement('div');
  el.className=`msg${isMine?' mine':''}${isCard?' msg-card-wrap':''}`;
  el.dataset.id=msg.id;el.dataset.table='private_messages';
  el.innerHTML=`<div class="msg-body" style="max-width:${isCard?'90':'82'}%"><div class="msg-meta"><span>${timeAgo(msg.created_at)}</span></div>${inner}</div>`;
  addMsgCtx(el,msg.id,'private_messages',isMine);
  area.appendChild(el);
}
async function sendPrivate(){
  if(!activeUser)return;
  const inp=document.getElementById('thread-input'),txt=inp.value.trim();if(!txt)return;inp.value='';
  const{data}=await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:txt}).select().single();
  if(data){appendPrivateMsg(data);scrollBottom(document.getElementById('thread-msgs'));showSeenBar(null);const prev=document.querySelector(`.convo-item[data-uid="${activeUser}"] .convo-preview`);if(prev)prev.textContent=txt;}
}
async function uploadPmImage(input){
  if(!activeUser)return;const file=input.files[0];if(!file)return;
  const path=`pm/${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);
  const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);
  const{data}=await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,image_url:publicUrl}).select().single();
  if(data){appendPrivateMsg(data);scrollBottom(document.getElementById('thread-msgs'));}input.value='';
}

// ── Per-contact chat theme ────────────────────────────────────
function applyCtTheme(theme,save=true){
  if(save&&activeUser) setThemeForContact(activeUser,theme);
  const t=CHAT_THEMES[theme]||CHAT_THEMES.default;
  const area=document.getElementById('thread-msgs');
  if(area) area.style.background=t.bg;
  // Mark active dot
  document.querySelectorAll('.ct-dot').forEach(d=>d.classList.toggle('active',d.dataset.t===theme));
}
// Also expose for onclick
window.applyCtTheme=applyCtTheme;

// ── 3-dot menu ────────────────────────────────────────────────
function toggleDotMenu(){const m=document.getElementById('dot-menu');m.style.display=m.style.display==='none'?'':'none';}

// ── Poll ──────────────────────────────────────────────────────
function openPoll(){document.getElementById('dot-menu').style.display='none';document.getElementById('poll-question').value='';[...document.querySelectorAll('.poll-opt')].forEach((o,i)=>{if(i>1)o.closest('.form-group').remove();else o.value='';});document.getElementById('poll-modal').style.display='flex';}
function addPollOption(){const wrap=document.getElementById('poll-options-wrap'),c=wrap.querySelectorAll('.poll-opt').length+1;if(c>5)return;const d=document.createElement('div');d.className='form-group';d.innerHTML=`<label>Option ${c}</label><input type="text" class="poll-opt" placeholder="Option ${c}" maxlength="100">`;wrap.appendChild(d);}
async function submitPoll(){
  if(!activeUser)return;
  const q=document.getElementById('poll-question').value.trim(),opts=[...document.querySelectorAll('.poll-opt')].map(i=>i.value.trim()).filter(Boolean);
  if(!q)return alert('Question required.');if(opts.length<2)return alert('Need 2+ options.');
  document.getElementById('poll-modal').style.display='none';
  await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`📊 Poll: ${q}\n${opts.map((o,i)=>`${i+1}. ${o}`).join('\n')}`});
}
function renderPollCard(content){
  const lines=content.split('\n');
  const q=lines[0].replace('📊 Poll: ','');
  const opts=lines.slice(1).filter(Boolean);
  const optHtml=opts.map((l,i)=>`
    <div class="poll-option">
      <div class="poll-option-bar" style="width:0%"></div>
      <span class="poll-option-label">${escHtml(l)}</span>
    </div>`).join('');
  return `<div class="poll-card-standalone">
    <div class="poll-card-hdr">📊 Poll</div>
    <div class="poll-card-q">${escHtml(q)}</div>
    <div class="poll-options">${optHtml}</div>
  </div>`;
}

// ── Trade ─────────────────────────────────────────────────────
function openTradeModal(){document.getElementById('dot-menu').style.display='none';if(!activeUser)return;document.getElementById('trade-to-label').textContent=`To: ${document.getElementById('thread-name').textContent}`;document.getElementById('trade-offer').value='';document.getElementById('trade-want').value='';document.getElementById('trade-note').value='';document.getElementById('trade-modal').style.display='flex';}
async function sendTrade(){
  if(!activeUser)return;
  const offer=document.getElementById('trade-offer').value.trim(),want=document.getElementById('trade-want').value.trim(),note=document.getElementById('trade-note').value.trim();
  if(!offer||!want)return alert('Fill both fields.');
  document.getElementById('trade-modal').style.display='none';
  await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`🤝 Trade offer sent!\nOffer: ${offer}\nWant: ${want}${note?'\nNote: '+note:''}`});
}
function renderTradeCard(content){
  const lines=content.split('\n');
  const offer = lines.find(l=>l.startsWith('Offer: '))?.replace('Offer: ','')||'?';
  const want  = lines.find(l=>l.startsWith('Want: '))?.replace('Want: ','')||'?';
  const note  = lines.find(l=>l.startsWith('Note: '))?.replace('Note: ','')||'';
  return `<div class="trade-card-standalone">
    <div class="trade-card-hdr">🤝 Trade Offer</div>
    <div class="trade-card-cols">
      <div class="trade-card-col">
        <div class="trade-card-lbl">I Offer</div>
        <div class="trade-card-val">${escHtml(offer)}</div>
      </div>
      <div class="trade-card-divider">⇄</div>
      <div class="trade-card-col">
        <div class="trade-card-lbl">I Want</div>
        <div class="trade-card-val">${escHtml(want)}</div>
      </div>
    </div>
    ${note?`<div class="trade-card-note">📝 ${escHtml(note)}</div>`:''}
  </div>`;
}

// ── Location ──────────────────────────────────────────────────
function sendLocation(){document.getElementById('dot-menu').style.display='none';if(!activeUser)return;if(!navigator.geolocation)return alert('Not supported.');navigator.geolocation.getCurrentPosition(async pos=>{const{latitude:lat,longitude:lng}=pos.coords;await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:activeUser,content:`📍 Location: https://www.google.com/maps?q=${lat},${lng}`});},()=>alert('Could not get location.'));}

// ── Add contact ───────────────────────────────────────────────
function openAddModal(){document.getElementById('add-modal').style.display='flex';document.getElementById('add-code-input').value='';document.getElementById('add-result').innerHTML='';setTimeout(()=>document.getElementById('add-code-input').focus(),100);}
document.getElementById('add-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')searchByCode();});
async function searchByCode(){
  const raw=document.getElementById('add-code-input').value.trim().replace('#',''),code=raw.padStart(6,'0'),res=document.getElementById('add-result');
  if(!raw){res.innerHTML='<div class="search-err">Enter a code.</div>';return;}
  res.innerHTML='<div class="spinner" style="margin:10px auto"></div>';
  const{data}=await sb.from('profiles').select('*').eq('user_code',code).maybeSingle();
  if(!data){res.innerHTML=`<div class="search-err">No user with #${code}</div>`;return;}
  if(data.id===ME.id){res.innerHTML='<div class="search-err">That\'s you! 😄</div>';return;}
  res.innerHTML=`<div class="search-result-card"><img src="${getAvatar(data.avatar_seed,data.avatar_style,data.avatar_url)}" class="src-av"><div class="src-info"><div class="src-name">${escHtml(displayName(data))}</div><div class="src-code">#${data.user_code}</div></div><button class="btn-sm" onclick="startChatFromSearch('${data.id}','${escAttr(displayName(data))}','${escAttr(data.avatar_seed)}','${escAttr(data.avatar_style)}','${escAttr(data.avatar_url||'')}')">Chat</button></div>`;
}
async function startChatFromSearch(uid,name,seed,style,url){document.getElementById('add-modal').style.display='none';switchPanel('chats');await openThread(uid,name,seed,style,url||null);}

// ── Groups ────────────────────────────────────────────────────
async function loadGroups(){
  const{data:mems}=await sb.from('group_members').select('group_id').eq('user_id',ME.id);
  const list=document.getElementById('group-list');
  if(!mems?.length){list.innerHTML='<div class="convo-empty">No groups yet.</div>';return;}
  const{data:groups}=await sb.from('group_chats').select('*').in('id',mems.map(m=>m.group_id));
  list.innerHTML=(groups||[]).map(g=>`<div class="convo-item" data-gid="${g.id}" onclick="openGroup(${g.id},'${escAttr(g.name)}')"><div class="convo-av" style="background:var(--sur2);display:flex;align-items:center;justify-content:center;font-size:18px">👥</div><div class="convo-info"><div class="convo-name">${escHtml(g.name)}</div><div class="convo-preview">Group chat</div></div></div>`).join('')||'<div class="convo-empty">No groups yet</div>';
}
async function openGroup(groupId,name){
  activeGroup=groupId;
  document.getElementById('group-thread-panel').classList.add('active');
  document.getElementById('group-thread-name').textContent=name;
  document.querySelectorAll('#group-list .convo-item').forEach(el=>el.classList.remove('active'));
  document.querySelector(`[data-gid="${groupId}"]`)?.classList.add('active');
  const area=document.getElementById('group-msgs');area.innerHTML='<div class="spinner"></div>';
  const{data}=await sb.from('group_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)').eq('group_id',groupId).order('created_at',{ascending:true}).limit(150);
  area.innerHTML='';(data||[]).forEach(m=>{if(!m.deleted_by?.includes(ME.id))appendGroupMsg(m);});scrollBottom(area);
  if(groupSub)sb.removeChannel(groupSub);
  groupSub=sb.channel(`grp-${groupId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'group_messages',filter:`group_id=eq.${groupId}`},async pl=>{
    const{data:full}=await sb.from('group_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)').eq('id',pl.new.id).single();
    if(full){appendGroupMsg(full);scrollBottom(area);}
  }).subscribe();
}
function appendGroupMsg(msg){
  const area=document.getElementById('group-msgs'),p=msg.profiles||{},isMine=msg.sender_id===ME.id;
  const av=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url),border=p.border_style||'none';
  let bubble='';if(msg.content)bubble+=`<div class="msg-text">${linkify(msg.content)}</div>`;if(msg.image_url)bubble+=`<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;
  const el=document.createElement('div');el.className=`msg${isMine?' mine':''}`;el.dataset.id=msg.id;el.dataset.table='group_messages';
  el.innerHTML=`<div class="msg-av-wrap"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div><div class="msg-body"><div class="msg-meta"><span class="msg-name">${isMine?'You':escHtml(displayName(p))}</span>${renderBadge(p.badge)}<span>${timeAgo(msg.created_at)}</span></div><div class="msg-bubble">${bubble}</div></div>`;
  addMsgCtx(el,msg.id,'group_messages',isMine);area.appendChild(el);
}
async function sendGroup(){if(!activeGroup)return;const inp=document.getElementById('group-input'),txt=inp.value.trim();if(!txt)return;inp.value='';await sb.from('group_messages').insert({group_id:activeGroup,sender_id:ME.id,content:txt});}
async function uploadGrpImage(input){if(!activeGroup)return;const file=input.files[0];if(!file)return;const path=`grp/${ME.id}/${Date.now()}-${file.name}`;await sb.storage.from('chat-images').upload(path,file);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);await sb.from('group_messages').insert({group_id:activeGroup,sender_id:ME.id,image_url:publicUrl});input.value='';}
function closeGroupThread(){document.getElementById('group-thread-panel').classList.remove('active');activeGroup=null;}
function openCreateGroup(){document.getElementById('create-group-modal').style.display='flex';}
async function createGroup(){
  const name=document.getElementById('group-name-input').value.trim();if(!name)return alert('Name required.');
  const codes=document.getElementById('group-members-input').value.split(',').map(s=>s.trim().replace('#','').padStart(6,'0')).filter(Boolean);
  const{data:grp,error}=await sb.from('group_chats').insert({name,created_by:ME.id}).select().single();
  if(error){alert('Failed: '+error.message);return;}
  await sb.from('group_members').insert({group_id:grp.id,user_id:ME.id});
  if(codes.length){const{data:others}=await sb.from('profiles').select('id').in('user_code',codes);if(others?.length)await sb.from('group_members').insert(others.filter(o=>o.id!==ME.id).map(o=>({group_id:grp.id,user_id:o.id})));}
  document.getElementById('create-group-modal').style.display='none';document.getElementById('group-name-input').value='';document.getElementById('group-members-input').value='';
  await loadGroups();openGroup(grp.id,name);
}
async function openGroupInfo(){if(!activeGroup)return;document.getElementById('group-info-name').textContent=document.getElementById('group-thread-name').textContent;document.getElementById('group-info-modal').style.display='flex';const{data:mems}=await sb.from('group_members').select('*, profiles(name,surname,user_code)').eq('group_id',activeGroup);document.getElementById('group-member-list').innerHTML=(mems||[]).map(m=>`<div class="convo-item" style="padding:8px 0;border:none"><div class="convo-info"><div class="convo-name">${escHtml(displayName(m.profiles))}</div><div class="convo-preview">#${m.profiles?.user_code||'------'}</div></div></div>`).join('');}
async function addGroupMember(){const code=document.getElementById('add-member-code').value.trim().replace('#','').padStart(6,'0');const{data:p}=await sb.from('profiles').select('id').eq('user_code',code).maybeSingle();if(!p)return alert('User not found.');const{error}=await sb.from('group_members').insert({group_id:activeGroup,user_id:p.id});if(error)return alert('Error: '+error.message);document.getElementById('add-member-code').value='';openGroupInfo();}

// ── Profile / Settings ────────────────────────────────────────
function showMyProfile(){
  stalkedUserId=null;
  document.getElementById('pv-section').style.display='';
  document.getElementById('stalk-section').style.display='none';
  document.getElementById('edit-section').style.display='none';
  document.getElementById('settings-title').textContent='Profile';
  document.getElementById('settings-back').style.display='none';
  loadProfileView();
}
function loadProfileView(){
  const av=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);
  document.getElementById('pv-avatar').src=av;
  document.getElementById('nav-avatar').src=av;
  document.getElementById('pv-code').textContent=`#${ME.user_code||'------'}`;
  document.getElementById('pv-name').textContent=displayName(ME);
  document.getElementById('pv-badge').innerHTML=renderBadge(ME.badge);
  document.getElementById('pv-bio').innerHTML=ME.bio?linkify(ME.bio):'';
  document.getElementById('pv-types').innerHTML=renderTypeTags(ME.user_types||[]);
  document.getElementById('pv-border-ring').className=`avatar-border-ring border-ring-${ME.border_style||'none'}`;
  applyGlobalTheme();
}
async function openProfilePage(userId){
  if(!userId) return;
  if(userId===ME.id){ switchPanel('settings'); showMyProfile(); return; }
  stalkedUserId=userId;
  const{data:p}=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();
  if(!p) return;

  // Show stalk MODAL (not navigate away)
  const m=document.getElementById('stalk-modal');
  if(!m) return;

  // Apply 3D border ring
  const ring=document.getElementById('sm-border-ring');
  ring.className=`avatar-border-ring sm-border-ring border-ring-${p.border_style||'none'}`;
  document.getElementById('sm-avatar').src=getAvatar(p.avatar_seed,p.avatar_style,p.avatar_url);
  document.getElementById('sm-code').textContent=`#${p.user_code||'------'}`;
  document.getElementById('sm-name').textContent=displayName(p);
  document.getElementById('sm-badge').innerHTML=renderBadge(p.badge);
  document.getElementById('sm-bio').innerHTML=p.bio?linkify(p.bio):'';
  document.getElementById('sm-types').innerHTML=renderTypeTags(p.user_types||[]);

  const{data:posts}=await sb.from('posts').select('*').eq('user_id',userId).order('created_at',{ascending:false}).limit(6);
  document.getElementById('sm-posts').innerHTML=(posts||[]).map(renderPostCard).join('')||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No posts yet</div>';

  m.style.display='flex';
}
function closeSettings(){showMyProfile();}
function messageFromProfile(){if(!stalkedUserId)return;const name=document.getElementById('sm-name').textContent;document.getElementById('stalk-modal').style.display='none';sb.from('profiles').select('avatar_seed,avatar_style,avatar_url').eq('id',stalkedUserId).single().then(({data:p})=>{if(p){switchPanel('chats');openThread(stalkedUserId,name,p.avatar_seed,p.avatar_style,p.avatar_url);}});}

// ── Edit Profile ──────────────────────────────────────────────
let editAvatarSeed=null, editAvatarStyle=null, editTypesArr=[];
function openEditProfile(){
  document.getElementById('pv-section').style.display='none';
  document.getElementById('stalk-section').style.display='none';
  document.getElementById('edit-section').style.display='';
  document.getElementById('settings-title').textContent='Edit Profile';
  document.getElementById('settings-back').style.display='flex';
  editAvatarSeed=ME.avatar_seed; editAvatarStyle=ME.avatar_style;
  editTypesArr=[...(ME.user_types||[])];
  document.getElementById('edit-avatar-preview').src=getAvatar(editAvatarSeed,editAvatarStyle,ME.avatar_url);
  document.getElementById('edit-name').value=ME.name||'';
  document.getElementById('edit-middle').value=ME.middle_name||'';
  document.getElementById('edit-surname').value=ME.surname||'';
  document.getElementById('edit-bio').value=ME.bio||'';
  // Name change cooldown
  const hint=document.getElementById('name-change-hint');
  if(ME.name_changed_at){
    const next=new Date(ME.name_changed_at);next.setDate(next.getDate()+30);
    const daysLeft=Math.ceil((next-Date.now())/(86400000));
    if(daysLeft>0){document.getElementById('edit-name').disabled=true;hint.textContent=`(can change in ${daysLeft} days)`;}
    else{document.getElementById('edit-name').disabled=false;hint.textContent='';}
  } else {document.getElementById('edit-name').disabled=false;hint.textContent='';}
  renderEditAvatarGrid();
  renderTypeChips();
}
function renderEditAvatarGrid(){
  document.getElementById('edit-avatar-grid').innerHTML=AVATAR_LIST.map(av=>`<div class="av-opt ${av.seed===editAvatarSeed?'selected':''}" onclick="pickEditAvatar('${av.seed}','${av.style}')"><img src="${getAvatar(av.seed,av.style)}" loading="lazy"></div>`).join('');
}
function pickEditAvatar(seed,style){
  editAvatarSeed=seed;editAvatarStyle=style;
  if(!ME.avatar_url) document.getElementById('edit-avatar-preview').src=getAvatar(seed,style);
  document.querySelectorAll('#edit-avatar-grid .av-opt').forEach((el,i)=>el.classList.toggle('selected',AVATAR_LIST[i].seed===seed));
}
async function uploadEditPhoto(input){
  const file=input.files[0];if(!file)return;
  const path=`${ME.id}/${Date.now()}-${file.name}`;
  const{error}=await sb.storage.from('avatars').upload(path,file,{upsert:true});if(error)return alert('Upload failed');
  const{data:{publicUrl}}=sb.storage.from('avatars').getPublicUrl(path);
  await sb.from('profiles').update({avatar_url:publicUrl}).eq('id',ME.id);
  ME.avatar_url=publicUrl;document.getElementById('edit-avatar-preview').src=publicUrl;
}
function renderTypeChips(){
  document.getElementById('edit-types').innerHTML=USER_TYPES.map(t=>`<div class="type-chip ${editTypesArr.includes(t.id)?'active':''}" onclick="toggleType('${t.id}')">${t.emoji} ${t.label}</div>`).join('');
}
function toggleType(id){if(editTypesArr.includes(id)){editTypesArr=editTypesArr.filter(x=>x!==id);}else{if(editTypesArr.length>=3){alert('Max 3!');return;}editTypesArr.push(id);}renderTypeChips();}
async function saveProfile(){
  const name=document.getElementById('edit-name').value.trim(),middle=document.getElementById('edit-middle').value.trim(),surname=document.getElementById('edit-surname').value.trim(),bio=document.getElementById('edit-bio').value.trim();
  if(!name)return alert('Name required.');if(!surname)return alert('Surname required.');
  const updates={middle_name:middle||null,surname,bio:bio||null,user_types:editTypesArr,avatar_seed:editAvatarSeed,avatar_style:editAvatarStyle};
  // Name change cooldown check
  if(name!==ME.name){const nc=ME.name_changed_at;if(nc){const next=new Date(nc);next.setDate(next.getDate()+30);if(Date.now()<next)return alert(`Name can only be changed every 30 days.`);}updates.name=name;updates.name_changed_at=new Date().toISOString();}
  const{error}=await sb.from('profiles').update(updates).eq('id',ME.id);
  if(error)return alert('Save failed: '+error.message);
  Object.assign(ME,{...updates,name:name||ME.name});
  loadProfileView();closeSettings();
}

// ── Posts ─────────────────────────────────────────────────────
function setPostImage(input){postImageFile=input.files[0];document.getElementById('post-img-label').textContent=postImageFile?`📷 ${postImageFile.name}`:'';} 
async function submitPost(){
  const txt=document.getElementById('post-input').value.trim();if(!txt&&!postImageFile)return;
  let imgUrl=null;
  if(postImageFile){const path=`posts/${ME.id}/${Date.now()}-${postImageFile.name}`;await sb.storage.from('chat-images').upload(path,postImageFile);const{data:{publicUrl}}=sb.storage.from('chat-images').getPublicUrl(path);imgUrl=publicUrl;}
  await sb.from('posts').insert({user_id:ME.id,content:txt||null,image_url:imgUrl});
  document.getElementById('post-input').value='';document.getElementById('post-img-label').textContent='';postImageFile=null;document.getElementById('post-img-input').value='';loadMyPosts();
}
async function loadMyPosts(){const{data}=await sb.from('posts').select('*').eq('user_id',ME.id).order('created_at',{ascending:false}).limit(20);document.getElementById('my-posts').innerHTML=(data||[]).map(renderPostCard).join('')||'<div style="font-size:12px;color:var(--muted);text-align:center;padding:14px">No posts yet</div>';}
function renderPostCard(post){return `<div class="post-card">${post.content?`<div class="post-text">${linkify(post.content)}</div>`:''} ${post.image_url?`<img class="post-img" src="${escHtml(post.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`:''}<div class="post-time">${timeAgo(post.created_at)}</div></div>`;}

// ── Settings actions ──────────────────────────────────────────
function openNotifSettings(){if('Notification' in window){Notification.requestPermission().then(p=>alert(p==='granted'?'Notifications enabled!':'Notifications not allowed. Please enable in browser settings.'));}else{alert('Notifications not supported on this browser.');}}
function openShareProfile(){const m=document.getElementById('share-modal');document.getElementById('share-code').textContent=`#${ME.user_code||'------'}`;document.getElementById('share-qr').textContent=`User code: #${ME.user_code}`;m.style.display='flex';}
function copyProfileCode(){navigator.clipboard.writeText(`#${ME.user_code}`).then(()=>alert('Copied!'));}
function openHelp(){alert('Help Center\n\nFor support, contact us at webzovvo@gmail.com or message @000001 on Pulseship.');}
function openPrivacy(){alert('Privacy Center\n\n• Your messages are protected by Supabase Row-Level Security.\n• Only sender and receiver can see private messages.\n• Anonymous match hides your identity.\n• Delete messages anytime by long pressing.');}
function openPolicy(){window.open('https://supabase.com/privacy','_blank');}

function confirmDeleteAccount(){document.getElementById('delete-confirm-input').value='';document.getElementById('delete-error').style.display='none';document.getElementById('delete-modal').style.display='flex';}
async function deleteAccount(){
  const typed=document.getElementById('delete-confirm-input').value.trim();
  const myName=displayName(ME);
  const err=document.getElementById('delete-error');
  if(typed.toLowerCase()!==myName.toLowerCase()){err.textContent=`Type your name exactly: "${myName}"`;err.style.display='';return;}
  // Delete profile (cascades) then sign out
  await sb.from('profiles').delete().eq('id',ME.id);
  await sb.auth.signOut();
  window.location.href='index.html';
}

// ── Anonymous Match ───────────────────────────────────────────
async function checkAnonDaily(){
  const today=new Date().toISOString().split('T')[0];
  const{data}=await sb.from('anon_daily').select('count').eq('user_id',ME.id).eq('date',today).maybeSingle();
  anonMatchesLeft=Math.max(0,10-(data?.count||0));
  const el=document.getElementById('match-daily-count');if(el)el.textContent=`${anonMatchesLeft} left today`;
  const btn=document.getElementById('match-start-btn');if(btn){btn.disabled=anonMatchesLeft<=0;if(anonMatchesLeft<=0)btn.textContent='Come back tomorrow!';}
}
function openMatchFullscreen(){
  if(anonMatchesLeft<=0)return;
  const fs=document.getElementById('match-fs');fs.style.display='flex';
  document.getElementById('match-fs-waiting').style.display='';
  document.getElementById('match-fs-chat').style.display='none';
  document.getElementById('match-fs-ended').style.display='none';
  document.getElementById('mfs-avatar').src=getAvatar(ME.avatar_seed,ME.avatar_style,ME.avatar_url);
  document.getElementById('mfs-daily').textContent=`${anonMatchesLeft} matches left today`;
  startMatching();
}
async function startMatching(){
  await sb.from('anon_queue').upsert({user_id:ME.id,joined_at:new Date().toISOString()});
  const{data:others}=await sb.from('anon_queue').select('user_id').neq('user_id',ME.id).order('joined_at',{ascending:true}).limit(1);
  if(others?.length){
    const partnerId=others[0].user_id;
    await sb.from('anon_queue').delete().in('user_id',[ME.id,partnerId]);
    const{data:match}=await sb.from('anon_matches').insert({user1_id:ME.id,user2_id:partnerId}).select().single();
    if(match){anonSlot=1;startAnonChat(match);}
  } else {
    if(anonQueueSub)sb.removeChannel(anonQueueSub);
    anonQueueSub=sb.channel(`queue-${ME.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'anon_matches',filter:`user2_id=eq.${ME.id}`},async pl=>{await sb.from('anon_queue').delete().eq('user_id',ME.id);anonSlot=2;startAnonChat(pl.new);sb.removeChannel(anonQueueSub);})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'anon_matches',filter:`user1_id=eq.${ME.id}`},pl=>{if(anonSlot)return;anonSlot=1;startAnonChat(pl.new);sb.removeChannel(anonQueueSub);})
      .subscribe();
  }
}
async function startAnonChat(match){
  anonMatchId=match.id;anonHeartShown=false;myHeartPressed=false;
  document.getElementById('match-fs-waiting').style.display='none';
  document.getElementById('match-fs-chat').style.display='flex';
  document.getElementById('anon-msgs').innerHTML='';
  document.getElementById('heart-btn').style.display='none';
  // Daily count
  const today=new Date().toISOString().split('T')[0];
  const{data:ex}=await sb.from('anon_daily').select('count').eq('user_id',ME.id).eq('date',today).maybeSingle();
  if(ex)await sb.from('anon_daily').update({count:(ex.count||0)+1}).eq('user_id',ME.id).eq('date',today);
  else await sb.from('anon_daily').insert({user_id:ME.id,date:today,count:1});
  anonMatchesLeft=Math.max(0,anonMatchesLeft-1);
  document.getElementById('mfs-daily').textContent=`${anonMatchesLeft} matches left today`;
  // Sub
  if(anonSub)sb.removeChannel(anonSub);
  anonSub=sb.channel(`anon-${anonMatchId}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'anon_messages',filter:`match_id=eq.${anonMatchId}`},pl=>{if(pl.new.slot!==anonSlot)appendAnonMsg(pl.new.content,false);})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'anon_matches',filter:`id=eq.${anonMatchId}`},pl=>{if(pl.new.user1_heart&&pl.new.user2_heart)bothHeart();else if((anonSlot===1&&pl.new.user2_heart)||(anonSlot===2&&pl.new.user1_heart)){const btn=document.getElementById('heart-btn');if(btn.style.display==='none'){btn.style.display='';}btn.textContent='💌';}})
    .subscribe();
  // Timer
  let secs=120;
  anonTimer=setInterval(()=>{
    secs--;
    const m=Math.floor(secs/60),s=secs%60;
    document.getElementById('match-timer-text').textContent=`${m}:${String(s).padStart(2,'0')}`;
    if(secs===60&&!anonHeartShown){anonHeartShown=true;document.getElementById('heart-btn').style.display='';}
    if(secs<=0){clearInterval(anonTimer);timeUp();}
  },1000);
}
function appendAnonMsg(content,mine){const area=document.getElementById('anon-msgs');const el=document.createElement('div');el.className=`msg${mine?' mine':''}`;el.innerHTML=`<div class="msg-body" style="max-width:80%"><div class="msg-bubble">${linkify(content)}</div></div>`;area.appendChild(el);scrollBottom(area);}
async function sendAnon(){const inp=document.getElementById('anon-input'),txt=inp.value.trim();if(!txt||!anonMatchId)return;inp.value='';await sb.from('anon_messages').insert({match_id:anonMatchId,slot:anonSlot,content:txt});appendAnonMsg(txt,true);}
async function pressHeart(){if(!anonMatchId||myHeartPressed)return;myHeartPressed=true;document.getElementById('heart-btn').textContent='❤️';const f=anonSlot===1?{user1_heart:true}:{user2_heart:true};await sb.from('anon_matches').update(f).eq('id',anonMatchId);}
async function bothHeart(){
  clearInterval(anonTimer);
  const{data:match}=await sb.from('anon_matches').select('user1_id,user2_id').eq('id',anonMatchId).single();
  const partnerId=anonSlot===1?match.user2_id:match.user1_id;
  await sb.from('private_messages').insert({sender_id:ME.id,receiver_id:partnerId,content:'💕 We matched from Pulseship anonymous chat! Hi!'});
  await sb.from('anon_matches').update({connected:true,ended_at:new Date().toISOString()}).eq('id',anonMatchId);
  if(anonSub)sb.removeChannel(anonSub);
  document.getElementById('match-fs-chat').style.display='none';
  document.getElementById('match-fs-ended').style.display='flex';
  document.getElementById('ended-icon').textContent='💕';
  document.getElementById('ended-title').textContent="It's a match!";
  document.getElementById('ended-msg').textContent="You're now connected! Check your Messages.";
}
function timeUp(){
  if(anonSub)sb.removeChannel(anonSub);
  if(anonMatchId)sb.from('anon_matches').update({ended_at:new Date().toISOString()}).eq('id',anonMatchId);
  document.getElementById('match-fs-chat').style.display='none';
  document.getElementById('match-fs-ended').style.display='flex';
  document.getElementById('ended-icon').textContent='⏱';
  document.getElementById('ended-title').textContent="Time's up!";
  document.getElementById('ended-msg').textContent=myHeartPressed?'No mutual match this time.':'Session ended.';
}
function endMatch(){if(anonTimer)clearInterval(anonTimer);timeUp();}
function resetMatch(){anonMatchId=null;anonSlot=null;anonHeartShown=false;myHeartPressed=false;document.getElementById('match-fs-ended').style.display='none';document.getElementById('match-fs-waiting').style.display='';startMatching();}
async function cancelMatch(){if(anonQueueSub)sb.removeChannel(anonQueueSub);await sb.from('anon_queue').delete().eq('user_id',ME.id);closeMatchFs();}
function closeMatchFs(){document.getElementById('match-fs').style.display='none';if(anonTimer)clearInterval(anonTimer);}

// ── DRAW GAME ─────────────────────────────────────────────────
function openDrawGame(){
  const modal=document.getElementById('game-modal'); modal.style.display='flex';
  if(!drawCanvas){initDrawGame();}
}
function closeDrawGame(){document.getElementById('game-modal').style.display='none';}
function toggleGameFs(){
  gameIsFs=!gameIsFs;
  const modal=document.getElementById('game-modal');
  modal.classList.toggle('game-modal-fs',gameIsFs);
  setTimeout(()=>{if(drawCanvas){drawCanvas.width=drawCanvas.offsetWidth;drawCanvas.height=drawCanvas.offsetHeight;redrawAll();}},50);
}
function initDrawGame(){
  drawCanvas=document.getElementById('draw-canvas');
  drawCanvas.width=drawCanvas.offsetWidth;
  drawCanvas.height=300;
  drawCtx=drawCanvas.getContext('2d');
  drawCtx.fillStyle='#fff';drawCtx.fillRect(0,0,drawCanvas.width,drawCanvas.height);

  // Color dots
  const dotsEl=document.getElementById('color-dots');
  dotsEl.innerHTML=DRAW_COLORS.map(c=>`<div class="draw-color-dot ${c===drawColor?'active':''}" style="background:${c}" onclick="setDrawColor('${c}')"></div>`).join('');

  // Events
  drawCanvas.addEventListener('mousedown', startDraw);
  drawCanvas.addEventListener('mousemove', doDraw);
  drawCanvas.addEventListener('mouseup',   endDraw);
  drawCanvas.addEventListener('touchstart', e=>{e.preventDefault();startDraw(e.touches[0]);},{passive:false});
  drawCanvas.addEventListener('touchmove',  e=>{e.preventDefault();doDraw(e.touches[0]);},{passive:false});
  drawCanvas.addEventListener('touchend',   endDraw);

  // Make draggable
  initDrag();

  // Load existing strokes
  loadDrawStrokes();

  // Subscribe to new strokes
  if(drawSub)sb.removeChannel(drawSub);
  drawSub=sb.channel('draw-rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'draw_strokes',filter:'room_id=eq.world'},pl=>{
    if(pl.new.user_id!==ME.id){drawStrokePath(pl.new.data);drawStrokes.push(pl.new.data);}
  }).on('postgres_changes',{event:'DELETE',schema:'public',table:'draw_strokes',filter:'room_id=eq.world'},()=>{
    drawStrokes=[];drawCtx.fillStyle='#fff';drawCtx.fillRect(0,0,drawCanvas.width,drawCanvas.height);
  }).subscribe();
}
let currentPath=[];
function getPos(e){const r=drawCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(drawCanvas.width/r.width),y:(e.clientY-r.top)*(drawCanvas.height/r.height)};}
function startDraw(e){drawIsDrawing=true;const p=getPos(e);currentPath=[p];drawCtx.beginPath();drawCtx.moveTo(p.x,p.y);}
function doDraw(e){if(!drawIsDrawing)return;const p=getPos(e);currentPath.push(p);drawCtx.lineWidth=drawEraser?20:drawSize;drawCtx.strokeStyle=drawEraser?'#fff':drawColor;drawCtx.lineCap='round';drawCtx.lineJoin='round';drawCtx.lineTo(p.x,p.y);drawCtx.stroke();}
async function endDraw(){
  if(!drawIsDrawing||!currentPath.length)return;drawIsDrawing=false;
  const stroke={color:drawEraser?'#fff':drawColor,size:drawEraser?20:drawSize,points:currentPath};
  drawStrokes.push(stroke);
  await sb.from('draw_strokes').insert({room_id:'world',user_id:ME.id,data:stroke});
  currentPath=[];
}
function drawStrokePath(s){
  if(!drawCtx||!s.points?.length)return;
  drawCtx.beginPath();drawCtx.moveTo(s.points[0].x,s.points[0].y);
  s.points.forEach(p=>drawCtx.lineTo(p.x,p.y));
  drawCtx.lineWidth=s.size;drawCtx.strokeStyle=s.color;drawCtx.lineCap='round';drawCtx.lineJoin='round';drawCtx.stroke();
}
function redrawAll(){
  drawCtx.fillStyle='#fff';drawCtx.fillRect(0,0,drawCanvas.width,drawCanvas.height);
  drawStrokes.forEach(s=>drawStrokePath(s));
}
async function loadDrawStrokes(){
  const{data}=await sb.from('draw_strokes').select('data').eq('room_id','world').order('created_at',{ascending:true}).limit(200);
  drawStrokes=(data||[]).map(r=>r.data);redrawAll();
}
async function clearMyStrokes(){await sb.from('draw_strokes').delete().eq('user_id',ME.id).eq('room_id','world');loadDrawStrokes();}
function setDrawColor(c){drawColor=c;drawEraser=false;document.getElementById('eraser-btn').classList.remove('active');document.querySelectorAll('.draw-color-dot').forEach(d=>d.classList.toggle('active',d.style.background===c));}
function toggleEraser(){drawEraser=!drawEraser;document.getElementById('eraser-btn').classList.toggle('active',drawEraser);}

function initDrag(){
  const hdr=document.getElementById('game-drag-hdr');
  const inner=document.getElementById('game-modal-inner');
  let dragging=false,ox=0,oy=0;
  hdr.addEventListener('mousedown',e=>{dragging=true;ox=e.clientX-inner.offsetLeft;oy=e.clientY-inner.offsetTop;});
  document.addEventListener('mousemove',e=>{if(!dragging)return;inner.style.left=(e.clientX-ox)+'px';inner.style.top=(e.clientY-oy)+'px';inner.style.right='auto';inner.style.bottom='auto';});
  document.addEventListener('mouseup',()=>dragging=false);
}

// ── Logout ────────────────────────────────────────────────────
async function doLogout(){
  clearInterval(leaderboardTimer);if(presenceCh)await presenceCh.untrack();
  await sb.auth.signOut();window.location.href='index.html';
}

// ── Utils ─────────────────────────────────────────────────────
function scrollBottom(el){if(el)el.scrollTop=el.scrollHeight;}
function renderTypeTags(types){return(types||[]).map(id=>{const t=USER_TYPES.find(x=>x.id===id);return t?`<span class="type-tag">${t.emoji} ${t.label}</span>`:''}).join('');}
function openImgFull(src){const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out';ov.innerHTML=`<img src="${src}" style="max-width:92vw;max-height:92vh;border-radius:8px">`;ov.onclick=()=>ov.remove();document.body.appendChild(ov);}