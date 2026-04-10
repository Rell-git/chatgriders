// ============================================================
// PULSESHIP — app.js
// ============================================================

let selSeed = AVATAR_LIST[0].seed, selStyle = AVATAR_LIST[0].style, regPhotoFile = null;

// Theme
function toggleTheme(cb) {
  const t = cb.checked ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('ps-theme', t);
}
(function() {
  const saved = localStorage.getItem('ps-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const cb = document.getElementById('auth-theme-toggle');
  if (cb) cb.checked = saved === 'light';
})();

function goToStep(s) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.querySelector(`.step[data-step="${s}"]`).classList.add('active');
  clearError();
}
function togglePw(id, btn) {
  const inp = document.getElementById(id), isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.querySelector('.eye-open').style.display   = isText ? '' : 'none';
  btn.querySelector('.eye-closed').style.display = isText ? 'none' : '';
}
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('login-form').style.display    = isLogin ? '' : 'none';
    document.getElementById('register-form').style.display = isLogin ? 'none' : '';
    clearError();
  });
});

function renderAvatarGrid() {
  selSeed = AVATAR_LIST[0].seed; selStyle = AVATAR_LIST[0].style;
  document.getElementById('avatar-preview').src = getAvatar(selSeed, selStyle);
  document.getElementById('avatar-grid').innerHTML = AVATAR_LIST.map(av => `
    <div class="av-opt ${av.seed===selSeed?'selected':''}" onclick="pickAvatar('${av.seed}','${av.style}')">
      <img src="${getAvatar(av.seed,av.style)}" loading="lazy">
    </div>`).join('');
}
function pickAvatar(seed, style) {
  selSeed = seed; selStyle = style;
  if (!regPhotoFile) document.getElementById('avatar-preview').src = getAvatar(seed, style);
  document.querySelectorAll('.av-opt').forEach((el,i) => el.classList.toggle('selected', AVATAR_LIST[i].seed===seed));
}
function previewRegPhoto(input) {
  regPhotoFile = input.files[0];
  if (regPhotoFile) { const r=new FileReader(); r.onload=e=>document.getElementById('avatar-preview').src=e.target.result; r.readAsDataURL(regPhotoFile); }
}

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pw    = document.getElementById('reg-password').value;
  if (!email) return showError('Email required.');
  if (pw.length < 6) return showError('Min 6 chars.');
  if (!/[A-Z]/.test(pw)) return showError('Need at least one uppercase.');
  setBusy(true,'register-form');
  const { error } = await sb.auth.signUp({email, password:pw});
  setBusy(false,'register-form');
  if (error) return showError(error.message);
  renderAvatarGrid();
  goToStep('B');
});

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  setBusy(true,'login-form');
  const {data,error} = await sb.auth.signInWithPassword({email, password:pw});
  setBusy(false,'login-form');
  if (error) return showError(error.message);
  const {data:p} = await sb.from('profiles').select('id').eq('id',data.user.id).maybeSingle();
  if (p) { window.location.href='chat.html'; return; }
  renderAvatarGrid(); goToStep('B');
});

document.getElementById('profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name    = document.getElementById('prof-name').value.trim();
  const middle  = document.getElementById('prof-middle').value.trim();
  const surname = document.getElementById('prof-surname').value.trim();
  if (!name)    return showError('First name required.');
  if (!surname) return showError('Surname required.');
  const {data:{session}} = await sb.auth.getSession();
  if (!session) return showError('Session expired.');
  setBusy(true,'profile-form');
  let avatarUrl = null;
  if (regPhotoFile) {
    const path = `${session.user.id}/${Date.now()}-${regPhotoFile.name}`;
    const {error:ue} = await sb.storage.from('avatars').upload(path, regPhotoFile);
    if (!ue) { const {data:{publicUrl}} = sb.storage.from('avatars').getPublicUrl(path); avatarUrl = publicUrl; }
  }
  const {error} = await sb.from('profiles').upsert({id:session.user.id, name, middle_name:middle||null, surname, avatar_seed:selSeed, avatar_style:selStyle, avatar_url:avatarUrl});
  setBusy(false,'profile-form');
  if (error) return showError(error.message);
  window.location.href = 'chat.html';
});

function showError(msg) { const el=document.getElementById('error-msg'); el.textContent=msg; el.style.display='block'; }
function clearError()   { document.getElementById('error-msg').style.display='none'; }
function setBusy(on,id) {
  const btn=document.querySelector(`#${id} button[type="submit"]`);
  if(!btn) return;
  if(on){btn._o=btn.textContent;btn.textContent='Loading…';btn.disabled=true;}
  else{btn.textContent=btn._o||'';btn.disabled=false;}
}

(async()=>{
  const {data:{session}} = await sb.auth.getSession();
  if (!session) return;
  const {data:p} = await sb.from('profiles').select('id').eq('id',session.user.id).maybeSingle();
  if (p) window.location.href='chat.html';
})();