// Ruang chat: pesan teks/media, centang, mengetik, hapus, suara, lokasi, grup
import { db, doc, setDoc, updateDoc, addDoc, collection, query, orderBy, limitToLast, where, limit, getDocs, onSnapshot, serverTimestamp, increment } from './firebase.js';
import { $, h, S, avatar, toast, fmt, size, dur, ico, getUser } from './ui.js';
import { sfx } from './sfx.js';
import { compressImage, upload, removeFile, getLocation, startRecorder, dHash, bandsOf } from './media.js';
import { checkReceipt } from './receipt.js';

let cur = null, unsubM = null, unsubC = null, unsubU = null, tInt = null, seen = new Set(), first = true;
let rec = null, recMode = '', recT = null, held = false, lastTyp = 0, menuCtx = null, playing = null;
const pend = new Set(), busy = new Set();
const typEl = h('div', 'bub in', h('span', 'dots', h('i'), h('i'), h('i')));
typEl.hidden = true;
export const currentChatId = () => cur?.id || null;
const safe = n => n.replace(/[^\w.\-]/g, '_');

/* ---------- buka / tutup ---------- */
export function openDirect(u) {
  openRoom({ id: [S.me.id, u.id].sort().join('_'), type: 'direct', peer: u, title: u.username, participants: [S.me.id, u.id].sort() });
}
export function openGroup(c) { openRoom({ id: c.id, type: 'group', title: c.name, participants: c.participants }); }
async function openRoom(cfg) {
  cur = cfg; seen = new Set(); first = true; cfg.data = {};
  $('msgs').replaceChildren(); typEl.hidden = true; $('rInput').value = ''; toggleSend();
  $('rName').textContent = cfg.title;
  $('rAv').replaceChildren(avatar(cfg.type === 'group' ? { username: cfg.title, isGroup: true } : cfg.peer));
  $('sheet').hidden = true; $('gsheet').hidden = true; $('room').hidden = false; sfx('open');
  await Promise.all(cfg.participants.map(getUser));
  if (cur !== cfg) return;
  unsubM?.(); unsubC?.(); unsubU?.();
  unsubM = onSnapshot(query(collection(db, 'chats', cfg.id, 'messages'), orderBy('timestamp'), limitToLast(100)), renderMsgs, e => toast('Gagal memuat pesan: ' + e.code));
  unsubC = onSnapshot(doc(db, 'chats', cfg.id), s => { cfg.data = s.data() || {}; updateSub(); }, () => {});
  if (cfg.type === 'direct') unsubU = onSnapshot(doc(db, 'users', cfg.peer.id), s => { if (s.exists()) { cfg.peer = { id: cfg.peer.id, ...s.data() }; S.cache.set(cfg.peer.id, cfg.peer); updateSub(); } });
  clearInterval(tInt); tInt = setInterval(updateSub, 1500); updateSub();
  const c = S.chats.find(x => x.id === cfg.id);
  if (c?.unread?.[S.me.id]) setDoc(doc(db, 'chats', cfg.id), { unread: { [S.me.id]: 0 } }, { merge: true }).catch(() => {});
}
export function closeRoom() {
  unsubM?.(); unsubC?.(); unsubU?.(); unsubM = unsubC = unsubU = null; clearInterval(tInt);
  recEnd(false); cur = null; $('room').hidden = true;
}
function updateSub() {
  if (!cur) return;
  const d = cur.data || {}, me = S.me.id;
  const typers = Object.entries(d.typing || {}).filter(([u, t]) => u !== me && typeof t === 'number' && Date.now() - t < 5000).map(([u]) => S.cache.get(u)?.username || 'seseorang');
  const was = typEl.hidden; typEl.hidden = !typers.length;
  if (was && !typEl.hidden) { const b = $('msgs'); b.scrollTop = b.scrollHeight; }
  let sub;
  if (typers.length) sub = cur.type === 'group' ? typers.join(', ') + ' mengetik...' : 'sedang mengetik...';
  else if (cur.type === 'group') sub = cur.participants.length + ' anggota';
  else { const p = cur.peer; sub = p.isOnline ? 'online' : p.lastSeen ? 'terlihat ' + fmt(p.lastSeen) : 'offline'; }
  $('rSub').textContent = sub;
}

/* ---------- render pesan ---------- */
function tick(m, pending) {
  const st = pending ? 'pending' : cur.type === 'group' ? 'sent' : (m.status || 'sent'), two = st === 'delivered' || st === 'read';
  const s = h('span', 'tk ' + st);
  s.innerHTML = `<svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true"><path d="M1 8l4 4L13 2${two ? 'M9 10l3 2L21 2' : ''}"/></svg>`;
  return s;
}
function audioEl(m) {
  const a = new Audio(m.mediaUrl); a.preload = 'none';
  const btn = h('button', 'ib sm', ico('play')), fill = h('i'), t = h('span', 'tm', dur(m.duration || 0));
  btn.type = 'button';
  btn.onclick = e => { e.stopPropagation(); a.paused ? a.play().catch(() => toast('Tidak bisa memutar audio.')) : a.pause(); };
  a.onplay = () => { if (playing && playing !== a) playing.pause(); playing = a; btn.replaceChildren(ico('pause')); };
  a.onpause = a.onended = () => btn.replaceChildren(ico('play'));
  a.ontimeupdate = () => { const d = isFinite(a.duration) ? a.duration : (m.duration || 1); fill.style.width = Math.min(100, a.currentTime / d * 100) + '%'; };
  return h('div', 'aud', btn, h('div', 'trk', fill), t);
}
function content(m) {
  switch (m.type) {
    case 'image': { const i = h('img', 'mimg'); i.src = m.mediaUrl; i.loading = 'lazy'; i.alt = 'Foto'; i.onclick = () => { $('lbImg').src = m.mediaUrl; $('lightbox').hidden = false; }; return i; }
    case 'video': { const v = h('video', 'mimg'); v.src = m.mediaUrl; v.controls = true; v.playsInline = true; v.preload = 'metadata'; return v; }
    case 'audio': return audioEl(m);
    case 'file': { const a = h('a', 'file', ico('file'), h('div', 'grow', h('div', 'nm', m.fileName || 'File'), h('div', 'sb', size(m.size || 0)))); a.href = m.mediaUrl; a.target = '_blank'; a.rel = 'noopener'; return a; }
    case 'location': { const a = h('a', 'file', ico('pin'), h('div', 'grow', h('div', 'nm', 'Lokasi'), h('div', 'sb', m.lat.toFixed(5) + ', ' + m.lng.toFixed(5)))); a.href = `https://www.google.com/maps?q=${m.lat},${m.lng}`; a.target = '_blank'; a.rel = 'noopener'; return a; }
    default: return document.createTextNode(m.text || '');
  }
}
function attachMenu(b, id, ref, m, mine) {
  let t, x, y; const open = () => { menuCtx = { ref, m, mine }; $('mmCopy').hidden = m.type !== 'text' || m.deleted; $('mmDel').hidden = !mine || m.deleted; $('mmCheck').hidden = m.type !== 'image' || m.deleted; if ($('mmCopy').hidden && $('mmDel').hidden && $('mmCheck').hidden) return; $('msgMenu').hidden = false; sfx('open'); };
  b.addEventListener('pointerdown', e => { x = e.clientX; y = e.clientY; t = setTimeout(open, 450); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
  b.addEventListener('pointermove', e => { if (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8) clearTimeout(t); });
  b.addEventListener('contextmenu', e => { e.preventDefault(); open(); });
}
function bubble(id, ref, m, pending, fresh) {
  const mine = m.senderId === S.me.id, b = h('div', 'bub ' + (mine ? 'out' : 'in') + (fresh ? ' pop' : ''));
  if (fresh) b.style.setProperty('--r', mine ? '3deg' : '-3deg');
  if (cur.type === 'group' && !mine) b.append(h('div', 'who', S.cache.get(m.senderId)?.username || 'pengguna'));
  if (m.deleted) { b.classList.add('del'); b.append(h('i', '', 'Pesan ini dihapus')); } else b.append(content(m));
  const meta = h('div', 'mt', fmt(m.timestamp)); if (mine) meta.append(tick(m, pending));
  b.append(meta); attachMenu(b, id, ref, m, mine); return b;
}
function renderMsgs(snap) {
  const box = $('msgs'), stick = !box.children.length || box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  box.replaceChildren(); let newIn = false; const incoming = [];
  snap.docs.forEach(d => {
    const m = d.data({ serverTimestamps: 'estimate' }), fresh = !first && !seen.has(d.id); seen.add(d.id);
    if (fresh && m.senderId !== S.me.id) newIn = true;
    if (m.senderId !== S.me.id && m.status !== 'read') incoming.push(d.ref);
    box.append(bubble(d.id, d.ref, m, d.metadata.hasPendingWrites, fresh));
  });
  pend.forEach(p => box.append(p)); box.append(typEl);
  first = false; if (newIn) sfx('recv'); if (stick) box.scrollTop = box.scrollHeight;
  if (cur.type === 'direct' && !document.hidden) incoming.forEach(r => updateDoc(r, { status: 'read' }).catch(() => {}));
}

/* ---------- kirim ---------- */
async function ensureChat() {
  const ref = doc(db, 'chats', cur.id);
  if (!cur.ensured) { await setDoc(ref, { participants: cur.participants, type: cur.type, ...(cur.type === 'group' ? { name: cur.title } : {}) }, { merge: true }); cur.ensured = true; }
  return ref;
}
async function push(msg, preview) {
  const ref = await ensureChat(), un = {};
  cur.participants.filter(p => p !== S.me.id).forEach(o => un[o] = increment(1));
  await setDoc(ref, { lastMessage: preview, lastMessageTime: serverTimestamp(), lastSender: S.me.id, unread: un, typing: { [S.me.id]: 0 } }, { merge: true });
  await addDoc(collection(ref, 'messages'), { senderId: S.me.id, timestamp: serverTimestamp(), status: 'sent', deleted: false, ...msg });
}
function progressBubble(label) {
  const fill = h('i'), b = h('div', 'bub out pop', label, h('div', 'prog', fill)), box = $('msgs');
  pend.add(b); box.insertBefore(b, typEl); box.scrollTop = box.scrollHeight;
  return { set: v => fill.style.width = Math.round(v * 100) + '%', done: () => { pend.delete(b); b.remove(); } };
}
async function sendMedia(file, kind) {
  if (!cur) return;
  if (kind !== 'image' && file.size > 25 * 1048576) return toast('Ukuran maksimal 25 MB.');
  const label = kind === 'image' ? 'Foto' : kind === 'video' ? 'Video' : file.name, p = progressBubble('Mengunggah ' + label + '...');
  try {
    await ensureChat();
    const blob = kind === 'image' ? await compressImage(file) : file, ts = Date.now();
    const ph = kind === 'image' ? await dHash(file).catch(() => null) : null;
    const path = `chats/${cur.id}/${S.me.id}/${ts}_${kind === 'image' ? 'foto.jpg' : safe(file.name)}`;
    const up = await upload(path, blob, p.set, blob.type || file.type);
    const msg = { type: kind, mediaUrl: up.url, mediaPath: up.path }; if (kind === 'file') { msg.fileName = file.name; msg.size = file.size; }
    if (ph) { msg.phash = ph; msg.upTs = ts; }
    await push(msg, kind === 'file' ? 'Dokumen: ' + file.name : label); sfx('send');
    if (ph) addDoc(collection(db, 'imageHashes'), { hash: ph, bands: bandsOf(ph), sender: S.me.id, ts }).catch(() => {});
  } catch (e) { toast('Gagal mengirim: ' + (e.message || e.code)); } finally { p.done(); }
}
async function recStart(mode) {
  if (rec || !cur) return;
  let r; try { r = await startRecorder(); } catch { return toast('Izin mikrofon ditolak.'); }
  if (mode === 'hold' && !held) { r.cancel(); return; }
  rec = r; recMode = mode; const t0 = Date.now();
  $('recBar').hidden = false; $('recBar').classList.toggle('tap', mode === 'tap'); $('rTime').textContent = '0:00'; sfx('rec');
  recT = setInterval(() => $('rTime').textContent = dur(Math.round((Date.now() - t0) / 1000)), 250);
}
async function recEnd(send) {
  if (!rec) return;
  const r = rec; rec = null; recMode = ''; clearInterval(recT); $('recBar').hidden = true; sfx('stop');
  if (!send) return r.cancel();
  const { blob, duration } = await r.stop();
  if (duration < 1) return toast('Tahan lebih lama untuk merekam.');
  const p = progressBubble('Mengirim pesan suara...');
  try {
    await ensureChat();
    const path = `chats/${cur.id}/${S.me.id}/${Date.now()}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`;
    const up = await upload(path, blob, p.set, blob.type);
    await push({ type: 'audio', mediaUrl: up.url, mediaPath: up.path, duration }, 'Pesan suara'); sfx('send');
  } catch (e) { toast('Gagal mengirim suara: ' + (e.message || e.code)); } finally { p.done(); }
}
const toggleSend = () => { const has = !!$('rInput').value.trim(); $('bSend').hidden = !has; $('bMic').hidden = has; };

/* ---------- centang "diterima" (dipanggil saat ada chat masuk) ---------- */
export async function markDelivered(id) {
  if (busy.has(id)) return; busy.add(id);
  try {
    const s = await getDocs(query(collection(db, 'chats', id, 'messages'), where('status', '==', 'sent'), limit(50)));
    await Promise.all(s.docs.filter(d => d.data().senderId !== S.me.id).map(d => updateDoc(d.ref, { status: 'delivered' })));
  } catch { /* abaikan */ } finally { busy.delete(id); }
}

/* ---------- pasang event (sekali) ---------- */
export function initChat() {
  $('rBack').onclick = closeRoom;
  $('rInput').addEventListener('input', () => {
    toggleSend(); const n = Date.now();
    if (cur && Object.keys(cur.data || {}).length && n - lastTyp > 2500) { lastTyp = n; updateDoc(doc(db, 'chats', cur.id), { ['typing.' + S.me.id]: n }).catch(() => {}); }
  });
  $('rForm').onsubmit = async e => {
    e.preventDefault(); const t = $('rInput').value.trim(); if (!t || !cur) return;
    $('rInput').value = ''; toggleSend(); sfx('send');
    try { await push({ type: 'text', text: t }, t.slice(0, 80)); } catch (err) { toast('Gagal kirim: ' + err.code); $('rInput').value = t; toggleSend(); }
  };
  $('bAttach').onclick = () => { $('attach').hidden = false; sfx('open'); };
  $('tMedia').onclick = () => { $('attach').hidden = true; $('fMedia').click(); };
  $('tDoc').onclick = () => { $('attach').hidden = true; $('fDoc').click(); };
  $('tVoice').onclick = () => { $('attach').hidden = true; recStart('tap'); };
  $('tLoc').onclick = async () => {
    $('attach').hidden = true; toast('Mengambil lokasi...', 'ok');
    try { const { lat, lng } = await getLocation(); await push({ type: 'location', lat, lng }, 'Lokasi'); sfx('send'); } catch (e) { toast(e.message || 'Gagal mengambil lokasi.'); }
  };
  $('fMedia').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) sendMedia(f, f.type.startsWith('video') ? 'video' : 'image'); };
  $('fDoc').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) sendMedia(f, 'file'); };
  const mic = $('bMic');
  mic.addEventListener('pointerdown', e => { e.preventDefault(); held = true; try { mic.setPointerCapture(e.pointerId); } catch {} recStart('hold'); });
  ['pointerup', 'pointercancel'].forEach(ev => mic.addEventListener(ev, () => { held = false; if (recMode === 'hold') recEnd(true); }));
  mic.addEventListener('contextmenu', e => e.preventDefault());
  $('rCancel').onclick = () => recEnd(false); $('rSend').onclick = () => recEnd(true);
  $('mmCheck').onclick = () => { $('msgMenu').hidden = true; checkReceipt(menuCtx.m); };
  $('mmCancel').onclick = () => $('msgMenu').hidden = true;
  $('mmCopy').onclick = () => { navigator.clipboard?.writeText(menuCtx.m.text || ''); $('msgMenu').hidden = true; toast('Teks disalin.', 'ok'); };
  $('mmDel').onclick = async () => {
    const { ref, m } = menuCtx; $('msgMenu').hidden = true;
    try { await updateDoc(ref, { deleted: true, text: '', mediaUrl: null, mediaPath: null, type: 'text' }); removeFile(m.mediaPath); sfx('del'); } catch (e) { toast('Gagal menghapus: ' + e.code); }
  };
  $('lightbox').onclick = () => $('lightbox').hidden = true;
}
