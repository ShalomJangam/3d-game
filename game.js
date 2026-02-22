import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("game");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 140);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 8, 18);

const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(20, 40, 10);
sun.castShadow = true;
scene.add(sun);

const roadGroup = new THREE.Group();
scene.add(roadGroup);

const laneWidth = 4;
const laneCount = 3;
const roadWidth = laneWidth * laneCount;

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x2f2f2f });
for (let i = 0; i < 10; i += 1) {
  const segment = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.2, 25), roadMaterial);
  segment.position.z = -i * 25;
  segment.receiveShadow = true;
  roadGroup.add(segment);
}

const laneMarkerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
for (let i = 0; i < 45; i += 1) {
  for (let lane = 1; lane < laneCount; lane += 1) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 1.5), laneMarkerMaterial);
    marker.position.set(-roadWidth / 2 + lane * laneWidth, 0.15, -i * 4);
    roadGroup.add(marker);
  }
}

const grass = new THREE.Mesh(
  new THREE.BoxGeometry(220, 0.1, 260),
  new THREE.MeshStandardMaterial({ color: 0x2f7d32 })
);
grass.position.y = -0.2;
grass.position.z = -70;
grass.receiveShadow = true;
scene.add(grass);

function createCar(bodyColor = 0x1e90ff) {
  const car = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.8, 4),
    new THREE.MeshStandardMaterial({ color: bodyColor })
  );
  base.castShadow = true;
  car.add(base);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.8, 2),
    new THREE.MeshStandardMaterial({ color: 0xddeeff })
  );
  cabin.position.set(0, 0.7, -0.1);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.6, 18);
  for (const [x, z] of [
    [0.95, 1.2],
    [-0.95, 1.2],
    [0.95, -1.2],
    [-0.95, -1.2],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.35, z);
    wheel.castShadow = true;
    car.add(wheel);
  }

  return car;
}

const playerCar = createCar(0x1e90ff);
playerCar.position.set(0, 0.65, 8);
scene.add(playerCar);

const laneCenters = [
  -laneWidth,
  0,
  laneWidth,
];

let targetLane = 1;
let playerLane = 1;
const enemies = [];
let spawnClock = 0;
let gameSpeed = 22;
let score = 0;
let gameState = "idle";

const keys = new Set();
window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "Space" && gameState !== "running") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

function resetGame() {
  score = 0;
  spawnClock = 0;
  gameSpeed = 22;
  targetLane = 1;
  playerLane = 1;
  playerCar.position.x = laneCenters[1];

  for (const enemy of enemies) {
    scene.remove(enemy);
  }
  enemies.length = 0;

  gameState = "running";
  statusEl.textContent = "Go!";
  scoreEl.textContent = "0";
}

function spawnEnemy() {
  const lane = Math.floor(Math.random() * laneCenters.length);
  const enemy = createCar(0xcc3322);
  enemy.position.set(laneCenters[lane], 0.65, -120);
  enemy.userData = { lane, passed: false };
  scene.add(enemy);
  enemies.push(enemy);
}

function moveRoad(delta) {
  roadGroup.position.z += gameSpeed * delta;
  if (roadGroup.position.z >= 25) {
    roadGroup.position.z -= 25;
  }
}

function updatePlayer(delta) {
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    targetLane = Math.max(0, targetLane - 1);
    keys.delete("ArrowLeft");
    keys.delete("KeyA");
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    targetLane = Math.min(laneCenters.length - 1, targetLane + 1);
    keys.delete("ArrowRight");
    keys.delete("KeyD");
  }

  const destinationX = laneCenters[targetLane];
  const offset = destinationX - playerCar.position.x;
  playerCar.position.x += offset * Math.min(1, 12 * delta);

  if (Math.abs(offset) < 0.08) {
    playerCar.position.x = destinationX;
    playerLane = targetLane;
  }
}

function updateEnemies(delta) {
  spawnClock += delta;
  if (spawnClock > 0.8) {
    spawnEnemy();
    spawnClock = 0;
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.position.z += gameSpeed * delta;

    if (!enemy.userData.passed && enemy.position.z > playerCar.position.z + 1) {
      enemy.userData.passed = true;
      score += 10;
      gameSpeed = Math.min(40, gameSpeed + 0.2);
      scoreEl.textContent = String(score);
    }

    if (enemy.position.distanceTo(playerCar.position) < 2.2) {
      gameState = "over";
      statusEl.textContent = `Crashed! Final score: ${score}. Press Space to restart.`;
    }

    if (enemy.position.z > 25) {
      scene.remove(enemy);
      enemies.splice(i, 1);
    }
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function tick() {
  const delta = clock.getDelta();

  if (gameState === "running") {
    moveRoad(delta);
    updatePlayer(delta);
    updateEnemies(delta);
  }

  camera.position.x += (playerCar.position.x * 0.6 - camera.position.x) * Math.min(1, 4 * delta);
  camera.lookAt(playerCar.position.x * 0.4, 1, -20);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
