import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("game");
const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const scoreEl = document.getElementById("score");
const nitroEl = document.getElementById("nitro");
const nitroBar = document.getElementById("nitro-bar");
const statusEl = document.getElementById("status");

// ── Renderer ────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ── Scene ────────────────────────────────────────────────────
const scene = new THREE.Scene();

// Synthwave sky gradient via background texture
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 2;
skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext("2d");
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0.0,  "#050010");
skyGrad.addColorStop(0.35, "#120040");
skyGrad.addColorStop(0.62, "#3d0068");
skyGrad.addColorStop(0.80, "#8b006a");
skyGrad.addColorStop(0.92, "#d4006e");
skyGrad.addColorStop(1.0,  "#ff7040");
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 2, 512);
const skyTex = new THREE.CanvasTexture(skyCanvas);
scene.background = skyTex;

// Fog tinted like the horizon
scene.fog = new THREE.FogExp2(0x3d0068, 0.006);

// ── Camera ───────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 7.5, 15);

// ── Lighting ─────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x110020, 2.2));

// Magenta key light (low angle sun/retrowave sun effect)
const sunLight = new THREE.DirectionalLight(0xff44cc, 1.8);
sunLight.position.set(30, 45, -60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 300;
sunLight.shadow.camera.left = -80;
sunLight.shadow.camera.right = 80;
sunLight.shadow.camera.top = 80;
sunLight.shadow.camera.bottom = -80;
scene.add(sunLight);

// Cyan fill light from the opposite side
const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.6);
fillLight.position.set(-30, 20, 40);
scene.add(fillLight);

// ── Retrowave sun disc ───────────────────────────────────────
function makeSunDisc() {
  const group = new THREE.Group();

  // Glow halo (large soft circle)
  const haloGeo = new THREE.PlaneGeometry(70, 70);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff3060,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  // Sun body with horizontal scan lines cut out
  const sunGeo = new THREE.PlaneGeometry(36, 20);
  const sunCanvas = document.createElement("canvas");
  sunCanvas.width = 256;
  sunCanvas.height = 256;
  const sc = sunCanvas.getContext("2d");

  // gradient fill
  const sg = sc.createLinearGradient(0, 0, 0, 256);
  sg.addColorStop(0, "#ffcc00");
  sg.addColorStop(0.45, "#ff6030");
  sg.addColorStop(1, "#ff0090");
  sc.fillStyle = sg;
  sc.fillRect(0, 0, 256, 256);

  // Retrowave horizontal stripe cut-outs (bottom half only)
  sc.fillStyle = "#000000";
  const stripes = [168, 182, 194, 204, 212, 219, 225, 230, 235, 240, 244, 248, 251, 254];
  for (let i = 0; i < stripes.length; i += 2) {
    if (stripes[i + 1]) {
      sc.fillRect(0, stripes[i], 256, stripes[i + 1] - stripes[i]);
    }
  }

  const sunTex = new THREE.CanvasTexture(sunCanvas);
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTex,
    transparent: true,
    depthWrite: false,
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  group.add(sunMesh);

  group.position.set(0, 32, -440);
  scene.add(group);
  return group;
}
makeSunDisc();

// ── Stars ─────────────────────────────────────────────────────
(function addStars() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 1200;
    positions[i * 3 + 1] = 20 + Math.random() * 280;
    positions[i * 3 + 2] = -20 - Math.random() * 700;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
  });
  scene.add(new THREE.Points(geo, mat));
})();

// ── World root (shifts instead of moving the player car) ─────
const worldRoot = new THREE.Group();
scene.add(worldRoot);

// ── Road constants ────────────────────────────────────────────
const ROAD_WIDTH = 16;
const HALF_ROAD = ROAD_WIDTH / 2;
const CHUNK_LENGTH = 80;
const ACTIVE_CHUNKS = 14;
const LANE_CENTERS = [-5.0, 0, 5.0];
const chunks = new Map();

// ── Materials ─────────────────────────────────────────────────
const matRoad = new THREE.MeshStandardMaterial({
  color: 0x060010,
  roughness: 0.45,
  metalness: 0.25,
});
const matShoulder = new THREE.MeshStandardMaterial({ color: 0x1a0030, roughness: 0.9 });
const matGrass = new THREE.MeshStandardMaterial({ color: 0x0d0028, roughness: 1.0 });

// Neon pink lane dashes
const matDash = new THREE.MeshStandardMaterial({
  color: 0xff00cc,
  emissive: 0xff00cc,
  emissiveIntensity: 1.8,
  roughness: 0.3,
});
// Cyan edge lines
const matEdge = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x00ffff,
  emissiveIntensity: 2.0,
  roughness: 0.2,
});

// ── Grid road (retrowave perspective grid) ───────────────────
const matGrid = new THREE.MeshStandardMaterial({
  color: 0x000015,
  emissive: 0x5500aa,
  emissiveIntensity: 0.6,
  roughness: 0.5,
});

// ── Car factory ───────────────────────────────────────────────
function createCar(bodyHex, rimHex = 0x00ffff) {
  const car = new THREE.Group();

  // body shell
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.72, 4.6),
    new THREE.MeshStandardMaterial({
      color: bodyHex,
      metalness: 0.75,
      roughness: 0.2,
      emissive: bodyHex,
      emissiveIntensity: 0.12,
    })
  );
  shell.castShadow = true;
  car.add(shell);

  // cabin/roof
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.78, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0x000818,
      metalness: 0.1,
      roughness: 0.15,
    })
  );
  roof.position.set(0, 0.75, -0.1);
  roof.castShadow = true;
  car.add(roof);

  // neon underbody glow strip (emissive plane beneath car)
  const glowStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 4.8),
    new THREE.MeshBasicMaterial({
      color: rimHex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  glowStrip.rotation.x = -Math.PI / 2;
  glowStrip.position.y = -0.34;
  car.add(glowStrip);

  // wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x080010, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimHex,
    emissive: rimHex,
    emissiveIntensity: 1.2,
    metalness: 0.8,
    roughness: 0.2,
  });
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.58, 24);
  const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.6, 16);
  for (const [x, z] of [[1.1, 1.45], [-1.1, 1.45], [1.1, -1.45], [-1.1, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.35, z);
    wheel.castShadow = true;
    car.add(wheel);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x * 1.02, -0.35, z);
    car.add(rim);
  }

  // headlights (for player car)
  for (const side of [-0.7, 0.7]) {
    const hlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.12, 0.08),
      new THREE.MeshBasicMaterial({ color: rimHex })
    );
    hlight.position.set(side, 0.05, -2.3);
    car.add(hlight);
  }

  return car;
}

// ── Environment objects ───────────────────────────────────────
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 1.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x1a0030, roughness: 0.9 })
  );
  trunk.position.y = 0.9;
  trunk.castShadow = true;

  const foliageColor = Math.random() > 0.5 ? 0x0d0040 : 0x1a0030;
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.6, 9),
    new THREE.MeshStandardMaterial({
      color: foliageColor,
      emissive: 0x220044,
      emissiveIntensity: 0.5,
    })
  );
  top.position.y = 2.7;
  top.castShadow = true;
  g.add(trunk, top);
  return g;
}

function makeBuilding(height = 8) {
  const w = 4 + Math.random() * 4;
  const d = 4 + Math.random() * 4;

  // Main body – dark with slight tint
  const hue = Math.random() > 0.5 ? 0.75 : 0.85; // purple or magenta range
  const bodyColor = new THREE.Color().setHSL(hue, 0.6, 0.08 + Math.random() * 0.08);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, height, d),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.5, roughness: 0.55 })
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;

  // Neon trim on top edge
  const trimColor = Math.random() > 0.5 ? 0xff00cc : 0x00ffff;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1),
    new THREE.MeshStandardMaterial({
      color: trimColor,
      emissive: trimColor,
      emissiveIntensity: 2.5,
    })
  );
  trim.position.y = height + 0.06;
  trim.castShadow = false;

  const g = new THREE.Group();
  g.add(body, trim);

  // Randomly add window glow panels
  if (Math.random() > 0.4) {
    const windowRows = Math.floor(height / 2.5);
    const windowCols = Math.floor(w / 1.5);
    const winColor = Math.random() > 0.5 ? 0xff88ff : 0x88ffff;
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        if (Math.random() > 0.45) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(0.55, 0.55),
            new THREE.MeshBasicMaterial({ color: winColor, transparent: true, opacity: 0.6 })
          );
          win.position.set(
            -w / 2 + 0.01,
            1.5 + row * 2.2,
            -d / 2 + 0.8 + col * (d / windowCols)
          );
          win.rotation.y = -Math.PI / 2;
          g.add(win);
        }
      }
    }
  }

  return g;
}

// ── Chunk builder ─────────────────────────────────────────────
function createChunk(chunkIndex) {
  const chunk = new THREE.Group();
  const zStart = -chunkIndex * CHUNK_LENGTH;
  const zMid = zStart - CHUNK_LENGTH / 2;

  // Road surface
  const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.18, CHUNK_LENGTH), matRoad);
  road.position.set(0, 0, zMid);
  road.receiveShadow = true;
  chunk.add(road);

  // Shoulders
  for (const side of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, CHUNK_LENGTH), matShoulder);
    sh.position.set(side * (HALF_ROAD + 1.1), 0.01, zMid);
    sh.receiveShadow = true;
    chunk.add(sh);

    const grass = new THREE.Mesh(new THREE.BoxGeometry(80, 0.09, CHUNK_LENGTH), matGrass);
    grass.position.set(side * (HALF_ROAD + 41), -0.05, zMid);
    grass.receiveShadow = true;
    chunk.add(grass);
  }

  // Neon lane dash markings
  const dashCount = Math.floor(CHUNK_LENGTH / 9);
  for (let i = 0; i < dashCount; i++) {
    const z = zStart - i * 9 - 2;
    // Two inner lane dashes
    for (const lx of [-2.7, 2.7]) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 3.5), matDash);
      dash.position.set(lx, 0.12, z);
      chunk.add(dash);
    }
    // Edge glow lines (full length segments)
    for (const ex of [-(HALF_ROAD - 0.25), HALF_ROAD - 0.25]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 9.2), matEdge);
      edge.position.set(ex, 0.11, z - 2.6);
      chunk.add(edge);
    }
  }

  // Scenery
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const obj = Math.random() > 0.45 ? makeBuilding(5 + Math.random() * 18) : makeTree();
    const x = side * (HALF_ROAD + 7 + Math.random() * 28);
    const z = zStart - 8 - Math.random() * (CHUNK_LENGTH - 16);
    obj.position.set(x, 0, z);
    chunk.add(obj);
  }

  chunks.set(chunkIndex, chunk);
  worldRoot.add(chunk);
}

function ensureChunks(playerChunk) {
  for (let i = playerChunk - 2; i < playerChunk + ACTIVE_CHUNKS; i++) {
    if (!chunks.has(i)) createChunk(i);
  }
  for (const [key, group] of chunks) {
    if (key < playerChunk - 3 || key > playerChunk + ACTIVE_CHUNKS + 1) {
      worldRoot.remove(group);
      chunks.delete(key);
    }
  }
}

// ── Player car ────────────────────────────────────────────────
const playerCar = createCar(0xcc00ff, 0x00ffff);
playerCar.position.y = 0.67;
scene.add(playerCar);

// Point light attached to player car for neon underglow on road
const carGlow = new THREE.PointLight(0x00ffff, 2.5, 12);
carGlow.position.set(0, 0, 0);
playerCar.add(carGlow);

const carGlowMagenta = new THREE.PointLight(0xff00ff, 1.8, 10);
carGlowMagenta.position.set(0, 0.5, 0);
playerCar.add(carGlowMagenta);

// ── Traffic ───────────────────────────────────────────────────
const trafficCars = [];
const trafficPalette = [
  [0xff0044, 0xff4488],
  [0xff8800, 0xffcc00],
  [0x8800ff, 0xcc00ff],
  [0x0044ff, 0x00ccff],
  [0x00ff88, 0x00ffcc],
  [0xff00cc, 0xffaaff],
];

function spawnTraffic(worldZ) {
  const [body, rim] = trafficPalette[(Math.random() * trafficPalette.length) | 0];
  const t = createCar(body, rim);
  t.position.set(LANE_CENTERS[(Math.random() * LANE_CENTERS.length) | 0], 0.67, worldZ);
  t.rotation.y = Math.PI;
  t.userData.speed = 35 + Math.random() * 45;
  t.userData.nearMiss = false;
  trafficCars.push(t);
  scene.add(t);
}

// ── Simulation state ──────────────────────────────────────────
const sim = {
  running: false,
  speed: 0,
  minSpeed: 0,
  maxSpeed: 120,
  accel: 38,
  brake: 65,
  drag: 14,
  steer: 1.9,
  nitro: 100,
  distance: 0,
  nearMisses: 0,
  heading: 0,
  worldPos: new THREE.Vector3(0, 0, 0),
  lastSpawnZ: -120,
};

const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space" && !sim.running) resetGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

function resetGame() {
  sim.running = true;
  sim.speed = 20;
  sim.nitro = 100;
  sim.distance = 0;
  sim.nearMisses = 0;
  sim.heading = 0;
  sim.worldPos.set(0, 0, 0);
  sim.lastSpawnZ = -120;

  for (const t of trafficCars) scene.remove(t);
  trafficCars.length = 0;

  statusEl.textContent = "DRIVE! THREAD TRAFFIC.";
  statusEl.classList.remove("crashed");
  speedEl.textContent = "0";
  distanceEl.textContent = "0.00";
  scoreEl.textContent = "0";
  nitroEl.textContent = "100%";
  nitroBar.style.width = "100%";
}

// ── Vehicle update ────────────────────────────────────────────
function updateVehicle(delta) {
  const accel  = keys.has("KeyW") || keys.has("ArrowUp");
  const braking = keys.has("KeyS") || keys.has("ArrowDown");
  const boost  = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && sim.nitro > 1;

  const topSpeed = boost ? sim.maxSpeed * 1.4 : sim.maxSpeed;
  if (accel)   sim.speed += sim.accel * delta;
  else         sim.speed -= sim.drag  * delta;
  if (braking) sim.speed -= sim.brake * delta;
  if (boost) {
    sim.speed += 36 * delta;
    sim.nitro = Math.max(0, sim.nitro - 28 * delta);
  } else {
    sim.nitro = Math.min(100, sim.nitro + 14 * delta);
  }
  sim.speed = THREE.MathUtils.clamp(sim.speed, 0, topSpeed);

  const steerIn = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0)
                - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
  sim.heading += steerIn * sim.steer * delta * (0.3 + sim.speed / 130);
  sim.heading *= 0.98;

  const forward = new THREE.Vector3(Math.sin(sim.heading), 0, -Math.cos(sim.heading));
  sim.worldPos.addScaledVector(forward, sim.speed * delta);

  const roadClamp = HALF_ROAD - 1.3;
  sim.worldPos.x = THREE.MathUtils.clamp(sim.worldPos.x, -roadClamp - 1.5, roadClamp + 1.5);
  if (Math.abs(sim.worldPos.x) > roadClamp) {
    sim.speed = Math.max(sim.speed - 36 * delta, 0);
  }

  sim.distance += (sim.speed * delta) / 1000;

  // Smooth car body position / rotation
  playerCar.position.x += (sim.worldPos.x - playerCar.position.x) * Math.min(1, 8 * delta);
  playerCar.rotation.y += (-sim.heading - playerCar.rotation.y) * Math.min(1, 7 * delta);

  // Bank / tilt on steering for feel
  playerCar.rotation.z += (-steerIn * 0.06 - playerCar.rotation.z) * Math.min(1, 6 * delta);

  // Camera follow
  const camOff = new THREE.Vector3(0, 7, 14).applyAxisAngle(new THREE.Vector3(0, 1, 0), -sim.heading * 0.35);
  const camTarget = new THREE.Vector3(playerCar.position.x, 1.4, -12);
  camera.position.lerp(camTarget.clone().add(camOff), Math.min(1, 4 * delta));
  camera.lookAt(camTarget);

  worldRoot.position.set(-sim.worldPos.x, 0, sim.worldPos.z);

  // Pulse car glow with speed
  const speedNorm = sim.speed / sim.maxSpeed;
  carGlow.intensity = 2.5 + speedNorm * 3;
  carGlowMagenta.intensity = boost ? 4 + Math.sin(Date.now() * 0.02) * 1.5 : 1.8;
}

// ── Traffic update ────────────────────────────────────────────
function updateTraffic(delta) {
  while (-sim.worldPos.z - sim.lastSpawnZ > 38) {
    sim.lastSpawnZ -= 38;
    spawnTraffic(sim.lastSpawnZ - 140 - Math.random() * 110);
  }

  for (let i = trafficCars.length - 1; i >= 0; i--) {
    const t = trafficCars[i];
    t.position.z += t.userData.speed * delta;

    const dz = t.position.z - (-sim.worldPos.z);
    if (!t.userData.nearMiss && dz > -3 && dz < 2.6 && Math.abs(t.position.x - sim.worldPos.x) < 2.7) {
      t.userData.nearMiss = true;
      sim.nearMisses++;
    }

    if (Math.abs(t.position.x - sim.worldPos.x) < 1.75 && Math.abs(dz) < 2.8) {
      sim.running = false;
      statusEl.textContent = `CRASH! ${sim.distance.toFixed(2)} km · SPACE TO RESTART`;
      statusEl.classList.add("crashed");
    }

    if (t.position.z > -sim.worldPos.z + 50) {
      scene.remove(t);
      trafficCars.splice(i, 1);
    }
  }
}

// ── HUD update ────────────────────────────────────────────────
function updateHUD() {
  speedEl.textContent = Math.round(sim.speed * 3.1).toString();
  distanceEl.textContent = sim.distance.toFixed(2);
  scoreEl.textContent = sim.nearMisses.toString();
  const n = Math.round(sim.nitro);
  nitroEl.textContent = n + "%";
  nitroBar.style.width = n + "%";
  // Change nitro bar color when low
  nitroBar.style.background = n < 25
    ? "linear-gradient(90deg, #ff2200, #ff6600)"
    : "linear-gradient(90deg, #ff00ff, #00f0ff)";
}

// ── Resize ────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Game loop ─────────────────────────────────────────────────
const clock = new THREE.Clock();

function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);

  if (sim.running) {
    updateVehicle(delta);
    updateTraffic(delta);
    ensureChunks(Math.floor((-sim.worldPos.z) / CHUNK_LENGTH));
    updateHUD();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

ensureChunks(0);
tick();
