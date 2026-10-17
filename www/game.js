import * as THREE from 'three';

// ==================== SETUP ====================
const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const statusEl = document.getElementById('status');
const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const bestScoreEl = document.getElementById('bestScore');
const fireBtn = document.getElementById('fireBtn');
const targetMarkerEl = document.getElementById('targetMarker');
const lockTextEl = document.getElementById('lockText');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050a10);
scene.fog = new THREE.FogExp2(0x050a10, 0.0025);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 5, 0);
camera.rotation.order = 'YXZ';

// ==================== LIGHTING ====================
const hemiLight = new THREE.HemisphereLight(0x334466, 0x111122, 1.0);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
sunLight.position.set(100, 200, 100);
scene.add(sunLight);
const ambientLight = new THREE.AmbientLight(0x112233, 0.6);
scene.add(ambientLight);

// ==================== TERRAIN ====================
const groundGeo = new THREE.PlaneGeometry(4000, 4000, 1, 1);
groundGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x0a1a10 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.position.y = 0;
scene.add(ground);

// ==================== CITY (PROCEDURAL) ====================
const cityGroup = new THREE.Group();
scene.add(cityGroup);

function createCity() {
  // پاکسازی شهر قبلی
  while (cityGroup.children.length > 0) {
    cityGroup.remove(cityGroup.children[0]);
  }

  const buildingCount = 60;
  const buildingMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

  for (let i = 0; i < buildingCount; i++) {
    const w = 8 + Math.random() * 15;
    const d = 8 + Math.random() * 15;
    const h = 20 + Math.random() * 120;

    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, buildingMat);

    // موقعیت تصادفی در یک ناحیه دایره‌ای
    const angle = Math.random() * Math.PI * 2;
    const radius = 300 + Math.random() * 600;
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;
    mesh.position.y = h / 2;

    // چرخش تصادفی
    mesh.rotation.y = Math.random() * Math.PI;

    // پنجره‌های درخشان (به صورت نقطه‌های ساده)
    const windowCount = Math.floor(h / 15);
    for (let j = 0; j < windowCount; j++) {
      if (Math.random() > 0.4) continue;
      const winGeo = new THREE.PlaneGeometry(1.5, 1.5);
      const win = new THREE.Mesh(winGeo, windowMat);
      win.position.set(
        (Math.random() - 0.5) * w * 0.8,
        -h / 2 + 5 + j * 12,
        d / 2 + 0.1
      );
      win.rotation.y = 0;
      mesh.add(win);
    }

    cityGroup.add(mesh);
  }
}

// ==================== LAUNCHER (VIEWMODEL) ====================
function createLauncher() {
  const g = new THREE.Group();
  const tubeMat = new THREE.MeshLambertMaterial({ color: 0x2a3a2a });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 10), tubeMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0, -0.7);

  const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.1), gripMat);
  grip.position.set(0, -0.2, -0.45);

  const sightMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.15), sightMat);
  sight.position.set(0, 0.18, -0.75);

  g.add(tube, grip, sight);
  g.position.set(0.35, -0.35, -0.8);
  g.rotation.y = -0.1;
  return g;
}
const launcher = createLauncher();
camera.add(launcher);
scene.add(camera);

// ==================== NARGIL MISSILE (3-DOF PHYSICS) ====================
const missiles = [];
const missileGroup = new THREE.Group();
scene.add(missileGroup);

function createMissileMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), bodyMat);
  body.rotation.x = Math.PI / 2;

  const noseMat = new THREE.MeshLambertMaterial({ color: 0xff2222 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -0.6;

  const finMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.2), finMat);
  fin1.position.z = 0.45;
  const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.2), finMat);
  fin2.position.z = 0.45;

  g.add(body, nose, fin1, fin2);
  return g;
}

// پارامترهای فیزیکی موشک
const MISSILE_MASS = 50;          // kg
const MISSILE_THRUST = 2500;      // N
const MISSILE_DRAG_COEFF = 0.02;  // ضریب کشش
const MISSILE_MAX_SPEED = 300;    // m/s
const MISSILE_LIFE = 8.0;         // ثانیه
const GRAVITY = 9.81;             // m/s^2
const PN_GAIN = 4.0;              // بهره هدایت تناسبی

let targetPoint = null;           // نقطه هدف (Vector3)
let targetMarkerMesh = null;

function fireMissile() {
  if (state !== 'playing' || !targetPoint) return;

  const startPos = new THREE.Vector3(0.35, -0.35, -1.2);
  startPos.applyQuaternion(camera.quaternion);
  startPos.add(camera.position);

  const mesh = createMissileMesh();
  mesh.position.copy(startPos);
  missileGroup.add(mesh);

  // جهت اولیه: به سمت هدف
  const initialDir = new THREE.Vector3().subVectors(targetPoint, startPos).normalize();

  missiles.push({
    mesh,
    position: startPos.clone(),
    velocity: initialDir.clone().multiplyScalar(30), // سرعت اولیه
    target: targetPoint.clone(),
    life: MISSILE_LIFE,
    dead: false,
    trail: [],
  });

  playLaunchSound();
  shakeAmount = Math.min(shakeAmount + 0.4, 0.8);
  statusEl.textContent = 'MISSILE AWAY';
}

// ==================== PARTICLES (EXPLOSION) ====================
const MAX_PARTICLES = 300;
const particleGeo = new THREE.SphereGeometry(0.15, 4, 4);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(particleInstanced);

const particles = [];
const dummy = new THREE.Object3D();

function spawnExplosion(position, colorHex = 0xffaa00) {
  for (let i = 0; i < 40; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    particles.push({
      pos: position.clone(),
      dir,
      speed: 20 + Math.random() * 50,
      life: 0.8 + Math.random() * 0.7,
      maxLife: 1.5,
      scale: 1 + Math.random() * 2,
    });
  }
  shakeAmount = Math.min(shakeAmount + 1.0, 1.5);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.pos.addScaledVector(p.dir, p.speed * dt);
    p.dir.y -= 20 * dt;
    p.speed *= 0.96;
  }
  const count = Math.min(particles.length, MAX_PARTICLES);
  for (let i = 0; i < count; i++) {
    const p = particles[i];
    dummy.position.copy(p.pos);
    const s = Math.max(0.01, (p.life / p.maxLife) * p.scale);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    particleInstanced.setMatrixAt(i, dummy.matrix);
  }
  particleInstanced.count = count;
  particleInstanced.instanceMatrix.needsUpdate = true;
}

// ==================== AUDIO ====================
let audioCtx = null;
function initAudio() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playLaunchSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(80, t);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.3);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2000, t + 0.3);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(f).connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.4);
}
function playExplosionSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dur = 0.6;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = audioCtx.createBufferSource();
  s.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(audioCtx.destination);
  s.start(t);
}

// ==================== TARGETING ====================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'playing') return;

  // تبدیل مختصات لمس به مختصات NDC
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  // برخورد با زمین
  const groundIntersects = raycaster.intersectObject(ground);
  // برخورد با ساختمان‌ها
  const cityIntersects = raycaster.intersectObjects(cityGroup.children, true);

  let hitPoint = null;
  if (cityIntersects.length > 0) {
    hitPoint = cityIntersects[0].point;
  } else if (groundIntersects.length > 0) {
    hitPoint = groundIntersects[0].point;
  }

  if (hitPoint) {
    targetPoint = hitPoint.clone();
    showTargetMarker(hitPoint);
    statusEl.textContent = 'TARGET DESIGNATED';
    lockTextEl.classList.remove('hidden');
  }
}, { passive: true });

function showTargetMarker(pos) {
  if (targetMarkerMesh) scene.remove(targetMarkerMesh);

  const geo = new THREE.SphereGeometry(2, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, transparent: true, opacity: 0.8 });
  targetMarkerMesh = new THREE.Mesh(geo, mat);
  targetMarkerMesh.position.copy(pos);
  scene.add(targetMarkerMesh);

  // به‌روزرسانی موقعیت نشانگر HTML
  const screenPos = pos.clone().project(camera);
  const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
  targetMarkerEl.style.left = x + 'px';
  targetMarkerEl.style.top = y + 'px';
  targetMarkerEl.classList.remove('hidden');
}

// ==================== CONTROLS ====================
let isDragging = false, lastX = 0, lastY = 0;
let yaw = 0, pitch = 0;
const LOOK_SENS = 0.003;
const PITCH_LIMIT = Math.PI / 2 - 0.1;

canvas.addEventListener('touchstart', (e) => {
  if (e.target === canvas) {
    isDragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const dx = e.touches[0].clientX - lastX;
  const dy = e.touches[0].clientY - lastY;
  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
  yaw -= dx * LOOK_SENS;
  pitch -= dy * LOOK_SENS;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  camera.rotation.set(pitch, yaw, 0);
}, { passive: true });
canvas.addEventListener('touchend', () => { isDragging = false; }, { passive: true });

canvas.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  yaw -= dx * LOOK_SENS;
  pitch -= dy * LOOK_SENS;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  camera.rotation.set(pitch, yaw, 0);
});
window.addEventListener('mouseup', () => { isDragging = false; });

fireBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  fireMissile();
});

// ==================== GAME STATE ====================
const STATE = { MENU: 'menu', PLAYING: 'playing', GAMEOVER: 'gameover' };
let state = STATE.MENU;
let score = 0, lives = 3;
let shakeAmount = 0;
let best = parseInt(localStorage.getItem('nargil_best') || '0', 10);

function startGame() {
  initAudio();
  state = STATE.PLAYING;
  // پاکسازی
  for (const m of missiles) missileGroup.remove(m.mesh);
  missiles.length = 0;
  particles.length = 0;
  targetPoint = null;
  if (targetMarkerMesh) { scene.remove(targetMarkerMesh); targetMarkerMesh = null; }
  targetMarkerEl.classList.add('hidden');
  lockTextEl.classList.add('hidden');

  score = 0; lives = 3;
  yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0);
  camera.position.set(0, 5, 0);

  scoreEl.textContent = '0';
  livesEl.textContent = '3';
  statusEl.textContent = 'READY';
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');

  createCity();
}

function endGame() {
  state = STATE.GAMEOVER;
  if (score > best) { best = score; localStorage.setItem('nargil_best', best); }
  finalScoreEl.textContent = score;
  finalBestEl.textContent = best;
  bestScoreEl.textContent = best;
  setTimeout(() => gameOverEl.classList.remove('hidden'), 500);
}

// ==================== MISSILE PHYSICS UPDATE ====================
function updateMissiles(dt) {
  for (const m of missiles) {
    if (m.dead) continue;

    m.life -= dt;
    if (m.life <= 0) {
      m.dead = true;
      missileGroup.remove(m.mesh);
      spawnExplosion(m.position, 0xffaa00);
      playExplosionSound();
      continue;
    }

    // --- 3-DOF PHYSICS ---
    // 1. نیروی رانش (در جهت سرعت)
    const speed = m.velocity.length();
    const thrustDir = m.velocity.clone().normalize();
    const thrust = thrustDir.multiplyScalar(MISSILE_THRUST / MISSILE_MASS);

    // 2. کشش هوا (مخالف جهت سرعت)
    const drag = m.velocity.clone().multiplyScalar(-MISSILE_DRAG_COEFF * speed);

    // 3. گرانش
    const gravity = new THREE.Vector3(0, -GRAVITY, 0);

    // 4. هدایت تناسبی (PN)
    let pnAccel = new THREE.Vector3();
    if (m.target) {
      const toTarget = new THREE.Vector3().subVectors(m.target, m.position);
      const dist = toTarget.length();
      const losDir = toTarget.clone().normalize();
      const velDir = m.velocity.clone().normalize();

      // نرخ چرخش خط دید
      const losRate = new THREE.Vector3().crossVectors(losDir, velDir);
      const closingSpeed = m.velocity.dot(losDir);

      if (closingSpeed > 0.1) {
        pnAccel = losRate.multiplyScalar(PN_GAIN * closingSpeed);
      }

      // بررسی برخورد
      if (dist < 5) {
        // انفجار روی هدف
        m.dead = true;
        missileGroup.remove(m.mesh);
        spawnExplosion(m.target, 0xff3333);
        playExplosionSound();
        score += 100;
        scoreEl.textContent = score;
        statusEl.textContent = 'TARGET DESTROYED';
        // حذف نشانگر هدف
        if (targetMarkerMesh) { scene.remove(targetMarkerMesh); targetMarkerMesh = null; }
        targetMarkerEl.classList.add('hidden');
        lockTextEl.classList.add('hidden');
        targetPoint = null;
        continue;
      }
    }

    // جمع شتاب‌ها
    const acceleration = new THREE.Vector3()
      .add(thrust)
      .add(drag)
      .add(gravity)
      .add(pnAccel);

    // به‌روزرسانی سرعت و موقعیت
    m.velocity.addScaledVector(acceleration, dt);

    // محدودیت سرعت
    const newSpeed = m.velocity.length();
    if (newSpeed > MISSILE_MAX_SPEED) {
      m.velocity.setLength(MISSILE_MAX_SPEED);
    }

    m.position.addScaledVector(m.velocity, dt);
    m.mesh.position.copy(m.position);

    // جهت‌دهی مدل موشک
    if (m.velocity.length() > 1) {
      const lookAt = m.position.clone().add(m.velocity.clone().normalize());
      m.mesh.lookAt(lookAt);
    }

    // رد موشک (Trail)
    m.trail.push(m.position.clone());
    if (m.trail.length > 20) m.trail.shift();

    // به‌روزرسانی موقعیت نشانگر هدف روی صفحه
    if (targetPoint) {
      const screenPos = targetPoint.clone().project(camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
      targetMarkerEl.style.left = x + 'px';
      targetMarkerEl.style.top = y + 'px';
    }
  }

  // پاکسازی
  for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
}

// ==================== MAIN LOOP ====================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === STATE.PLAYING) {
    updateMissiles(dt);

    // چرخش نشانگر هدف
    if (targetMarkerMesh) {
      targetMarkerMesh.rotation.y += dt * 2;
    }
  }

  updateParticles(dt);

  // لرزش دوربین
  if (shakeAmount > 0.01) {
    camera.position.x = (Math.random() - 0.5) * shakeAmount * 0.5;
    camera.position.y = 5 + (Math.random() - 0.5) * shakeAmount * 0.5;
    camera.position.z = (Math.random() - 0.5) * shakeAmount * 0.5;
    shakeAmount *= 0.9;
  } else {
    shakeAmount = 0;
    camera.position.set(0, 5, 0);
  }

  renderer.render(scene, camera);
}

// ==================== RESIZE & INIT ====================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
bestScoreEl.textContent = best;

// قفل جهت افقی (در صورت پشتیبانی مرورگر)
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('landscape').catch(() => {});
}

createCity();
animate();
