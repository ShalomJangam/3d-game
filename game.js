import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("game");
const speedEl = document.getElementById("speed");
const distanceEl = document.getElementById("distance");
const scoreEl = document.getElementById("score");
const nitroEl = document.getElementById("nitro");
const statusEl = document.getElementById("status");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7bb2eb);
scene.fog = new THREE.Fog(0x7bb2eb, 80, 360);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 7.5, 15);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xfff6df, 1.2);
sun.position.set(50, 90, -40);
sun.castShadow = true;
scene.add(sun);

const worldRoot = new THREE.Group();
scene.add(worldRoot);

const ROAD_WIDTH = 14;
const HALF_ROAD = ROAD_WIDTH / 2;
const CHUNK_LENGTH = 80;
const ACTIVE_CHUNKS = 12;
const LANE_CENTERS = [-4.4, 0, 4.4];
const chunks = new Map();

const materialRoad = new THREE.MeshStandardMaterial({ color: 0x25282f, roughness: 0.9 });
const materialShoulder = new THREE.MeshStandardMaterial({ color: 0x8f8f8f, roughness: 1 });
const materialGrass = new THREE.MeshStandardMaterial({ color: 0x427b3f });
const materialDashed = new THREE.MeshStandardMaterial({ color: 0xf5f2d8, emissive: 0x111100 });
const materialSolid = new THREE.MeshStandardMaterial({ color: 0xffffff });

function createCar(bodyColor, roofColor = 0xdbe8ff) {
  const car = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.8, 4.6),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.2, roughness: 0.55 })
  );
  shell.castShadow = true;
  car.add(shell);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.85, 2.15),
    new THREE.MeshStandardMaterial({ color: roofColor, metalness: 0.1, roughness: 0.2 })
  );
  roof.position.set(0, 0.73, -0.15);
  roof.castShadow = true;
  car.add(roof);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.6, 20);
  for (const [x, z] of [[1, 1.45], [-1, 1.45], [1, -1.45], [-1, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.38, z);
    wheel.castShadow = true;
    car.add(wheel);
  }

  return car;
}

function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x6e4f2c })
  );
  trunk.position.y = 0.8;

  const top = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x356f33 })
  );
  top.position.y = 2.4;

  trunk.castShadow = true;
  top.castShadow = true;
  g.add(trunk, top);
  return g;
}

function makeBuilding(height = 8) {
  const w = 4 + Math.random() * 3;
  const d = 4 + Math.random() * 3;
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(w, height, d),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58, 0.15, 0.3 + Math.random() * 0.25) })
  );
  b.position.y = height / 2;
  b.castShadow = true;
  b.receiveShadow = true;
  return b;
}

function createChunk(chunkIndex) {
  const chunk = new THREE.Group();
  const zStart = -chunkIndex * CHUNK_LENGTH;

  const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.2, CHUNK_LENGTH), materialRoad);
  road.position.set(0, 0, zStart - CHUNK_LENGTH / 2);
  road.receiveShadow = true;
  chunk.add(road);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, CHUNK_LENGTH), materialShoulder);
    shoulder.position.set(side * (HALF_ROAD + 1), 0.02, zStart - CHUNK_LENGTH / 2);
    shoulder.receiveShadow = true;
    chunk.add(shoulder);

    const grass = new THREE.Mesh(new THREE.BoxGeometry(70, 0.1, CHUNK_LENGTH), materialGrass);
    grass.position.set(side * (HALF_ROAD + 36), -0.06, zStart - CHUNK_LENGTH / 2);
    grass.receiveShadow = true;
    chunk.add(grass);
  }

  for (let i = 0; i < CHUNK_LENGTH / 8; i += 1) {
    const laneDashL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 3), materialDashed);
    const laneDashR = laneDashL.clone();
    const z = zStart - i * 8 - 2;
    laneDashL.position.set(-2.2, 0.13, z);
    laneDashR.position.set(2.2, 0.13, z);
    chunk.add(laneDashL, laneDashR);

    const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 3), materialSolid);
    const edgeR = edgeL.clone();
    edgeL.position.set(-HALF_ROAD + 0.2, 0.12, z);
    edgeR.position.set(HALF_ROAD - 0.2, 0.12, z);
    chunk.add(edgeL, edgeR);
  }

  for (let i = 0; i < 10; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const style = Math.random();
    const obj = style > 0.52 ? makeBuilding(6 + Math.random() * 16) : makeTree();
    const x = side * (HALF_ROAD + 6 + Math.random() * 26);
    const z = zStart - 8 - Math.random() * (CHUNK_LENGTH - 16);
    obj.position.set(x, 0, z);
    chunk.add(obj);
  }

  chunks.set(chunkIndex, chunk);
  worldRoot.add(chunk);
}

function ensureChunks(playerChunk) {
  for (let i = playerChunk - 2; i < playerChunk + ACTIVE_CHUNKS; i += 1) {
    if (!chunks.has(i)) {
      createChunk(i);
    }
  }

  for (const [key, group] of chunks) {
    if (key < playerChunk - 3 || key > playerChunk + ACTIVE_CHUNKS + 1) {
      worldRoot.remove(group);
      chunks.delete(key);
    }
  }
}

const playerCar = createCar(0x0b83ff, 0xbad6ff);
playerCar.position.y = 0.68;
scene.add(playerCar);

const trafficCars = [];
const trafficColors = [0xc0392b, 0xf39c12, 0x9b59b6, 0x16a085, 0xecf0f1, 0xf1c40f];

function spawnTraffic(worldZ) {
  const t = createCar(trafficColors[(Math.random() * trafficColors.length) | 0], 0xdfe8ff);
  t.position.set(LANE_CENTERS[(Math.random() * LANE_CENTERS.length) | 0], 0.68, worldZ);
  t.rotation.y = Math.PI;
  t.userData.speed = 35 + Math.random() * 45;
  t.userData.nearMiss = false;
  trafficCars.push(t);
  scene.add(t);
}

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
  if (e.code === "Space" && !sim.running) {
    resetGame();
  }
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

  for (const t of trafficCars) {
    scene.remove(t);
  }
  trafficCars.length = 0;

  statusEl.textContent = "Drive! Stay on the road and thread traffic.";
  speedEl.textContent = "0";
  distanceEl.textContent = "0.00";
  scoreEl.textContent = "0";
  nitroEl.textContent = "100";
}

function updateVehicle(delta) {
  const accelerating = keys.has("KeyW") || keys.has("ArrowUp");
  const braking = keys.has("KeyS") || keys.has("ArrowDown");
  const boost = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && sim.nitro > 1;

  const maxSpeed = boost ? sim.maxSpeed * 1.35 : sim.maxSpeed;
  if (accelerating) {
    sim.speed += sim.accel * delta;
  } else {
    sim.speed -= sim.drag * delta;
  }
  if (braking) {
    sim.speed -= sim.brake * delta;
  }
  if (boost) {
    sim.speed += 34 * delta;
    sim.nitro = Math.max(0, sim.nitro - 28 * delta);
  } else {
    sim.nitro = Math.min(100, sim.nitro + 14 * delta);
  }

  sim.speed = THREE.MathUtils.clamp(sim.speed, sim.minSpeed, maxSpeed);

  const steerInput = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
  sim.heading += steerInput * sim.steer * delta * (0.3 + sim.speed / 130);
  sim.heading *= 0.98;

  const forward = new THREE.Vector3(Math.sin(sim.heading), 0, -Math.cos(sim.heading));
  sim.worldPos.addScaledVector(forward, sim.speed * delta);

  const roadClamp = HALF_ROAD - 1.3;
  sim.worldPos.x = THREE.MathUtils.clamp(sim.worldPos.x, -roadClamp - 1.5, roadClamp + 1.5);
  if (Math.abs(sim.worldPos.x) > roadClamp) {
    sim.speed = Math.max(sim.speed - 36 * delta, 0);
  }

  sim.distance += (sim.speed * delta) / 1000;

  playerCar.position.x += (sim.worldPos.x - playerCar.position.x) * Math.min(1, 8 * delta);
  playerCar.rotation.y += (-sim.heading - playerCar.rotation.y) * Math.min(1, 7 * delta);

  const camOffset = new THREE.Vector3(0, 7, 15).applyAxisAngle(new THREE.Vector3(0, 1, 0), -sim.heading * 0.35);
  const camTarget = new THREE.Vector3(playerCar.position.x, 1.4, -12);
  camera.position.lerp(camTarget.clone().add(camOffset), Math.min(1, 4 * delta));
  camera.lookAt(camTarget);

  worldRoot.position.set(-sim.worldPos.x, 0, sim.worldPos.z);
}

function updateTraffic(delta) {
  while (-sim.worldPos.z - sim.lastSpawnZ > 38) {
    sim.lastSpawnZ -= 38;
    spawnTraffic(sim.lastSpawnZ - 140 - Math.random() * 110);
  }

  for (let i = trafficCars.length - 1; i >= 0; i -= 1) {
    const t = trafficCars[i];
    t.position.z += t.userData.speed * delta;

    const dz = t.position.z - (-sim.worldPos.z);
    if (!t.userData.nearMiss && dz > -3 && dz < 2.6 && Math.abs(t.position.x - sim.worldPos.x) < 2.7) {
      t.userData.nearMiss = true;
      sim.nearMisses += 1;
    }

    const collision = Math.abs(t.position.x - sim.worldPos.x) < 1.75 && Math.abs(dz) < 2.8;
    if (collision) {
      sim.running = false;
      statusEl.textContent = `Crash! Distance ${sim.distance.toFixed(2)} km. Press Space to restart.`;
    }

    if (t.position.z > -sim.worldPos.z + 45) {
      scene.remove(t);
      trafficCars.splice(i, 1);
    }
  }
}

function updateHUD() {
  speedEl.textContent = Math.round(sim.speed * 3.1).toString();
  distanceEl.textContent = sim.distance.toFixed(2);
  scoreEl.textContent = sim.nearMisses.toString();
  nitroEl.textContent = Math.round(sim.nitro).toString();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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
