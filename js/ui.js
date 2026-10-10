// Helper UI bersama + state global
import { db, doc, getDoc } from './firebase.js';
import { sfx } from './sfx.js';
export const $ = id => document.getElementById(id);
export const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; kids.forEach(k => e.append(k)); return e; };
export const S = { me: null, cache: new Map(), chats: [], contacts: [] };
export const BOT = { id: 'ai-dixz', username: 'AI dixzChat', bio: 'Tanya apa saja, aku jawab', photoURL: 'default', isOnline: true, isBot: true };
export const COLORS = ['#FF90E8', '#FFC900', '#23A094'];
export const fmt = ts => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
export const size = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
export const dur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const ago = ms => { const m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? 'baru saja' : m < 60 ? m + ' mnt lalu' : Math.floor(m / 60) + ' jam lalu'; };
export function ico(n) { const s = document.createElement('span'); s.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`; return s.firstChild; }
export function avatar(u) {
  const name = u.username || u.name || '?';
  const d = h('div', 'av' + (u.isGroup ? ' grp' : ''), name[0].toUpperCase());
  d.style.background = COLORS[name.charCodeAt(0) % 3];
  if (u.isBot) { d.textContent = 'AI'; d.style.background = '#23A094'; }
  if (/^https?:/.test(u.photoURL || '')) { d.textContent = ''; const i = h('img'); i.src = u.photoURL; i.alt = ''; d.append(i); }
  return d;
}
export function toast(msg, kind = 'err') {
  const t = $('toast'); t.textContent = msg; t.className = 'show ' + kind; sfx(kind === 'err' ? 'error' : 'ok');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 3500);
}
let wn = 0;
export function wipe() { const w = $('wipe'); w.className = ''; void w.offsetWidth; w.className = 'go c' + (wn++ % 3); }
export const other = c => c.participants.find(p => p !== S.me.id);
export async function getUser(id) {
  if (S.cache.has(id)) return S.cache.get(id);
  const s = await getDoc(doc(db, 'users', id));
  const u = s.exists() ? { id, ...s.data() } : { id, username: 'pengguna' };
  S.cache.set(id, u); return u;
}
