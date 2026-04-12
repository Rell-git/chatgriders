// ============================================================
// PULSESHIP — config.js  v8
// ============================================================

const SUPABASE_URL = 'https://wzfoatphpozplgbtfees.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6Zm9hdHBocG96cGxnYnRmZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODQ4NTAsImV4cCI6MjA5MDM2MDg1MH0.hl4xsJkkDKx8kYDSrvEbXIYMzyeunZMtB2V0IRBU0Ko';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Admin user codes (set border/badge from Supabase dashboard)
const ADMIN_CODES = ['000001','000111'];

// ── BADGES (set in Supabase → profiles.badge) ───────────────
// Values: crown | verified | diamond | star | fire | none
const BADGES = {
  crown:    {icon:'👑', tip:'Studio Founder'},
  verified: {icon:'✅', tip:'Verified'},
  diamond:  {icon:'💎', tip:'Diamond Member'},
  star:     {icon:'⭐', tip:'Star User'},
  fire:     {icon:'🔥', tip:'Trending'},
  none:     {icon:'',   tip:''},
};
function renderBadge(badge) {
  const b = BADGES[badge]||BADGES.none;
  return b.icon ? `<span class="badge-icon" title="${b.tip}">${b.icon}</span>` : '';
}

// ── AVATARS ─────────────────────────────────────────────────
const AVATAR_LIST = [
  {seed:'Jasper',style:'adventurer-neutral'},{seed:'Luna',style:'adventurer-neutral'},
  {seed:'Felix',style:'adventurer-neutral'},{seed:'Aria',style:'adventurer-neutral'},
  {seed:'Zephyr',style:'adventurer-neutral'},{seed:'Mochi',style:'adventurer-neutral'},
  {seed:'Rusty',style:'adventurer-neutral'},{seed:'Nova',style:'adventurer-neutral'},
  {seed:'Kai',style:'adventurer-neutral'},{seed:'Suki',style:'adventurer-neutral'},
  {seed:'Marco',style:'adventurer-neutral'},{seed:'Yuki',style:'adventurer-neutral'},
  {seed:'Echo',style:'bottts-neutral'},{seed:'Pixel',style:'bottts-neutral'},
  {seed:'Drift',style:'bottts-neutral'},{seed:'Byte',style:'bottts-neutral'},
  {seed:'Glitch',style:'bottts-neutral'},{seed:'Spark',style:'bottts-neutral'},
  {seed:'Bun',style:'croodles-neutral'},{seed:'Finn',style:'croodles-neutral'},
  {seed:'Paws',style:'croodles-neutral'},{seed:'Ash',style:'croodles-neutral'},
  {seed:'Coco',style:'croodles-neutral'},{seed:'Remy',style:'croodles-neutral'},
];
function getAvatar(seed,style,url){
  if(url) return url;
  return `https://api.dicebear.com/9.x/${style||'adventurer-neutral'}/svg?seed=${encodeURIComponent(seed||'default')}`;
}

// ── USER TYPES ───────────────────────────────────────────────
const USER_TYPES = [
  {id:'selling',label:'Selling',emoji:'💼'},{id:'buying',label:'Buying',emoji:'🛍️'},
  {id:'advertiser',label:'Advertiser',emoji:'📢'},{id:'sports',label:'Sports',emoji:'⚽'},
  {id:'gaming',label:'Gaming',emoji:'🎮'},{id:'friendly',label:'Friendly',emoji:'🤝'},
  {id:'bns',label:'Buy & Sell',emoji:'🔄'},{id:'dating',label:'Dating',emoji:'💕'},
  {id:'creative',label:'Creative',emoji:'🎨'},{id:'tech',label:'Tech',emoji:'💻'},
  {id:'music',label:'Music',emoji:'🎵'},{id:'photo',label:'Photography',emoji:'📸'},
];

// ── CHAT THEMES ──────────────────────────────────────────────
const CHAT_THEMES = {
  default:{label:'Default', bubble:'#7b6ef6', bg:'',          text:'#fff'},
  sakura: {label:'Sakura',  bubble:'#e879a8', bg:'#1a0418',   text:'#fff'},
  ocean:  {label:'Ocean',   bubble:'#0ea5e9', bg:'#001828',   text:'#fff'},
  forest: {label:'Forest',  bubble:'#22c55e', bg:'#001208',   text:'#fff'},
  sunset: {label:'Sunset',  bubble:'#f97316', bg:'#1a0800',   text:'#fff'},
  night:  {label:'Night',   bubble:'#8b5cf6', bg:'#050512',   text:'#fff'},
  mono:   {label:'Mono',    bubble:'#374151', bg:'#0a0a0a',   text:'#fff'},
};
function getThemeForContact(uid){return localStorage.getItem(`ps-ct-${uid}`)||'default';}
function setThemeForContact(uid,t){localStorage.setItem(`ps-ct-${uid}`,t);}

// ── SVG ICON LIBRARY ─────────────────────────────────────────
const ICONS = {
  globe:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>`,
  chat:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  gear:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  heart:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  plus:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  back:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  close:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  send:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>`,
  image:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  pin:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  chart:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  trade:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  bell:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  share:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  qr:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="14" y1="21" x2="14" y2="14"/></svg>`,
  shield:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  help:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  trash:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  logout:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  tools:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  calc:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`,
  translate:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  dots:    `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>`,
  sun:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  arrow:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  download:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  scan:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
  user:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  eye:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  lock:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  flag:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  copy:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  group:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
};
function icon(name, size=18) {
  const svg = ICONS[name]||'';
  return `<span class="svg-icon" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center">${svg}</span>`;
}

// ── PRIVACY / HELP TEXT ──────────────────────────────────────
const PRIVACY_POLICY_HTML = `
<h2>Privacy Policy</h2><p class="pp-date">Last Updated: April 20, 2026</p>
<p>Welcome to PulseShip. Your privacy matters. This Policy explains how we collect, use, and protect your information.</p>
<h3>1. Information We Collect</h3><p><strong>Provided by you:</strong> Display name, profile/avatar, messages sent in chats.<br><strong>Auto-collected:</strong> Device info, IP address (security &amp; moderation), session duration.</p>
<h3>2. How We Use Your Information</h3><p>To provide real-time chat, improve platform performance, match users for random/global chat, monitor for abuse, and enforce community guidelines.</p>
<h3>3. Chat Content &amp; Privacy</h3><p>Messages may be temporarily stored for real-time messaging. Some chat data may be logged for moderation. PulseShip does not guarantee full privacy. <strong>Do not share sensitive personal information.</strong></p>
<h3>4. Cookies &amp; Tracking</h3><p>We may use cookies to improve experience, analyze traffic, and store preferences. Disable via browser settings.</p>
<h3>5. Data Sharing</h3><p>We do not sell your data. We may share only when required by law, to protect users, or with trusted services (e.g., Supabase, hosting).</p>
<h3>6. Data Security</h3><p>We take reasonable steps to protect your data. No online platform is 100% secure. Users access PulseShip at their own risk.</p>
<h3>7. User Responsibilities</h3><p>By using PulseShip you agree: not to post harmful/illegal/abusive content, not to impersonate others, and to follow community guidelines. Violations may result in suspension or banning.</p>
<h3>8. Children's Privacy</h3><p>PulseShip is not intended for users under 13. We do not knowingly collect data from children.</p>
<h3>9. Third-Party Services</h3><p>PulseShip may include external links and third-party tools (ads, analytics). We are not responsible for their privacy practices.</p>
<h3>10. Changes to This Policy</h3><p>We may update this Policy at any time. Updates will be posted on this page with a revised date.</p>
<h3>11. Contact Us</h3><p>Email: <a href="mailto:webzovvo@gmail.com" class="chat-link">webzovvo@gmail.com</a><br>Website: PulseShip<br>User ID: #000111</p>
<p><em>By using PulseShip, you agree to this Privacy Policy.</em></p>
`;

const PRIVACY_CENTER_HTML = `
<h2>Privacy Center</h2>
<p>Welcome to the PulseShip Privacy Center. Understand how your data is used and how to stay safe.</p>
<h3>What Data We Use</h3><p>Display name, messages you send, basic device/browser info, IP address (for security).</p>
<h3>Your Chats</h3><p>Messages deliver real-time chat and may be monitored for safety. Avoid sharing personal or sensitive information. <strong>Chats on PulseShip are not fully private.</strong></p>
<h3>Safety &amp; Moderation</h3><p>We detect spam and abusive behavior, allow reports and blocking, and take action against users who violate rules.</p>
<h3>Your Controls</h3><p>Use any display name, leave chats anytime, block users, control browser permissions (notifications, etc.).</p>
<h3>Cookies &amp; Tracking</h3><p>We use cookies to improve performance, understand usage, and enhance experience. Disable anytime in your browser.</p>
<h3>Notifications (PWA)</h3><p>If enabled, PulseShip may send alerts for messages or updates. Turn off anytime in device/browser settings.</p>
<h3>Third-Party Services</h3><p>We use Supabase (backend/database), hosting providers, and analytics tools to keep PulseShip running.</p>
<h3>Important Reminders</h3><p>Do not share passwords, personal info, or financial details. Be careful when chatting with strangers. Report suspicious behavior.</p>
<h3>Need Help?</h3><p>Email: <a href="mailto:webzovvo@gmail.com" class="chat-link">webzovvo@gmail.com</a><br>User ID: #000111 | Website: PulseShip</p>
`;

const HELP_CENTER_HTML = `
<h2>Help Center</h2>
<h3>Getting Started</h3><p><strong>What is PulseShip?</strong> A chatting platform for random worldwide chat, group chats, trading discussions, and chat-based features.</p>
<p><strong>Do I need an account?</strong> Yes. Register with email to access all features.</p>
<h3>Chat Features</h3><p><strong>How do I start chatting?</strong> Register → set up profile → use World Chat to talk globally, or add contacts via user code (#000001).</p>
<p><strong>Can I leave a chat?</strong> Yes, anytime.</p>
<p><strong>Are chats private?</strong> Private messages are secured with row-level security. World Chat is public.</p>
<h3>Notifications</h3><p><strong>Not receiving notifications?</strong> Check browser settings → enable notifications for PulseShip. On iOS, install as PWA first.</p>
<p><strong>Turn off notifications:</strong> Browser/device settings → disable PulseShip notifications.</p>
<h3>Common Issues</h3><p><strong>Messages not sending:</strong> Check internet → refresh page → rejoin chat.</p>
<p><strong>Website not loading:</strong> Clear browser cache → use Chrome or Edge → restart device.</p>
<p><strong>Can't connect:</strong> Server may be temporarily down. Try again in a few minutes.</p>
<h3>Safety &amp; Reporting</h3><p><strong>Report a user:</strong> Long-press their message → report option, or contact us directly.</p>
<p><strong>Reported users:</strong> We review reports and may ban users who violate rules.</p>
<h3>Account &amp; Data</h3><p><strong>Is my data saved?</strong> Some data is temporarily stored for chat functionality and safety.</p>
<p><strong>Delete my data:</strong> Settings → Delete Account, or contact us for manual removal.</p>
<h3>Tips for Better Experience</h3><p>Be respectful, don't share personal/sensitive info, report abuse, and enjoy exploring different chats!</p>
<h3>Contact Support</h3><p>Email: <a href="mailto:webzovvo@gmail.com" class="chat-link">webzovvo@gmail.com</a><br>User ID: #000111</p>
`;

// ── HELPERS ──────────────────────────────────────────────────
function timeAgo(ts){const d=Date.now()-new Date(ts).getTime(),m=Math.floor(d/60000);if(m<1)return 'just now';if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return new Date(ts).toLocaleDateString('en-PH',{month:'short',day:'numeric'});}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});}
function displayName(p){return p?[p.name,p.surname].filter(Boolean).join(' '):'User';}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function linkify(text){return escHtml(text).replace(/(https?:\/\/[^\s<>"]+)/g,url=>`<a href="${url}" target="_blank" rel="noopener" class="chat-link">${url}</a>`);}