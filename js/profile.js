// Pengaturan: foto profil, ganti username, bio, suara, keluar
import { auth, db, doc, updateDoc, writeBatch, getDoc, signOut } from './firebase.js';
import { $, S, avatar, toast } from './ui.js';
import { sfx, isMuted, setMuted } from './sfx.js';
import { compressImage, upload } from './media.js';

const soundLabel = () => $('sSound').textContent = 'Efek suara: ' + (isMuted() ? 'mati' : 'nyala');
export function fillSettings() {
  const me = S.me; $('sName').value = me.username; $('sEmail').value = auth.currentUser?.email || ''; $('sBio').value = me.bio || '';
  $('sAv').replaceChildren(avatar(me)); soundLabel();
}
export function initProfile(onSignOut) {
  $('sPhoto').onclick = () => $('fAvatar').click();
  $('sAv').onclick = () => $('fAvatar').click();
  $('fAvatar').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    toast('Mengunggah foto profil...', 'ok');
    try {
      const blob = await compressImage(f, 512, .8), up = await upload(`avatars/${S.me.id}.jpg`, blob, null, 'image/jpeg');
      await updateDoc(doc(db, 'users', S.me.id), { photoURL: up.url });
      S.me.photoURL = up.url; S.cache.set(S.me.id, S.me); fillSettings(); window.dispatchEvent(new Event('profile-changed')); toast('Foto profil diperbarui.', 'ok');
    } catch (err) { toast('Gagal mengunggah: ' + (err.message || err.code)); }
  };
  $('sNameBtn').onclick = async () => {
    const name = $('sName').value.trim(), low = name.toLowerCase(), me = S.me;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return toast('Username 3–20 karakter: huruf, angka, garis bawah.');
    if (name === me.username) return;
    try {
      const b = writeBatch(db);
      if (low !== me.usernameLower) {
        if ((await getDoc(doc(db, 'usernames', low))).exists()) return toast('Username sudah dipakai.');
        b.set(doc(db, 'usernames', low), { uid: me.id }); b.delete(doc(db, 'usernames', me.usernameLower));
      }
      b.update(doc(db, 'users', me.id), { username: name, usernameLower: low }); await b.commit();
      me.username = name; me.usernameLower = low; S.cache.set(me.id, me); window.dispatchEvent(new Event('profile-changed')); toast('Username diganti.', 'ok');
    } catch (e) { toast('Gagal mengganti username: ' + e.code); }
  };
  $('sSave').onclick = async () => {
    const bio = $('sBio').value.trim();
    try { await updateDoc(doc(db, 'users', S.me.id), { bio }); S.me.bio = bio; toast('Bio disimpan.', 'ok'); } catch (e) { toast('Gagal menyimpan: ' + e.code); }
  };
  $('sSound').onclick = () => { setMuted(!isMuted()); soundLabel(); sfx('pop'); };
  $('sOut').onclick = async () => { await onSignOut(); await signOut(auth); };
}
