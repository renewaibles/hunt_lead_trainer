// --- Mapping for Iron Sights Models ---
const ironSightsModelMap = {
  model1: "model1.png",
  model2: "model2.png",
  model3: "model3.png"
};

// --- Mapping for Scope Zoom Factors ---
const scopeZoomFactors = {
  ironSights: 2.04,
  deadeye: 5,
  marksman: 8.46,
  sniper: 11,
  aperture: 6.25
};

// --- Settings and Persistence ---
let settings = {
  sensitivity: 0.0015,
  maxDistance: 100,
  numTargets: 10,
  muzzleVelocity: 400,
  targetMaxSpeed: 5,
  targetAcceleration: 5,
  targetSteerAccel: 5,
  playerHeight: 1.8,
  showDistance: true,
  hardMode: false,
  strafeIntensity: 1.0,
  strafeFrequency: 1.0,
  ironSightsModel: "model1",
  ironSightsScale: 1.0,
  scopeType: "ironSights"
};

function loadSettings() {
  let stored = localStorage.getItem('shooterConfig');
  if (stored) { settings = JSON.parse(stored); }
}
function saveSettings() {
  localStorage.setItem('shooterConfig', JSON.stringify(settings));
}
loadSettings();

// --- Global Variables ---
let scene, camera, renderer;
let yawObject, pitchObject;
let targets = [];
let bullets = [];
let score = 0;
let lastTime = performance.now();
let paused = false;

// For pointer lock aiming
const mouse = new THREE.Vector2(0, 0);
let yaw = 0, pitch = 0;

// --- DOM Elements ---
const pauseMenu = document.getElementById("pauseMenu");
const sensitivityInput = document.getElementById("sensitivityInput");
const maxDistanceInput = document.getElementById("maxDistanceInput");
const numTargetsInput = document.getElementById("numTargetsInput");
const muzzleVelocityInput = document.getElementById("muzzleVelocityInput");
const targetMaxSpeedInput = document.getElementById("targetMaxSpeedInput");
const targetAccelerationInput = document.getElementById("targetAccelerationInput");
const targetSteerAccelInput = document.getElementById("targetSteerAccelInput");
const playerHeightInput = document.getElementById("playerHeightInput");
const showDistanceInput = document.getElementById("showDistanceInput");
const hardModeInput = document.getElementById("hardModeInput");
const strafeIntensityInput = document.getElementById("strafeIntensityInput");
const strafeFrequencyInput = document.getElementById("strafeFrequencyInput");
const scopeTypeSelect = document.getElementById("scopeTypeSelect");
const ironSightsPreviewImg = document.getElementById("ironSightsPreviewImg");
const ironSightsScaleInput = document.getElementById("ironSightsScaleInput");
const saveSettingsButton = document.getElementById("saveSettings");
const resumeGameButton = document.getElementById("resumeGame");
const hitMarker = document.getElementById("hitMarker");
const ironSightsImg = document.getElementById("ironSightsImg");

function updatePauseMenuInputs() {
  sensitivityInput.value = settings.sensitivity;
  maxDistanceInput.value = settings.maxDistance;
  numTargetsInput.value = settings.numTargets;
  muzzleVelocityInput.value = settings.muzzleVelocity;
  targetMaxSpeedInput.value = settings.targetMaxSpeed;
  targetAccelerationInput.value = settings.targetAcceleration;
  targetSteerAccelInput.value = settings.targetSteerAccel;
  playerHeightInput.value = settings.playerHeight;
  showDistanceInput.checked = settings.showDistance;
  hardModeInput.checked = settings.hardMode;
  strafeIntensityInput.value = settings.strafeIntensity;
  strafeFrequencyInput.value = settings.strafeFrequency;
  scopeTypeSelect.value = settings.scopeType;
  ironSightsScaleInput.value = settings.ironSightsScale;
  
  // Update preview for iron sights/aperture scopes
  if (settings.scopeType === "ironSights" || settings.scopeType === "aperture") {
    document.getElementById("ironSightsPreview").style.display = "block";
    ironSightsPreviewImg.src = ironSightsModelMap[settings.ironSightsModel];
    ironSightsPreviewImg.style.transform = "translate(-50%, -50%) scale(" + settings.ironSightsScale + ")";
  } else {
    document.getElementById("ironSightsPreview").style.display = "none";
  }
}

// Listen for scope type changes
scopeTypeSelect.addEventListener("change", function() {
  settings.scopeType = this.value;
  updatePauseMenuInputs();
});

// Save settings when button is clicked
saveSettingsButton.addEventListener("click", function() {
  settings.sensitivity = parseFloat(sensitivityInput.value);
  settings.maxDistance = parseFloat(maxDistanceInput.value);
  settings.numTargets = parseInt(numTargetsInput.value);
  settings.muzzleVelocity = parseFloat(muzzleVelocityInput.value);
  settings.targetMaxSpeed = parseFloat(targetMaxSpeedInput.value);
  settings.targetAcceleration = parseFloat(targetAccelerationInput.value);
  settings.targetSteerAccel = parseFloat(targetSteerAccelInput.value);
  settings.playerHeight = parseFloat(playerHeightInput.value);
  settings.showDistance = showDistanceInput.checked;
  settings.hardMode = hardModeInput.checked;
  settings.strafeIntensity = parseFloat(strafeIntensityInput.value);
  settings.strafeFrequency = parseFloat(strafeFrequencyInput.value);
  settings.scopeType = scopeTypeSelect.value;
  settings.ironSightsScale = parseFloat(ironSightsScaleInput.value);
  saveSettings();
  
  if (yawObject) {
    yawObject.position.y = settings.playerHeight;
  }
  // Update iron sights overlay scale if used
  ironSightsImg.style.transform = "translate(-50%, 0) scale(" + settings.ironSightsScale + ")";
});

resumeGameButton.addEventListener("click", togglePause);

// Toggle pause menu with ESC key
document.addEventListener('keydown', function(e) {
  if (e.key === "Escape") { togglePause(); }
});
function togglePause() {
  paused = !paused;
  pauseMenu.style.display = paused ? "block" : "none";
  if (paused) { updatePauseMenuInputs(); }
}

// --- Text Sprite Functions (for distance labels) ---
function createTextSprite(message) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.font = "32px Arial Bold";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 4;
  context.strokeStyle = "black";
  context.strokeText(message, canvas.width / 2, canvas.height / 2);
  context.fillStyle = "white";
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, sizeAttenuation: false });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(0.1, 0.05, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.context = context;
  sprite.userData.texture = texture;
  return sprite;
}
function updateTextSprite(sprite, message) {
  const canvas = sprite.userData.canvas;
  const context = sprite.userData.context;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "32px Arial Bold";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 4;
  context.strokeStyle = "black";
  context.strokeText(message, canvas.width / 2, canvas.height / 2);
  context.fillStyle = "white";
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  sprite.userData.texture.needsUpdate = true;
}

// --- Hit Marker Function ---
function showHitMarker() {
  hitMarker.style.display = "block";
  setTimeout(() => {
    hitMarker.style.display = "none";
  }, 1000);
}

// --- Initialization ---
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  camera = new THREE.PerspectiveCamera(94, window.innerWidth / window.innerHeight, 0.1, 1000);
  yawObject = new THREE.Object3D();
  pitchObject = new THREE.Object3D();
  yawObject.add(pitchObject);
  pitchObject.add(camera);
  yawObject.position.set(0, settings.playerHeight, 5);
  scene.add(yawObject);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 1, 1);
  scene.add(directionalLight);

  const gridSize = 200;
  const gridHelper = new THREE.GridHelper(gridSize, 50, 0x00ffff, 0x00ffff);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Request pointer lock and shoot on left-click.
  renderer.domElement.addEventListener('click', function(e) {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
      return;
    }
    shootBullet();
  }, false);

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('mousedown', onMouseDown, false);
  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('resize', onWindowResize, false);

  animate();
}

// --- Target (Person) Creation ---
function createTarget() {
  const targetGroup = new THREE.Group();

  const bodyGeometry = new THREE.SphereGeometry(0.15, 32, 32);
  const bodyScaleY = 1.5 / 0.3;
  bodyGeometry.scale(1.2, bodyScaleY, 1.2);
  bodyGeometry.translate(0, 0.15 * bodyScaleY, 0);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);

  const headGeometry = new THREE.SphereGeometry(0.15, 32, 32);
  const headMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);
  headMesh.name = "head";
  headMesh.position.y = 1.5 + 0.15;

  const helperGeometry = new THREE.SphereGeometry(0.18, 16, 16);
  const helperMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
  const headHelper = new THREE.Mesh(helperGeometry, helperMaterial);
  headHelper.name = "headHelper";
  headMesh.add(headHelper);

  targetGroup.add(bodyMesh);
  targetGroup.add(headMesh);

  let distance = 10 + Math.random() * (settings.maxDistance - 10);
  let angle = Math.random() * Math.PI * 2;
  let x = distance * Math.cos(angle);
  let z = distance * Math.sin(angle);
  targetGroup.position.set(x, 0, z);

  let sprintAngle = Math.random() * Math.PI * 2;
  targetGroup.userData.velocity = new THREE.Vector3(Math.cos(sprintAngle), 0, Math.sin(sprintAngle))
                                    .multiplyScalar(settings.targetMaxSpeed);

  return targetGroup;
}
function spawnTarget() {
  const target = createTarget();
  targets.push(target);
  scene.add(target);
}
function maintainTargets() {
  while (targets.length < settings.numTargets) {
    spawnTarget();
  }
}

// --- Shooting and Collision Detection ---
function shootBullet() {
  const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  let bulletStart = new THREE.Vector3();
  camera.getWorldPosition(bulletStart);
  bullet.position.copy(bulletStart);
  bullet.userData.prevPosition = bullet.position.clone();
  let bulletDirection = new THREE.Vector3();
  camera.getWorldDirection(bulletDirection);
  bullet.userData.velocity = bulletDirection.multiplyScalar(settings.muzzleVelocity);
  bullets.push(bullet);
  scene.add(bullet);
}
function lineSphereIntersection(p0, p1, center, radius) {
  let d = p1.clone().sub(p0);
  let f = p0.clone().sub(center);
  let a = d.dot(d);
  let b = 2 * f.dot(d);
  let c = f.dot(f) - radius * radius;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) { return false; }
  discriminant = Math.sqrt(discriminant);
  let t1 = (-b - discriminant) / (2 * a);
  let t2 = (-b + discriminant) / (2 * a);
  return ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1));
}

// --- Event Handlers ---
function onMouseMove(event) {
  if (document.pointerLockElement === renderer.domElement) {
    const sensitivity = settings.sensitivity;
    yaw -= event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    yawObject.rotation.y = yaw;
    pitchObject.rotation.x = pitch;
  }
}
function onMouseDown(event) {
  if (event.button === 2) {
    let zoomValue = scopeZoomFactors[settings.scopeType];
    camera.zoom = zoomValue;
    camera.updateProjectionMatrix();
    
    if (settings.scopeType === "ironSights" || settings.scopeType === "aperture") {
      ironSightsImg.src = ironSightsModelMap[settings.ironSightsModel];
      ironSightsImg.style.transform = "translate(-50%, 0) scale(" + settings.ironSightsScale + ")";
      document.getElementById("ironSights").style.display = "block";
      document.getElementById("crosshair").style.display = "none";
    } else {
      document.getElementById("crosshair").style.display = "block";
      document.getElementById("ironSights").style.display = "none";
    }
  }
}
function onMouseUp(event) {
  if (event.button === 2) {
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    document.getElementById("ironSights").style.display = "none";
    document.getElementById("crosshair").style.display = "block";
  }
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Main Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  let currentTime = performance.now();
  let dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    let prevPos = bullet.userData.prevPosition.clone();
    bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(dt));
    for (let j = targets.length - 1; j >= 0; j--) {
      let target = targets[j];
      let head = target.getObjectByName("head");
      let headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);
      if (lineSphereIntersection(prevPos, bullet.position, headWorldPos, 0.15)) {
        score++;
        document.getElementById('score').textContent = 'Score: ' + score;
        showHitMarker();
        scene.remove(bullet);
        bullets.splice(i, 1);
        scene.remove(target);
        targets.splice(j, 1);
        break;
      }
    }
    bullet.userData.prevPosition.copy(bullet.position);
    if (bullet.position.distanceTo(camera.position) > 1000) {
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }

  for (let i = targets.length - 1; i >= 0; i--) {
    let target = targets[i];
    let v = target.userData.velocity;
    const acceleration = settings.targetAcceleration;
    let randomAccel = new THREE.Vector3(
      (Math.random() - 0.5) * acceleration * dt,
      0,
      (Math.random() - 0.5) * acceleration * dt
    );
    v.add(randomAccel);

    if (settings.hardMode) {
      let perpendicular = new THREE.Vector3(-v.z, 0, v.x);
      if (perpendicular.length() === 0) { perpendicular.set(1, 0, 0); }
      perpendicular.normalize();
      let timeSeconds = performance.now() / 1000;
      let strafeAccel = perpendicular.multiplyScalar(Math.sin(timeSeconds * settings.strafeFrequency) * settings.strafeIntensity * dt);
      v.add(strafeAccel);
    }

    if (v.length() > settings.targetMaxSpeed) v.setLength(settings.targetMaxSpeed);
    if (target.position.length() > settings.maxDistance) {
      let inward = target.position.clone().negate().normalize();
      const steerAccel = settings.targetSteerAccel;
      v.add(inward.multiplyScalar(steerAccel * dt));
    }
    target.userData.velocity = v;
    target.position.add(v.clone().multiplyScalar(dt));

    if (settings.showDistance) {
      let distance = camera.position.distanceTo(target.position).toFixed(1);
      if (!target.userData.distanceLabel) {
        let label = createTextSprite(distance + " m");
        label.position.set(0, 2.75, 0);
        target.add(label);
        target.userData.distanceLabel = label;
      } else {
        updateTextSprite(target.userData.distanceLabel, distance + " m");
      }
    } else if (target.userData.distanceLabel) {
      target.remove(target.userData.distanceLabel);
      delete target.userData.distanceLabel;
    }
  }

  maintainTargets();
  renderer.render(scene, camera);
}

init();
