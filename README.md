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

## AI dixzChat (SynoxCloud lewat backend Vercel)
Kontak "AI dixzChat" muncul otomatis di daftar kontak. Saat chat AI dibuka, pilih model dari dropdown. Frontend hanya mengirim pesan dan nama model ke endpoint internal `/api/ai-chat`; URL SynoxCloud dan request ke provider diproses di `api/ai-chat.js`, bukan di browser/APK.

Model yang terpasang: Unlimited AI (`prompt`), DeepSeek R1 (`q`), GPT-4o Mini (`prompt`), dan Gemini 3.1 Flash Lite Preview (`pesan`). Pemilihan model disimpan di browser masing-masing.

1. Vercel > Settings > Environment Variables: opsional `SYNOXCLOUD_API_KEY`; jika tidak ada, backend memakai `FREE`.
2. Deploy ulang setelah mengubah kode.
3. Backend memverifikasi Firebase login dan menerapkan batas sederhana 12 pesan/menit per akun.

Catatan: endpoint Gemini 3.1 Flash Lite Preview pernah mengembalikan `wrong params` saat diuji dari halaman provider. Kode sudah meneruskan parameter `pesan` sesuai screenshot, tetapi endpoint itu tetap perlu dites ulang; jika SynoxCloud menolak parameter, pilih model lain sampai parameter resminya dikonfirmasi.
