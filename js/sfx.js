// Efek suara sintetis (Web Audio) — tanpa file audio
let ctx, master, muted = localStorage.getItem('sfxMuted') === '1';
function ac() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ctx = new A(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const tone = (t, type, f0, f1, d, g) => {
  const o = ctx.createOscillator(), a = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(a); a.connect(master); o.start(t); o.stop(t + d + .02);
};
let nb;
const noise = (t, d, f0, f1, g) => {
  if (!nb) { nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const x = nb.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), a = ctx.createGain();
  s.buffer = nb; b.type = 'bandpass'; b.Q.value = 1.2;
  b.frequency.setValueAtTime(f0, t); b.frequency.exponentialRampToValueAtTime(f1, t + d);
  a.gain.setValueAtTime(.001, t); a.gain.linearRampToValueAtTime(g, t + d * .4); a.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(b); b.connect(a); a.connect(master); s.start(t); s.stop(t + d + .02);
};
const SET = {
  tap: t => tone(t, 'square', 700, 400, .04, .06),
  nav: t => { noise(t, .25, 500, 3000, .2); tone(t, 'sine', 150, 60, .14, .3); },
  open: t => { noise(t, .16, 800, 2500, .14); tone(t, 'sine', 300, 600, .1, .2); },
  pop: t => tone(t, 'sine', 400, 900, .1, .3),
  send: t => { tone(t, 'sine', 500, 1000, .1, .25); tone(t + .08, 'sine', 800, 1400, .1, .2); },
  recv: t => { tone(t, 'triangle', 700, 500, .1, .3); tone(t + .1, 'triangle', 900, 700, .12, .25); },
  ok: t => { tone(t, 'sine', 660, 990, .12, .25); tone(t + .1, 'sine', 990, 1320, .16, .2); },
  error: t => tone(t, 'sawtooth', 220, 110, .25, .22),
  rec: t => tone(t, 'sine', 600, 900, .12, .3),
  stop: t => tone(t, 'sine', 900, 500, .12, .3),
  del: t => tone(t, 'sawtooth', 400, 80, .22, .2)
};
export function sfx(name) { if (muted) return; const c = ac(); if (c) SET[name]?.(c.currentTime + .01); }
export const isMuted = () => muted;
export function setMuted(v) { muted = v; localStorage.setItem('sfxMuted', v ? '1' : '0'); }
// Klik/tap pada tombol & kartu memicu bunyi "tik" kecil
document.addEventListener('pointerdown', e => { if (e.target.closest?.('button,.card,.chip,.ni')) sfx('tap'); }, { passive: true });
