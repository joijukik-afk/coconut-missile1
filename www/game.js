import * as THREE from 'three';

// ==================== SETUP ====================
const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const envLabelEl = document.getElementById('envLabel');
const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');
const bestScoreEl = document.getElementById('bestScore');
const fireBtn = document.getElementById('fireBtn');
const targetLockEl = document.getElementById('targetLock');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050a10);
scene.fog = new THREE.FogExp2(0x050a10, 0.004);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 3, 0);
camera.rotation.order = 'YXZ';

// ==================== LIGHTING ====================
const hemiLight = new THREE.HemisphereLight(0x334466, 0x111122, 1.2);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(50, 100, 50);
scene.add(sunLight);
const ambientLight = new THREE.AmbientLight(0x112233, 0.5);
scene.add(ambientLight);

// ==================== ENVIRONMENTS ====================
const ENVIRONMENTS = [
  { name: '☀️ Desert', skyColor: 0x1a0a2e, groundColor: 0x2a1a0a, fogColor: 0x1a0a2e, fogDensity: 0.003, sunColor: 0xffaa66, hemiSky: 0x443322, hemiGround: 0x221100, terrainColor: 0x8B6B4A },
  { name: '❄️ Arctic', skyColor: 0x0a1a2e, groundColor: 0x1a2a3a, fogColor: 0x0a1a2e, fogDensity: 0.005, sunColor: 0xaaccff, hemiSky: 0x334466, hemiGround: 0x112233, terrainColor: 0xc8d8e8 },
  { name: '🌙 Night Ops', skyColor: 0x020408, groundColor: 0x050a10, fogColor: 0x020408, fogDensity: 0.008, sunColor: 0x4466aa, hemiSky: 0x112244, hemiGround: 0x050510, terrainColor: 0x1a2a1a },
];
let currentEnvIndex = 0;

function applyEnvironment(index) {
  const env = ENVIRONMENTS[index];
  scene.background = new THREE.Color(env.skyColor);
  scene.fog = new THREE.FogExp2(env.fogColor, env.fogDensity);
  hemiLight.color = new THREE.Color(env.hemiSky);
  hemiLight.groundColor = new THREE.Color(env.hemiGround);
  sunLight.color = new THREE.Color(env.sunColor);
  if (terrainMesh) {
    terrainMesh.material.color = new THREE.Color(env.terrainColor);
  }
  envLabelEl.textContent = env.name;
}

// ==================== PROCEDURAL TERRAIN ====================
let terrainMesh = null;

function createTerrain() {
  const size = 400;
  const segments = 64;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dist = Math.sqrt(x * x + z * z);
    let height = 0;
    if (dist > 15) {
      height = (Math.sin(x * 0.08) * Math.cos(z * 0.06) * 3 +
                Math.sin(x * 0.15 + z * 0.12) * 1.5 +
                Math.cos(x * 0.04 - z * 0.09) * 4) * Math.min(1, (dist - 15) / 40);
    }
    pos.setY(i, height);
    const shade = 0.6 + Math.random() * 0.4;
    color.setRGB(shade, shade, shade);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  terrainMesh = new THREE.Mesh(geo, mat);
  scene.add(terrainMesh);
}

// ==================== INSTANCED ROCKS & TREES ====================
function createInstancedDecor() {
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const rockCount = 80;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < rockCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 30 + Math.random() * 150;
    dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.scale.setScalar(0.5 + Math.random() * 1.5);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  const treeGeo = new THREE.ConeGeometry(0.6, 3, 6);
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2a5a2a });
  const treeCount = 120;
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);

  for (let i = 0; i < treeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 25 + Math.random() * 160;
    dummy.position.set(Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.setScalar(0.6 + Math.random() * 1.2);
    dummy.updateMatrix();
    trees.setMatrixAt(i, dummy.matrix);
  }
  trees.instanceMatrix.needsUpdate = true;
  scene.add(trees);
}

// ==================== LAUNCHER (VIEWMODEL) ====================
function createLauncher() {
  const g = new THREE.Group();
  const tubeMat = new THREE.MeshLambertMaterial({ color: 0x2a3a2a });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.0, 8), tubeMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0, -0.6);

  const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.09), gripMat);
  grip.position.set(0, -0.16, -0.4);

  const sightMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.12), sightMat);
  sight.position.set(0, 0.14, -0.65);

  g.add(tube, grip, sight);
  g.position.set(0.3, -0.3, -0.65);
  g.rotation.y = -0.12;
  return g;
}
const launcher = createLauncher();
camera.add(launcher);
scene.add(camera);

// ==================== ENEMY (TARGET) ====================
const enemies = [];
const enemyGroup = new THREE.Group();
scene.add(enemyGroup);

function createEnemyMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bodyMat);
  body.scale.set(1.2, 0.5, 0.9);

  const wingMat = new THREE.MeshLambertMaterial({ color: 0x881111 });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.5), wingMat);
  wing.position.y = 0.15;

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), eyeMat);
  eye.position.set(0, 0, -0.5);

  g.add(body, wing, eye);
  return g;
}

function spawnEnemy() {
  const mesh = createEnemyMesh();
  const angle = Math.random() * Math.PI * 2;
  const radius = 80 + Math.random() * 60;
  const y = 15 + Math.random() * 30;
  mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  enemyGroup.add(mesh);
  enemies.push({
    mesh,
    speed: 6 + Math.random() * 6,
    dir: new THREE.Vector3(-mesh.position.x, (Math.random() - 0.5) * 4, -mesh.position.z).normalize(),
    dead: false,
  });
}

// ==================== NARGIL MISSILE (PROPORTIONAL NAVIGATION) ====================
const missiles = [];
const missileGroup = new THREE.Group();
scene.add(missileGroup);

function createMissileMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), bodyMat);
  body.rotation.x = Math.PI / 2;

  const noseMat = new THREE.MeshLambertMaterial({ color: 0xff2222 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -0.49;

  const finMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.15), finMat);
  fin1.position.z = 0.35;
  const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.15), finMat);
  fin2.position.z = 0.35;

  g.add(body, nose, fin1, fin2);
  return g;
}

const MISSILE_MAX_SPEED = 120;
const MISSILE_ACCEL = 80;
const MISSILE_LIFE = 4.0;
const PN_GAIN = 3.5;

let currentTarget = null;

function fireMissile() {
  if (state !== 'playing') return;

  const startPos = new THREE.Vector3(0.3, -0.3, -1.0);
  startPos.applyQuaternion(camera.quaternion);
  startPos.add(camera.position);

  const mesh = createMissileMesh();
  mesh.position.copy(startPos);
  mesh.quaternion.copy(camera.quaternion);
  missileGroup.add(mesh);

  let target = currentTarget;
  if (!target || target.dead) {
    let bestDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = mesh.position.distanceTo(e.mesh.position);
      if (d < bestDist) { bestDist = d; target = e; }
    }
  }

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  missiles.push({
    mesh,
    velocity: forward.clone().multiplyScalar(30),
    target: target || null,
    life: MISSILE_LIFE,
    dead: false,
    hasLock: !!target,
    trailTimer: 0,
  });

  playLaunchSound();
  shakeAmount = Math.min(shakeAmount + 0.3, 0.6);
  currentTarget = null;
  targetLockEl.classList.add('hidden');
}

// ==================== PARTICLES (INSTANCED) ====================
const MAX_PARTICLES = 200;
const particleGeo = new THREE.SphereGeometry(0.12, 4, 4);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 });
const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, MAX_PARTICLES);
particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(particleInstanced);

const particles = [];
const dummy = new THREE.Object3D();

function spawnExplosion(position, colorHex) {
  for (let i = 0; i < 25; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    particles.push({
      pos: position.clone(),
      dir,
      speed: 12 + Math.random() * 25,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      scale: 0.8 + Math.random() * 1.5,
    });
  }
  shakeAmount = Math.min(shakeAmount + 0.5, 0.8);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.pos.addScaledVector(p.dir, p.speed * dt);
    p.dir.y -= 8 * dt;
    p.speed *= 0.97;
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
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(600, t + 0.2);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(f).connect(g).connect(audioCtx.destination);
  o.start(t); o.stop(t + 0.3);
}
function playExplosionSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dur = 0.4;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const s = audioCtx.createBufferSource();
  s.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(audioCtx.destination);
  s.start(t);
}

// ==================== TOUCH / MOUSE CONTROLS ====================
let isDragging = false, lastX = 0, lastY = 0;
let yaw = 0, pitch = 0;
const LOOK_SENS = 0.0045;
const PITCH_LIMIT = Math.PI / 2 - 0.08;

function onPointerStart(x, y) { isDragging = true; lastX = x; lastY = y; }
function onPointerMove(x, y) {
  if (!isDragging) return;
  const dx = x - lastX, dy = y - lastY;
  lastX = x; lastY = y;
  yaw -= dx * LOOK_SENS;
  pitch -= dy * LOOK_SENS;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  camera.rotation.set(pitch, yaw, 0);
}
function onPointerEnd() { isDragging = false; }

canvas.addEventListener('touchstart', e => { if (e.target === canvas) onPointerStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
canvas.addEventListener('touchmove', e => { if (isDragging) { onPointerMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
canvas.addEventListener('touchend', onPointerEnd, { passive: true });
canvas.addEventListener('mousedown', e => onPointerStart(e.clientX, e.clientY));
window.addEventListener('mousemove', e => onPointerMove(e.clientX, e.clientY));
window.addEventListener('mouseup', onPointerEnd);

fireBtn.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); fireMissile(); });

// ==================== GAME STATE ====================
const STATE = { MENU: 'menu', PLAYING: 'playing', GAMEOVER: 'gameover' };
let state = STATE.MENU;
let score = 0, lives = 3;
let spawnTimer = 0, spawnInterval = 2.5;
let shakeAmount = 0;
let envTimer = 0;
let best = parseInt(localStorage.getItem('nargil_best') || '0', 10);

function startGame() {
  initAudio();
  state = STATE.PLAYING;
  // cleanup
  for (const m of missiles) missileGroup.remove(m.mesh);
  missiles.length = 0;
  for (const e of enemies) enemyGroup.remove(e.mesh);
  enemies.length = 0;
  particles.length = 0;
  currentTarget = null;

  score = 0; lives = 3; spawnTimer = 0; spawnInterval = 2.5;
  yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0);
  currentEnvIndex = 0; applyEnvironment(0); envTimer = 0;

  scoreEl.textContent = '0';
  livesEl.textContent = '3';
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  targetLockEl.classList.add('hidden');
}

function endGame() {
  state = STATE.GAMEOVER;
  if (score > best) { best = score; localStorage.setItem('nargil_best', best); }
  finalScoreEl.textContent = score;
  finalBestEl.textContent = best;
  bestScoreEl.textContent = best;
  setTimeout(() => gameOverEl.classList.remove('hidden'), 500);
}

// ==================== MAIN LOOP ====================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === STATE.PLAYING) {
    // environment cycle every 25 seconds
    envTimer += dt;
    if (envTimer > 25) {
      envTimer = 0;
      currentEnvIndex = (currentEnvIndex + 1) % ENVIRONMENTS.length;
      applyEnvironment(currentEnvIndex);
    }

    // spawn enemies
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnEnemy();
      if (score > 80 && Math.random() < 0.4) spawnEnemy();
    }

    // update missiles (PN GUIDANCE)
    for (const m of missiles) {
      if (m.dead) continue;
      m.life -= dt;
      if (m.life <= 0) {
        m.dead = true;
        missileGroup.remove(m.mesh);
        spawnExplosion(m.mesh.position, 0xffaa00);
        playExplosionSound();
        continue;
      }

      // --- PROPORTIONAL NAVIGATION ---
      if (m.target && !m.target.dead) {
        const toTarget = new THREE.Vector3().subVectors(m.target.mesh.position, m.mesh.position);
        const dist = toTarget.length();
        const losDir = toTarget.clone().normalize();

        const currentSpeed = m.velocity.length();
        const speed = Math.min(currentSpeed + MISSILE_ACCEL * dt, MISSILE_MAX_SPEED);
        const velDir = m.velocity.clone().normalize();

        // PN acceleration: a = N * Vc * LOS_rate
        const losRate = new THREE.Vector3().crossVectors(losDir, velDir);
        const accel = losRate.multiplyScalar(PN_GAIN * speed);

        m.velocity.addScaledVector(accel, dt);
        m.velocity.setLength(speed);

        if (dist < 4) {
          m.target.dead = true;
          enemyGroup.remove(m.target.mesh);
          score += 15;
          scoreEl.textContent = score;
          spawnExplosion(m.target.mesh.position, 0xff3333);
          playExplosionSound();
          m.dead = true;
          missileGroup.remove(m.mesh);
          continue;
        }
      } else {
        // ballistic fallback
        m.velocity.y -= 15 * dt;
      }

      m.mesh.position.addScaledVector(m.velocity, dt);
      const lookAt = m.mesh.position.clone().add(m.velocity.clone().normalize());
      m.mesh.lookAt(lookAt);
    }

    // update enemies
    for (const e of enemies) {
      if (e.dead) continue;
      e.mesh.position.addScaledVector(e.dir, e.speed * dt);
      e.mesh.lookAt(camera.position);

      if (e.mesh.position.length() > 220) {
        e.dead = true;
        enemyGroup.remove(e.mesh);
        lives--;
        livesEl.textContent = Math.max(0, lives);
        if (lives <= 0) endGame();
      }
      if (e.mesh.position.distanceTo(camera.position) < 3) {
        e.dead = true;
        enemyGroup.remove(e.mesh);
        lives--;
        livesEl.textContent = Math.max(0, lives);
        spawnExplosion(e.mesh.position, 0xff0000);
        playExplosionSound();
        shakeAmount = Math.min(shakeAmount + 0.6, 1.0);
        if (lives <= 0) endGame();
      }
    }

    // auto-target nearest enemy for lock indicator
    let nearest = null, nearestDist = 150;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = e.mesh.position.distanceTo(camera.position);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    currentTarget = nearest;
    if (nearest) targetLockEl.classList.remove('hidden');
    else targetLockEl.classList.add('hidden');
  }

  // cleanup
  for (let i = missiles.length - 1; i >= 0; i--) if (missiles[i].dead) missiles.splice(i, 1);
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);

  updateParticles(dt);

  // camera shake
  if (shakeAmount > 0.01) {
    camera.position.x = (Math.random() - 0.5) * shakeAmount * 0.3;
    camera.position.y = 3 + (Math.random() - 0.5) * shakeAmount * 0.3;
    shakeAmount *= 0.9;
  } else {
    shakeAmount = 0;
    camera.position.set(0, 3, 0);
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

createTerrain();
createInstancedDecor();
applyEnvironment(0);
animate();
