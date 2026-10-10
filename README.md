# dixzChat
Static site (tanpa build) · HTML + CSS + Vanilla JS (ES modules) + Firebase 13.0.0 (CDN) · Neo-Brutalism + motion + efek suara.

## Fitur
Login/register + captcha · kontak otomatis (semua user) · chat 1-1 & grup · centang terkirim/diterima/dibaca ·
indikator mengetik · hapus pesan untuk semua (tekan lama) · foto/video (kompres + progres) · pesan suara (tahan mic atau menu) ·
dokumen · lokasi (link Google Maps) · status 24 jam (teks/foto) · foto profil, ganti username, bio · PWA (bisa di-install, shell offline).

## Deploy
1. Upload semua file di folder ini ke root repo GitHub.
2. Vercel: Add New Project > pilih repo > Framework **Other**, Build Command & Output Directory kosong > Deploy.
3. Firebase Console:
   - Authentication > Sign-in method: aktifkan **Email/Password**.
   - Authentication > Settings > Authorized domains: tambahkan domain `*.vercel.app` kamu.
   - Firestore Database: buat database > tab **Rules** > tempel `firestore.rules` > Publish.
   - Storage: aktifkan (mungkin perlu paket Blaze) > tab **Rules** > tempel `storage.rules` > Publish.
   - (Opsional, disarankan) Firestore > TTL: buat kebijakan TTL untuk koleksi `statuses`, field `expiresAt`, supaya status lama terhapus otomatis.
4. Buka situs, daftar 2 akun (browser berbeda) lalu coba semua fitur. Di Android: menu Chrome > "Instal aplikasi".

## Catatan jujur
- Panggilan suara/video belum ada (tab Telepon masih kosong). Butuh WebRTC + server TURN.
- Notifikasi saat aplikasi ditutup belum ada (butuh FCM + backend/Cloud Functions).
- Lampiran bisa dibaca siapa pun yang sudah login dan tahu URL-nya (URL berisi token acak), bukan hanya anggota chat.
- Setelah deploy ulang, buka dua kali (service worker memuat versi lama dulu). Naikkan `V` di `sw.js` tiap rilis.

## AI dixzChat (kontak bot, Gemini lewat Vercel)
Kontak "AI dixzChat" muncul otomatis di daftar kontak. Pesan teks ke kontak ini dijawab oleh Gemini lewat `api/ai-chat.js`.
1. Vercel > Settings > Environment Variables: `GEMINI_API_KEY` (wajib), `GEMINI_MODEL` (opsional, default `gemini-flash-latest`). Redeploy setelah mengubah.
2. Publish ulang `firestore.rules` (ada aturan balasan AI).
3. Hapus file lama `api/analyze-receipt.js` dan `js/receipt.js` dari repo (fitur cek struk sudah dicabut).
Catatan: pesan di chat AI dikirim ke Google untuk diproses; jangan kirim data sensitif. Ada batas 12 pesan/menit per akun dan jatah gratis Gemini.
