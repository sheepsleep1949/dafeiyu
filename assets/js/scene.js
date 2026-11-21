import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadWhaleGirl } from './character.js';

/* ------------------------------------------------------------------ *
 * 大肥鱼 · 3D 场景
 * 全部几何体在运行时生成，没有外部模型文件。
 * ------------------------------------------------------------------ */

const C = {
  body: 0x4d6bfe,
  bodyDark: 0x3a54d6,
  fin: 0x3a54d6,
  finLight: 0x6a86ff,
  belly: 0xf7faff,
  cream: 0xfff1de,
  ink: 0x1b2a3a,
  desk: 0xffdcbf,
  deskEdge: 0xf0c6a4,
  monitor: 0xf7f9fc,
  key: 0xfbfdfb,
  mint: 0xbfe6d6,
  coral: 0xff8a5c,
  pink: 0xffb3c1,
  bubble: 0xd6efff,
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clay(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.54,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.7,
    sheen: 0.28,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0xffffff),
    ...extra,
  });
}

function roundedBoxGeo(w, h, d, r = 0.05, seg = 4) {
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.min(r, hw * 0.9, hh * 0.9);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + rr, -hh);
  shape.lineTo(hw - rr, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + rr);
  shape.lineTo(hw, hh - rr);
  shape.quadraticCurveTo(hw, hh, hw - rr, hh);
  shape.lineTo(-hw + rr, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - rr);
  shape.lineTo(-hw, -hh + rr);
  shape.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);

  const depth = Math.max(0.01, d - rr * 1.6);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: rr * 0.8,
    bevelSize: rr * 0.8,
    bevelSegments: Math.min(5, seg + 1),
    curveSegments: 10,
    steps: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* 屏幕内容：抽象色块，不出现可读文字 */
function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 440;
  const ctx = c.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, 440);
  bg.addColorStop(0, '#dcf3ff');
  bg.addColorStop(1, '#f6fcff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 440);

  ctx.fillStyle = 'rgba(180, 224, 255, .9)';
  ctx.fillRect(0, 0, 768, 44);
  ['#ff9c8a', '#ffd479', '#7fd6a8'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(24 + i * 25, 22, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(0, 44, 142, 396);
  ctx.fillStyle = 'rgba(150, 205, 240, .55)';
  for (let i = 0; i < 5; i += 1) {
    roundRect(ctx, 18, 72 + i * 54, 104, 15, 7);
    ctx.fill();
  }

  const cols = ['#8fc8ef', '#ffd2bd', '#b8e6cf', '#c9b8f0', '#ffd9a8'];
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = cols[i % cols.length];
    const w = 220 + ((i * 47) % 190);
    roundRect(ctx, 168 + (i % 2) * 34, 74 + i * 44, w, 14, 7);
    ctx.fill();
  }

  ctx.strokeStyle = '#7fb8e6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 1) {
    const x = 180 + i * 50;
    const y = 330 - Math.sin(i * 0.9) * 46 - (i % 3) * 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(74, 144, 217, .22)';
  ctx.beginPath();
  ctx.ellipse(640, 366, 50, 30, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(690, 366);
  ctx.lineTo(716, 348);
  ctx.lineTo(716, 384);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(74, 144, 217, .55)';
  ctx.beginPath();
  ctx.arc(626, 358, 6, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.35, 'rgba(190,233,255,.6)');
  g.addColorStop(1, 'rgba(190,233,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function makeBlobShadow() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 126);
  g.addColorStop(0, 'rgba(58,44,32,.55)');
  g.addColorStop(0.55, 'rgba(58,44,32,.24)');
  g.addColorStop(1, 'rgba(58,44,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.05);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.25;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 5.4;
  controls.maxDistance = 11.5;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.72;
  // 水平方向不再限位：可以 360° 转一圈看背面
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;

  /* ---------------- 灯光 ---------------- */
  const hemi = new THREE.HemisphereLight(0xdceeff, 0xffe2c6, 0.6);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-5, 7.5, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfe6ff, 0.35);
  fill.position.set(5.5, 3.2, 4.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd8bd, 1.25);
  rim.position.set(2.5, 4.2, -5.5);
  scene.add(rim);

  const screenLight = new THREE.PointLight(0x9fd8ff, 6, 6.5, 2);
  screenLight.position.set(-0.7, 1.7, 1.15);
  scene.add(screenLight);

  /* ---------------- 地面阴影 ---------------- */
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 4.6),
    new THREE.MeshBasicMaterial({
      map: makeBlobShadow(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0.2, 0.004, 0.9);
  scene.add(blob);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ color: 0x32465c, opacity: 0.16 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------------- 桌子 ---------------- */
  const desk = new THREE.Group();
  scene.add(desk);

  const deskTop = new THREE.Mesh(roundedBoxGeo(4.55, 0.16, 1.78, 0.08), clay(C.desk, { roughness: 0.62 }));
  deskTop.position.set(0, 0.6, 0.95);
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  desk.add(deskTop);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.062, 0.6, 16);
  const legMat = clay(C.cream, { roughness: 0.62 });
  [[-2.02, 0.34], [2.02, 0.34], [-2.02, 1.56], [2.02, 1.56]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, 0.3, z);
    leg.castShadow = true;
    desk.add(leg);
  });

  // 桌沿一条浅色装饰线
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.035, 0.035),
    clay(C.deskEdge, { roughness: 0.7 }),
  );
  edge.position.set(0, 0.665, 1.83);
  desk.add(edge);

  // 前挡板，避免桌子看起来像悬空的板
  const apron = new THREE.Mesh(roundedBoxGeo(4.24, 0.3, 0.07, 0.03), clay(0xffdfc4, { roughness: 0.68 }));
  apron.position.set(0, 0.37, 1.72);
  apron.castShadow = true;
  apron.receiveShadow = true;
  desk.add(apron);

  /* ---------------- 显示器 ---------------- */
  const monitor = new THREE.Group();
  monitor.position.set(-0.72, 0.68, 0.52);
  monitor.rotation.y = 0.4;
  scene.add(monitor);

  const shellMat = clay(C.monitor, { roughness: 0.42, clearcoat: 0.4 });
  const panel = new THREE.Mesh(roundedBoxGeo(1.92, 1.22, 0.13, 0.07), shellMat);
  panel.position.set(0, 0.96, 0);
  panel.castShadow = true;
  monitor.add(panel);

  const screenTex = makeScreenTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.0),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.set(0, 0.96, 0.07);
  monitor.add(screen);

  const screenGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.0),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  screenGlow.position.set(0, 0.96, 0.12);
  monitor.add(screenGlow);

  const cameraDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x8fa4b8 }),
  );
  cameraDot.position.set(0, 1.5, 0.075);
  monitor.add(cameraDot);

  const neck = new THREE.Mesh(roundedBoxGeo(0.17, 0.4, 0.11, 0.04), shellMat);
  neck.position.set(0, 0.2, -0.02);
  neck.castShadow = true;
  monitor.add(neck);

  const footGeo = roundedBoxGeo(0.78, 0.06, 0.34, 0.06);
  const foot = new THREE.Mesh(footGeo, clay(0xe8edf3, { roughness: 0.5 }));
  foot.position.set(0, 0.03, 0.02);
  foot.castShadow = true;
  foot.receiveShadow = true;
  monitor.add(foot);

  /* ---------------- 键盘 ---------------- */
  const keyboard = new THREE.Group();
  keyboard.position.set(0.95, 0.695, 1.06);
  keyboard.rotation.y = -0.07;
  scene.add(keyboard);

  const kbBase = new THREE.Mesh(roundedBoxGeo(1.42, 0.07, 0.46, 0.035), clay(C.mint, { roughness: 0.55 }));
  kbBase.castShadow = true;
  kbBase.receiveShadow = true;
  keyboard.add(kbBase);

  const keyGeo = roundedBoxGeo(0.085, 0.028, 0.07, 0.012, 2);
  const keyMat = clay(C.key, { roughness: 0.45 });
  const rows = 4;
  const cols = 12;
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, rows * cols);
  const dummy = new THREE.Object3D();
  let ki = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      dummy.position.set(-0.6 + c * 0.109, 0.052, -0.15 + r * 0.096);
      dummy.updateMatrix();
      keys.setMatrixAt(ki, dummy.matrix);
      ki += 1;
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  keyboard.add(keys);

  const spaceKey = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.026, 0.062), keyMat);
  spaceKey.position.set(0.02, 0.053, 0.24);
  keyboard.add(spaceKey);

  /* ---------------- 鼠标 ---------------- */
  const mouse = new THREE.Group();
  mouse.position.set(1.82, 0.7, 1.02);
  scene.add(mouse);
  const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), clay(C.key, { roughness: 0.45 }));
  mouseBody.scale.set(0.085, 0.055, 0.13);
  mouseBody.castShadow = true;
  mouse.add(mouseBody);
  const wheel = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.02, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xb9c6d2 }),
  );
  wheel.position.set(0, 0.052, 0.02);
  mouse.add(wheel);

  /* ---------------- 小道具 ---------------- */
  // 马克杯
  const mug = new THREE.Group();
  mug.position.set(1.62, 0.69, 1.4);
  scene.add(mug);
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, 0.22, 24, 1), clay(0xffffff, { roughness: 0.4 }));
  mugBody.position.y = 0.11;
  mugBody.castShadow = true;
  mug.add(mugBody);
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 24), clay(0x9a6a4a, { roughness: 0.8 }));
  coffee.position.y = 0.2;
  mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 20), clay(0xffffff, { roughness: 0.4 }));
  handle.position.set(0.14, 0.12, 0);
  handle.rotation.y = Math.PI / 2;
  mug.add(handle);
  const steam = new THREE.Group();
  steam.position.set(1.62, 0.92, 1.4);
  scene.add(steam);
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  for (let i = 0; i < 3; i += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), steamMat);
    const s = 0.035 + i * 0.012;
    puff.scale.set(s, s * 1.3, s);
    puff.position.set((i - 1) * 0.03, 0.04 + i * 0.1, 0.02);
    puff.userData.baseX = puff.position.x;
    steam.add(puff);
  }

  // 小盆栽
  const plant = new THREE.Group();
  plant.position.set(1.98, 0.69, 0.42);
  scene.add(plant);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.18, 20), clay(0xe8b08e, { roughness: 0.7 }));
  pot.position.y = 0.09;
  pot.castShadow = true;
  plant.add(pot);
  const leafMat = clay(0x7fbf9a, { roughness: 0.6 });
  [[0, 0.28, 0, 1.2], [-0.1, 0.26, 0.03, 0.9], [0.1, 0.25, -0.02, 0.95]].forEach(([x, y, z, s]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), leafMat);
    leaf.position.set(x, y, z);
    leaf.scale.set(0.06 * s, 0.14 * s, 0.05 * s);
    leaf.rotation.z = x * 2;
    leaf.castShadow = true;
    plant.add(leaf);
  });

  // 便利贴
  const noteGeo = new THREE.PlaneGeometry(0.15, 0.15);
  const noteColors = [0xffd479, 0xffb3c1, 0xa8dcc4];
  noteColors.forEach((col, i) => {
    const note = new THREE.Mesh(
      noteGeo,
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
    );
    note.position.set(-0.55 + i * 0.19, 0.693, 1.42);
    note.rotation.x = -Math.PI / 2;
    note.rotation.z = (i - 1) * 0.18;
    scene.add(note);
  });

  // 笔记本和笔
  const notebook = new THREE.Group();
  notebook.position.set(0.02, 0.702, 1.4);
  notebook.rotation.y = -0.18;
  scene.add(notebook);
  const cover = new THREE.Mesh(roundedBoxGeo(0.38, 0.03, 0.27, 0.02), clay(0xf7e7c9, { roughness: 0.7 }));
  cover.castShadow = true;
  notebook.add(cover);
  const pages = new THREE.Mesh(roundedBoxGeo(0.35, 0.02, 0.24, 0.015), clay(0xffffff, { roughness: 0.85 }));
  pages.position.y = 0.025;
  notebook.add(pages);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 10), clay(0xff9f68, { roughness: 0.4 }));
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.25;
  pen.position.set(0.12, 0.05, 0.0);
  notebook.add(pen);

  // 桌面接触阴影，让道具落地
  const blobTex = makeBlobShadow();  function deskShadow(w, d, x, z, opacity, rot = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, 0.683, z);
    scene.add(m);
  }
  deskShadow(2.1, 0.8, -0.7, 0.48, 0.32, 0.08);
  deskShadow(1.55, 0.62, 0.95, 1.06, 0.24, -0.07);
  deskShadow(0.55, 0.42, 1.82, 1.02, 0.2);
  deskShadow(0.5, 0.5, 1.62, 1.4, 0.18);

  // 屏幕在桌面上的冷光
  const screenPool = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({
      map: makeGlowTexture(),
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  screenPool.rotation.x = -Math.PI / 2;
  screenPool.position.set(-0.5, 0.686, 0.85);
  scene.add(screenPool);

  /* ---------------- 鲸鱼娘 ---------------- */
  const girl = loadWhaleGirl();
  girl.ready.catch((err) => {
    console.error('GLB 角色加载失败：', err);
  });
  girl.group.position.set(0.95, 0.06, -0.52);
  scene.add(girl.group);

  const fish = girl.group;
  const head = girl.head;
  const eyeGroups = girl.eyes;
  const body = girl.body;
  const tailPivot = girl.tail;

  /* ---------------- 配饰 ---------------- */
  const accessories = girl.accessories;

  /* ---------------- 气泡与浮尘 ---------------- */
  const bubbles = [];
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: C.bubble,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.2,
  });
  const bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 9; i += 1) {
    const b = new THREE.Mesh(bubbleGeo, bubbleMat);
    const r = 0.025 + Math.random() * 0.05;
    b.scale.setScalar(r);
    b.position.set(0.2 + Math.random() * 1.5, 0.8 + Math.random() * 1.6, -0.2 + Math.random() * 1.0);
    b.userData = { speed: 0.08 + Math.random() * 0.12, phase: Math.random() * Math.PI * 2, baseX: b.position.x };
    scene.add(b);
    bubbles.push(b);
  }

  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 90;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPos[i * 3] = (Math.random() - 0.5) * 8;
    dustPos[i * 3 + 1] = Math.random() * 3.4;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  scene.add(dust);

  /* ---------------- 交互状态 ---------------- */
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hitTargets = girl.hit;

  let hovered = false;
  let pointerActive = false;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let headX = 0;
  let headY = 0;
  let hopT = -1;
  let nextBlink = 2.2;
  let blinkStart = -10;
  let tailBoost = 0;
  let accessoryBoost = 0;
  let running = true;
  let elapsed = 0;

  const accessoryState = { glasses: false, headphones: false, tie: false };

  let layoutMode = '';
  function layout(force = false) {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = w < 980;
    const mode = narrow ? 'narrow' : 'wide';
    if (force || mode !== layoutMode) {
      layoutMode = mode;
      if (narrow) {
        camera.fov = 38;
        const shortScreen = h < 720;
        camera.position.set(0.65, 3.1, shortScreen ? 8.9 : 8.4);
        controls.target.set(0.35, shortScreen ? 2.4 : 2.2, 0);
        controls.minDistance = 6.2;
        controls.maxDistance = 12;
      } else {
        const compact = w < 1240;
        camera.fov = 32;
        camera.position.set(1.6, 2.8, compact ? 11.2 : 9.9);
        controls.target.set(compact ? -1.55 : -1.45, 1.15, 0);
        controls.minDistance = 7.5;
        controls.maxDistance = 14;
      }
      camera.updateProjectionMatrix();
    }
    controls.update();
  }

  function resetView() {
    layout(true);
  }

  layout(true);
  const initial = {
    pos: camera.position.clone(),
    target: controls.target.clone(),
  };
  window.addEventListener('resize', layout);

  /* ---------------- 动画 ---------------- */
  const tmpV = new THREE.Vector3();

  function updateEyeBlink(dt) {
    elapsed += dt;
    if (elapsed > nextBlink) {
      blinkStart = elapsed;
      nextBlink = elapsed + 2.4 + Math.random() * 3.4;
    }
    const p = (elapsed - blinkStart) / 0.16;
    const closed = p >= 0 && p <= 1 ? 1 - Math.sin(p * Math.PI) * 0.92 : 1;
    eyeGroups.forEach((g) => {
      g.scale.y += (closed - g.scale.y) * 0.5;
    });
  }

  function updateFish(dt, t) {
    const bob = reduceMotion ? 0 : Math.sin(t * 1.15) * 0.016;
    let hopY = 0;
    if (hopT >= 0) {
      hopT += dt;
      const p = hopT / 0.85;
      if (p >= 1) {
        hopT = -1;
      } else {
        hopY = Math.sin(p * Math.PI) * 0.2;
        const squash = Math.sin(p * Math.PI) * 0.06;
        body.scale.set(1 + squash, 1 - squash, 1);
      }
    } else {
      body.scale.set(1, 1, 1);
    }
    fish.position.y = bob + hopY;

    if (!reduceMotion) {
      const breathe = 1 + Math.sin(t * 2.1) * 0.012;
      body.scale.y *= breathe;
      tailPivot.rotation.z = -0.28 + Math.sin(t * 2.4) * (0.055 + tailBoost * 0.12);
      tailPivot.rotation.x = Math.sin(t * 1.6) * 0.03;
    }

    // 头部跟随指针
    const nx = pointerActive ? pointerTargetX : 0;
    const ny = pointerActive ? pointerTargetY : 0;
    headY += ((nx * 0.16) - headY) * Math.min(1, dt * 6);
    headX += ((ny * 0.08) - headX) * Math.min(1, dt * 6);
    head.rotation.y = headY;
    head.rotation.x = headX;

    // 悬停时轻微放大
    const targetScale = hovered ? 1.02 : 1;
    fish.scale.x += (targetScale - fish.scale.x) * Math.min(1, dt * 8);
    fish.scale.y = fish.scale.x;
    fish.scale.z = fish.scale.x;

    if (tailBoost > 0) tailBoost = Math.max(0, tailBoost - dt * 2.5);
  }

  function updateProps(dt, t) {
    screenGlow.material.opacity = 0.18 + Math.sin(t * 0.9) * 0.03;
    screenLight.intensity = 5.8 + Math.sin(t * 0.9) * 0.8;

    bubbles.forEach((b) => {
      b.position.y += b.userData.speed * dt;
      b.position.x = b.userData.baseX + Math.sin(t * 1.3 + b.userData.phase) * 0.08;
      if (b.position.y > 3.1) {
        b.position.y = 0.7;
        b.userData.baseX = 0.2 + Math.random() * 1.6;
      }
    });

    if (!reduceMotion) {
      dust.rotation.y = t * 0.012;
    }

    steam.children.forEach((puff, i) => {
      puff.position.y += dt * 0.06;
      puff.position.x = puff.userData.baseX + Math.sin(t * 0.9 + i * 1.7) * 0.02;
      if (puff.position.y > 0.42) puff.position.y = 0.02;
    });
  }

  function updateAccessories(dt) {
    Object.entries(accessories).forEach(([name, g]) => {
      const target = accessoryState[name] ? 1 : 0.001;
      const s = g.scale.x + (target - g.scale.x) * Math.min(1, dt * 9);
      g.scale.setScalar(s);
      g.visible = s > 0.02;
    });
  }

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (!running) return;

    controls.update();
    updateFish(dt, t);
    updateEyeBlink(dt);
    updateProps(dt, t);
    updateAccessories(dt);

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(tick);

  /* ---------------- 指针交互 ---------------- */
  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointerActive = true;
    pointerTargetX = pointer.x;
    pointerTargetY = pointer.y;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length > 0;
  }

  let downX = 0;
  let downY = 0;
  let dragging = false;

  canvas.addEventListener('pointermove', (e) => {
    setPointerFromEvent(e);
    if (e.buttons === 0) {
      const over = pick();
      if (over !== hovered) {
        hovered = over;
        canvas.style.cursor = over ? 'pointer' : 'grab';
      }
    }
  });

  canvas.addEventListener('pointerleave', () => {
    pointerActive = false;
    hovered = false;
    canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
    dragging = true;
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dragging && moved < 6 && pick()) {
      hopT = 0;
      blinkStart = elapsed;
      tailBoost = 1;
      hovered = true;
    }
    dragging = false;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });

  canvas.addEventListener('dblclick', () => {
    hopT = 0;
    tailBoost = 1;
  });

  canvas.style.cursor = 'grab';

  /* ---------------- 对外接口 ---------------- */
  function setAccessory(name, on) {
    if (!(name in accessoryState)) return;
    accessoryState[name] = Boolean(on);
    accessoryBoost = 1;
  }

  function getAccessories() {
    return { ...accessoryState };
  }

  function pause() {
    running = false;
  }

  function resume() {
    running = true;
    last = performance.now();
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', layout);
    controls.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      }
    });
    renderer.dispose();
    pmrem.dispose();
  }

  return {
    setAccessory,
    getAccessories,
    resetView,
    pause,
    resume,
    dispose,
    get initial() { return initial; },
    get camera() { return camera; },
    get controls() { return controls; },
  };
}
