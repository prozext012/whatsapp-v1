// Login / Register + captcha matematika (client-side) + pembuatan profil
import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, getDoc, writeBatch, serverTimestamp } from './firebase.js';
import { $, toast } from './ui.js';
let mode = 'login', answer = 0;
const MSG = {
  'auth/invalid-credential': 'Email atau password salah.',
  'auth/email-already-in-use': 'Email sudah terdaftar.',
  'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/network-request-failed': 'Tidak ada koneksi internet.',
  'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti.'
};
function newCaptcha() {
  const a = 1 + Math.floor(Math.random() * 9), b = 1 + Math.floor(Math.random() * 9);
  answer = a + b; $('capQ').textContent = `${a} + ${b} = ?`; $('capA').value = '';
}
function setMode(m) {
  mode = m;
  $('tabLogin').classList.toggle('on', m === 'login'); $('tabReg').classList.toggle('on', m === 'reg');
  $('fUser').hidden = $('capBox').hidden = m === 'login';
  $('authSubmit').textContent = m === 'login' ? 'MASUK' : 'DAFTAR SEKARANG';
  $('aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  if (m === 'reg') newCaptcha();
}
async function register(email, pw) {
  const name = $('aUser').value.trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error('Username 3–20 karakter: huruf, angka, garis bawah.');
  if (parseInt($('capA').value, 10) !== answer) { newCaptcha(); throw new Error('Captcha salah, coba lagi.'); }
  const low = name.toLowerCase();
  if ((await getDoc(doc(db, 'usernames', low))).exists()) throw new Error('Username sudah dipakai.');
  const { user } = await createUserWithEmailAndPassword(auth, email, pw);
  const b = writeBatch(db);
  b.set(doc(db, 'usernames', low), { uid: user.uid });
  b.set(doc(db, 'users', user.uid), { username: name, usernameLower: low, bio: '', photoURL: 'default', isOnline: true, lastSeen: serverTimestamp(), createdAt: serverTimestamp() });
  b.set(doc(db, 'users_private', user.uid), { email });
  await b.commit();
}
export function initAuth() {
  $('tabLogin').onclick = () => setMode('login');
  $('tabReg').onclick = () => setMode('reg');
  $('authForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('authSubmit'); btn.disabled = true;
    try {
      const email = $('aEmail').value.trim(), pw = $('aPass').value;
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, pw); else await register(email, pw);
    } catch (err) { toast(err.code ? (MSG[err.code] || 'Terjadi kesalahan: ' + err.code) : err.message); }
    finally { btn.disabled = false; }
  };
  setMode('login');
}
