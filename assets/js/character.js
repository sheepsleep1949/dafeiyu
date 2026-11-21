import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 从 Blender 导出的 GLB 载入「蓝色大肥鱼」。
 *
 * 对外暴露的接口与旧的手搓角色保持一致：
 *   group / body / head / tail / eyes / accessories / hit
 * 这样 scene.js 里的动画与交互代码不用改。
 *
 * 渲染风格：MeshToonMaterial（3 档色阶）+ 反向壳描边 + 靠现有灯光做轮廓光。
 */

const MODEL_URL = 'assets/models/whale_girl.glb';
const OUTLINE_COLOR = 0x1b2a44;
const MODEL_SCALE = 0.72;

// 模型内部坐标（Blender Z-up 导成 glTF Y-up 后，高度就是 y）
const HEAD_POS = new THREE.Vector3(0, 1.30, 0);
const EYE_POS = [new THREE.Vector3(-0.138, 1.215, 0.34), new THREE.Vector3(0.138, 1.215, 0.34)];
const TAIL_POS = new THREE.Vector3(0, 0.55, -0.12);

const HEAD_PARTS = [
  'head', 'face_card', 'hair_hood', 'hair_back_hi', 'hair_back_lo', 'hair_back_tail', 'hair_back_top',
  'hair_back_mid', 'hair_back_low', 'hair_curl', 'fringe', 'strand', 'side_bang', 'ahoge', 'lock',
  'lace_band', 'petal_', 'bow_', 'fin_', 'blush_', 'mouth',
];
const EYE_RE = /^(eye_|iris|pupil_|hi_|hi2_|lash_)/;
const TAIL_PARTS = ['tail_a', 'tail_b', 'fluke_'];

function toonGradient(steps = 3) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) data[i] = Math.round((255 * (i + 1)) / steps);
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function sideOf(name) {
  // Blender 导出的名字形如 eye_-1 / eye_1 / fluke_-1
  if (/_-\d+$/.test(name)) return 0;
  if (/_\d+$/.test(name)) return 1;
  return -1;
}

function headMatch(name) {
  return HEAD_PARTS.some((p) => name === p || name.startsWith(p));
}

export function loadWhaleGirl() {
  const group = new THREE.Group();          // fish：负责整体位置/缩放
  const body = new THREE.Group();           // 负责挤压呼吸
  const rig = new THREE.Group();            // 模型自身缩放
  rig.scale.setScalar(MODEL_SCALE);

  const head = new THREE.Group();
  head.position.copy(HEAD_POS);
  rig.add(head);

  // 注意：Object3D.position 是只读属性（three 用 defineProperties 定义且没有 writable），
  // 严格模式下 Object.assign(group, { position }) 会抛 TypeError，所以只能 copy。
  const eyes = [new THREE.Group(), new THREE.Group()];
  eyes[0].position.copy(EYE_POS[0]);
  eyes[1].position.copy(EYE_POS[1]);
  eyes.forEach((e) => head.add(e));

  const tail = new THREE.Group();
  tail.position.copy(TAIL_POS);
  rig.add(tail);

  const accessories = {
    glasses: new THREE.Group(),
    headphones: new THREE.Group(),
    tie: new THREE.Group(),
  };
  Object.entries(accessories).forEach(([, g]) => {
    g.scale.setScalar(0.001);
    g.visible = false;
    head.add(g);
  });

  const hit = [];
  const grad = toonGradient(3);
  const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });

  body.add(rig);
  group.add(body);

  const loader = new GLTFLoader();

  const ready = new Promise((resolve, reject) => {
    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = false;
            const src = o.material;
            const color = src && src.color ? src.color.clone() : new THREE.Color(0xffffff);
            const rough = src && src.roughness !== undefined ? src.roughness : 0.6;

            if (o.name === 'face_card') {
              // 脸卡是贴图，不能用卡通着色（会被色阶吃掉细节），用不受光材质保持插画原色
              o.material = new THREE.MeshBasicMaterial({
                map: src && src.map ? src.map : null,
                transparent: true,
                alphaTest: 0.02,
                toneMapped: false,
              });
            } else {
              const mat = new THREE.MeshToonMaterial({ color, gradientMap: grad });
              // 保留贴图（头部的烘焙贴图），否则会变成纯色
              if (src && src.map) {
                mat.map = src.map;
                mat.transparent = Boolean(src.transparent);
              }
              if (rough < 0.25) mat.emissive = color.clone().multiplyScalar(0.12);
              o.material = mat;
            }
            if (src && src.dispose) src.dispose();
            hit.push(o);
          }
        });

        rig.add(model);
        rig.updateMatrixWorld(true);

        // 按名字把零件挂到对应的枢轴上（attach 会保留世界变换）
        const meshes = [];
        model.traverse((o) => {
          if (o.isMesh) meshes.push(o);
        });
        meshes.forEach((m) => {
          const name = m.name || '';
          if (EYE_RE.test(name)) {
            const s = sideOf(name);
            (eyes[s === 1 ? 1 : 0]).attach(m);
          } else if (TAIL_PARTS.some((p) => name.startsWith(p))) {
            tail.attach(m);
          } else if (headMatch(name)) {
            head.attach(m);
          }
        });

        // 反向壳描边：给每个网格挂一个「背面放大的同款」，作为子节点，
        // 这样它自动跟随头部/尾巴的动画，不会和身体脱节。
        meshes.forEach((m) => {
          if (m.name === 'face_card') return;   // 脸卡不做描边，否则黑壳会糊住五官
          const ol = new THREE.Mesh(m.geometry, outlineMat);
          ol.scale.setScalar(1.018);
          ol.castShadow = false;
          ol.receiveShadow = false;
          ol.renderOrder = -1;
          m.add(ol);
        });

        buildAccessories(accessories);
        resolve();
      },
      undefined,
      (err) => reject(err),
    );
  });

  return { group, body, head, tail, eyes, accessories, hit, ready };
}

function buildAccessories(targets) {
  const glassMat = new THREE.MeshToonMaterial({ color: 0x243444 });
  const metalMat = new THREE.MeshToonMaterial({ color: 0x5b6b7d });
  const clothMat = new THREE.MeshToonMaterial({ color: 0x3450cf });

  // 圆框眼镜
  const g = targets.glasses;
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 8, 24), glassMat);
    ring.position.set(sx * 0.155, 0.005, 0.40);
    g.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.012, 8, 16, Math.PI), glassMat);
  bridge.position.set(0, 0.065, 0.40);
  bridge.rotation.z = Math.PI;
  g.add(bridge);

  // 耳机
  const h = targets.headphones;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 10, 32, Math.PI), metalMat);
  band.position.set(0, 0.16, 0.02);
  band.rotation.y = Math.PI / 2;
  h.add(band);
  for (const sx of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 20), metalMat);
    cup.position.set(sx * 0.47, 0.02, 0.02);
    cup.rotation.z = Math.PI / 2;
    h.add(cup);
  }

  // 小领结
  const t = targets.tie;
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 10), clothMat);
    wing.position.set(sx * 0.11, -0.36, 0.30);
    wing.rotation.z = (Math.PI / 2) * sx;
    t.add(wing);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), clothMat);
  knot.position.set(0, -0.36, 0.30);
  t.add(knot);
}
