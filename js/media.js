// Utilitas media: kompres gambar, upload Storage + progres, rekam suara, GPS
import { storage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from './firebase.js';

export function compressImage(file, max = 1280, q = .75) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('Gagal mengompres gambar')), 'image/jpeg', q);
    };
    img.onerror = () => rej(new Error('Gambar tidak valid'));
    img.src = url;
  });
}
export function upload(path, blob, onProgress, contentType) {
  return new Promise((res, rej) => {
    const r = ref(storage, path), t = uploadBytesResumable(r, blob, { contentType: contentType || blob.type });
    t.on('state_changed', s => onProgress?.(s.bytesTransferred / s.totalBytes), rej, async () => res({ url: await getDownloadURL(r), path }));
  });
}
export const removeFile = p => p ? deleteObject(ref(storage, p)).catch(() => {}) : Promise.resolve();
export function getLocation() {
  return new Promise((res, rej) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => rej(new Error('Izin lokasi ditolak')), { enableHighAccuracy: true, timeout: 10000 })
    : rej(new Error('GPS tidak didukung')));
}
export async function startRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [], t0 = Date.now();
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();
  const stopTracks = () => stream.getTracks().forEach(t => t.stop());
  return {
    stop: () => new Promise(res => { rec.onstop = () => { stopTracks(); res({ blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), duration: Math.round((Date.now() - t0) / 1000) }); }; rec.stop(); }),
    cancel() { rec.onstop = stopTracks; try { rec.stop(); } catch { stopTracks(); } }
  };
}

// Sidik gambar 64-bit (dHash) untuk mendeteksi gambar yang dikirim ulang; dipecah jadi 4 "band" agar bisa dicari
export async function dHash(file) {
  const bmp = await createImageBitmap(file), c = document.createElement('canvas'); c.width = 9; c.height = 8;
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, 9, 8); bmp.close?.();
  const d = x.getImageData(0, 0, 9, 8).data, g = i => d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114;
  let bits = ''; for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) bits += g(r * 9 + q) > g(r * 9 + q + 1) ? '1' : '0';
  return bits.match(/.{4}/g).map(b => parseInt(b, 2).toString(16)).join('');
}
export const bandsOf = hex => [0, 1, 2, 3].map(i => i + ':' + hex.slice(i * 4, i * 4 + 4));
