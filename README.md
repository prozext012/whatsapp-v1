# dixzChat · Ronde 1
Static site (tanpa build). Isi: login/register + captcha, kontak otomatis, chat teks 1-1, profil (bio).

## Deploy
1. Upload semua file ini ke repo GitHub (root repo = folder ini).
2. Vercel > Add New Project > pilih repo. Framework: **Other**, Build Command & Output Directory dikosongkan. Deploy.
3. Firebase Console:
   - Authentication > Sign-in method: aktifkan **Email/Password**.
   - Authentication > Settings > Authorized domains: tambahkan domain `*.vercel.app` kamu.
   - Firestore Database: buat database, lalu tab **Rules**: tempel isi `firestore.rules` > Publish.
4. Buka situs, daftar 2 akun (browser berbeda), lalu coba chat.

## Belum ada (ronde 2-3)
Chat grup, status 24 jam, lampiran (foto/video, voice note, file, lokasi), centang pesan, indikator mengetik,
hapus pesan, foto profil + ganti username, PWA/offline shell, storage.rules.
