// ============================================================
// CHATGRID v5 — chat.js
// ============================================================

let ME = null, activeUser = null, activeGroup = null, stalkedUserId = null;
let privateSub = null, groupSub = null, incomingDMSub = null, presenceCh = null;
let unreadCount = 0, editSelSeed = null, editSelStyle = null, editTypes = [];
let pwaPrompt = null, postImageFile = null, ctxMsgId = null, ctxMsgTable = null;
let typingTimer = null, typingCh = null;
let leaderboardTimer = null;
let mgTimer = null, mgScore = 0;

// ── Mobile viewport fix ───────────────────────────────────────
(function() {
  function set() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', h + 'px');
  }
  set();
  if (window.visualViewport) window.visualViewport.addEventListener('resize', set);
  window.addEventListener('resize', set);
})();

// ── PWA ───────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); pwaPrompt = e;
  document.getElementById('pwa-install-btn').style.display = '';
});
function installPWA() { if (pwaPrompt) { pwaPrompt.prompt(); pwaPrompt = null; document.getElementById('pwa-install-btn').style.display = 'none'; } }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ── INIT ──────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return redirect();
  const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!p) return redirect();
  ME = p;
  initUI();
  initPresence();
  await Notification.requestPermission().catch(() => {});
  cleanupWorld();
  loadWorldChat();
  loadConversations();
  loadGroups();
  loadMyPosts();
  subscribeIncomingDMs();
  startLeaderboardPing();
  loadLeaderboard();
})();

function redirect() { window.location.href = 'index.html'; }

function initUI() {
  document.getElementById('nav-avatar').src = getAvatar(ME.avatar_seed, ME.avatar_style, ME.avatar_url);
  loadProfileView();
  document.getElementById('world-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendWorld();} });
  document.getElementById('thread-input').addEventListener('keydown', e => {
    if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendPrivate();}
    else sendTyping();
  });
  document.getElementById('group-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendGroup();} });
  document.addEventListener('click', e => {
    const dm = document.getElementById('dot-menu');
    if (dm && !dm.contains(e.target) && e.target.id !== 'dot-btn') dm.style.display = 'none';
    if (!e.target.closest('.ctx-menu')) document.getElementById('ctx-menu').style.display = 'none';
  });
}

// ── Panel switching ───────────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`${name}-panel`)?.classList.add('active');
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  if (name === 'private') { unreadCount = 0; updateDMBadge(); }
  if (name === 'about') loadLeaderboard();
}
function updateDMBadge() {
  const b = document.getElementById('dm-badge');
  if (unreadCount > 0) { b.textContent = unreadCount > 9 ? '9+' : unreadCount; b.style.display = ''; }
  else b.style.display = 'none';
}

// ── Presence / online count ───────────────────────────────────
function initPresence() {
  presenceCh = sb.channel('cg-presence', { config: { presence: { key: ME.id } } });
  presenceCh
    .on('presence', { event: 'sync' }, () => {
      document.getElementById('online-label').textContent = Object.keys(presenceCh.presenceState()).length + ' online';
    })
    .subscribe(async s => { if (s === 'SUBSCRIBED') await presenceCh.track({ userId: ME.id }); });
}

// ── Leaderboard (time online) ─────────────────────────────────
function startLeaderboardPing() {
  pingLeaderboard();
  leaderboardTimer = setInterval(pingLeaderboard, 60000); // every 60s
}
async function pingLeaderboard() {
  const { data: existing } = await sb.from('leaderboard').select('score').eq('user_id', ME.id).maybeSingle();
  const score = (existing?.score || 0) + 60;
  await sb.from('leaderboard').upsert({
    user_id: ME.id, user_name: displayName(ME), score, last_ping: new Date().toISOString(), updated_at: new Date().toISOString()
  });
}
async function loadLeaderboard() {
  const { data } = await sb.from('leaderboard').select('*').order('score', { ascending: false }).limit(10);
  const container = document.getElementById('leaderboard-list');
  if (!data?.length) { container.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No data yet</div>'; return; }
  container.innerHTML = data.map((r, i) => {
    const hrs = Math.floor(r.score / 3600);
    const mins = Math.floor((r.score % 3600) / 60);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
    return `<div class="lb-row ${r.user_id === ME.id ? 'lb-me' : ''}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${escHtml(r.user_name || 'User')}</span>
      <span class="lb-time">${hrs}h ${mins}m</span>
    </div>`;
  }).join('');
}

// ── Mini game ─────────────────────────────────────────────────
function startGame() {
  mgScore = 0; let timeLeft = 10;
  document.getElementById('mg-idle').style.display = 'none';
  document.getElementById('mg-done').style.display = 'none';
  document.getElementById('mg-play').style.display = '';
  document.getElementById('mg-score').textContent = '0';
  document.getElementById('mg-timer').textContent = '10';
  moveTarget();
  mgTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('mg-timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(mgTimer);
      document.getElementById('mg-play').style.display = 'none';
      document.getElementById('mg-done').style.display = '';
      document.getElementById('mg-final').textContent = mgScore;
    }
  }, 1000);
}
function hitTarget() {
  mgScore++;
  document.getElementById('mg-score').textContent = mgScore;
  moveTarget();
}
function moveTarget() {
  const field = document.getElementById('mg-field');
  const target = document.getElementById('mg-target');
  const fw = field.clientWidth - 40, fh = field.clientHeight - 40;
  target.style.left = Math.random() * fw + 'px';
  target.style.top  = Math.random() * fh + 'px';
}

// ── World chat ────────────────────────────────────────────────
async function cleanupWorld() { await sb.rpc('cleanup_world_messages'); }

async function loadWorldChat() {
  const { data } = await sb.from('world_messages')
    .select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)')
    .order('created_at', { ascending: true }).limit(120);
  const area = document.getElementById('world-msgs');
  area.innerHTML = '';
  (data||[]).forEach(m => appendWorldMsg(m));
  scrollBottom(area);

  sb.channel('world-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_messages' }, async pl => {
    const { data: full } = await sb.from('world_messages')
      .select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,user_code,border_style,badge)')
      .eq('id', pl.new.id).single();
    if (full) { appendWorldMsg(full); scrollBottom(document.getElementById('world-msgs')); }
  }).subscribe();
}

function appendWorldMsg(msg) {
  const area = document.getElementById('world-msgs');
  const p = msg.profiles || {};
  const isMine = msg.user_id === ME.id;
  const name = displayName(p) || 'User';
  const av = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  const border = p.border_style || 'none';
  const badge = renderBadge(p.badge);

  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${linkify(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.dataset.id = msg.id; el.dataset.table = 'world_messages';
  el.innerHTML = `
    <div class="msg-av-wrap" onclick="viewProfile('${msg.user_id}')">
      <div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div>
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name" onclick="viewProfile('${msg.user_id}')">${isMine ? 'You' : escHtml(name)}</span>${badge}
        <span>${timeAgo(msg.created_at)}</span>
      </div>
      <div class="msg-bubble border-bubble-${border}">${bubble}</div>
    </div>`;
  addMsgContextMenu(el, msg.id, 'world_messages', msg.user_id);
  area.appendChild(el);
}

async function sendWorld() {
  const inp = document.getElementById('world-input');
  const txt = inp.value.trim(); if (!txt) return;
  inp.value = '';
  await sb.from('world_messages').insert({ user_id: ME.id, content: txt });
}
async function uploadWorldImage(input) {
  const file = input.files[0]; if (!file) return;
  const path = `${ME.id}/${Date.now()}-${file.name}`;
  await sb.storage.from('chat-images').upload(path, file);
  const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
  await sb.from('world_messages').insert({ user_id: ME.id, image_url: publicUrl });
  input.value = '';
}

// ── Context menu (delete msg) ─────────────────────────────────
function addMsgContextMenu(el, msgId, table, senderId) {
  el.addEventListener('contextmenu', e => { e.preventDefault(); showCtxMenu(e, msgId, table, senderId); });
  el.addEventListener('touchstart', (() => {
    let t;
    return (e) => {
      t = setTimeout(() => showCtxMenu(e.touches[0], msgId, table, senderId), 600);
      el.addEventListener('touchend', () => clearTimeout(t), { once: true });
    };
  })());
}

function showCtxMenu(e, msgId, table, senderId) {
  ctxMsgId = msgId; ctxMsgTable = table;
  const menu = document.getElementById('ctx-menu');
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX || e.pageX, window.innerWidth - 140) + 'px';
  menu.style.top  = Math.min(e.clientY || e.pageY, window.innerHeight - 80) + 'px';

  // Show "Delete for everyone" if it's mine (world or world only mine)
  const isOwn = senderId === ME.id;
  menu.innerHTML = isOwn
    ? `<button onclick="deleteCtxMsg(true)">🗑 Delete for everyone</button><button onclick="document.getElementById('ctx-menu').style.display='none'">Cancel</button>`
    : `<button onclick="deleteCtxMsg(false)">🗑 Delete for me</button><button onclick="document.getElementById('ctx-menu').style.display='none'">Cancel</button>`;
}

async function deleteCtxMsg(forEveryone) {
  document.getElementById('ctx-menu').style.display = 'none';
  if (!ctxMsgId) return;

  if (forEveryone) {
    await sb.from(ctxMsgTable).delete().eq('id', ctxMsgId);
  } else {
    // Soft delete — add ME to deleted_by array
    if (ctxMsgTable === 'private_messages') {
      const { data: msg } = await sb.from('private_messages').select('deleted_by').eq('id', ctxMsgId).single();
      const arr = [...(msg?.deleted_by || []), ME.id];
      await sb.from('private_messages').update({ deleted_by: arr }).eq('id', ctxMsgId);
    }
  }

  // Remove from DOM
  const el = document.querySelector(`[data-id="${ctxMsgId}"]`);
  if (el) el.remove();
}

// ── Incoming DMs ──────────────────────────────────────────────
function subscribeIncomingDMs() {
  incomingDMSub = sb.channel(`incoming-${ME.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `receiver_id=eq.${ME.id}` },
      async pl => {
        const sid = pl.new.sender_id;
        const existing = document.querySelector(`.convo-item[data-uid="${sid}"]`);
        if (!existing) {
          const { data: p } = await sb.from('profiles').select('*').eq('id', sid).single();
          if (p) prependConvoItem(p, pl.new.content || '📷');
        } else {
          const prev = existing.querySelector('.convo-preview');
          if (prev) prev.textContent = pl.new.content || '📷 Image';
          // Move to top
          const list = document.getElementById('convo-list');
          if (list.firstChild !== existing) list.insertBefore(existing, list.firstChild);
        }
        if (activeUser !== sid) {
          unreadCount++; updateDMBadge();
          const { data: p } = await sb.from('profiles').select('name,surname').eq('id', sid).single();
          const name = p ? displayName(p) : 'Someone';
          pushNotif(`New message from ${name}`, pl.new.content || '📷 Image');
        } else {
          appendPrivateMsg(pl.new);
          scrollBottom(document.getElementById('thread-msgs'));
          markSeen(pl.new.id);
        }
      })
    .subscribe();
}

function pushNotif(title, body) {
  if (Notification.permission !== 'granted' || document.hasFocus()) return;
  new Notification(title, { body, icon: 'icon-192.png' });
}

// ── Typing indicator ──────────────────────────────────────────
function sendTyping() {
  if (!activeUser || !typingCh) return;
  typingCh.send({ type: 'broadcast', event: 'typing', payload: { userId: ME.id } });
  clearTimeout(typingTimer);
}

function subscribeTyping(userId) {
  if (typingCh) sb.removeChannel(typingCh);
  const chId = [ME.id, userId].sort().join('-');
  typingCh = sb.channel(`typing-${chId}`)
    .on('broadcast', { event: 'typing' }, payload => {
      if (payload.payload.userId !== ME.id) showTyping();
    })
    .subscribe();
}

function showTyping() {
  const el = document.getElementById('thread-typing');
  if (el) { el.textContent = 'typing…'; clearTimeout(typingTimer); typingTimer = setTimeout(() => { if (el) el.textContent = ''; }, 2000); }
}

// ── Seen / read receipts ──────────────────────────────────────
async function markSeen(msgId) {
  await sb.from('private_messages').update({ is_read: true, seen_at: new Date().toISOString() }).eq('id', msgId);
}
function showSeenBar(seenAt) {
  const bar = document.getElementById('seen-indicator');
  if (!bar) return;
  if (seenAt) { bar.style.display = ''; bar.textContent = `Seen ${fmtTime(seenAt)}`; }
  else { bar.style.display = 'none'; }
}

// ── Conversations ─────────────────────────────────────────────
async function loadConversations() {
  const { data: msgs } = await sb.from('private_messages')
    .select('sender_id, receiver_id, content, created_at')
    .or(`sender_id.eq.${ME.id},receiver_id.eq.${ME.id}`)
    .order('created_at', { ascending: false });

  const list = document.getElementById('convo-list');
  if (!msgs?.length) { list.innerHTML = `<div class="convo-empty">No chats yet.<br>Tap <strong>+</strong> to add someone!</div>`; return; }

  const seen = new Set(), ids = [], previews = {};
  msgs.forEach(m => {
    const pid = m.sender_id === ME.id ? m.receiver_id : m.sender_id;
    if (!seen.has(pid)) { seen.add(pid); ids.push(pid); previews[pid] = m.content || '📷 Image'; }
  });

  const { data: profiles } = await sb.from('profiles').select('*').in('id', ids);
  list.innerHTML = '';
  ids.map(id => profiles?.find(p => p.id === id)).filter(Boolean).forEach(p => prependConvoItem(p, previews[p.id], true));
}

function prependConvoItem(p, preview, append = false) {
  const list = document.getElementById('convo-list');
  const existing = list.querySelector(`.convo-item[data-uid="${p.id}"]`);
  if (existing) { existing.querySelector('.convo-preview').textContent = preview || ''; return; }
  const av = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  const el = document.createElement('div');
  el.className = 'convo-item'; el.dataset.uid = p.id;
  el.onclick = () => openThread(p.id, displayName(p), p.avatar_seed, p.avatar_style, p.avatar_url);
  el.innerHTML = `
    <div class="convo-av"><img src="${av}" loading="lazy" alt=""></div>
    <div class="convo-info">
      <div class="convo-name">${escHtml(displayName(p))}</div>
      <div class="convo-preview">${escHtml(preview||'')}</div>
    </div>`;
  if (append) list.appendChild(el);
  else { if (list.firstChild && !list.querySelector('.convo-empty')) list.insertBefore(el, list.firstChild); else { list.innerHTML = ''; list.appendChild(el); } }
}

function filterConvos(q) {
  document.querySelectorAll('#convo-list .convo-item').forEach(el => {
    el.style.display = el.querySelector('.convo-name')?.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── Private thread ────────────────────────────────────────────
async function openThread(userId, name, seed, style, avatarUrl) {
  activeUser = userId;
  document.getElementById('thread-empty').style.display  = 'none';
  document.getElementById('thread-hdr').style.display    = 'flex';
  document.getElementById('thread-msgs').style.display   = 'flex';
  document.getElementById('thread-footer').style.display = '';
  document.getElementById('thread-typing').textContent   = '';

  document.getElementById('thread-av').src           = getAvatar(seed, style, avatarUrl);
  document.getElementById('thread-name').textContent = name;

  document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.convo-item[data-uid="${userId}"]`)?.classList.add('active');
  document.getElementById('private-panel').classList.add('thread-open');

  subscribeTyping(userId);

  const area = document.getElementById('thread-msgs');
  area.innerHTML = '<div class="spinner"></div>';

  const { data } = await sb.from('private_messages').select('*')
    .or(`and(sender_id.eq.${ME.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${ME.id})`)
    .order('created_at', { ascending: true }).limit(150);
  area.innerHTML = '';

  (data||[]).forEach(m => {
    if (!m.deleted_by?.includes(ME.id)) appendPrivateMsg(m);
  });
  scrollBottom(area);

  // Show last seen
  const lastFromThem = [...(data||[])].reverse().find(m => m.sender_id === ME.id && m.seen_at);
  showSeenBar(lastFromThem?.seen_at);

  // Mark incoming as read+seen
  const unread = (data||[]).filter(m => m.sender_id === userId && !m.is_read);
  for (const m of unread) await markSeen(m.id);
}

function closeThread() {
  document.getElementById('private-panel').classList.remove('thread-open');
  activeUser = null;
  if (typingCh) sb.removeChannel(typingCh);
}

function appendPrivateMsg(msg) {
  const area = document.getElementById('thread-msgs');
  const isMine = msg.sender_id === ME.id;
  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${linkify(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.dataset.id = msg.id; el.dataset.table = 'private_messages';
  el.innerHTML = `
    <div class="msg-body" style="max-width:80%">
      <div class="msg-meta"><span>${timeAgo(msg.created_at)}</span></div>
      <div class="msg-bubble border-bubble-${isMine ? (ME.border_style||'none') : 'none'}">${bubble}</div>
    </div>`;
  addMsgContextMenu(el, msg.id, 'private_messages', msg.sender_id);
  area.appendChild(el);
}

async function sendPrivate() {
  if (!activeUser) return;
  const inp = document.getElementById('thread-input');
  const txt = inp.value.trim(); if (!txt) return;
  inp.value = '';
  const { data } = await sb.from('private_messages').insert({
    sender_id: ME.id, receiver_id: activeUser, content: txt
  }).select().single();
  if (data) {
    appendPrivateMsg(data);
    scrollBottom(document.getElementById('thread-msgs'));
    const prev = document.querySelector(`.convo-item[data-uid="${activeUser}"] .convo-preview`);
    if (prev) prev.textContent = txt;
    showSeenBar(null); // reset seen after new message
  }
}

async function uploadPmImage(input) {
  if (!activeUser) return;
  const file = input.files[0]; if (!file) return;
  const path = `pm/${ME.id}/${Date.now()}-${file.name}`;
  await sb.storage.from('chat-images').upload(path, file);
  const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
  const { data } = await sb.from('private_messages').insert({
    sender_id: ME.id, receiver_id: activeUser, image_url: publicUrl
  }).select().single();
  if (data) { appendPrivateMsg(data); scrollBottom(document.getElementById('thread-msgs')); }
  input.value = '';
}

// ── 3-dot menu ────────────────────────────────────────────────
function toggleDotMenu() {
  const m = document.getElementById('dot-menu');
  m.style.display = m.style.display === 'none' ? '' : 'none';
}

// ── Trade ─────────────────────────────────────────────────────
function openTradeModal() {
  document.getElementById('dot-menu').style.display = 'none';
  if (!activeUser) return;
  const nm = document.getElementById('thread-name').textContent;
  document.getElementById('trade-to-label').textContent = `Sending trade offer to ${nm}`;
  document.getElementById('trade-offer').value = '';
  document.getElementById('trade-want').value  = '';
  document.getElementById('trade-note').value  = '';
  document.getElementById('trade-modal').style.display = 'flex';
}
async function sendTrade() {
  if (!activeUser) return;
  const offer = document.getElementById('trade-offer').value.trim();
  const want  = document.getElementById('trade-want').value.trim();
  const note  = document.getElementById('trade-note').value.trim();
  if (!offer || !want) return alert('Fill in both offer and want fields.');
  const { error } = await sb.from('trades').insert({
    initiator_id: ME.id, receiver_id: activeUser,
    item_offer: offer, item_want: want, note: note || null
  });
  if (error) return alert('Failed to send trade: ' + error.message);
  document.getElementById('trade-modal').style.display = 'none';
  // Send a system message in the chat
  await sb.from('private_messages').insert({
    sender_id: ME.id, receiver_id: activeUser,
    content: `🤝 Trade offer sent!\nOffer: ${offer}\nWant: ${want}${note ? '\nNote: ' + note : ''}`
  });
}

// Also subscribe to incoming trades and render them
async function loadPendingTrades() {
  const { data } = await sb.from('trades').select('*, profiles!trades_initiator_id_fkey(name,surname)')
    .eq('receiver_id', ME.id).eq('status', 'pending');
  return data || [];
}

// ── Poll ──────────────────────────────────────────────────────
function openPoll() {
  document.getElementById('dot-menu').style.display = 'none';
  document.getElementById('poll-question').value = '';
  document.querySelectorAll('.poll-opt').forEach((o,i) => { if(i > 1) o.closest('.form-group').remove(); else o.value=''; });
  document.getElementById('poll-modal').style.display = 'flex';
}
function addPollOption() {
  const wrap = document.getElementById('poll-options-wrap');
  const count = wrap.querySelectorAll('.poll-opt').length + 1;
  if (count > 5) return;
  const div = document.createElement('div');
  div.className = 'form-group';
  div.innerHTML = `<label>Option ${count}</label><input type="text" class="poll-opt" placeholder="Option ${count}" maxlength="100">`;
  wrap.appendChild(div);
}
async function submitPoll() {
  if (!activeUser) return;
  const q = document.getElementById('poll-question').value.trim();
  const opts = [...document.querySelectorAll('.poll-opt')].map(i => i.value.trim()).filter(Boolean);
  if (!q) return alert('Question is required.');
  if (opts.length < 2) return alert('Need at least 2 options.');
  const ctxId = [ME.id, activeUser].sort().join('-');
  const { error } = await sb.from('polls').insert({ creator_id: ME.id, context_id: ctxId, question: q, options: opts });
  if (error) return alert('Poll failed: ' + error.message);
  document.getElementById('poll-modal').style.display = 'none';
  // Send as message
  await sb.from('private_messages').insert({
    sender_id: ME.id, receiver_id: activeUser,
    content: `📊 Poll: ${q}\n${opts.map((o,i)=>`${i+1}. ${o}`).join('\n')}`
  });
}

// ── Share location ────────────────────────────────────────────
function sendLocation() {
  document.getElementById('dot-menu').style.display = 'none';
  if (!activeUser) return;
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    await sb.from('private_messages').insert({
      sender_id: ME.id, receiver_id: activeUser,
      content: `📍 Location: ${url}`
    });
  }, () => alert('Could not get your location.'));
}

// ── Add contact ───────────────────────────────────────────────
function openAddModal() {
  document.getElementById('add-modal').style.display = 'flex';
  document.getElementById('add-code-input').value = '';
  document.getElementById('add-result').innerHTML = '';
  setTimeout(() => document.getElementById('add-code-input').focus(), 100);
}
document.getElementById('add-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchByCode(); });

async function searchByCode() {
  const raw  = document.getElementById('add-code-input').value.trim().replace('#','');
  const code = raw.padStart(6,'0');
  const res  = document.getElementById('add-result');
  if (!raw) { res.innerHTML = `<div class="search-err">Enter a code.</div>`; return; }
  res.innerHTML = '<div class="spinner" style="margin:10px auto"></div>';
  const { data } = await sb.from('profiles').select('*').eq('user_code', code).maybeSingle();
  if (!data) { res.innerHTML = `<div class="search-err">No user with #${code}</div>`; return; }
  if (data.id === ME.id) { res.innerHTML = `<div class="search-err">That's you! 😄</div>`; return; }
  res.innerHTML = `
    <div class="search-result-card">
      <img src="${getAvatar(data.avatar_seed, data.avatar_style, data.avatar_url)}" class="src-av" alt="">
      <div class="src-info">
        <div class="src-name">${escHtml(displayName(data))}</div>
        <div class="src-code">#${data.user_code}</div>
      </div>
      <button class="btn-sm" onclick="startChatFromSearch('${data.id}','${escAttr(displayName(data))}','${escAttr(data.avatar_seed)}','${escAttr(data.avatar_style)}','${escAttr(data.avatar_url||'')}')">Chat</button>
    </div>`;
}
async function startChatFromSearch(uid, name, seed, style, url) {
  document.getElementById('add-modal').style.display = 'none';
  switchPanel('private');
  await openThread(uid, name, seed, style, url||null);
}

// ── Profile stalk ─────────────────────────────────────────────
async function viewProfile(userId) {
  if (!userId) return;
  const { data: p } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!p) return;
  stalkedUserId = userId;

  document.getElementById('stalk-avatar').src        = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  document.getElementById('stalk-code').textContent  = `#${p.user_code||'------'}`;
  document.getElementById('stalk-name').textContent  = displayName(p);
  document.getElementById('stalk-badge').innerHTML   = renderBadge(p.badge);
  document.getElementById('stalk-bio').innerHTML     = p.bio ? linkify(p.bio) : '';
  document.getElementById('stalk-types').innerHTML   = renderTypeTags(p.user_types||[]);

  const ring = document.getElementById('stalk-border-ring');
  ring.className = `avatar-border-ring border-ring-${p.border_style||'none'}`;

  const { data: posts } = await sb.from('posts').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(5);
  document.getElementById('stalk-posts').innerHTML = (posts||[]).map(renderPostCard).join('') ||
    '<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No posts yet</div>';

  document.getElementById('profile-modal').style.display = 'flex';
}
function messageFromModal() {
  if (!stalkedUserId) return;
  document.getElementById('profile-modal').style.display = 'none';
  const name = document.getElementById('stalk-name').textContent;
  sb.from('profiles').select('avatar_seed,avatar_style,avatar_url').eq('id', stalkedUserId).single().then(({ data: p }) => {
    if (p) { switchPanel('private'); openThread(stalkedUserId, name, p.avatar_seed, p.avatar_style, p.avatar_url); }
  });
}

// ── My Profile ───────────────────────────────────────────────
function loadProfileView() {
  const av = getAvatar(ME.avatar_seed, ME.avatar_style, ME.avatar_url);
  document.getElementById('pv-avatar').src        = av;
  document.getElementById('nav-avatar').src       = av;
  document.getElementById('pv-code').textContent  = `#${ME.user_code||'------'}`;
  document.getElementById('pv-name').textContent  = displayName(ME);
  document.getElementById('pv-badge').innerHTML   = renderBadge(ME.badge);
  document.getElementById('pv-bio').innerHTML     = ME.bio ? linkify(ME.bio) : '';
  document.getElementById('pv-types').innerHTML   = renderTypeTags(ME.user_types||[]);
  const ring = document.getElementById('pv-border-ring');
  ring.className = `avatar-border-ring border-ring-${ME.border_style||'none'}`;
}

// Quick photo upload from profile view (camera icon on avatar)
async function quickPhotoUpload(input) {
  const file = input.files[0]; if (!file) return;
  const path = `${ME.id}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) return alert('Upload failed: ' + error.message);
  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', ME.id);
  ME.avatar_url = publicUrl;
  loadProfileView();
  document.getElementById('edit-avatar-preview').src = publicUrl;
}

function toggleProfileEdit() {
  const isEdit = document.getElementById('profile-edit').style.display !== 'none';
  if (isEdit) {
    document.getElementById('profile-edit').style.display = 'none';
    document.getElementById('profile-view').style.display = '';
    document.getElementById('edit-toggle-btn').textContent = 'Edit';
  } else {
    openProfileEdit();
    document.getElementById('edit-toggle-btn').textContent = 'Cancel';
  }
}
function openProfileEdit() {
  document.getElementById('profile-view').style.display = 'none';
  document.getElementById('profile-edit').style.display = '';
  editSelSeed  = ME.avatar_seed;
  editSelStyle = ME.avatar_style;
  editTypes    = [...(ME.user_types||[])];
  document.getElementById('edit-avatar-preview').src = getAvatar(editSelSeed, editSelStyle, ME.avatar_url);
  document.getElementById('edit-name').value    = ME.name||'';
  document.getElementById('edit-middle').value  = ME.middle_name||'';
  document.getElementById('edit-surname').value = ME.surname||'';
  document.getElementById('edit-bio').value     = ME.bio||'';
  renderEditAvatarGrid();
  renderTypeChips();
}
function renderEditAvatarGrid() {
  document.getElementById('edit-avatar-grid').innerHTML = AVATAR_LIST.map(av => `
    <div class="av-opt ${av.seed === editSelSeed ? 'selected' : ''}" onclick="pickEditAvatar('${av.seed}','${av.style}')">
      <img src="${getAvatar(av.seed, av.style)}" loading="lazy"></div>`).join('');
}
function pickEditAvatar(seed, style) {
  editSelSeed = seed; editSelStyle = style;
  if (!ME.avatar_url) document.getElementById('edit-avatar-preview').src = getAvatar(seed, style);
  document.querySelectorAll('#edit-avatar-grid .av-opt').forEach((el,i) => el.classList.toggle('selected', AVATAR_LIST[i].seed === seed));
}
function renderTypeChips() {
  document.getElementById('edit-types').innerHTML = USER_TYPES.map(t => `
    <div class="type-chip ${editTypes.includes(t.id) ? 'active' : ''}" onclick="toggleType('${t.id}')">${t.emoji} ${t.label}</div>`).join('');
}
function toggleType(id) {
  if (editTypes.includes(id)) { editTypes = editTypes.filter(x => x !== id); }
  else { if (editTypes.length >= 3) { alert('Max 3!'); return; } editTypes.push(id); }
  renderTypeChips();
}
async function saveProfile() {
  const name    = document.getElementById('edit-name').value.trim();
  const middle  = document.getElementById('edit-middle').value.trim();
  const surname = document.getElementById('edit-surname').value.trim();
  const bio     = document.getElementById('edit-bio').value.trim();
  if (!name)    return alert('Name is required.');
  if (!surname) return alert('Surname is required.');

  const { error } = await sb.from('profiles').update({
    name, middle_name: middle||null, surname, bio: bio||null,
    user_types: editTypes, avatar_seed: editSelSeed, avatar_style: editSelStyle
  }).eq('id', ME.id);
  if (error) return alert('Save failed: ' + error.message);
  Object.assign(ME, { name, middle_name: middle, surname, bio, user_types: editTypes, avatar_seed: editSelSeed, avatar_style: editSelStyle });
  loadProfileView();
  toggleProfileEdit();
}

// ── Posts ─────────────────────────────────────────────────────
function setPostImage(input) {
  postImageFile = input.files[0];
  document.getElementById('post-img-label').textContent = postImageFile ? `📷 ${postImageFile.name}` : '';
}
async function submitPost() {
  const txt = document.getElementById('post-input').value.trim();
  if (!txt && !postImageFile) return;
  let imgUrl = null;
  if (postImageFile) {
    const path = `posts/${ME.id}/${Date.now()}-${postImageFile.name}`;
    await sb.storage.from('chat-images').upload(path, postImageFile);
    const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
    imgUrl = publicUrl;
  }
  await sb.from('posts').insert({ user_id: ME.id, content: txt||null, image_url: imgUrl });
  document.getElementById('post-input').value = '';
  document.getElementById('post-img-label').textContent = '';
  postImageFile = null; document.getElementById('post-img-input').value = '';
  loadMyPosts();
}
async function loadMyPosts() {
  const { data } = await sb.from('posts').select('*').eq('user_id', ME.id).order('created_at',{ascending:false}).limit(20);
  document.getElementById('my-posts').innerHTML = (data||[]).map(renderPostCard).join('') ||
    '<div style="font-size:12px;color:var(--muted);text-align:center;padding:14px">No posts yet</div>';
}
function renderPostCard(post) {
  return `<div class="post-card">
    ${post.content ? `<div class="post-text">${linkify(post.content)}</div>` : ''}
    ${post.image_url ? `<img class="post-img" src="${escHtml(post.image_url)}" loading="lazy" onclick="openImgFull(this.src)">` : ''}
    <div class="post-time">${timeAgo(post.created_at)}</div>
  </div>`;
}

// ── Groups ────────────────────────────────────────────────────
async function loadGroups() {
  const { data: mems } = await sb.from('group_members').select('group_id').eq('user_id', ME.id);
  const list = document.getElementById('group-list');
  if (!mems?.length) { list.innerHTML = `<div class="convo-empty">No groups yet.</div>`; return; }
  const ids = mems.map(m => m.group_id);
  const { data: groups } = await sb.from('group_chats').select('*').in('id', ids);
  list.innerHTML = (groups||[]).map(g => `
    <div class="convo-item" data-gid="${g.id}" onclick="openGroup(${g.id},'${escAttr(g.name)}')">
      <div class="convo-av" style="background:var(--sur2);display:flex;align-items:center;justify-content:center;font-size:18px">👥</div>
      <div class="convo-info"><div class="convo-name">${escHtml(g.name)}</div><div class="convo-preview">Group chat</div></div>
    </div>`).join('') || `<div class="convo-empty">No groups yet</div>`;
}

async function openGroup(groupId, name) {
  activeGroup = groupId;
  document.getElementById('group-empty').style.display      = 'none';
  document.getElementById('group-thread-hdr').style.display = 'flex';
  document.getElementById('group-msgs').style.display       = 'flex';
  document.getElementById('group-footer').style.display     = '';
  document.getElementById('group-thread-name').textContent  = name;
  document.getElementById('groups-panel').classList.add('thread-open');
  document.querySelectorAll('#group-list .convo-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-gid="${groupId}"]`)?.classList.add('active');

  const area = document.getElementById('group-msgs');
  area.innerHTML = '<div class="spinner"></div>';
  const { data } = await sb.from('group_messages')
    .select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)')
    .eq('group_id', groupId).order('created_at',{ascending:true}).limit(150);
  area.innerHTML = '';
  (data||[]).forEach(m => { if (!m.deleted_by?.includes(ME.id)) appendGroupMsg(m); });
  scrollBottom(area);

  if (groupSub) sb.removeChannel(groupSub);
  groupSub = sb.channel(`grp-${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      async pl => {
        const { data: full } = await sb.from('group_messages')
          .select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style,badge)')
          .eq('id', pl.new.id).single();
        if (full) { appendGroupMsg(full); scrollBottom(area); }
      })
    .subscribe();
}

function appendGroupMsg(msg) {
  const area = document.getElementById('group-msgs');
  const p = msg.profiles || {};
  const isMine = msg.sender_id === ME.id;
  const name = displayName(p) || 'User';
  const av = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  const border = p.border_style || 'none';
  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${linkify(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.dataset.id = msg.id; el.dataset.table = 'group_messages';
  el.innerHTML = `
    <div class="msg-av-wrap"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${isMine ? 'You' : escHtml(name)}</span><span>${timeAgo(msg.created_at)}</span></div>
      <div class="msg-bubble">${bubble}</div>
    </div>`;
  addMsgContextMenu(el, msg.id, 'group_messages', msg.sender_id);
  area.appendChild(el);
}

async function sendGroup() {
  if (!activeGroup) return;
  const inp = document.getElementById('group-input');
  const txt = inp.value.trim(); if (!txt) return;
  inp.value = '';
  await sb.from('group_messages').insert({ group_id: activeGroup, sender_id: ME.id, content: txt });
}
async function uploadGrpImage(input) {
  if (!activeGroup) return;
  const file = input.files[0]; if (!file) return;
  const path = `grp/${ME.id}/${Date.now()}-${file.name}`;
  await sb.storage.from('chat-images').upload(path, file);
  const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
  await sb.from('group_messages').insert({ group_id: activeGroup, sender_id: ME.id, image_url: publicUrl });
  input.value = '';
}
function closeGroupThread() { document.getElementById('groups-panel').classList.remove('thread-open'); activeGroup = null; }
function openCreateGroup() { document.getElementById('create-group-modal').style.display = 'flex'; }

async function createGroup() {
  const name  = document.getElementById('group-name-input').value.trim();
  if (!name) return alert('Group name is required.');
  const codes = document.getElementById('group-members-input').value
    .split(',').map(s => s.trim().replace('#','').padStart(6,'0')).filter(Boolean);

  // Create group
  const { data: grp, error } = await sb.from('group_chats').insert({ name, created_by: ME.id }).select().single();
  if (error) { alert('Failed: ' + error.message); return; }

  // Add creator first
  const { error: memErr } = await sb.from('group_members').insert({ group_id: grp.id, user_id: ME.id });
  if (memErr) { alert('Member error: ' + memErr.message); return; }

  // Add other members
  if (codes.length) {
    const { data: others } = await sb.from('profiles').select('id').in('user_code', codes);
    if (others?.length) {
      await sb.from('group_members').insert(others.filter(o => o.id !== ME.id).map(o => ({ group_id: grp.id, user_id: o.id })));
    }
  }

  document.getElementById('create-group-modal').style.display = 'none';
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-members-input').value = '';
  await loadGroups();
  openGroup(grp.id, name);
}

async function openGroupInfo() {
  if (!activeGroup) return;
  document.getElementById('group-info-name').textContent = document.getElementById('group-thread-name').textContent;
  document.getElementById('group-info-modal').style.display = 'flex';
  const { data: mems } = await sb.from('group_members').select('*, profiles(name,surname,user_code)').eq('group_id', activeGroup);
  document.getElementById('group-member-list').innerHTML = (mems||[]).map(m => `
    <div class="convo-item" style="padding:8px 0;border:none">
      <div class="convo-info">
        <div class="convo-name">${escHtml(displayName(m.profiles))}</div>
        <div class="convo-preview">#${m.profiles?.user_code||'------'}</div>
      </div>
    </div>`).join('');
}
async function addGroupMember() {
  const code = document.getElementById('add-member-code').value.trim().replace('#','').padStart(6,'0');
  const { data: p } = await sb.from('profiles').select('id').eq('user_code', code).maybeSingle();
  if (!p) return alert('User not found.');
  const { error } = await sb.from('group_members').insert({ group_id: activeGroup, user_id: p.id });
  if (error) return alert('Error: ' + error.message);
  document.getElementById('add-member-code').value = '';
  openGroupInfo();
}

// ── About ─────────────────────────────────────────────────────
function toggleAbout(cb) { document.body.classList.toggle('about-light', cb.checked); }

// ── Logout ────────────────────────────────────────────────────
async function doLogout() {
  clearInterval(leaderboardTimer);
  if (presenceCh) await presenceCh.untrack();
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// ── Utils ─────────────────────────────────────────────────────
function scrollBottom(el) { if (el) el.scrollTop = el.scrollHeight; }
function renderTypeTags(types) {
  return (types||[]).map(id => {
    const t = USER_TYPES.find(x => x.id === id);
    return t ? `<span class="type-tag">${t.emoji} ${t.label}</span>` : '';
  }).join('');
}
function openImgFull(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:999;cursor:zoom-out';
  ov.innerHTML = `<img src="${src}" style="max-width:92vw;max-height:92vh;border-radius:8px">`;
  ov.onclick = () => ov.remove();
  document.body.appendChild(ov);
}