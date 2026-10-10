// Logika utama: navigasi, kontak otomatis, daftar chat, ruang chat teks, profil
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, limitToLast, startAfter, onSnapshot, serverTimestamp, increment } from './firebase.js';
import { initAuth, toast } from './auth.js';

const $ = id => document.getElementById(id);
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; kids.forEach(k => e.append(k)); return e; };
const COLORS = ['#FF90E8', '#FFC900', '#23A094'];
const fmt = ts => ts ? ts.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
const cache = new Map();            // id -> profil publik
let me = null, chats = [], contacts = [], lastDoc = null, hasMore = true;
let unsubChats = null, unsubMsgs = null, cur = null, query_ = '', results = [];

/* ---------- util ---------- */
function avatar(u) {
  const name = u.username || '?';
  const d = h('div', 'av', name[0].toUpperCase());
  d.style.background = COLORS[name.charCodeAt(0) % 3];
  if (/^https?:/.test(u.photoURL || '')) { d.textContent = ''; const i = h('img'); i.src = u.photoURL; i.alt = ''; d.append(i); }
  return d;
}
async function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  const s = await getDoc(doc(db, 'users', id));
  const u = s.exists() ? { id, ...s.data() } : { id, username: 'pengguna' };
  cache.set(id, u); return u;
}
const other = c => c.participants.find(p => p !== me.id);
const setPresence = v => me && updateDoc(doc(db, 'users', me.id), { isOnline: v, lastSeen: serverTimestamp() }).catch(() => {});

/* ---------- navigasi ---------- */
function go(v) {
  document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
  document.querySelectorAll('.ni').forEach(e => e.classList.toggle('on', e.dataset.v === v));
}
document.querySelectorAll('.ni').forEach(b => b.onclick = () => go(b.dataset.v));

/* ---------- kontak ---------- */
function contactRow(u) {
  const b = h('button', 'card row', avatar(u), h('div', 'grow', h('div', 'nm', u.username), h('div', 'sb', u.bio || 'Tersedia di dixzChat')), u.isOnline ? h('i', 'dot') : '');
  b.onclick = () => openChat(u); return b;
}
async function loadContacts(reset) {
  if (reset) { contacts = []; lastDoc = null; hasMore = true; }
  if (!hasMore) return;
  try {
    const s = await getDocs(query(collection(db, 'users'), orderBy('usernameLower'), ...(lastDoc ? [startAfter(lastDoc)] : []), limit(30)));
    lastDoc = s.docs[s.docs.length - 1] || lastDoc; hasMore = s.size === 30;
    s.docs.forEach(d => { if (d.id !== me.id) { const u = { id: d.id, ...d.data() }; cache.set(u.id, u); contacts.push(u); } });
    renderHome(); renderSheet();
  } catch (e) { toast('Gagal memuat kontak: ' + e.code); }
}
function renderSheet() {
  const list = query_ ? results : contacts, L = $('sheetList'); L.replaceChildren();
  if (!list.length) L.append(h('div', 'empty', query_ ? 'Username tidak ditemukan.' : 'Belum ada kontak lain.'));
  list.forEach(u => L.append(contactRow(u)));
  $('more').hidden = !!query_ || !hasMore;
}
let timer;
$('sSearch').oninput = e => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    query_ = e.target.value.trim().toLowerCase();
    if (!query_) { results = []; return renderSheet(); }
    try {
      const s = await getDocs(query(collection(db, 'users'), orderBy('usernameLower'), where('usernameLower', '>=', query_), where('usernameLower', '<=', query_ + '\uf8ff'), limit(30)));
      results = s.docs.filter(d => d.id !== me.id).map(d => ({ id: d.id, ...d.data() }));
      results.forEach(u => cache.set(u.id, u)); renderSheet();
    } catch (err) { toast('Pencarian gagal: ' + err.code); }
  }, 300);
};
$('fab').onclick = () => { $('sheet').hidden = false; renderSheet(); };
$('sClose').onclick = () => $('sheet').hidden = true;
$('more').onclick = () => loadContacts(false);

/* ---------- daftar chat ---------- */
function listenChats() {
  unsubChats = onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', me.id)), async s => {
    chats = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastMessageTime?.seconds ?? 9e12) - (a.lastMessageTime?.seconds ?? 9e12));
    await Promise.all(chats.map(c => getUser(other(c))));
    renderHome();
  }, e => toast('Gagal memuat chat: ' + e.code));
}
function renderHome() {
  const L = $('chatList'); L.replaceChildren();
  if (!chats.length) L.append(h('div', 'empty', 'Belum ada chat. Pilih kontak di bawah atau ketuk +.'));
  chats.forEach(c => {
    const u = cache.get(other(c)); if (!u) return;
    const n = c.unread?.[me.id] || 0;
    const b = h('button', 'card row', avatar(u), h('div', 'grow', h('div', 'nm', u.username), h('div', 'sb', c.lastMessage || '')), h('div', 'side', h('div', 'tm', fmt(c.lastMessageTime)), n ? h('div', 'badge', String(n)) : ''));
    b.onclick = () => openChat(u); L.append(b);
  });
  const have = new Set(chats.map(other)), C = $('homeContacts'); C.replaceChildren();
  contacts.filter(u => !have.has(u.id)).forEach(u => C.append(contactRow(u)));
}

/* ---------- ruang chat ---------- */
function openChat(u) {
  $('sheet').hidden = true;
  cur = { u, id: [me.id, u.id].sort().join('_') };
  $('rName').textContent = u.username; $('rSub').textContent = u.isOnline ? 'online' : 'offline';
  $('rAv').replaceChildren(avatar(u)); $('msgs').replaceChildren(); $('room').hidden = false;
  unsubMsgs?.();
  unsubMsgs = onSnapshot(query(collection(db, 'chats', cur.id, 'messages'), orderBy('timestamp'), limitToLast(100)), renderMsgs, e => toast('Gagal memuat pesan: ' + e.code));
  const c = chats.find(x => x.id === cur.id);
  if (c?.unread?.[me.id]) setDoc(doc(db, 'chats', cur.id), { unread: { [me.id]: 0 } }, { merge: true }).catch(() => {});
}
function renderMsgs(s) {
  const box = $('msgs'), stick = !box.children.length || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  box.replaceChildren();
  s.docs.forEach(d => {
    const m = d.data({ serverTimestamps: 'estimate' });
    box.append(h('div', 'bub ' + (m.senderId === me.id ? 'out' : 'in'), m.text, h('div', 'mt', fmt(m.timestamp))));
  });
  if (stick) box.scrollTop = box.scrollHeight;
}
$('rBack').onclick = () => { unsubMsgs?.(); unsubMsgs = null; cur = null; $('room').hidden = true; };
$('rForm').onsubmit = async e => {
  e.preventDefault();
  const t = $('rInput').value.trim(); if (!t || !cur) return;
  $('rInput').value = '';
  const o = cur.u.id, ref = doc(db, 'chats', cur.id);
  try {
    await setDoc(ref, { participants: [me.id, o], lastMessage: t.slice(0, 80), lastMessageTime: serverTimestamp(), unread: { [o]: increment(1) } }, { merge: true });
    await addDoc(collection(ref, 'messages'), { senderId: me.id, text: t, type: 'text', timestamp: serverTimestamp(), status: 'sent' });
  } catch (err) { toast('Gagal kirim: ' + err.code); $('rInput').value = t; }
};

/* ---------- pengaturan / profil ---------- */
function fillSettings() {
  $('sName').value = me.username; $('sEmail').value = auth.currentUser.email; $('sBio').value = me.bio || '';
  $('sAv').replaceChildren(avatar(me));
}
$('sSave').onclick = async () => {
  try { await updateDoc(doc(db, 'users', me.id), { bio: $('sBio').value.trim() }); me.bio = $('sBio').value.trim(); toast('Profil disimpan.', 'ok'); }
  catch (e) { toast('Gagal menyimpan: ' + e.code); }
};
$('sOut').onclick = async () => { await setPresence(false); await signOut(auth); };

/* ---------- siklus hidup ---------- */
function teardown() { unsubChats?.(); unsubMsgs?.(); unsubChats = unsubMsgs = null; me = null; chats = []; contacts = []; cache.clear(); $('room').hidden = true; $('sheet').hidden = true; }
initAuth();
onAuthStateChanged(auth, async user => {
  if (!user) { teardown(); $('auth').hidden = false; $('app').hidden = true; return; }
  let snap;
  try { for (let i = 0; i < 8; i++) { snap = await getDoc(doc(db, 'users', user.uid)); if (snap.exists()) break; await new Promise(r => setTimeout(r, 500)); } } catch (e) { toast('Gagal memuat profil: ' + e.code); }
  if (!snap?.exists()) return;
  me = { id: user.uid, ...snap.data() }; cache.set(me.id, me);
  $('auth').hidden = true; $('app').hidden = false;
  setPresence(true); fillSettings(); listenChats(); loadContacts(true); go('home');
});
document.addEventListener('visibilitychange', () => setPresence(!document.hidden));
addEventListener('pagehide', () => setPresence(false));
const net = () => $('offline').hidden = navigator.onLine;
addEventListener('online', net); addEventListener('offline', net); net();
