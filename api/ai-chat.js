// Vercel Serverless Function: jawaban untuk kontak "AI dixzChat" (Gemini).
// API key disimpan di Environment Variable Vercel (GEMINI_API_KEY), tidak pernah ada di browser.
const FB_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD1656fPz0HWe9nTdiBJcrQz6N02njt_jU'; // key web Firebase (publik)
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const hits = new Map();
const SYSTEM = `Kamu adalah "AI dixzChat", asisten di dalam aplikasi chat dixzChat. Jawab dengan bahasa yang dipakai pengguna (default: Indonesia santai tapi sopan), ringkas dan jelas, enak dibaca di layar HP (maksimal sekitar 6 paragraf pendek). Kalau tidak tahu, atau informasinya mungkin sudah berubah, katakan terus terang. Jangan berpura-pura menjadi manusia. Tolak dengan sopan permintaan yang berbahaya atau ilegal. Jangan meminta data sensitif seperti password, PIN, atau nomor kartu.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di Vercel' });
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
    // 4) tanya Gemini
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: turns, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } })
    });
    const gj = await g.json();
    if (!g.ok) return res.status(502).json({ error: gj.error?.message || 'Layanan AI gagal' });
    const reply = (gj.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return res.status(200).json({ reply: reply || 'Maaf, aku belum bisa menjawab itu. Coba tanyakan dengan cara lain.' });
  } catch (e) { return res.status(500).json({ error: 'Terjadi kesalahan server' }); }
};
