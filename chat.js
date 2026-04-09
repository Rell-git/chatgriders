// ============================================================
// CHATGRID v4 — chat.js
// ============================================================

let ME             = null;
let activeUser     = null;
let activeGroup    = null;
let stalkedUserId  = null;
let privateSub     = null;
let presenceCh     = null;
let groupSub       = null;
let incomingDMSub  = null;
let unreadCount    = 0;
let editSelSeed    = null;
let editSelStyle   = null;
let editTypes      = [];
let editBorder     = 'none';
let mediaRecorder  = null;
let audioChunks    = [];
let isRecording    = false;
let pwaPrompt      = null;
let postImageFile  = null;

// ── Mobile keyboard fix ───────────────────────────────────────
(function fixMobileViewport() {
  function setH() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', h + 'px');
  }
  setH();
  if (window.visualViewport) window.visualViewport.addEventListener('resize', setH);
  window.addEventListener('resize', setH);
})();

// ── PWA install ───────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); pwaPrompt = e;
  document.getElementById('pwa-install-btn').style.display = '';
});
function installPWA() {
  if (!pwaPrompt) return;
  pwaPrompt.prompt();
  pwaPrompt.userChoice.then(() => {
    document.getElementById('pwa-install-btn').style.display = 'none';
  });
}

// ── Init ──────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return redirect();
  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!profile) return redirect();
  ME = profile;
  initUI();
  initPresence();
  requestNotifPermission();
  cleanupWorld();
  loadWorldChat();
  loadConversations();
  loadGroups();
  loadMyPosts();
  subscribeIncomingDMs();
})();

function redirect() { window.location.href = 'index.html'; }

// ── Notification permission ───────────────────────────────────
async function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
function pushNotif(title, body, onClick) {
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // only when tab is in background
  const n = new Notification(title, { body, icon: 'icon-192.png', badge: 'icon-72.png' });
  if (onClick) n.onclick = onClick;
}

// ── Service worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── UI init ──────────────────────────────────────────────────
function initUI() {
  const av = getAvatar(ME.avatar_seed, ME.avatar_style, ME.avatar_url);
  document.getElementById('nav-avatar').src = av;
  loadProfileView();

  document.getElementById('world-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendWorld(); }
  });
  document.getElementById('thread-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrivate(); }
  });
  document.getElementById('group-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroup(); }
  });
}

// ── Panel switching ───────────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`${name}-panel`)?.classList.add('active');
  document.querySelector(`[data-panel="${name}"]`)?.classList.add('active');
  if (name === 'private') { unreadCount = 0; updateDMBadge(); }
}

function updateDMBadge() {
  const badge = document.getElementById('dm-badge');
  if (unreadCount > 0) { badge.textContent = unreadCount > 9 ? '9+' : unreadCount; badge.style.display = ''; }
  else { badge.style.display = 'none'; }
}

// ── Presence ─────────────────────────────────────────────────
function initPresence() {
  presenceCh = sb.channel('cg-presence', { config: { presence: { key: ME.id } } });
  presenceCh
    .on('presence', { event: 'sync' }, () => {
      document.getElementById('online-label').textContent = Object.keys(presenceCh.presenceState()).length + ' online';
    })
    .subscribe(async s => { if (s === 'SUBSCRIBED') await presenceCh.track({ userId: ME.id }); });
}

// ── World chat ────────────────────────────────────────────────
async function cleanupWorld() { await sb.rpc('cleanup_world_messages'); }

async function loadWorldChat() {
  const { data } = await sb.from('world_messages')
    .select('*, profiles(name, surname, avatar_seed, avatar_style, avatar_url, user_code, border_style)')
    .order('created_at', { ascending: true }).limit(120);
  const area = document.getElementById('world-msgs');
  area.innerHTML = '';
  (data || []).forEach(m => appendWorldMsg(m));
  scrollBottom(area);

  sb.channel('world-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_messages' }, async payload => {
    const { data: full } = await sb.from('world_messages')
      .select('*, profiles(name, surname, avatar_seed, avatar_style, avatar_url, user_code, border_style)')
      .eq('id', payload.new.id).single();
    if (full) { appendWorldMsg(full); scrollBottom(document.getElementById('world-msgs')); }
  }).subscribe();
}

function appendWorldMsg(msg) {
  const area = document.getElementById('world-msgs');
  const p = msg.profiles || {};
  const isMine = msg.user_id === ME.id;
  const name = p.name ? displayName(p) : 'User';
  const av = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  const border = p.border_style || 'none';

  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${escHtml(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" alt="" loading="lazy" onclick="openImgFull(this.src)">`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.innerHTML = `
    <div class="msg-av-wrap" onclick="viewProfile('${msg.user_id}')" style="cursor:pointer">
      <div class="msg-av border-${border}"><img src="${av}" alt="${escHtml(name)}" loading="lazy"></div>
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name" onclick="viewProfile('${msg.user_id}')">${isMine ? 'You' : escHtml(name)}</span>
        <span>${timeAgo(msg.created_at)}</span>
      </div>
      <div class="msg-bubble border-bubble-${border}">${bubble}</div>
    </div>`;
  area.appendChild(el);
}

async function sendWorld() {
  const inp = document.getElementById('world-input');
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  await sb.from('world_messages').insert({ user_id: ME.id, content: txt });
}
async function uploadWorldImage(input) {
  const file = input.files[0]; if (!file) return;
  const path = `${ME.id}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from('chat-images').upload(path, file);
  if (error) return alert('Upload failed');
  const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
  await sb.from('world_messages').insert({ user_id: ME.id, image_url: publicUrl });
  input.value = '';
}

// ── Incoming DMs realtime (auto-add to list) ──────────────────
function subscribeIncomingDMs() {
  incomingDMSub = sb.channel(`incoming-${ME.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `receiver_id=eq.${ME.id}` },
      async payload => {
        const senderId = payload.new.sender_id;
        // Add to list if not already there
        const existing = document.querySelector(`.convo-item[data-uid="${senderId}"]`);
        if (!existing) {
          const { data: p } = await sb.from('profiles').select('*').eq('id', senderId).single();
          if (p) prependConvoItem(p, payload.new.content || '📷');
        } else {
          const preview = existing.querySelector('.convo-preview');
          if (preview) preview.textContent = payload.new.content || '📷 Image';
        }
        // Notification
        if (activeUser !== senderId) {
          const { data: p } = await sb.from('profiles').select('name,surname').eq('id', senderId).single();
          const name = p ? displayName(p) : 'Someone';
          unreadCount++;
          updateDMBadge();
          pushNotif(`New message from ${name}`, payload.new.content || '📷 Image', () => {
            switchPanel('private');
            sb.from('profiles').select('*').eq('id', senderId).single().then(({ data }) => {
              if (data) openThread(data.id, displayName(data), data.avatar_seed, data.avatar_style);
            });
          });
        }
        // If thread open, append message
        if (activeUser === senderId) {
          appendPrivateMsg(payload.new);
          scrollBottom(document.getElementById('thread-msgs'));
        }
      })
    .subscribe();
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
  ids.map(id => profiles?.find(p => p.id === id)).filter(Boolean).forEach(p => {
    prependConvoItem(p, previews[p.id], true);
  });
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
  else { if (list.firstChild) list.insertBefore(el, list.firstChild); else list.appendChild(el); }
}

function filterConvos(q) {
  document.querySelectorAll('#convo-list .convo-item').forEach(el => {
    el.style.display = el.querySelector('.convo-name').textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── Private thread ────────────────────────────────────────────
async function openThread(userId, name, seed, style, avatarUrl) {
  activeUser = userId;
  document.getElementById('thread-empty').style.display   = 'none';
  document.getElementById('thread-hdr').style.display     = 'flex';
  document.getElementById('thread-msgs').style.display    = 'flex';
  document.getElementById('thread-footer').style.display  = '';

  document.getElementById('thread-av').src            = getAvatar(seed, style, avatarUrl);
  document.getElementById('thread-name').textContent  = name;

  document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.convo-item[data-uid="${userId}"]`)?.classList.add('active');
  document.getElementById('private-panel').classList.add('thread-open');

  const area = document.getElementById('thread-msgs');
  area.innerHTML = '<div class="spinner"></div>';
  const { data } = await sb.from('private_messages').select('*')
    .or(`and(sender_id.eq.${ME.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${ME.id})`)
    .order('created_at', { ascending: true }).limit(150);
  area.innerHTML = '';
  (data || []).forEach(m => appendPrivateMsg(m));
  scrollBottom(area);

  // Mark read
  await sb.from('private_messages').update({ is_read: true })
    .eq('sender_id', userId).eq('receiver_id', ME.id).eq('is_read', false);
}

function closeThread() {
  document.getElementById('private-panel').classList.remove('thread-open');
  activeUser = null;
}

function appendPrivateMsg(msg) {
  const area = document.getElementById('thread-msgs');
  const isMine = msg.sender_id === ME.id;
  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${escHtml(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" alt="" loading="lazy" onclick="openImgFull(this.src)">`;
  if (msg.voice_url) bubble += `<audio controls src="${escHtml(msg.voice_url)}" style="max-width:200px;margin-top:4px"></audio>`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.innerHTML = `
    <div class="msg-body" style="max-width:80%">
      <div class="msg-meta"><span>${timeAgo(msg.created_at)}</span></div>
      <div class="msg-bubble border-bubble-${isMine ? (ME.border_style||'none') : 'none'}">${bubble}</div>
    </div>`;
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
  }
}

async function uploadPmImage(input) {
  if (!activeUser) return;
  const file = input.files[0]; if (!file) return;
  const path = `pm/${ME.id}/${Date.now()}-${file.name}`;
  await sb.storage.from('chat-images').upload(path, file);
  const { data: { publicUrl } } = sb.storage.from('chat-images').getPublicUrl(path);
  const { data } = await sb.from('private_messages').insert({ sender_id: ME.id, receiver_id: activeUser, image_url: publicUrl }).select().single();
  if (data) { appendPrivateMsg(data); scrollBottom(document.getElementById('thread-msgs')); }
  input.value = '';
}

// ── Voice messages ────────────────────────────────────────────
async function toggleVoice() {
  if (isRecording) { stopVoice(); return; }
  if (!navigator.mediaDevices) return alert('Microphone not supported.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('voice-bar').style.display = '';
    document.getElementById('thread-input').style.display = 'none';
    document.getElementById('voice-btn').style.color = 'var(--danger)';
  } catch { alert('Cannot access microphone.'); }
}
function stopVoice() {
  if (mediaRecorder) { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t => t.stop()); }
  isRecording = false;
  document.getElementById('voice-bar').style.display = 'none';
  document.getElementById('thread-input').style.display = '';
  document.getElementById('voice-btn').style.color = '';
}
function cancelVoice() { stopVoice(); audioChunks = []; }
async function sendVoice() {
  if (!activeUser || !audioChunks.length) { cancelVoice(); return; }
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  stopVoice();
  const path = `voice/${ME.id}/${Date.now()}.webm`;
  const { error } = await sb.storage.from('voice-msgs').upload(path, blob);
  if (error) return alert('Upload failed');
  const { data: { publicUrl } } = sb.storage.from('voice-msgs').getPublicUrl(path);
  const { data } = await sb.from('private_messages').insert({ sender_id: ME.id, receiver_id: activeUser, voice_url: publicUrl }).select().single();
  if (data) { appendPrivateMsg(data); scrollBottom(document.getElementById('thread-msgs')); }
}

// ── Add contact modal ─────────────────────────────────────────
function openAddModal() {
  document.getElementById('add-modal').style.display = 'flex';
  document.getElementById('add-code-input').value = '';
  document.getElementById('add-result').innerHTML = '';
  setTimeout(() => document.getElementById('add-code-input').focus(), 100);
}
function closeAddModalDirect() { document.getElementById('add-modal').style.display = 'none'; }
document.getElementById('add-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchByCode(); });

async function searchByCode() {
  const raw  = document.getElementById('add-code-input').value.trim().replace('#','');
  const code = raw.padStart(6,'0');
  const res  = document.getElementById('add-result');
  if (!raw) { res.innerHTML = `<div class="search-err">Enter a user code.</div>`; return; }
  res.innerHTML = '<div class="spinner" style="margin:12px auto"></div>';
  const { data } = await sb.from('profiles').select('*').eq('user_code', code).maybeSingle();
  if (!data) { res.innerHTML = `<div class="search-err">No user found with #${code}</div>`; return; }
  if (data.id === ME.id) { res.innerHTML = `<div class="search-err">That's you! 😄</div>`; return; }
  res.innerHTML = `
    <div class="search-result-card">
      <img src="${getAvatar(data.avatar_seed, data.avatar_style, data.avatar_url)}" class="src-av" alt="">
      <div class="src-info"><div class="src-name">${escHtml(displayName(data))}</div><div class="src-code">#${data.user_code}</div></div>
      <button class="btn-sm" onclick="startChatFromSearch('${data.id}','${escAttr(displayName(data))}','${escAttr(data.avatar_seed)}','${escAttr(data.avatar_style)}','${escAttr(data.avatar_url||'')}')">Chat</button>
    </div>`;
}
async function startChatFromSearch(uid, name, seed, style, url) {
  closeAddModalDirect();
  switchPanel('private');
  await openThread(uid, name, seed, style, url || null);
}

// ── Profile stalk ─────────────────────────────────────────────
async function viewProfile(userId) {
  if (!userId) return;
  const { data: p } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!p) return;
  stalkedUserId = userId;

  document.getElementById('stalk-avatar').src      = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  document.getElementById('stalk-code').textContent  = `#${p.user_code||'------'}`;
  document.getElementById('stalk-name').textContent  = displayName(p);
  document.getElementById('stalk-bio').textContent   = p.bio || '';
  document.getElementById('stalk-types').innerHTML   = renderTypeTags(p.user_types||[]);

  // Apply border to stalk avatar
  const ring = document.getElementById('stalk-border-ring');
  ring.className = `avatar-border-ring border-ring-${p.border_style||'none'}`;

  // Load their posts
  const { data: posts } = await sb.from('posts').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(5);
  document.getElementById('stalk-posts').innerHTML = (posts||[]).length
    ? (posts.map(renderPostCard).join(''))
    : '<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No posts yet</div>';

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
function closeProfileModal(e) {
  if (e.target === document.getElementById('profile-modal'))
    document.getElementById('profile-modal').style.display = 'none';
}

// ── My Profile ───────────────────────────────────────────────
function loadProfileView() {
  const av = getAvatar(ME.avatar_seed, ME.avatar_style, ME.avatar_url);
  document.getElementById('pv-avatar').src          = av;
  document.getElementById('pv-code').textContent    = `#${ME.user_code||'------'}`;
  document.getElementById('pv-name').textContent    = displayName(ME);
  document.getElementById('pv-bio').textContent     = ME.bio || '';
  document.getElementById('pv-types').innerHTML     = renderTypeTags(ME.user_types||[]);
  const ring = document.getElementById('pv-border-ring');
  ring.className = `avatar-border-ring border-ring-${ME.border_style||'none'}`;
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
  editBorder   = ME.border_style || 'none';

  document.getElementById('edit-avatar-preview').src = getAvatar(editSelSeed, editSelStyle, ME.avatar_url);
  document.getElementById('edit-name').value    = ME.name||'';
  document.getElementById('edit-middle').value  = ME.middle_name||'';
  document.getElementById('edit-surname').value = ME.surname||'';
  document.getElementById('edit-bio').value     = ME.bio||'';

  renderPhotoUploadSection();
  renderEditAvatarGrid();
  renderBorderChips();
  renderTypeChips();
}

function renderPhotoUploadSection() {
  const sec = document.getElementById('photo-upload-section');
  const vip = isVIP(ME.user_code);
  if (vip) {
    sec.innerHTML = `
      <div class="form-group">
        <label>Profile Photo <span style="color:var(--accent)">✦ VIP</span></label>
        <label class="photo-upload-btn">
          <input type="file" id="photo-file-input" accept="image/*" style="display:none" onchange="uploadProfilePhoto(this)">
          ${ME.avatar_url ? `<img src="${ME.avatar_url}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin-right:8px">` : ''}
          <span>📷 ${ME.avatar_url ? 'Change photo' : 'Upload photo'}</span>
        </label>
        ${ME.avatar_url ? `<button class="btn-ghost-sm" style="margin-top:6px" onclick="removeProfilePhoto()">Remove photo</button>` : ''}
      </div>`;
  } else {
    sec.innerHTML = `
      <div class="locked-feature">
        <span>📷 Custom Profile Photo</span>
        <span class="lock-badge">🔒 VIP only · #000001–#000002</span>
      </div>`;
  }
}

async function uploadProfilePhoto(input) {
  const file = input.files[0]; if (!file) return;
  const path = `${ME.id}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from('avatars').upload(path, file);
  if (error) return alert('Upload failed: ' + error.message);
  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', ME.id);
  ME.avatar_url = publicUrl;
  document.getElementById('edit-avatar-preview').src = publicUrl;
  document.getElementById('nav-avatar').src = publicUrl;
  renderPhotoUploadSection();
}
async function removeProfilePhoto() {
  await sb.from('profiles').update({ avatar_url: null }).eq('id', ME.id);
  ME.avatar_url = null;
  document.getElementById('edit-avatar-preview').src = getAvatar(editSelSeed, editSelStyle);
  renderPhotoUploadSection();
}

function renderEditAvatarGrid() {
  document.getElementById('edit-avatar-grid').innerHTML = AVATAR_LIST.map(av => `
    <div class="av-opt ${av.seed === editSelSeed ? 'selected' : ''}" onclick="pickEditAvatar('${av.seed}','${av.style}')">
      <img src="${getAvatar(av.seed, av.style)}" loading="lazy" alt="${av.seed}">
    </div>`).join('');
}
function pickEditAvatar(seed, style) {
  editSelSeed = seed; editSelStyle = style;
  document.getElementById('edit-avatar-preview').src = getAvatar(seed, style);
  document.querySelectorAll('#edit-avatar-grid .av-opt').forEach((el,i) => {
    el.classList.toggle('selected', AVATAR_LIST[i].seed === seed);
  });
}

function renderBorderChips() {
  const vip = isVIP(ME.user_code);
  document.getElementById('border-chips').innerHTML = BORDER_STYLES.map(b => {
    const locked = b.vip && !vip;
    return `
      <div class="border-chip ${editBorder === b.id ? 'active' : ''} ${locked ? 'locked' : ''}"
           onclick="${locked ? "showBorderLock()" : `pickBorder('${b.id}')`}"
           style="position:relative">
        <div class="border-chip-preview border-ring-${b.id}"></div>
        ${b.emoji} ${b.label}
        ${locked ? '<span class="chip-lock">🔒</span>' : ''}
      </div>`;
  }).join('');
}
function pickBorder(id) {
  editBorder = id;
  document.querySelectorAll('.border-chip').forEach((el, i) => {
    el.classList.toggle('active', BORDER_STYLES[i].id === id);
  });
}
function showBorderLock() {
  alert('🔒 Border styles are VIP-only!\n\nOnly #000001 and #000002 can use this feature.\n\nWant access? Participate with the Zovvo studio!');
}

function renderTypeChips() {
  document.getElementById('edit-types').innerHTML = USER_TYPES.map(t => `
    <div class="type-chip ${editTypes.includes(t.id) ? 'active' : ''}" onclick="toggleType('${t.id}')">
      ${t.emoji} ${t.label}
    </div>`).join('');
}
function toggleType(id) {
  if (editTypes.includes(id)) { editTypes = editTypes.filter(x => x !== id); }
  else { if (editTypes.length >= 3) { alert('Pick up to 3 only!'); return; } editTypes.push(id); }
  renderTypeChips();
}

async function saveProfile() {
  const name   = document.getElementById('edit-name').value.trim();
  const middle = document.getElementById('edit-middle').value.trim();
  const sur    = document.getElementById('edit-surname').value.trim();
  const bio    = document.getElementById('edit-bio').value.trim();
  if (!name) return alert('Name is required.');

  const vip = isVIP(ME.user_code);
  const borderToSave = vip ? editBorder : 'none';

  const { error } = await sb.from('profiles').update({
    name, middle_name: middle||null, surname: sur||null, bio: bio||null,
    user_types: editTypes, avatar_seed: editSelSeed, avatar_style: editSelStyle,
    border_style: borderToSave
  }).eq('id', ME.id);
  if (error) return alert('Save failed: ' + error.message);
  Object.assign(ME, { name, middle_name: middle, surname: sur, bio, user_types: editTypes, avatar_seed: editSelSeed, avatar_style: editSelStyle, border_style: borderToSave });
  document.getElementById('nav-avatar').src = getAvatar(editSelSeed, editSelStyle, ME.avatar_url);
  loadProfileView();
  toggleProfileEdit();
}

// ── Posts ─────────────────────────────────────────────────────
let postImageUrl = null;
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
  postImageFile = null;
  document.getElementById('post-img-input').value = '';
  loadMyPosts();
}
async function loadMyPosts() {
  const { data } = await sb.from('posts').select('*').eq('user_id', ME.id)
    .order('created_at', { ascending: false }).limit(20);
  document.getElementById('my-posts').innerHTML = (data||[]).map(renderPostCard).join('') || '<div style="font-size:12px;color:var(--muted);text-align:center;padding:14px">No posts yet</div>';
}
function renderPostCard(post) {
  return `
    <div class="post-card">
      ${post.content ? `<div class="post-text">${escHtml(post.content)}</div>` : ''}
      ${post.image_url ? `<img class="post-img" src="${escHtml(post.image_url)}" loading="lazy" onclick="openImgFull(this.src)">` : ''}
      <div class="post-time">${timeAgo(post.created_at)}</div>
    </div>`;
}

// ── Group chats ───────────────────────────────────────────────
async function loadGroups() {
  const { data: members } = await sb.from('group_members').select('group_id').eq('user_id', ME.id);
  if (!members?.length) { document.getElementById('group-list').innerHTML = `<div class="convo-empty">No groups yet.<br>Tap <strong>+</strong> to create one!</div>`; return; }
  const ids = members.map(m => m.group_id);
  const { data: groups } = await sb.from('group_chats').select('*').in('id', ids);
  const list = document.getElementById('group-list');
  list.innerHTML = (groups||[]).map(g => `
    <div class="convo-item" data-gid="${g.id}" onclick="openGroup(${g.id},'${escAttr(g.name)}')">
      <div class="convo-av" style="background:var(--sur2);display:flex;align-items:center;justify-content:center;font-size:18px">👥</div>
      <div class="convo-info">
        <div class="convo-name">${escHtml(g.name)}</div>
        <div class="convo-preview">Group chat</div>
      </div>
    </div>`).join('') || `<div class="convo-empty">No groups yet</div>`;
}

async function openGroup(groupId, name) {
  activeGroup = groupId;
  document.getElementById('group-empty').style.display       = 'none';
  document.getElementById('group-thread-hdr').style.display  = 'flex';
  document.getElementById('group-msgs').style.display        = 'flex';
  document.getElementById('group-footer').style.display      = '';
  document.getElementById('group-thread-name').textContent   = name;
  document.getElementById('groups-panel').classList.add('thread-open');

  document.querySelectorAll('#group-list .convo-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-gid="${groupId}"]`)?.classList.add('active');

  const area = document.getElementById('group-msgs');
  area.innerHTML = '<div class="spinner"></div>';
  const { data } = await sb.from('group_messages').select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style)')
    .eq('group_id', groupId).order('created_at', { ascending: true }).limit(150);
  area.innerHTML = '';
  (data||[]).forEach(m => appendGroupMsg(m));
  scrollBottom(area);

  if (groupSub) sb.removeChannel(groupSub);
  groupSub = sb.channel(`grp-${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      async payload => {
        const { data: full } = await sb.from('group_messages')
          .select('*, profiles(name,surname,avatar_seed,avatar_style,avatar_url,border_style)')
          .eq('id', payload.new.id).single();
        if (full) { appendGroupMsg(full); scrollBottom(area); }
      })
    .subscribe();
}

function appendGroupMsg(msg) {
  const area = document.getElementById('group-msgs');
  const p = msg.profiles || {};
  const isMine = msg.sender_id === ME.id;
  const name = p.name ? displayName(p) : 'User';
  const av = getAvatar(p.avatar_seed, p.avatar_style, p.avatar_url);
  const border = p.border_style || 'none';

  let bubble = '';
  if (msg.content)   bubble += `<div class="msg-text">${escHtml(msg.content)}</div>`;
  if (msg.image_url) bubble += `<img class="msg-img" src="${escHtml(msg.image_url)}" loading="lazy" onclick="openImgFull(this.src)">`;

  const el = document.createElement('div');
  el.className = `msg${isMine ? ' mine' : ''}`;
  el.innerHTML = `
    <div class="msg-av-wrap"><div class="msg-av border-${border}"><img src="${av}" loading="lazy"></div></div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${isMine ? 'You' : escHtml(name)}</span><span>${timeAgo(msg.created_at)}</span></div>
      <div class="msg-bubble">${bubble}</div>
    </div>`;
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

function closeGroupThread() {
  document.getElementById('groups-panel').classList.remove('thread-open');
  activeGroup = null;
}

function openCreateGroup() { document.getElementById('create-group-modal').style.display = 'flex'; }

async function createGroup() {
  const name = document.getElementById('group-name-input').value.trim();
  if (!name) return alert('Group name is required.');
  const codes = document.getElementById('group-members-input').value.split(',').map(s => s.trim().replace('#','').padStart(6,'0')).filter(Boolean);

  const { data: grp, error } = await sb.from('group_chats').insert({ name, created_by: ME.id }).select().single();
  if (error) return alert('Failed to create group.');

  // Add creator
  await sb.from('group_members').insert({ group_id: grp.id, user_id: ME.id });

  // Add other members by code
  if (codes.length) {
    const { data: profiles } = await sb.from('profiles').select('id').in('user_code', codes);
    if (profiles?.length) {
      await sb.from('group_members').insert(profiles.map(p => ({ group_id: grp.id, user_id: p.id })));
    }
  }

  document.getElementById('create-group-modal').style.display = 'none';
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-members-input').value = '';
  loadGroups();
  openGroup(grp.id, name);
}

async function openGroupInfo() {
  if (!activeGroup) return;
  document.getElementById('group-info-name').textContent = document.getElementById('group-thread-name').textContent;
  document.getElementById('group-info-modal').style.display = 'flex';
  const { data: members } = await sb.from('group_members').select('*, profiles(name,surname,user_code)').eq('group_id', activeGroup);
  document.getElementById('group-member-list').innerHTML = (members||[]).map(m => `
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
  await sb.from('group_members').insert({ group_id: activeGroup, user_id: p.id });
  document.getElementById('add-member-code').value = '';
  openGroupInfo();
}

// ── About ─────────────────────────────────────────────────────
function toggleAbout(cb) { document.body.classList.toggle('about-light', cb.checked); }

// ── Logout ────────────────────────────────────────────────────
async function doLogout() {
  if (presenceCh) await presenceCh.untrack();
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

// ── Helpers ───────────────────────────────────────────────────
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
  ov.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:8px">`;
  ov.onclick = () => ov.remove();
  document.body.appendChild(ov);
}