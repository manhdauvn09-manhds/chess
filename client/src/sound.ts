// Âm thanh tổng hợp bằng Web Audio API — không cần file nhạc, chạy offline.
// Chọn loại âm dựa trên ký hiệu SAN của nước đi (đồng nhất cho mọi chế độ).

let ctx: AudioContext | null = null;
let muted = localStorage.getItem('chess_muted') === '1';

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}
export function setMuted(v: boolean) {
  muted = v;
  localStorage.setItem('chess_muted', v ? '1' : '0');
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

function tone({ freq, dur, type = 'sine', gain = 0.18, slideTo, delay = 0 }: ToneOpts) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Tiếng "cạch" (gõ) ngắn bằng nhiễu lọc — dùng cho di chuyển/ăn quân.
function thock(gain = 0.25, freq = 800, delay = 0) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
}

const sounds = {
  move() {
    thock(0.22, 760);
    tone({ freq: 200, dur: 0.06, type: 'sine', gain: 0.12 });
  },
  capture() {
    thock(0.3, 480);
    tone({ freq: 150, dur: 0.09, type: 'triangle', gain: 0.16 });
  },
  castle() {
    thock(0.22, 700);
    thock(0.2, 620, 0.09);
  },
  promote() {
    tone({ freq: 440, dur: 0.18, type: 'triangle', slideTo: 880, gain: 0.16 });
  },
  check() {
    tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.13 });
    tone({ freq: 990, dur: 0.12, type: 'square', gain: 0.12, delay: 0.1 });
  },
  gameStart() {
    tone({ freq: 392, dur: 0.12, type: 'triangle', gain: 0.14 });
    tone({ freq: 587, dur: 0.16, type: 'triangle', gain: 0.14, delay: 0.12 });
  },
  gameEnd() {
    tone({ freq: 523, dur: 0.18, type: 'sine', gain: 0.15 });
    tone({ freq: 392, dur: 0.22, type: 'sine', gain: 0.15, delay: 0.16 });
    tone({ freq: 262, dur: 0.3, type: 'sine', gain: 0.15, delay: 0.34 });
  },
};

export function playForSan(san: string) {
  if (muted || !san) return;
  try {
    if (san.includes('#')) {
      sounds.check();
      setTimeout(() => sounds.gameEnd(), 180);
    } else if (san.includes('+')) sounds.check();
    else if (san.startsWith('O-O')) sounds.castle();
    else if (san.includes('=')) sounds.promote();
    else if (san.includes('x')) sounds.capture();
    else sounds.move();
  } catch {
    /* bỏ qua nếu trình duyệt chặn audio */
  }
}

export function playGameStart() {
  if (muted) return;
  try {
    sounds.gameStart();
  } catch {}
}
export function playGameEnd() {
  if (muted) return;
  try {
    sounds.gameEnd();
  } catch {}
}
