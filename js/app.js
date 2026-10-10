// Inti aplikasi: siklus login, navigasi, beranda, kontak otomatis, grup, PWA
import { auth, db, onAuthStateChanged, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp } from './firebase.js';
import { $, h, S, avatar, toast, wipe, fmt, getUser, other, ico } from './ui.js';
import { sfx } from './sfx.js';
import { initAuth } from './auth.js';
import { initChat, openDirect, openGroup, closeRoom, markDelivered, currentChatId } from './chat.js';
import { bindStatus, startStatus, stopStatus } from './status.js';
import { initProfile, fillSettings } from './profile.js';

let unsubChats = null, lastDoc = null, hasMore = true, q = '', results = [], anim = true, view = 'home', loaded = false;
const lastSeen = new Map();
const setPresence = v => S.me && updateDoc(doc(db, 'users', S.me.id), { isOnline: v, lastSeen: serverTimestamp() }).catch(() => {});

/* ---------- navigasi (dengan wipe + suara) ---------- */
function go(v, instant) {
  const apply = () => {
    document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
    document.querySelectorAll('.ni').forEach(e => e.classList.toggle('on', e.dataset.v === v));
    if (v === 'home') { anim = true; renderHome(); }
  };
  if (instant || v === view) apply(); else { wipe(); sfx('nav'); setTimeout(apply, 240); }
  view = v;
}
document.querySelectorAll('.ni').forEach(b => b.onclick = () => go(b.dataset.v));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.hidden = true; }));

/* ---------- kontak otomatis ---------- */
function contactRow(u, i = 0, extra) {
  const b = h('button', 'card row' + (anim ? ' rise' : '') + (extra || ''), avatar(u), h('div', 'grow', h('div', 'nm', u.username), h('div', 'sb', u.bio || 'Tersedia di dixzChat')), u.isOnline ? h('i', 'dot') : '');
  b.style.setProperty('--i', i); return b;
}
async function loadContacts(reset) {
  if (reset) { S.contacts = []; lastDoc = null; hasMore = true; }
  if (!hasMore) return;
  try {
    const s = await getDocs(query(collection(db, 'users'), orderBy('usernameLower'), ...(lastDoc ? [startAfter(lastDoc)] : []), limit(30)));
    lastDoc = s.docs[s.docs.length - 1] || lastDoc; hasMore = s.size === 30;
    s.docs.forEach(d => { if (d.id !== S.me.id) { const u = { id: d.id, ...d.data() }; S.cache.set(u.id, u); S.contacts.push(u); } });
    renderHome(); renderSheet(); renderGroupList();
  } catch (e) { toast('Gagal memuat kontak: ' + e.code); }
}
function renderSheet() {
  const list = q ? results : S.contacts, L = $('sheetList'); L.replaceChildren();
  if (!list.length) L.append(h('div', 'empty', q ? 'Username tidak ditemukan.' : 'Belum ada kontak lain.'));
  list.forEach((u, i) => { const b = contactRow(u, i); b.onclick = () => openDirect(u); L.append(b); });
  $('more').hidden = !!q || !hasMore;
}
let timer;
$('sSearch').oninput = e => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    q = e.target.value.trim().toLowerCase();
    if (!q) { results = []; return renderSheet(); }
    try {
      const s = await getDocs(query(collection(db, 'users'), orderBy('usernameLower'), where('usernameLower', '>=', q), where('usernameLower', '<=', q + '\uf8ff'), limit(30)));
      results = s.docs.filter(d => d.id !== S.me.id).map(d => ({ id: d.id, ...d.data() })); results.forEach(u => S.cache.set(u.id, u)); renderSheet();
    } catch (err) { toast('Pencarian gagal: ' + err.code); }
  }, 300);
};
$('fab').onclick = () => { anim = true; $('sheet').hidden = false; sfx('open'); renderSheet(); };
$('sClose').onclick = () => $('sheet').hidden = true;
$('more').onclick = () => loadContacts(false);

/* ---------- grup ---------- */
const picked = new Set();
function renderGroupList() {
  const L = $('gList'); L.replaceChildren();
  S.contacts.forEach((u, i) => { const b = contactRow(u, i, picked.has(u.id) ? ' sel' : ''); b.onclick = () => { picked.has(u.id) ? picked.delete(u.id) : picked.add(u.id); b.classList.toggle('sel'); }; L.append(b); });
  if (hasMore) { const m = h('button', 'btn white', 'Muat lagi'); m.onclick = () => loadContacts(false); L.append(m); }
}
$('gNew').onclick = () => { picked.clear(); $('gName').value = ''; $('sheet').hidden = true; $('gsheet').hidden = false; renderGroupList(); sfx('open'); };
$('gClose').onclick = () => $('gsheet').hidden = true;
$('gCreate').onclick = async () => {
  const name = $('gName').value.trim();
  if (!name) return toast('Isi nama grup dulu.');
  if (!picked.size) return toast('Pilih minimal 1 anggota.');
  const ref = doc(collection(db, 'chats')), members = [S.me.id, ...picked];
  try {
    await setDoc(ref, { type: 'group', name, admin: S.me.id, participants: members, lastMessage: 'Grup dibuat', lastMessageTime: serverTimestamp(), lastSender: S.me.id, unread: {}, typing: {} });
    sfx('ok'); openGroup({ id: ref.id, name, participants: members, type: 'group' });
  } catch (e) { toast('Gagal membuat grup: ' + e.code); }
};

/* ---------- beranda ---------- */
function listenChats() {
  loaded = false;
  unsubChats = onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', S.me.id)), async s => {
    S.chats = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastMessageTime?.seconds ?? 9e12) - (a.lastMessageTime?.seconds ?? 9e12));
    await Promise.all(S.chats.filter(c => c.type !== 'group').map(c => getUser(other(c))));
    S.chats.forEach(c => {
      const sec = c.lastMessageTime?.seconds || 0, prev = lastSeen.get(c.id) || 0;
      if (loaded && sec > prev && c.lastSender && c.lastSender !== S.me.id && currentChatId() !== c.id) sfx('recv');
      lastSeen.set(c.id, sec);
      if (c.type !== 'group' && (c.unread?.[S.me.id] || 0) > 0 && c.lastSender !== S.me.id) markDelivered(c.id);
    });
    loaded = true; renderHome();
  }, e => toast('Gagal memuat chat: ' + e.code));
}
function chatCard(c, i) {
  const isG = c.type === 'group', u = isG ? { username: c.name, isGroup: true } : S.cache.get(other(c)); if (!u) return null;
  const n = c.unread?.[S.me.id] || 0;
  const b = h('button', 'card row' + (anim ? ' rise' : ''), avatar(u), h('div', 'grow', h('div', 'nm', isG ? c.name : u.username), h('div', 'sb', c.lastMessage || '')), h('div', 'side', h('div', 'tm', fmt(c.lastMessageTime)), n ? h('div', 'badge', String(n > 99 ? '99+' : n)) : ''));
  b.style.setProperty('--i', i); b.onclick = () => isG ? openGroup(c) : openDirect(u); return b;
}
function renderHome() {
  if (!S.me) return;
  const L = $('chatList'); L.replaceChildren();
  if (!S.chats.length) L.append(h('div', 'empty', 'Belum ada chat. Pilih kontak di bawah atau ketuk +.'));
  S.chats.forEach((c, i) => { const el = chatCard(c, i); if (el) L.append(el); });
  const have = new Set(S.chats.filter(c => c.type !== 'group').map(other)), C = $('homeContacts'); C.replaceChildren();
  S.contacts.filter(u => !have.has(u.id)).forEach((u, i) => { const b = contactRow(u, i + S.chats.length); b.onclick = () => openDirect(u); C.append(b); });
  anim = false;
}
window.addEventListener('profile-changed', () => { renderHome(); renderSheet(); });

/* ---------- siklus hidup ---------- */
function teardown() {
  unsubChats?.(); unsubChats = null; stopStatus(); closeRoom();
  S.me = null; S.chats = []; S.contacts = []; S.cache.clear(); lastSeen.clear();
  ['sheet', 'gsheet', 'astSheet', 'attach', 'msgMenu'].forEach(id => $(id).hidden = true);
}
initAuth(); initChat(); bindStatus(); initProfile(async () => { await setPresence(false); teardown(); });
onAuthStateChanged(auth, async user => {
  if (!user) { teardown(); $('auth').hidden = false; $('app').hidden = true; return; }
  let snap;
  try { for (let i = 0; i < 8; i++) { snap = await getDoc(doc(db, 'users', user.uid)); if (snap.exists()) break; await new Promise(r => setTimeout(r, 500)); } }
  catch (e) { toast('Gagal memuat profil: ' + e.code); }
  if (!snap?.exists()) return;
  S.me = { id: user.uid, ...snap.data() }; S.cache.set(S.me.id, S.me);
  wipe(); sfx('ok');
  setTimeout(() => { $('auth').hidden = true; $('app').hidden = false; }, 240);
  setPresence(true); fillSettings(); listenChats(); loadContacts(true); startStatus(); go('home', true);
});
document.addEventListener('visibilitychange', () => setPresence(!document.hidden));
addEventListener('pagehide', () => setPresence(false));
const net = () => $('offline').hidden = navigator.onLine;
addEventListener('online', net); addEventListener('offline', net); net();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
