// Cek struk: ambil data lewat /api/analyze-receipt, cocokkan waktu (maks 24 jam), cari gambar yang dipakai ulang
import { auth, db, collection, query, where, getDocs } from './firebase.js';
import { $, h, getUser } from './ui.js';
import { bandsOf } from './media.js';
const LV = ['rendah', 'sedang', 'tinggi'];
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } } return d; };
const kv = (k, v) => h('div', 'kv', h('span', '', k), h('b', '', String(v)));
const dur = ms => { const m = Math.round(Math.abs(ms) / 60000); return m >= 60 ? Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt' : m + ' mnt'; };
$('rcClose').onclick = () => $('rcSheet').hidden = true;

async function dups(m) {
  if (!m.phash) return [];
  const s = await getDocs(query(collection(db, 'imageHashes'), where('bands', 'array-contains-any', bandsOf(m.phash))));
  return s.docs.map(d => d.data()).filter(r => !(r.sender === m.senderId && r.ts === m.upTs) && ham(r.hash, m.phash) <= 6).sort((a, b) => a.ts - b.ts);
}
export async function checkReceipt(m) {
  if (!confirm('Gambar ini akan dikirim ke layanan AI (Gemini) untuk dianalisis. Lanjutkan?')) return;
  const box = $('rcBody'); $('rcSheet').hidden = false; box.replaceChildren(h('div', 'empty', 'Memeriksa struk...'));
  try {
    const idToken = await auth.currentUser.getIdToken();
    const [res, dp] = await Promise.all([
      fetch('/api/analyze-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, imageUrl: m.mediaUrl }) }),
      dups(m).catch(() => [])
    ]);
    const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Analisis gagal');
    await show(j, m, dp);
  } catch (e) { box.replaceChildren(h('div', 'empty', 'Gagal: ' + e.message)); }
}
async function show(j, m, dp) {
  const box = $('rcBody'); box.replaceChildren();
  if (!j.is_receipt) return box.append(h('div', 'vd r1', 'Gambar ini tidak terlihat seperti struk atau bukti transaksi.'), h('div', 'note', j.summary || ''));
  let lvl = Math.max(0, LV.indexOf(j.risk)); const nodes = [];
  const sent = m.timestamp?.toMillis?.() ?? Date.now(); let cek;
  if (j.date && j.time) {
    const t = Date.parse(`${j.date}T${j.time}:00+07:00`), diff = sent - t;
    if (isNaN(t)) cek = 'Waktu tidak terbaca';
    else if (diff < -5 * 60000) { cek = 'JANGGAL: struk bertanggal setelah gambar dikirim'; lvl = 2; }
    else if (diff > 864e5) { cek = 'TIDAK COCOK: selisih ' + dur(diff) + ' (batas 24 jam)'; lvl = Math.max(lvl, 1); }
    else cek = 'COCOK: selisih ' + dur(diff) + ' (batas 24 jam)';
  } else cek = 'Tanggal/jam tidak terbaca, tidak bisa dicocokkan';
  nodes.push(h('div', 'card col', kv('Jenis', j.type || '-'), kv('Bank / merchant', j.bank_or_merchant || '-'), kv('Waktu di struk', j.date && j.time ? `${j.date} ${j.time} WIB` : '-'),
    kv('Nominal', j.amount != null ? 'Rp' + Number(j.amount).toLocaleString('id-ID') : '-'), kv('No. referensi', j.reference_number || '-'), kv('Status', j.status || '-'), kv('Cek waktu', cek)));
  if (j.suspicious_signs?.length) {
    nodes.push(h('div', 'lab', 'TANDA JANGGAL'));
    j.suspicious_signs.forEach(s => nodes.push(h('div', 'card col', h('b', '', s.sign || ''), h('span', 'sb', s.detail || ''))));
  } else nodes.push(h('div', 'note', 'Tidak ada tanda janggal visual yang terlihat.'));
  if (dp.length) {
    lvl = 2; const u = await getUser(dp[0].sender);
    nodes.push(h('div', 'lab', 'GAMBAR SERUPA PERNAH DIKIRIM'), h('div', 'card col', h('b', '', `Ditemukan ${dp.length} gambar mirip`), h('span', 'sb', `Pertama kali oleh ${u.username} pada ${new Date(dp[0].ts).toLocaleString('id-ID')}`)));
  }
  box.append(h('div', 'vd r' + lvl, `Indikasi risiko ${LV[lvl].toUpperCase()}`, h('div', 'note', j.summary || '')), ...nodes,
    h('div', 'note', 'Ini indikasi otomatis, bukan bukti. AI tidak bisa memastikan struk asli atau palsu. Pastikan lewat mutasi rekening atau aplikasi bank/e-wallet.'));
}
