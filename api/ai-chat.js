// Vercel Serverless Function: AI dixzChat via SynoxCloud.
// Provider requests stay on the server; Firebase ID token is validated first.
const FB_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyD1656fPz0HWe9nTdiBJcrQz6N02njt_jU';
const hits = new Map();
const SYSTEM = `Kamu adalah "AI dixzChat", asisten di dalam aplikasi chat dixzChat. Jawab dengan bahasa yang dipakai pengguna (default: Indonesia santai tapi sopan), ringkas dan jelas, enak dibaca di layar HP (maksimal sekitar 6 paragraf pendek). Kalau tidak tahu, atau informasinya mungkin sudah berubah, katakan terus terang. Jangan berpura-pura menjadi manusia. Tolak dengan sopan permintaan yang berbahaya atau ilegal. Jangan meminta data sensitif seperti password, PIN, atau nomor kartu.`;
const MODELS = {
  'unlimited-ai': { path: '/ai-chat/unlimited-ai', promptKey: 'prompt', session: true, answer: d => d?.result?.answer },
  'deepseek-r1': { path: '/ai-chat/deepseek-r1', promptKey: 'q', session: false, answer: d => d?.result?.answer },
  'gpt-4o-mini': { path: '/ai-chat/gpt-4o-mini', promptKey: 'prompt', session: true, answer: d => d?.data?.answer },
  'gemini-3.1-flash-lite-preview': { path: '/ai-chat/gemini-3.1-flash-lite-preview', promptKey: 'pesan', session: true, answer: d => d?.data?.answer }
};
const BASE = 'https://api.synoxcloud.xyz';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  try {
    const { idToken, messages, model: requestedModel } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!idToken || !Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Data tidak lengkap' });
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
    const uid = (await v.json()).users?.[0]?.localId;
    if (!uid) return res.status(401).json({ error: 'Sesi login tidak valid' });
    const now = Date.now(), arr = (hits.get(uid) || []).filter(t => now - t < 60000);
    if (arr.length >= 12) return res.status(429).json({ error: 'Terlalu cepat, tunggu sebentar lalu coba lagi' });
    arr.push(now); hits.set(uid, arr);
    let total = 0; const turns = [];
    for (const m of messages.slice(-12)) {
      const text = String(m?.text || '').trim().slice(0, 2000), role = m?.role === 'model' ? 'model' : 'user';
      if (!text) continue; total += text.length;
      if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].parts[0].text += '\n' + text;
      else turns.push({ role, parts: [{ text }] });
    }
    while (turns.length && turns[0].role !== 'user') turns.shift();
    if (!turns.length || total > 12000) return res.status(400).json({ error: 'Pesan tidak valid atau terlalu panjang' });
    const model = MODELS[requestedModel] ? requestedModel : 'unlimited-ai';
    const config = MODELS[model];
    const transcript = turns.map(t => `${t.role === 'model' ? 'Asisten' : 'Pengguna'}: ${t.parts.map(p => p.text).join(' ')}`).join('\n');
    const prompt = `${SYSTEM}\n\nPercakapan terakhir:\n${transcript}`.slice(0, 9000);
    const params = new URLSearchParams({ [config.promptKey]: prompt, apikey: process.env.SYNOXCLOUD_API_KEY || 'FREE' });
    if (config.session) params.set('session', `dixz-${uid}`);
    const upstream = await fetch(`${BASE}${config.path}?${params.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } });
    let data; try { data = await upstream.json(); } catch { data = null; }
    if (!upstream.ok || data?.status !== true) return res.status(502).json({ error: data?.message || data?.error || `Layanan AI gagal (HTTP ${upstream.status})`, model });
    if (data?.data?.success === false || (typeof data?.data?.status === 'number' && data.data.status >= 400)) {
      const raw = data?.data?.raw;
      let detail = ''; try { detail = typeof raw === 'string' ? (JSON.parse(raw).message || raw) : ''; } catch { detail = raw || ''; }
      return res.status(502).json({ error: detail || `Provider ${model} menolak parameter atau gagal memproses permintaan`, model });
    }
    const answer = config.answer(data);
    const reply = answer == null ? '' : String(answer).trim();
    if (!reply) return res.status(502).json({ error: `Endpoint ${model} tidak mengembalikan jawaban. Coba model lain atau periksa parameter endpoint di SynoxCloud.`, model });
    return res.status(200).json({ reply, model });
  } catch (e) { return res.status(500).json({ error: 'Terjadi kesalahan server' }); }
};
