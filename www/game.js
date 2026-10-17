'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const bestScoreEl = document.getElementById('bestScore');
const levelUpEl = document.getElementById('levelUp');

let W, H, DPR;
let stars = [];

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  createStars();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

function createStars() {
  stars = [];
  const count = Math.min(100, Math.floor((W * H) / 10000));
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.8,
      r: Math.random() * 1.5 + 0.3,
      tw: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random()
    });
  }
}

// ===== صدا =====
let audioCtx = null;
function initAudio() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function soundLaunch() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(500, t);
  o.frequency.exponentialRampToValueAtTime(1500, t + 0.08);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.1);
}
function soundExplosion() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dur = 0.2;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = audioCtx.createBufferSource();
  s.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(audioCtx.destination);
  s.start(t);
}
function soundGameOver() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.5);
  g.gain.setValueAtTime(0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.5);
}

// ===== کلاس‌ها =====
class Missile {
  constructor(tx, ty) {
    this.x = cannonX;
    this.y = cannonY;
    const dx = tx - cannonX, dy = ty - cannonY;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx = (dx / dist) * 900;
    this.vy = (dy / dist) * 900;
    this.tx = tx; this.ty = ty;
    this.life = 0;
    this.dead = false;
    this.trail = [];
  }
  update(dt) {
    this.life += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.trail.push({ x: this.x, y: this.y, a: 1 });
    if (this.trail.length > 8) this.trail.shift();
    for (const t of this.trail) t.a -= dt * 5;
    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    if (d < 15 || this.y < -30 || this.x < -30 || this.x > W + 30 || this.life > 3) {
      this.dead = true;
      createExplosion(this.x, this.y, 80);
      soundExplosion();
    }
  }
  draw() {
    for (const t of this.trail) {
      ctx.globalAlpha = Math.max(0, t.a) * 0.4;
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 15;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Coconut {
  constructor() {
    this.x = 40 + Math.random() * (W - 80);
    this.y = -40;
    const r = Math.random();
    if (r < 0.1 && level >= 2) {
      this.type = 'bomb'; this.radius = 22;
      this.vy = 70 + Math.random() * 40 + level * 8;
      this.c1 = '#e63946'; this.c2 = '#7a0a15'; this.points = 20;
    } else if (r < 0.3) {
      this.type = 'golden'; this.radius = 13;
      this.vy = 140 + Math.random() * 60 + level * 10;
      this.c1 = '#ffe066'; this.c2 = '#a87700'; this.points = 25;
    } else {
      this.type = 'normal'; this.radius = 17 + Math.random() * 5;
      this.vy = 80 + Math.random() * 50 + level * 8;
      this.c1 = '#8B5E3C'; this.c2 = '#3a2210'; this.points = 10;
    }
    this.vx = (Math.random() - 0.5) * 40;
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 3;
    this.dead = false;
    this.wob = Math.random() * Math.PI * 2;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.x += this.vx * dt + Math.sin(this.wob) * 15 * dt;
    this.wob += dt * 3;
    this.rot += this.rotSpeed * dt;
    if (this.y > H + 40) { this.dead = true; hitGround(this); }
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    if (this.type === 'golden') { ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 25; }
    else if (this.type === 'bomb') { ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20; }
    const g = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.2, 0, 0, this.radius);
    g.addColorStop(0, this.c1); g.addColorStop(1, this.c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (this.type !== 'bomb') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * this.radius * 0.35, Math.sin(a) * this.radius * 0.35, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-this.radius * 0.15, -this.radius * 0.1, this.radius * 0.08, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.15, -this.radius * 0.1, this.radius * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

class Explosion {
  constructor(x, y, maxR) {
    this.x = x; this.y = y;
    this.r = 0; this.maxR = maxR;
    this.expanding = true; this.dead = false;
    this.hits = new Set();
  }
  update(dt) {
    if (this.expanding) {
      this.r += 200 * dt;
      if (this.r >= this.maxR) this.expanding = false;
    } else {
      this.r -= 130 * dt;
      if (this.r <= 0) this.dead = true;
    }
    for (const c of coconuts) {
      if (c.dead || this.hits.has(c)) continue;
      if (Math.hypot(this.x - c.x, this.y - c.y) < this.r + c.radius) {
        this.hits.add(c);
        destroyCoconut(c);
      }
    }
  }
  draw() {
    const a = Math.max(0, Math.min(1, this.r / this.maxR));
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    g.addColorStop(0, `rgba(255,255,220,${a})`);
    g.addColorStop(0.4, `rgba(255,200,60,${a * 0.85})`);
    g.addColorStop(0.8, `rgba(255,100,30,${a * 0.5})`);
    g.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
  }
}

class Particle {
  constructor(x, y, color, speed = 280) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.life = 0.6 + Math.random() * 0.5;
    this.maxLife = this.life;
    this.color = color;
    this.size = 2 + Math.random() * 4;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 400 * dt;
    this.vx *= 0.98;
    this.life -= dt;
  }
  draw() {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ===== منطق بازی =====
const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
let state = STATE.MENU;
let missiles = [], coconuts = [], explosions = [], particles = [];
let score = 0, lives = 3, level = 1;
let spawnTimer = 0, spawnInterval = 1400;
let shake = 0;
let cannonX = 0, cannonY = 0, cannonAngle = -Math.PI / 2;
let best = parseInt(localStorage.getItem('coconut_best') || '0', 10);

function createExplosion(x, y, r) {
  explosions.push(new Explosion(x, y, r));
  shake = Math.min(shake + 6, 18);
  for (let i = 0; i < 18; i++) particles.push(new Particle(x, y, i % 2 ? '#ffbb33' : '#ff6633'));
}

function destroyCoconut(c) {
  if (c.dead) return;
  c.dead = true;
  score += c.points;
  scoreEl.textContent = score;
  const colors = c.type === 'golden' ? ['#ffe066', '#ffaa00'] : c.type === 'bomb' ? ['#ff3333', '#aa0000'] : ['#8B5E3C', '#ffbb33'];
  for (let i = 0; i < 14; i++) particles.push(new Particle(c.x, c.y, colors[i % 2], 240));
  explosions.push(new Explosion(c.x, c.y, 30));
  shake = Math.min(shake + 3, 18);
  checkLevel();
}

function hitGround(c) {
  const loss = c.type === 'bomb' ? 2 : 1;
  lives -= loss;
  livesEl.textContent = Math.max(0, lives);
  shake = Math.min(shake + 10, 22);
  for (let i = 0; i < 18; i++) particles.push(new Particle(c.x, H - 20, '#ff3333', 300));
  if (lives <= 0) endGame();
}

function checkLevel() {
  const nl = Math.floor(score / 100) + 1;
  if (nl > level) {
    level = nl;
    spawnInterval = Math.max(450, 1400 - (level - 1) * 80);
    levelUpEl.textContent = 'مرحله ' + level;
    levelUpEl.classList.add('show');
    setTimeout(() => levelUpEl.classList.remove('show'), 1400);
  }
}

function fireAt(tx, ty) {
  if (state !== STATE.PLAYING) return;
  initAudio();
  if (ty > cannonY - 20) ty = cannonY - 20;
  missiles.push(new Missile(tx, ty));
  soundLaunch();
  cannonAngle = Math.atan2(ty - cannonY, tx - cannonX);
}

// ===== ورودی =====
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  fireAt(e.clientX, e.clientY);
}, { passive: false });

document.addEventListener('gesturestart', e => e.preventDefault());
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

let lastTouch = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouch <= 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });

// ===== حلقه =====
let lastT = 0;

function loop(t) {
  if (!lastT) lastT = t;
  let dt = (t - lastT) / 1000;
  lastT = t;
  if (dt > 0.05) dt = 0.05;

  cannonX = W / 2;
  cannonY = H - 40;

  if (state === STATE.PLAYING) {
    spawnTimer += dt * 1000;
    if (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      coconuts.push(new Coconut());
      if (level >= 4 && Math.random() < 0.3) coconuts.push(new Coconut());
    }
  }

  for (const m of missiles) m.update(dt);
  for (const c of coconuts) c.update(dt);
  for (const e of explosions) e.update(dt);
  for (const p of particles) p.update(dt);

  missiles = missiles.filter(m => !m.dead);
  coconuts = coconuts.filter(c => !c.dead);
  explosions = explosions.filter(e => !e.dead);
  particles = particles.filter(p => p.life > 0);

  shake *= 0.88;
  if (shake < 0.5) shake = 0;

  // رسم
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0520'); bg.addColorStop(0.5, '#140a30'); bg.addColorStop(1, '#1a0a20');
  ctx.fillStyle = bg;
  ctx.fillRect(-50, -50, W + 100, H + 100);

  for (const s of stars) {
    s.tw += dt * s.speed;
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(s.tw)) * 0.7;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ماه
  const mx = W * 0.8, my = 100;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 80);
  mg.addColorStop(0, 'rgba(255,255,220,0.4)'); mg.addColorStop(1, 'rgba(255,255,220,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 80, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5f0d0'; ctx.beginPath(); ctx.arc(mx, my, 35, 0, Math.PI * 2); ctx.fill();

  // زمین
  const gg = ctx.createLinearGradient(0, H - 60, 0, H);
  gg.addColorStop(0, '#1a3a20'); gg.addColorStop(1, '#0a1a10');
  ctx.fillStyle = gg; ctx.fillRect(0, H - 60, W, 60);
  ctx.strokeStyle = 'rgba(100,255,150,0.5)'; ctx.lineWidth = 2;
  ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.moveTo(0, H - 60); ctx.lineTo(W, H - 60); ctx.stroke();
  ctx.shadowBlur = 0;

  for (const c of coconuts) c.draw();
  for (const m of missiles) m.draw();
  for (const e of explosions) e.draw();
  for (const p of particles) p.draw();

  if (state !== STATE.MENU) {
    ctx.save();
    ctx.translate(cannonX, cannonY);
    ctx.rotate(cannonAngle + Math.PI / 2);
    ctx.fillStyle = '#3a5060'; ctx.fillRect(-15, -40, 30, 50);
    const bg2 = ctx.createLinearGradient(-10, 0, 10, 0);
    bg2.addColorStop(0, '#556677'); bg2.addColorStop(0.5, '#778899'); bg2.addColorStop(1, '#445566');
    ctx.fillStyle = bg2; ctx.fillRect(-8, -55, 16, 35);
    ctx.shadowColor = '#ffd93d'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffd93d'; ctx.beginPath(); ctx.arc(0, -55, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a3a45'; ctx.beginPath(); ctx.arc(0, 10, 20, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

// ===== شروع / پایان =====
function startGame() {
  initAudio();
  state = STATE.PLAYING;
  missiles = []; coconuts = []; explosions = []; particles = [];
  score = 0; lives = 3; level = 1;
  spawnTimer = 0; spawnInterval = 1400; shake = 0;
  scoreEl.textContent = '0'; livesEl.textContent = '3';
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
}

function endGame() {
  state = STATE.GAMEOVER;
  soundGameOver();
  if (score > best) { best = score; localStorage.setItem('coconut_best', best); }
  finalScoreEl.textContent = score;
  finalBestEl.textContent = best;
  bestScoreEl.textContent = best;
  setTimeout(() => gameOverEl.classList.remove('hidden'), 500);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
bestScoreEl.textContent = best;

document.addEventListener('visibilitychange', () => { if (document.hidden) lastT = 0; });

requestAnimationFrame(loop);
