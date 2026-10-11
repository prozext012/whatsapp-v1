// Vercel Serverless Function: jawaban untuk kontak "AI dixzChat" via SynoxCloud Unlimited AI.
// Panggilan ke provider dilakukan di server, bukan dari browser/APK.
const FB_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD1656fPz0HWe9nTdiBJcrQz6N02njt_jU'; // key web Firebase (publik)
const hits = new Map();
const SYSTEM = `Kamu adalah "AI dixzChat", asisten di dalam aplikasi chat dixzChat. Jawab dengan bahasa yang dipakai pengguna (default: Indonesia santai tapi sopan), ringkas dan jelas, enak dibaca di layar HP (maksimal sekitar 6 paragraf pendek). Kalau tidak tahu, atau informasinya mungkin sudah berubah, katakan terus terang. Jangan berpura-pura menjadi manusia. Tolak dengan sopan permintaan yang berbahaya atau ilegal. Jangan meminta data sensitif seperti password, PIN, atau nomor kartu.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
    try {
    const { idToken, messages } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!idToken || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Data tidak lengkap' });
    // 1) pemanggil harus sudah login
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
    const uid = (await v.json()).users?.[0]?.localId;
    if (!uid) return res.status(401).json({ error: 'Sesi login tidak valid' });
    // 2) batas pemakaian sederhana (12 pesan per menit per akun)
    const now = Date.now(), arr = (hits.get(uid) || []).filter(t => now - t < 60000);
    if (arr.length >= 12) return res.status(429).json({ error: 'Terlalu cepat, tunggu sebentar lalu coba lagi' });
    arr.push(now); hits.set(uid, arr);
    // 3) rapikan riwayat: maks 12 pesan, giliran user/model bergantian, mulai dari user
    let total = 0; const turns = [];
    for (const m of messages.slice(-12)) {
      const text = String(m?.text || '').trim().slice(0, 2000), role = m?.role === 'model' ? 'model' : 'user';
      if (!text) continue; total += text.length;
      if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].parts[0].text += '\n' + text;
      else turns.push({ role, parts: [{ text }] });
    }
    while (turns.length && turns[0].role !== 'user') turns.shift();
    if (!turns.length || total > 12000) return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });
    // 4) Kirim konteks ringkas ke SynoxCloud Unlimited AI.
    // Endpoint pada dokumentasi yang dikirim pengguna menggunakan GET dan apikey=FREE.
    const transcript = turns.map(t => `${t.role === 'model' ? 'Asisten' : 'Pengguna'}: ${t.parts.map(p => p.text).join(' ')}`).join('\n');
    const prompt = `${SYSTEM}\n\nPercakapan terakhir:\n${transcript}`.slice(0, 9000);
    const params = new URLSearchParams({ prompt, session: `dixz-${uid}`, apikey: process.env.SYNOXCLOUD_API_KEY || 'FREE' });
    const endpoint = process.env.SYNOXCLOUD_ENDPOINT || 'https://api.synoxcloud.xyz/ai-chat/unlimited-ai';
    const upstream = await fetch(`${endpoint}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    let data;
    try { data = await upstream.json(); } catch { data = null; }
    if (!upstream.ok || data?.status !== true) return res.status(502).json({ error: data?.message || data?.error || `Layanan AI gagal (HTTP ${upstream.status})` });
    const answer = data?.result?.answer;
    const reply = answer == null ? '' : String(answer).trim();
    return res.status(200).json({ reply: reply || 'Maaf, AI belum memberikan jawaban. Coba lagi sebentar.' });
  } catch (e) { return res.status(500).json({ error: 'Terjadi kesalahan server' }); }
};
