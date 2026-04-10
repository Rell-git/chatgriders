// ============================================================
// CHATGRID v5 — config.js
// ============================================================

const SUPABASE_URL = 'https://wzfoatphpozplgbtfees.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Zm9hdHBocG96cGxnYnRmZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODQ4NTAsImV4cCI6MjA5MDM2MDg1MH0.hl4xsJkkDKx8kYDSrvEbXIYMzyeunZMtB2V0IRBU0Ko';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Badges (admin sets in Supabase → profiles.badge) ────
const BADGES = {
  crown:    { icon: '👑', label: 'King',       title: 'King/Queen — Studio Founder' },
  verified: { icon: '✅', label: 'Verified',   title: 'Verified Account' },
  diamond:  { icon: '💎', label: 'Diamond',    title: 'Diamond Member' },
  none:     { icon: '',   label: '',            title: '' }
};
function renderBadge(badge) {
  const b = BADGES[badge] || BADGES.none;
  if (!b.icon) return '';
  return `<span class="user-badge" title="${b.title}">${b.icon}</span>`;
}

// ── Avatars (24 options) ─────────────────────────────────
const AVATAR_LIST = [
  { seed:'Jasper',  style:'adventurer-neutral' },
  { seed:'Luna',    style:'adventurer-neutral' },
  { seed:'Felix',   style:'adventurer-neutral' },
  { seed:'Aria',    style:'adventurer-neutral' },
  { seed:'Zephyr',  style:'adventurer-neutral' },
  { seed:'Mochi',   style:'adventurer-neutral' },
  { seed:'Rusty',   style:'adventurer-neutral' },
  { seed:'Nova',    style:'adventurer-neutral' },
  { seed:'Kai',     style:'adventurer-neutral' },
  { seed:'Suki',    style:'adventurer-neutral' },
  { seed:'Marco',   style:'adventurer-neutral' },
  { seed:'Yuki',    style:'adventurer-neutral' },
  { seed:'Echo',    style:'bottts-neutral' },
  { seed:'Pixel',   style:'bottts-neutral' },
  { seed:'Drift',   style:'bottts-neutral' },
  { seed:'Byte',    style:'bottts-neutral' },
  { seed:'Glitch',  style:'bottts-neutral' },
  { seed:'Spark',   style:'bottts-neutral' },
  { seed:'Bun',     style:'croodles-neutral' },
  { seed:'Finn',    style:'croodles-neutral' },
  { seed:'Paws',    style:'croodles-neutral' },
  { seed:'Ash',     style:'croodles-neutral' },
  { seed:'Coco',    style:'croodles-neutral' },
  { seed:'Remy',    style:'croodles-neutral' },
];

function getAvatar(seed, style, url) {
  if (url) return url;
  return `https://api.dicebear.com/9.x/${style||'adventurer-neutral'}/svg?seed=${encodeURIComponent(seed||'default')}`;
}

// ── User types ───────────────────────────────────────────
const USER_TYPES = [
  { id:'selling',    label:'Selling',     emoji:'💼' },
  { id:'buying',     label:'Buying',      emoji:'🛍️' },
  { id:'advertiser', label:'Advertiser',  emoji:'📢' },
  { id:'sports',     label:'Sports',      emoji:'⚽' },
  { id:'messaging',  label:'Messaging',   emoji:'💬' },
  { id:'friendly',   label:'Friendly',    emoji:'🤝' },
  { id:'bns',        label:'Buy & Sell',  emoji:'🔄' },
  { id:'gaming',     label:'Gaming',      emoji:'🎮' },
  { id:'creative',   label:'Creative',    emoji:'🎨' },
  { id:'tech',       label:'Tech',        emoji:'💻' },
  { id:'music',      label:'Music',       emoji:'🎵' },
  { id:'photo',      label:'Photography', emoji:'📸' },
];

// ── Helpers ──────────────────────────────────────────────
function timeAgo(ts) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d/60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h`;
  return new Date(ts).toLocaleDateString('en-PH',{month:'short',day:'numeric'});
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});
}
function displayName(p) {
  return p ? [p.name, p.surname].filter(Boolean).join(' ') : 'User';
}
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
// Convert URLs and links in text to clickable anchors
function linkify(text) {
  const escaped = escHtml(text);
  const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
  return escaped.replace(urlRegex, url =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${url}</a>`
  );
}