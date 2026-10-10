// Status / Stories 24 jam (teks & foto)
import { db, doc, addDoc, deleteDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from './firebase.js';
import { $, h, S, avatar, toast, ico, ago, getUser } from './ui.js';
import { sfx } from './sfx.js';
import { compressImage, upload, removeFile } from './media.js';

const DAY = 864e5, BG = ['#FF90E8', '#FFC900', '#23A094'];
let unsub = null, groups = new Map(), bg = BG[0], vt = null, vList = [], vIdx = 0;
const seen = new Set(JSON.parse(localStorage.getItem('seenSt') || '[]'));
const markSeen = id => { seen.add(id); localStorage.setItem('seenSt', JSON.stringify([...seen].slice(-300))); };

export function startStatus() {
  const cutoff = Timestamp.fromMillis(Date.now() - DAY);
  unsub = onSnapshot(query(collection(db, 'statuses'), where('timestamp', '>', cutoff), orderBy('timestamp', 'desc')), async s => {
    const now = Date.now(); groups = new Map();
    s.docs.forEach(d => {
      const x = { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }; x.ms = x.timestamp.toMillis();
      if (now - x.ms > DAY) return;
      if (!groups.has(x.senderId)) groups.set(x.senderId, []); groups.get(x.senderId).push(x);
    });
    groups.forEach(l => l.sort((a, b) => a.ms - b.ms));
    await Promise.all([...groups.keys()].map(getUser)); render();
  }, e => toast('Gagal memuat status: ' + e.code));
}
export function stopStatus() { unsub?.(); unsub = null; groups = new Map(); closeViewer(); }

function render() {
  const mine = groups.get(S.me.id) || [], my = $('myStatus'); my.replaceChildren();
  const b = h('button', 'card row rise', avatar(S.me), h('div', 'grow', h('div', 'nm', 'Status saya'), h('div', 'sb', mine.length ? mine.length + ' status · ' + ago(mine[mine.length - 1].ms) : 'Ketuk + untuk menambah')));
  b.onclick = () => mine.length ? view(mine, 0) : openAdd(); my.append(b);
  const row = $('stRow'); row.replaceChildren();
  const others = [...groups.entries()].filter(([id]) => id !== S.me.id);
  if (!others.length) return row.append(h('div', 'empty', 'Belum ada status dari kontak.'));
  const wrap = h('div', 'card rise', ''); wrap.style.cssText = 'overflow-x:auto;gap:14px;justify-content:flex-start';
  others.forEach(([id, list]) => {
    const u = S.cache.get(id) || { username: '?' }, unseen = list.some(x => !seen.has(x.id)), av = avatar(u);
    av.style.cssText += `width:60px;height:60px;border:5px solid ${unseen ? '#FF90E8' : '#999'}`;
    const it = h('button', '', av, h('div', 'tm', u.username)); it.style.cssText = 'border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:6px;flex:none;width:68px';
    it.onclick = () => view(list, Math.max(0, list.findIndex(x => !seen.has(x.id)))); wrap.append(it);
  });
  row.append(wrap);
}

/* ---- penampil ---- */
function view(list, idx) { vList = list; vIdx = idx; $('viewer').hidden = false; sfx('pop'); show(); }
function show() {
  clearTimeout(vt); const it = vList[vIdx]; if (!it) return closeViewer();
  markSeen(it.id); const u = S.cache.get(it.senderId) || {};
  $('vBars').replaceChildren(...vList.map((_, i) => h('div', '', h('i', i < vIdx ? 'done' : i === vIdx ? 'run' : ''))));
  $('vAv').replaceChildren(avatar(u)); $('vName').textContent = u.username || ''; $('vTime').textContent = ago(it.ms);
  $('vDel').hidden = it.senderId !== S.me.id;
  const body = $('vBody'); body.replaceChildren(); body.style.background = '#000';
  if (it.type === 'image') { const i = h('img'); i.src = it.mediaUrl; i.alt = 'Status'; body.append(i); }
  else { body.style.background = it.bg || BG[0]; body.textContent = it.text; }
  vt = setTimeout(() => { vIdx++; show(); }, 5000);
}
function closeViewer() { clearTimeout(vt); $('viewer').hidden = true; if (S.me) render(); }

/* ---- tambah status ---- */
function openAdd() { $('astSheet').hidden = false; sfx('open'); }
async function post(data) {
  await addDoc(collection(db, 'statuses'), { senderId: S.me.id, timestamp: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + DAY), ...data });
  $('astSheet').hidden = true; toast('Status terkirim.', 'ok');
}
export function bindStatus() {
  $('stAdd').onclick = openAdd; $('aClose').onclick = () => $('astSheet').hidden = true;
  const sw = $('aSw'); BG.forEach((c, i) => { const b = h('button', i ? '' : 'on'); b.type = 'button'; b.style.background = c; b.setAttribute('aria-label', 'Warna ' + (i + 1)); b.onclick = () => { bg = c; [...sw.children].forEach(x => x.classList.toggle('on', x === b)); }; sw.append(b); });
  $('aPostText').onclick = async () => {
    const t = $('aTxt').value.trim(); if (!t) return toast('Tulis sesuatu dulu.');
    try { await post({ type: 'text', text: t, bg }); $('aTxt').value = ''; } catch (e) { toast('Gagal: ' + e.code); }
  };
  $('aPickPhoto').onclick = () => $('fStatus').click();
  $('fStatus').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    toast('Mengunggah foto...', 'ok');
    try { const blob = await compressImage(f, 1080, .78), up = await upload(`statuses/${S.me.id}/${Date.now()}.jpg`, blob, null, 'image/jpeg'); await post({ type: 'image', mediaUrl: up.url, mediaPath: up.path }); } catch (err) { toast('Gagal mengunggah: ' + (err.message || err.code)); }
  };
  $('vClose').onclick = closeViewer;
  $('vNext').onclick = () => { vIdx++; show(); }; $('vPrev').onclick = () => { vIdx = Math.max(0, vIdx - 1); show(); };
  $('vDel').onclick = async () => {
    const it = vList[vIdx]; if (!it) return;
    try { await deleteDoc(doc(db, 'statuses', it.id)); removeFile(it.mediaPath); sfx('del'); toast('Status dihapus.', 'ok'); closeViewer(); } catch (e) { toast('Gagal menghapus: ' + e.code); }
  };
}
