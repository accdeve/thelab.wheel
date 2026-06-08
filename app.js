// --- STATE APLIKASI ---
let names = [];
let isSpinning = false;
let angle = 0; // Sudut rotasi roda saat ini (dalam radian)
let angularVelocity = 0; // Kecepatan putaran roda (radian per frame)
let isSoundEnabled = true;
let autoDelete = true;
let lastSelectedSectorIndex = -1;
let spinMusicStep = 0;
let nextNoteTime = 0;


// --- CONFIG RODA ---
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const addForm = document.getElementById("addNameForm");
const nameInput = document.getElementById("nameInput");
const namesList = document.getElementById("namesList");
const emptyState = document.getElementById("emptyState");

const autoDeleteToggle = document.getElementById("autoDeleteToggle");
const soundToggle = document.getElementById("soundToggle");

// --- CONFIG MODAL & CONFETTI ---
const winnerModal = document.getElementById("winnerModal");
const modalBox = document.getElementById("modalBox");
const winnerNameEl = document.getElementById("winnerName");
const autoDeleteMsgEl = document.getElementById("autoDeleteMsg");
const closeModalBtn = document.getElementById("closeModalBtn");
const manualDeleteBtn = document.getElementById("manualDeleteBtn");
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas.getContext("2d");

// Palet warna pastel ceria untuk anak-anak
const pastelColors = [
  "#FFADAD", // Pink
  "#FFD6A5", // Orange
  "#FDFFB6", // Yellow
  "#CAFFBF", // Green
  "#9BF6FF", // Blue
  "#A0C4FF", // Indigo
  "#BDB2FF", // Purple
  "#FFC6FF"  // Magenta
];

// --- AUDIO ENGINE (WEB AUDIO API - NATIVE SYNTH) ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Bunyi detik (tick) saat roda berputar melewati batas segmen
function playTickSound() {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = "triangle";
    
    // Clean snappy percussion click
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.015);

    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.015);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.02);
  } catch (e) {
    console.error("Audio tick error:", e);
  }
}

// Bunyi kemenangan arpeggio ceria seperti sihir peri + kord penutup bervibrato
function playWinSound() {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;
    
    // 1. Happy fanfare melody notes
    const melodyNotes = [
      { freq: 523.25, time: 0.0, dur: 0.15, type: "sine" },     // C5
      { freq: 659.25, time: 0.06, dur: 0.15, type: "sine" },    // E5
      { freq: 783.99, time: 0.12, dur: 0.15, type: "sine" },    // G5
      { freq: 1046.50, time: 0.18, dur: 0.15, type: "sine" },   // C6
      
      { freq: 1318.51, time: 0.30, dur: 0.10, type: "triangle" }, // E6
      { freq: 1174.66, time: 0.40, dur: 0.10, type: "triangle" }, // D6
      { freq: 1046.50, time: 0.50, dur: 0.10, type: "triangle" }, // C6
      { freq: 1174.66, time: 0.60, dur: 0.10, type: "triangle" }, // D6
      { freq: 1318.51, time: 0.70, dur: 0.15, type: "triangle" }, // E6
      { freq: 1567.98, time: 0.85, dur: 0.15, type: "triangle" }, // G6
      { freq: 1318.51, time: 1.00, dur: 0.12, type: "triangle" }, // E6
      { freq: 1046.50, time: 1.12, dur: 1.30, type: "triangle", vibrato: true }  // C6
    ];

    // 2. Bouncy bass notes
    const bassNotes = [
      { freq: 130.81, time: 0.30, dur: 0.25 }, // C3
      { freq: 174.61, time: 0.60, dur: 0.12 }, // F3
      { freq: 196.00, time: 0.75, dur: 0.12 }, // G3
      { freq: 196.00, time: 0.88, dur: 0.12 }, // G3
      { freq: 130.81, time: 1.00, dur: 0.12 }, // C3
      { freq: 130.81, time: 1.12, dur: 1.30, vibrato: true } // C3 (Final chord bass)
    ];

    // LFO for vibrato on the final note/chord
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 8.5; // 8.5 Hz vibrato
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 12; // 12Hz pitch vibrato
    lfo.connect(lfoGain);
    
    let lfoStarted = false;

    // Play melody notes
    melodyNotes.forEach((n) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, now + n.time);
      
      if (n.vibrato) {
        if (!lfoStarted) {
          lfo.start(now + n.time);
          lfoStarted = true;
        }
        lfoGain.connect(osc.frequency);
      }

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, now + n.time);
      gainNode.gain.linearRampToValueAtTime(0.18, now + n.time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur + 0.05);
    });

    // Play bass notes
    bassNotes.forEach((n) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.freq, now + n.time);

      if (n.vibrato) {
        lfoGain.connect(osc.frequency);
      }

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, now + n.time);
      gainNode.gain.linearRampToValueAtTime(0.18, now + n.time + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur + 0.05);
    });

    // Play harmony chord at 1.12s
    const chordFreqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    chordFreqs.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + 1.12);
      lfoGain.connect(osc.frequency);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, now + 1.12);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 1.12 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.12 + 1.30);

      osc.start(now + 1.12);
      osc.stop(now + 1.12 + 1.35);
    });

    // Extra sparkles for final chord!
    const sparkleTimes = [1.2, 1.3, 1.4, 1.5, 1.6];
    const sparkleFreqs = [1046.50, 1318.51, 1567.98, 2093.00, 2637.02]; // C6, E6, G6, C7, E7
    sparkleTimes.forEach((time, index) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(sparkleFreqs[index % sparkleFreqs.length], now + time);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, now + time);
      gainNode.gain.linearRampToValueAtTime(0.12, now + time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + 0.15);

      osc.start(now + time);
      osc.stop(now + time + 0.2);
    });

    // Stop LFO eventually
    lfo.stop(now + 3.0);

  } catch (e) {
    console.error("Audio error:", e);
  }
}

// Bunyi lonceng kristal ganda (bloop-chime) saat menambah/menghapus nama
function playPopSound() {
  if (!isSoundEnabled) return;
  try {
    initAudio();
    const now = audioCtx.currentTime;

    // Bouncy bubble sweep
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.06);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc1.start(now);
    osc1.stop(now + 0.07);

    // High sweet chime on top
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1567.98, now + 0.04); // G6

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    gain2.gain.setValueAtTime(0, now + 0.04);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.04 + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.04 + 0.12);

    osc2.start(now + 0.04);
    osc2.stop(now + 0.04 + 0.15);

  } catch (e) {
    console.error("Audio error:", e);
  }
}

// Bunyi musik pengiring berputar yang ceria (BGM tempo dinamis)
function playSpinMusicNote(step) {
  if (!isSoundEnabled) return;
  try {
    const now = audioCtx.currentTime;
    
    // Melodi ceria tangga nada mayor
    const spinMelody = [
      523.25, 659.25, 783.99, 1046.50, // C5, E5, G5, C6
      698.46, 880.00, 1046.50, 1396.91, // F5, A5, C6, F6
      783.99, 987.77, 1174.66, 1567.98, // G5, B5, D6, G6
      1318.51, 1046.50, 783.99, 659.25, // E6, C6, G5, E5
      
      1046.50, 1318.51, 1567.98, 2093.00, // C6, E6, G6, C7
      880.00, 1046.50, 1396.91, 1760.00,  // A5, C6, F6, A6
      987.77, 1174.66, 1567.98, 1975.53,  // B5, D6, G6, B6
      2093.00, 1567.98, 1318.51, 1046.50  // C7, G6, E6, C6
    ];
    
    const spinBass = [
      130.81, 130.81, 130.81, 130.81, // C3
      174.61, 174.61, 174.61, 174.61, // F3
      196.00, 196.00, 196.00, 196.00, // G3
      130.81, 130.81, 130.81, 130.81, // C3
      
      130.81, 130.81, 130.81, 130.81, // C3
      174.61, 174.61, 174.61, 174.61, // F3
      196.00, 196.00, 196.00, 196.00, // G3
      130.81, 130.81, 130.81, 130.81  // C3
    ];
    
    const melodyFreq = spinMelody[step % spinMelody.length];
    const bassFreq = spinBass[step % spinBass.length];
    
    // 1. Melody Oscillator (Triangle untuk nuansa retro chiptune imut)
    const oscMelody = audioCtx.createOscillator();
    const gainMelody = audioCtx.createGain();
    oscMelody.type = "triangle";
    oscMelody.frequency.setValueAtTime(melodyFreq, now);
    
    oscMelody.connect(gainMelody);
    gainMelody.connect(audioCtx.destination);
    
    gainMelody.gain.setValueAtTime(0, now);
    gainMelody.gain.linearRampToValueAtTime(0.06, now + 0.01);
    gainMelody.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    oscMelody.start(now);
    oscMelody.stop(now + 0.15);
    
    // 2. Bass Oscillator (Triangle untuk bass empuk yang bouncy)
    const oscBass = audioCtx.createOscillator();
    const gainBass = audioCtx.createGain();
    oscBass.type = "triangle";
    oscBass.frequency.setValueAtTime(bassFreq, now);
    
    oscBass.connect(gainBass);
    gainBass.connect(audioCtx.destination);
    
    gainBass.gain.setValueAtTime(0, now);
    gainBass.gain.linearRampToValueAtTime(0.08, now + 0.015);
    gainBass.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    oscBass.start(now);
    oscBass.stop(now + 0.18);
    
  } catch (e) {
    console.error("Spin music play error:", e);
  }
}


// --- RODA CANVAS ENGINE ---
function drawWheel() {
  const size = canvas.width;
  const radius = size / 2;
  ctx.clearRect(0, 0, size, size);

  if (names.length === 0) {
    // Gambar roda kosong yang imut
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 15, 0, Math.PI * 2);
    ctx.fillStyle = "#F1F5F9";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();
    
    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Tambahkan Nama!", radius, radius);
    return;
  }

  const sectorAngle = (Math.PI * 2) / names.length;

  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(angle);

  // 1. Gambar Segmen
  for (let i = 0; i < names.length; i++) {
    const startAngle = i * sectorAngle;
    const endAngle = startAngle + sectorAngle;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 15, startAngle, endAngle);
    ctx.fillStyle = pastelColors[i % pastelColors.length];
    ctx.fill();

    // Garis pembatas putih antar segmen
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();

    // 2. Gambar Teks Nama
    ctx.save();
    ctx.rotate(startAngle + sectorAngle / 2);
    ctx.fillStyle = "#334155"; // Slate-700 kontras tinggi
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'SF Pro', 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Potong teks jika kepanjangan
    let text = names[i];
    const maxTextWidth = radius * 0.68;
    if (ctx.measureText(text).width > maxTextWidth) {
      while (ctx.measureText(text + "...").width > maxTextWidth && text.length > 0) {
        text = text.slice(0, -1);
      }
      text += "...";
    }

    // Gambar teks sedikit tergeser dari ujung tepi roda
    ctx.fillText(text, radius - 45, 0);
    ctx.restore();
  }

  // 3. Bulatan Lampu Hiasan di Tepi Roda
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#FFFFFF";
  for (let i = 0; i < names.length * 2; i++) {
    const dotAngle = i * (sectorAngle / 2);
    const dotRadius = radius - 15;
    const x = Math.cos(dotAngle) * dotRadius;
    const y = Math.sin(dotAngle) * dotRadius;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    // Lampu berselang-seling kuning dan putih
    ctx.fillStyle = i % 2 === 0 ? "#FDE047" : "#FFFFFF";
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  // 4. Lingkaran Tengah Roda (Static Center Hub) - Desain Lencana Bulat Flat Bersih
  // Gambar bayangan hub tengah (flat & subtle)
  ctx.beginPath();
  ctx.arc(radius, radius, 54, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(30, 41, 59, 0.08)";
  ctx.fill();

  // Hub tengah bulat flat putih bersih
  ctx.beginPath();
  ctx.arc(radius, radius, 48, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#1E293B"; // Border tebal gelap
  ctx.stroke();

  // Garis lingkar kecil pemanis di dalam hub
  ctx.beginPath();
  ctx.arc(radius, radius, 40, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();
}

// --- PHYSICS SPIN ENGINE ---
let animationFrameId = null;

function spinUpdate() {
  if (!isSpinning) return;

  angle += angularVelocity;
  angularVelocity *= 0.983; // Gesekan (friction) - melambat perlahan

  // Mainkan detik suara saat roda berganti segmen
  if (names.length > 0) {
    const sectorAngle = (Math.PI * 2) / names.length;
    // Pointer menunjuk di atas (270 derajat / -Math.PI/2)
    // Hitung posisi sudut pointer terhadap putaran roda
    const pointerOffset = Math.PI * 1.5;
    const currentAbsoluteAngle = (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2);
    const activeSectorIndex = Math.floor(((currentAbsoluteAngle + pointerOffset) % (Math.PI * 2)) / sectorAngle) % names.length;

    if (activeSectorIndex !== lastSelectedSectorIndex) {
      playTickSound();
      lastSelectedSectorIndex = activeSectorIndex;
    }
  }

  drawWheel();

  // Jika putaran sudah sangat lambat, hentikan roda dan nyatakan pemenang
  if (angularVelocity < 0.001) {
    isSpinning = false;
    angularVelocity = 0;
    cancelAnimationFrame(animationFrameId);
    declareWinner();
  } else {
    animationFrameId = requestAnimationFrame(spinUpdate);
  }
}

function startSpin(initialVelocity) {
  if (isSpinning || names.length === 0) return;
  
  initAudio();
  isSpinning = true;
  
  // Jika initialVelocity tidak diberikan (misal klik tombol), buat random ceria
  angularVelocity = initialVelocity || (0.35 + Math.random() * 0.25);
  
  // Efek getar sedikit pada tombol putar saat roda mulai
  spinBtn.classList.remove("animate-pulse-slow");
  spinBtn.disabled = true;

  spinUpdate();
}

// Mengambil indeks pemenang berdasarkan posisi jarum (di bagian atas roda / 270 derajat)
function getWinnerIndex() {
  if (names.length === 0) return -1;
  const sectorAngle = (Math.PI * 2) / names.length;
  const pointerOffset = Math.PI * 1.5; // Pointer di atas (270 derajat)
  const currentAbsoluteAngle = (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2);
  return Math.floor(((currentAbsoluteAngle + pointerOffset) % (Math.PI * 2)) / sectorAngle) % names.length;
}

// --- INTERAKSI SWIPE/DRAG RODA DI TABLET & DESKTOP ---
let isDragging = false;
let dragStartAngle = 0;
let wheelStartAngle = 0;
let lastDragAngle = 0;
let dragHistory = [];

function getAngleFromCenter(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(clientY - cy, clientX - cx);
}

function handleDragStart(clientX, clientY) {
  if (isSpinning || names.length === 0) return;
  initAudio();
  isDragging = true;
  dragStartAngle = getAngleFromCenter(clientX, clientY);
  wheelStartAngle = angle;
  lastDragAngle = wheelStartAngle;
  dragHistory = [{ angle: wheelStartAngle, time: Date.now() }];
}

function handleDragMove(clientX, clientY) {
  if (!isDragging) return;
  const currentTouchAngle = getAngleFromCenter(clientX, clientY);
  const angleDiff = currentTouchAngle - dragStartAngle;
  
  angle = wheelStartAngle + angleDiff;
  
  // Simpan riwayat tarikan untuk kalkulasi kecepatan lepas
  const now = Date.now();
  dragHistory.push({ angle: angle, time: now });
  if (dragHistory.length > 6) dragHistory.shift();

  // Efek gesek: bunyi detak kecil jika berputar cukup jauh saat ditarik
  const sectorAngle = (Math.PI * 2) / names.length;
  const pointerOffset = Math.PI * 1.5;
  const currentAbsoluteAngle = (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2);
  const activeSectorIndex = Math.floor(((currentAbsoluteAngle + pointerOffset) % (Math.PI * 2)) / sectorAngle) % names.length;

  if (activeSectorIndex !== lastSelectedSectorIndex) {
    playTickSound();
    lastSelectedSectorIndex = activeSectorIndex;
  }

  drawWheel();
}

function handleDragEnd() {
  if (!isDragging) return;
  isDragging = false;

  // Hitung kecepatan lemparan roda berdasarkan riwayat tarikan terakhir
  if (dragHistory.length >= 2) {
    const first = dragHistory[0];
    const last = dragHistory[dragHistory.length - 1];
    const timeDelta = last.time - first.time;
    let angleDelta = last.angle - first.angle;

    // Koreksi pembungkusan radian (wrapping)
    if (Math.abs(angleDelta) > Math.PI) {
      angleDelta = angleDelta > 0 ? angleDelta - Math.PI * 2 : angleDelta + Math.PI * 2;
    }

    if (timeDelta > 0) {
      // Kecepatan sudut per milidetik dikonversi ke per frame (sekitar 16ms)
      const velocity = (angleDelta / timeDelta) * 16.66;
      const speed = Math.abs(velocity);

      // Jika lemparan cukup cepat, putar roda dengan kecepatan tersebut
      if (speed > 0.05) {
        // Batasi kecepatan maksimal agar tidak berputar ekstrem
        const clampedVelocity = Math.max(-0.75, Math.min(0.75, velocity));
        startSpin(Math.abs(clampedVelocity));
        return;
      }
    }
  }

  // Jika hanya diklik biasa (tap), putar roda dengan kekuatan acak standar
  startSpin();
}

// Bind Mouse & Touch events ke Canvas
canvas.addEventListener("mousedown", (e) => handleDragStart(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => handleDragMove(e.clientX, e.clientY));
window.addEventListener("mouseup", () => handleDragEnd());

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  if (isDragging && e.touches.length === 1) {
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

window.addEventListener("touchend", () => handleDragEnd());

// --- CONFETTI PARTICLE ENGINE ---
let confettiParticles = [];
let confettiActive = false;
let confettiAnimId = null;

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * confettiCanvas.width;
    this.y = Math.random() * confettiCanvas.height - confettiCanvas.height;
    this.size = Math.random() * 8 + 6;
    this.color = pastelColors[Math.floor(Math.random() * pastelColors.length)];
    this.speedY = Math.random() * 3 + 2;
    this.speedX = Math.random() * 2 - 1;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 4 - 2;
    this.wobble = Math.random() * 0.05;
    this.wobbleSpeed = Math.random() * 0.03 + 0.01;
    this.wobbleAngle = Math.random() * Math.PI;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX + Math.sin(this.wobbleAngle) * 0.5;
    this.wobbleAngle += this.wobbleSpeed;
    this.rotation += this.rotationSpeed;

    // Recycle konfeti yang jatuh keluar layar
    if (this.y > confettiCanvas.height) {
      this.y = -20;
      this.x = Math.random() * confettiCanvas.width;
      this.speedY = Math.random() * 3 + 2;
    }
  }

  draw() {
    confettiCtx.save();
    confettiCtx.translate(this.x, this.y);
    confettiCtx.rotate((this.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = this.color;
    
    // Gambar konfeti berbentuk persegi panjang melayang
    confettiCtx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    confettiCtx.restore();
  }
}

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function animateConfetti() {
  if (!confettiActive) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  
  confettiParticles.forEach((p) => {
    p.update();
    p.draw();
  });

  confettiAnimId = requestAnimationFrame(animateConfetti);
}

function startConfetti() {
  resizeConfettiCanvas();
  confettiParticles = [];
  for (let i = 0; i < 120; i++) {
    confettiParticles.push(new ConfettiParticle());
  }
  confettiActive = true;
  animateConfetti();
}

function stopConfetti() {
  confettiActive = false;
  cancelAnimationFrame(confettiAnimId);
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

window.addEventListener("resize", () => {
  if (confettiActive) resizeConfettiCanvas();
});

// --- UI CONTROLLER & EVENT LISTENERS ---

// Merender list nama di sidebar kanan
function renderNamesList() {
  namesList.innerHTML = "";
  
  if (names.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  names.forEach((name, index) => {
    const li = document.createElement("li");
    // Gunakan warna pastel bersesuaian dengan segmen roda
    const color = pastelColors[index % pastelColors.length];
    
    li.className = "name-pill flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-800 font-semibold select-none";
    li.style.borderLeft = `6px solid ${color}`;
    
    li.innerHTML = `
      <span class="truncate max-w-[190px]">${name}</span>
      <button onclick="removeName(${index})" class="text-slate-400 hover:text-pink-500 font-bold p-1 rounded-lg hover:bg-pink-50 transition-colors" title="Hapus nama">
        ✕
      </button>
    `;
    namesList.appendChild(li);
  });
}

// Menambahkan nama baru
addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  
  if (name.length > 0 && names.length < 50) {
    names.push(name);
    nameInput.value = "";
    playPopSound();
    renderNamesList();
    drawWheel();
  }
});

// Menghapus nama secara manual dari list
window.removeName = function(index) {
  if (isSpinning) return;
  names.splice(index, 1);
  playPopSound();
  renderNamesList();
  drawWheel();
};

// Mengacak urutan nama
shuffleBtn.addEventListener("click", () => {
  if (isSpinning || names.length <= 1) return;
  playPopSound();
  
  // Algoritma Fisher-Yates Shuffle
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  
  renderNamesList();
  drawWheel();
});

// Reset ke daftar bawaan (Kosongkan Roda)
resetBtn.addEventListener("click", () => {
  if (isSpinning) return;
  playPopSound();
  names = [];
  renderNamesList();
  drawWheel();
});

// Spin Button Event
spinBtn.addEventListener("click", () => startSpin());

// Toggle Hapus Otomatis
autoDeleteToggle.addEventListener("change", (e) => {
  autoDelete = e.target.checked;
  playPopSound();
});

// Toggle Suara
soundToggle.addEventListener("change", (e) => {
  isSoundEnabled = e.target.checked;
  playPopSound();
});

// --- WINNER MODAL FLOW ---
let currentWinnerIndex = -1;

function declareWinner() {
  const winnerIdx = getWinnerIndex();
  if (winnerIdx === -1) return;

  currentWinnerIndex = winnerIdx;
  const winnerName = names[winnerIdx];

  // Update Teks Modal
  winnerNameEl.textContent = winnerName;
  
  // Tampilkan confetti & suara kemenangan
  startConfetti();
  playWinSound();

  // Kondisi Hapus Otomatis
  if (autoDelete) {
    autoDeleteMsgEl.textContent = "Nama ini otomatis dihapus dari roda";
    manualDeleteBtn.classList.add("hidden");
  } else {
    autoDeleteMsgEl.textContent = "Nama tetap ada di roda. Klik hapus jika mau.";
    manualDeleteBtn.classList.remove("hidden");
  }

  // Animasi modal masuk
  winnerModal.classList.add("show");
}

function closeModal() {
  winnerModal.classList.remove("show");
  stopConfetti();
  
  // Jika autoDelete diaktifkan, hapus pemenang sekarang setelah modal ditutup
  if (autoDelete && currentWinnerIndex !== -1) {
    names.splice(currentWinnerIndex, 1);
    currentWinnerIndex = -1;
    renderNamesList();
    drawWheel();
  }

  // Aktifkan kembali tombol spin
  spinBtn.disabled = false;
  spinBtn.classList.add("animate-pulse-slow");
}

// Tutup modal
closeModalBtn.addEventListener("click", () => {
  playPopSound();
  closeModal();
});

// Hapus manual lewat modal pemenang
manualDeleteBtn.addEventListener("click", () => {
  if (currentWinnerIndex !== -1) {
    playPopSound();
    names.splice(currentWinnerIndex, 1);
    currentWinnerIndex = -1;
    renderNamesList();
    drawWheel();
  }
  closeModal();
});

// Inisialisasi awal aplikasi
renderNamesList();
drawWheel();
