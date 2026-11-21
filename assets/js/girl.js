import * as THREE from 'three';

/**
 * 蓝色大肥鱼 · 鲸鱼娘（Q 版）
 * 参照 dafeiyu_mv/assets/char_front.png：
 * 蓝发、白色女仆头饰、鲸鱼耳鳍、深蓝女仆裙、白围裙、鲸鱼尾巴。
 * 全部用基础几何体拼，无外部模型。
 */

const C = {
  skin: 0xffdfcd,
  skinShade: 0xf3c3b0,
  hair: 0x3c58cf,
  hairDark: 0x2e45b4,
  hairLight: 0x5b78ea,
  dress: 0x2c3f86,
  dressLight: 0x3a51a0,
  white: 0xfff9f2,
  iris: 0x2f6fe0,
  pupil: 0x101a30,
  mouth: 0x9c4a55,
  blush: 0xff9fb4,
  frame: 0x243444,
  mint: 0x9fe0c5,
  gold: 0xffd479,
};

function clay(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.55,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.7,
    sheen: 0.2,
    ...extra,
  });
}

function sphere(r, material, pos, scale = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), material);
  m.position.set(pos[0], pos[1], pos[2]);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = true;
  return m;
}

function capsule(r, len, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), material);
  m.castShadow = true;
  return m;
}

function placeCapsule(from, to, r, material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.05, dir.length() - r * 1.8);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), material);
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  m.castShadow = true;
  return m;
}

function extrudedShape(points, depth = 0.05, bevel = 0.02) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export function createWhaleGirl() {
  const group = new THREE.Group();

  const skinMat = clay(C.skin, { roughness: 0.52 });
  const hairMat = clay(C.hair, { roughness: 0.42, clearcoat: 0.3 });
  const hairDarkMat = clay(C.hairDark, { roughness: 0.45 });
  const dressMat = clay(C.dress, { roughness: 0.5 });
  const dressLightMat = clay(C.dressLight, { roughness: 0.5 });
  const whiteMat = clay(C.white, { roughness: 0.65 });
  const irisMat = new THREE.MeshPhysicalMaterial({ color: C.iris, roughness: 0.18, clearcoat: 1 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: C.pupil });
  const whiteEyeMat = clay(0xffffff, { roughness: 0.25, clearcoat: 0.6 });
  const lashMat = new THREE.MeshBasicMaterial({ color: 0x1a2340 });
  const blushMat = new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.45, depthWrite: false });
  const mouthMat = new THREE.MeshBasicMaterial({ color: C.mouth });

  /* ---------------- 头 ---------------- */
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  group.add(head);

  const headMesh = sphere(0.6, skinMat, [0, 0.52, 0], [1, 0.98, 0.96]);
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // 后发
  const hairBack = sphere(0.64, hairMat, [0, 0.5, -0.14], [1.04, 1.06, 0.96]);
  head.add(hairBack);

  // 头顶发盖，盖住额头以上
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.615, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.47),
    hairMat,
  );
  hairCap.position.set(0, 0.52, 0);
  hairCap.scale.set(1.02, 1.0, 1.0);
  hairCap.castShadow = true;
  head.add(hairCap);

  // 刘海
  for (let i = 0; i < 9; i += 1) {
    const x = -0.48 + i * 0.12;
    const len = 0.34 + (i % 2) * 0.05;
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.095, len, 12), hairMat);
    bang.position.set(x, 0.74, 0.42);
    bang.rotation.z = Math.PI;
    bang.rotation.x = -0.08;
    bang.scale.z = 0.55;
    bang.castShadow = true;
    head.add(bang);
  }

  // 侧发 + 后长发
  [-1, 1].forEach((side) => {
    const sideLock = capsule(0.09, 0.72, hairMat);
    sideLock.position.set(side * 0.55, 0.18, 0.16);
    sideLock.rotation.z = side * 0.06;
    head.add(sideLock);

    const frontLock = capsule(0.07, 0.5, hairMat);
    frontLock.position.set(side * 0.47, 0.33, 0.36);
    frontLock.rotation.z = side * 0.16;
    head.add(frontLock);

    const backLock = capsule(0.1, 0.85, hairDarkMat);
    backLock.position.set(side * 0.42, -0.1, -0.2);
    backLock.rotation.z = side * 0.08;
    head.add(backLock);
  });

  const backMass = sphere(0.5, hairDarkMat, [0, 0.02, -0.32], [0.58, 0.82, 0.36]);
  head.add(backMass);

  // 呆毛
  const ahoge = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI * 1.3), hairMat);
  ahoge.position.set(0, 1.14, -0.02);
  ahoge.rotation.z = 0.35;
  head.add(ahoge);

  /* ---------------- 女仆头饰 ---------------- */
  // 白色蕾丝头饰：两排小圆点压在头发前缘
  for (let row = 0; row < 2; row += 1) {
    const y = 0.9 - row * 0.075;
    const r = 0.53 + row * 0.02;
    for (let i = 0; i < 11; i += 1) {
      const a = -1.2 + i * 0.24;
      const ruffle = sphere(0.062, whiteMat, [Math.sin(a) * r, y, Math.cos(a) * r * 0.95 + 0.02]);
      ruffle.scale.set(1, 0.8, 0.5);
      head.add(ruffle);
    }
  }

  // 侧边小蝴蝶结
  [-1, 1].forEach((side) => {
    const bow = new THREE.Group();
    bow.position.set(side * 0.62, 0.72, 0.18);
    bow.rotation.z = side * 0.2;
    const wingGeo = new THREE.ConeGeometry(0.06, 0.14, 12);
    [-1, 1].forEach((s2) => {
      const wing = new THREE.Mesh(wingGeo, whiteMat);
      wing.rotation.z = -s2 * Math.PI / 2;
      wing.position.x = s2 * 0.07;
      wing.scale.z = 0.5;
      bow.add(wing);
    });
    const knot = sphere(0.035, whiteMat, [0, 0, 0.02]);
    bow.add(knot);
    head.add(bow);
  });

  /* ---------------- 鲸鱼耳鳍 ---------------- */
  [-1, 1].forEach((side) => {
    const finGeo = extrudedShape([
      [0, 0],
      [0.18, 0.3, 0.4, 0.32],
      [0.34, 0.1, 0.22, -0.1],
      [0.1, -0.02, 0, 0],
    ], 0.05, 0.02);

    const fin = new THREE.Mesh(finGeo, hairMat);
    fin.position.set(side * 0.58, 0.52, 0.02);
    fin.rotation.y = side * 0.55;
    fin.rotation.z = side * 0.15;
    fin.scale.set(side * 0.72, 0.72, 0.72);
    fin.castShadow = true;
    head.add(fin);

    const inner = new THREE.Mesh(finGeo, whiteMat);
    inner.position.set(side * 0.585, 0.52, 0.04);
    inner.rotation.copy(fin.rotation);
    inner.scale.set(side * 0.44, 0.44, 0.36);
    head.add(inner);
  });

  /* ---------------- 脸 ---------------- */
  const eyes = [];
  [-1, 1].forEach((side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.225, 0.53, 0.505);
    g.rotation.y = -side * 0.12;
    head.add(g);

    const sclera = sphere(0.165, whiteEyeMat, [0, 0, 0], [1, 1.18, 0.42]);
    g.add(sclera);

    const iris = sphere(0.115, irisMat, [0, 0, 0.055], [1, 1.05, 0.32]);
    g.add(iris);

    const pupil = sphere(0.055, pupilMat, [0, 0, 0.085], [1, 1, 0.4]);
    g.add(pupil);

    const hl = sphere(0.036, new THREE.MeshBasicMaterial({ color: 0xffffff }), [-0.04, 0.05, 0.105]);
    g.add(hl);
    const hl2 = sphere(0.018, new THREE.MeshBasicMaterial({ color: 0xffffff }), [0.045, -0.03, 0.11]);
    g.add(hl2);

    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.012, 8, 24, Math.PI), lashMat);
    lash.position.set(0, 0.01, 0.085);
    lash.rotation.x = -0.05;
    g.add(lash);

    eyes.push(g);
  });

  // 嘴
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 20, Math.PI), mouthMat);
  smile.position.set(0, 0.4, 0.575);
  smile.rotation.z = Math.PI;
  smile.rotation.x = -0.12;
  head.add(smile);

  // 腮红
  [-1, 1].forEach((side) => {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), blushMat);
    blush.position.set(side * 0.37, 0.42, 0.535);
    blush.rotation.y = side * 0.45;
    blush.renderOrder = 2;
    head.add(blush);
  });

  /* ---------------- 身体 ---------------- */
  const body = new THREE.Group();
  group.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.24, 20), skinMat);
  neck.position.set(0, 1.5, 0);
  neck.castShadow = true;
  body.add(neck);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.82, 28), dressMat);
  torso.position.set(0, 1.16, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const chest = sphere(0.38, dressMat, [0, 1.44, 0.02], [1.28, 0.72, 0.9]);
  body.add(chest);

  // 白围裙：一块圆角布片，不要做成圆球，否则会像小胡子
  const apronShape = new THREE.Shape();
  const aw = 0.22;
  const ah = 0.24;
  const ar = 0.06;
  apronShape.moveTo(-aw + ar, -ah);
  apronShape.lineTo(aw - ar, -ah);
  apronShape.quadraticCurveTo(aw, -ah, aw, -ah + ar);
  apronShape.lineTo(aw, ah - ar);
  apronShape.quadraticCurveTo(aw, ah, aw - ar, ah);
  apronShape.lineTo(-aw + ar, ah);
  apronShape.quadraticCurveTo(-aw, ah, -aw, ah - ar);
  apronShape.lineTo(-aw, -ah + ar);
  apronShape.quadraticCurveTo(-aw, -ah, -aw + ar, -ah);
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  apronGeo.center();
  const apron = new THREE.Mesh(apronGeo, whiteMat);
  apron.position.set(0, 1.12, 0.465);
  apron.castShadow = true;
  body.add(apron);

  // 领口
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24), whiteMat);
  collar.position.set(0, 1.57, 0.04);
  collar.rotation.x = Math.PI / 2;
  body.add(collar);

  // 胸口蝴蝶结
  const chestBow = new THREE.Group();
  chestBow.position.set(0, 1.49, 0.44);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), dressLightMat);
    wing.rotation.z = -side * Math.PI / 2;
    wing.position.x = side * 0.08;
    wing.scale.z = 0.55;
    chestBow.add(wing);
  });
  chestBow.add(sphere(0.045, dressLightMat, [0, 0, 0.02]));
  body.add(chestBow);

  // 袖子 / 手臂 / 手
  [-1, 1].forEach((side) => {
    const sleeve = sphere(0.13, whiteMat, [side * 0.44, 1.42, 0.06], [1, 1, 0.9]);
    body.add(sleeve);

    const shoulder = new THREE.Vector3(side * 0.37, 1.42, 0.08);
    const wrist = new THREE.Vector3(side * 0.3, 0.82, 0.95);
    const arm = placeCapsule(shoulder, wrist, 0.07, dressMat);
    body.add(arm);

    const cuff = sphere(0.075, whiteMat, [side * 0.3, 0.86, 0.9]);
    body.add(cuff);

    const hand = sphere(0.085, skinMat, [side * 0.3, 0.79, 0.98], [1, 0.8, 1.1]);
    body.add(hand);
  });

  /* ---------------- 鲸鱼尾巴 ---------------- */
  const tail = new THREE.Group();
  tail.position.set(0.52, 0.78, -0.42);
  tail.rotation.z = -0.28;
  tail.rotation.y = 0.25;
  body.add(tail);

  const tailGeo = extrudedShape([
    [0, 0],
    [0.14, 0.34, 0.5, 0.42],
    [0.34, 0.16, 0.42, 0.02],
    [0.3, -0.2, 0.42, -0.36],
    [0.16, -0.28, 0, 0],
  ], 0.06, 0.03);

  const tailMesh = new THREE.Mesh(tailGeo, hairMat);
  tailMesh.scale.set(1.05, 1.05, 1);
  tailMesh.castShadow = true;
  tail.add(tailMesh);

  /* ---------------- 配饰 ---------------- */
  const accessories = {
    glasses: new THREE.Group(),
    headphones: new THREE.Group(),
    tie: new THREE.Group(),
  };
  Object.values(accessories).forEach((g) => {
    g.visible = false;
    g.scale.setScalar(0.001);
    head.add(g);
  });
  head.remove(accessories.tie);
  body.add(accessories.tie);

  // 圆框眼镜
  [-1, 1].forEach((side) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 10, 36), clay(C.frame, { roughness: 0.3, metalness: 0.25 }));
    ring.position.set(side * 0.225, 0.53, 0.6);
    ring.rotation.y = -side * 0.12;
    accessories.glasses.add(ring);
  });
  {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.024, 0.024), clay(C.frame, { roughness: 0.3, metalness: 0.25 }));
    bridge.position.set(0, 0.55, 0.615);
    accessories.glasses.add(bridge);
  }

  // 耳机
  {
    const cupMat = clay(0x2b3f5c, { roughness: 0.42 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 12, 40, Math.PI), cupMat);
    band.position.set(0, 0.55, -0.02);
    accessories.headphones.add(band);
    [-1, 1].forEach((side) => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 24), cupMat);
      cup.position.set(side * 0.67, 0.47, 0);
      cup.rotation.z = Math.PI / 2;
      accessories.headphones.add(cup);
      const accent = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24), clay(C.mint, { roughness: 0.4 }));
      accent.position.set(side * 0.735, 0.47, 0);
      accent.rotation.z = Math.PI / 2;
      accessories.headphones.add(accent);
    });
  }

  // 小领结
  {
    const bowMat = clay(0x2b3f5c, { roughness: 0.42 });
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 14), bowMat);
      wing.rotation.z = -side * Math.PI / 2;
      wing.position.set(side * 0.07, 1.47, 0.36);
      wing.scale.z = 0.55;
      accessories.tie.add(wing);
    });
    const knot = sphere(0.04, bowMat, [0, 1.47, 0.37]);
    accessories.tie.add(knot);
  }

  /* ---------------- 交互用 ---------------- */
  const hit = [headMesh, torso, chest];

  return {
    group,
    head,
    body,
    eyes,
    tail,
    accessories,
    hit,
  };
}
