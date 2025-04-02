// --- Mapping for Iron Sights Models ---
const ironSightsModelMap = {
  model1: "source/model1.png",
  model2: "source/model2.png",
  model3: "source/model3.png"
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
  sensitivity: 0.001,
  maxDistance: 100,
  numTargets: 10,
  muzzleVelocity: 400,
  targetMaxSpeed: 5,
  playerHeight: 10,
  showDistance: true,
  hardMode: false,
  strafeIntensity: 15.0,
  strafeFrequency: 10.0,
  ironSightsModel: "model1",
  ironSightsScale: 0.5,
  scopeType: "ironSights"
};

const TARGET_ACCELERATION = 5;
const TARGET_STEER_ACCEL = 5;

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

// Accuracy tracking variables
let shotsFired = 0;
let headshotCount = 0;
let bodyshotCount = 0;
let missCount = 0;

// For smooth player height movement
let moveUp = false;
let moveDown = false;

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
const playerHeightInput = document.getElementById("playerHeightInput");
const showDistanceInput = document.getElementById("showDistanceInput");
const hardModeInput = document.getElementById("hardModeInput");
const strafeIntensityInput = document.getElementById("strafeIntensityInput");
const strafeFrequencyInput = document.getElementById("strafeFrequencyInput");
const scopeTypeSelect = document.getElementById("scopeTypeSelect");
const ironSightsModelSelect = document.getElementById("ironSightsModelSelect");
const ironSightsPreviewImg = document.getElementById("ironSightsPreviewImg");
const ironSightsScaleInput = document.getElementById("ironSightsScaleInput");
const saveSettingsButton = document.getElementById("saveSettings");
const resumeGameButton = document.getElementById("resumeGame");
const hitMarker = document.getElementById("hitMarker");
const ironSightsImg = document.getElementById("ironSightsImg");

// Accuracy display element
const accuracyDisplay = document.getElementById("accuracy");

function updatePauseMenuInputs() {
  sensitivityInput.value = settings.sensitivity;
  maxDistanceInput.value = settings.maxDistance;
  numTargetsInput.value = settings.numTargets;
  muzzleVelocityInput.value = settings.muzzleVelocity;
  targetMaxSpeedInput.value = settings.targetMaxSpeed;
  playerHeightInput.value = settings.playerHeight;
  showDistanceInput.checked = settings.showDistance;
  hardModeInput.checked = settings.hardMode;
  strafeIntensityInput.value = settings.strafeIntensity;
  strafeFrequencyInput.value = settings.strafeFrequency;
  scopeTypeSelect.value = settings.scopeType;
  ironSightsScaleInput.value = settings.ironSightsScale;
  ironSightsModelSelect.value = settings.ironSightsModel;

  if (settings.scopeType === "ironSights" || settings.scopeType === "aperture") {
    document.getElementById("ironSightsPreview").style.display = "block";
    ironSightsPreviewImg.src = ironSightsModelMap[settings.ironSightsModel];
    ironSightsPreviewImg.style.transform = "translate(-50%, -50%) scale(" + settings.ironSightsScale + ")";
  } else {
    document.getElementById("ironSightsPreview").style.display = "none";
  }
}

scopeTypeSelect.addEventListener("change", function() {
  settings.scopeType = this.value;
  updatePauseMenuInputs();
});

ironSightsModelSelect.addEventListener("change", function() {
  settings.ironSightsModel = this.value;
  updatePauseMenuInputs();
});

saveSettingsButton.addEventListener("click", function() {
  settings.sensitivity = parseFloat(sensitivityInput.value);
  settings.maxDistance = parseFloat(maxDistanceInput.value);
  settings.numTargets = parseInt(numTargetsInput.value);
  settings.muzzleVelocity = parseFloat(muzzleVelocityInput.value);
  settings.targetMaxSpeed = parseFloat(targetMaxSpeedInput.value);
  settings.playerHeight = parseFloat(playerHeightInput.value);
  settings.showDistance = showDistanceInput.checked;
  settings.hardMode = hardModeInput.checked;
  settings.strafeIntensity = parseFloat(strafeIntensityInput.value);
  settings.strafeFrequency = parseFloat(strafeFrequencyInput.value);
  settings.scopeType = scopeTypeSelect.value;
  settings.ironSightsScale = parseFloat(ironSightsScaleInput.value);
  settings.ironSightsModel = ironSightsModelSelect.value;
  saveSettings();

  if (yawObject) {
    yawObject.position.y = settings.playerHeight;
  }
  ironSightsImg.style.transform = "scale(" + settings.ironSightsScale + ")";
});

resumeGameButton.addEventListener("click", togglePause);

document.addEventListener('keydown', function(e) {
  if (e.key === "Escape") { togglePause(); }
  if (e.code === "Space") { moveUp = true; }
  if (e.key === "Control") { moveDown = true; }
});
document.addEventListener('keyup', function(e) {
  if (e.code === "Space") { moveUp = false; }
  if (e.key === "Control") { moveDown = false; }
});

function togglePause() {
  paused = !paused;
  pauseMenu.style.display = paused ? "block" : "none";
  if (paused) { updatePauseMenuInputs(); }
}

function updateAccuracyDisplay() {
  if (shotsFired > 0) {
    let headPercent = ((headshotCount / shotsFired) * 100).toFixed(1);
    let bodyPercent = ((bodyshotCount / shotsFired) * 100).toFixed(1);
    let missPercent = ((missCount / shotsFired) * 100).toFixed(1);
    accuracyDisplay.textContent = 'Accuracy: H: ' + headPercent + '% | B: ' + bodyPercent + '% | M: ' + missPercent + '%';
  }
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

  // --- Body (broadened) ---
  const bodyGeometry = new THREE.SphereGeometry(0.15, 32, 32);
  const bodyScaleY = 1.5 / 0.3;
  // Increase the X and Z scale to make the body broader
  bodyGeometry.scale(1.5, bodyScaleY, 1.5);
  bodyGeometry.translate(0, 0.15 * bodyScaleY, 0);

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.name = "body";  // So we can reference it for collisions

  // --- Head ---
  const headGeometry = new THREE.SphereGeometry(0.13, 32, 32);
  const headMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
  const headMesh = new THREE.Mesh(headGeometry, headMaterial);
  headMesh.name = "head";
  headMesh.position.y = 1.5 + 0.15;

  const helperGeometry = new THREE.SphereGeometry(0.15,  15, 15);
  const helperMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
  const headHelper = new THREE.Mesh(helperGeometry, helperMaterial);
  headHelper.name = "headHelper";
  headMesh.add(headHelper);

  targetGroup.add(bodyMesh);
  targetGroup.add(headMesh);

  // Initial body hit count
  targetGroup.userData.bodyHits = 0;

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

  // Count this shot
  shotsFired++;
  updateAccuracyDisplay();
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
function lineCapsuleIntersection(p0, p1, capsuleStart, capsuleEnd, radius) {
  // p0, p1: endpoints of the bullet's line segment
  // capsuleStart, capsuleEnd: endpoints of the capsule (torso hitbox)
  // radius: radius of the capsule

  let d = p1.clone().sub(p0);        // Bullet direction vector.
  let n = capsuleEnd.clone().sub(capsuleStart); // Capsule central axis.

  // m is the vector from the capsule start to the bullet start.
  let m = p0.clone().sub(capsuleStart);

  // Precompute dot products.
  let dd = d.dot(d);
  let nn = n.dot(n);
  let nd = n.dot(d);
  let mn = m.dot(n);
  let md = m.dot(d);

  // Compute the denominator of the parameters.
  let denom = dd * nn - nd * nd;
  let t, s;

  // Compute the parameter t (for the bullet line)
  if (denom !== 0) {
    t = (nd * mn - nn * md) / denom;
  } else {
    t = 0;
  }

  // Clamp t to [0, 1] to ensure it is within the bullet's segment.
  t = Math.max(0, Math.min(1, t));

  // Compute the parameter s (for the capsule line)
  s = (t * nd + mn) / nn;
  // Clamp s to [0, 1] so it falls on the capsule segment.
  s = Math.max(0, Math.min(1, s));

  // Recompute t given the clamped s, if the lines aren't parallel.
  if (denom !== 0) {
    t = (s * nd - md) / dd;
    t = Math.max(0, Math.min(1, t));
  }

  // Find the closest points on each segment.
  let closestPointLine = p0.clone().add(d.clone().multiplyScalar(t));
  let closestPointCapsule = capsuleStart.clone().add(n.clone().multiplyScalar(s));

  // If the distance between these two points is within the radius, there's an intersection.
  let distSquared = closestPointLine.distanceToSquared(closestPointCapsule);
  return distSquared <= radius * radius;
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
      ironSightsImg.style.transform = "scale(" + settings.ironSightsScale + ")";
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

  // Smooth vertical movement
  if (moveUp) {
    yawObject.position.y += 5 * dt;
    settings.playerHeight = yawObject.position.y;
  }
  if (moveDown) {
    yawObject.position.y -= 5 * dt;
    settings.playerHeight = yawObject.position.y;
  }

  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    let bullet = bullets[i];
    let prevPos = bullet.userData.prevPosition.clone();
    bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(dt));

    // Check collision with each target
    for (let j = targets.length - 1; j >= 0; j--) {
      let target = targets[j];
      let head = target.getObjectByName("head");
      let headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      // Check for headshot (instant kill)
      if (lineSphereIntersection(prevPos, bullet.position, headWorldPos, 0.15)) {
        headshotCount++;
        score++;
        document.getElementById('score').textContent = 'Score: ' + score;
        showHitMarker();
        scene.remove(bullet);
        bullets.splice(i, 1);
        scene.remove(target);
        targets.splice(j, 1);
        updateAccuracyDisplay();
        break;
      } else {
        // Check for body shot (needs 2 hits to kill)
        let body = target.getObjectByName("body");
        if (body) {
          let bodyWorldPos = new THREE.Vector3();
          body.getWorldPosition(bodyWorldPos);
          let capsuleStart = target.position.clone().add(new THREE.Vector3(0, 0.1, 0)); // lower torso
          let capsuleEnd = target.position.clone().add(new THREE.Vector3(0, 1.33, 0));  // upper torso
          let capsuleRadius = 0.25;  // Adjust this based on your target's dimensions.
          if (lineCapsuleIntersection(prevPos, bullet.position, capsuleStart, capsuleEnd, capsuleRadius)) {
            bodyshotCount++;
            target.userData.bodyHits = (target.userData.bodyHits || 0) + 1;
            showHitMarker();
            scene.remove(bullet);
            bullets.splice(i, 1);
            if (target.userData.bodyHits >= 2) {
              score++;
              document.getElementById('score').textContent = 'Score: ' + score;
              scene.remove(target);
              targets.splice(j, 1);
            }
            updateAccuracyDisplay();
            break;
          }
        }
      }
    }
    bullet.userData.prevPosition.copy(bullet.position);
    if (bullet.position.distanceTo(camera.position) > 1000) {
      // Count as a miss if the bullet goes too far without hitting a target
      missCount++;
      updateAccuracyDisplay();
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }

  // Update targets movement
  for (let i = targets.length - 1; i >= 0; i--) {
    let target = targets[i];
    let v = target.userData.velocity;
    const acceleration = TARGET_ACCELERATION;
    let randomAccel = new THREE.Vector3(
      (Math.random() - 0.5) * acceleration * dt,
      0,
      (Math.random() - 0.5) * acceleration * dt
    );
    v.add(randomAccel);

    if (settings.hardMode) {
      let currentTime = performance.now() / 1000;
      if (!target.userData.nextStrafeTime || currentTime >= target.userData.nextStrafeTime) {
        let perpendicular = new THREE.Vector3(-v.z, 0, v.x);
        if (perpendicular.length() === 0) {
          perpendicular.set(1, 0, 0);
        }
        perpendicular.normalize();
        if (Math.random() < 0.5) {
          perpendicular.negate();
        }
        target.userData.strafeDirection = perpendicular;
        target.userData.nextStrafeTime = currentTime + (0.5 + Math.random());
      }
      let randomFactor = 0.5 + Math.random();
      let strafeAccel = target.userData.strafeDirection.clone()
                         .multiplyScalar(settings.strafeIntensity * dt * randomFactor);
      v.add(strafeAccel);
    }

    if (v.length() > settings.targetMaxSpeed) v.setLength(settings.targetMaxSpeed);
    if (target.position.length() > settings.maxDistance) {
      let inward = target.position.clone().negate().normalize();
      const steerAccel = TARGET_STEER_ACCEL;
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
