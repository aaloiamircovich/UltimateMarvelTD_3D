import * as THREE from 'three';

const materials = new Map();
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
export function material(color, glow = false) {
  const key = `${color}:${glow}`;
  if (!materials.has(key)) materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.18, flatShading: true }));
  return materials.get(key);
}
export function part(parent, geometry, color, position, scale, glow = false) {
  const mesh = new THREE.Mesh(geometry, material(color, glow));
  mesh.position.set(...position); mesh.scale.set(...scale);
  mesh.castShadow = !glow; mesh.receiveShadow = !glow; parent.add(mesh); return mesh;
}
export const box = (parent, color, pos, size, glow) => part(parent, boxGeometry, color, pos, size, glow);
export const ball = (parent, color, pos, size, glow) => part(parent, sphereGeometry, color, pos, size, glow);
export const cylinder = (parent, color, pos, size, glow) => part(parent, cylinderGeometry, color, pos, size, glow);

export function heroModel(hero, pedestal = true) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); root.userData.body = body;
  const hulk = hero.id === 'hulk', width = hulk ? 1.18 : 0.74, skin = '#d5a17f';
  if (pedestal) {
    cylinder(root, '#17273b', [0, 0.12, 0], [0.68, 0.24, 0.68]);
    cylinder(root, hero.color, [0, 0.25, 0], [0.67, 0.035, 0.67], true);
  }
  body.position.y = pedestal ? 0.25 : 0;
  const pants = hero.id === 'hulk' || hero.id === 'spiderman' ? hero.accent : hero.body;
  for (const side of [-1, 1]) {
    box(body, pants, [side * 0.23, 0.47, 0], [0.34, 0.84, 0.4]);
    box(body, hero.body, [side * 0.23, 0.15, 0.09], [0.38, 0.3, 0.57]);
    const arm = box(body, hero.body, [side * (width / 2 + 0.16), 1.18, 0.06], [hulk ? 0.49 : 0.29, 0.81, 0.36]);
    arm.rotation.z = side * 0.13;
    ball(body, ['thor', 'doctor_strange', 'capitan_america'].includes(hero.id) ? skin : hero.body, [side * (width / 2 + 0.21), 0.85, 0.1], [0.2, 0.22, 0.2]);
  }
  box(body, hero.body, [0, 1.2, 0], [width, 0.85, 0.5]);
  box(body, pants, [0, 0.79, 0], [width * 0.9, 0.18, 0.48]);
  const exposed = ['thor', 'doctor_strange'].includes(hero.id);
  ball(body, exposed ? skin : hero.body, [0, 1.97, 0.02], [hulk ? 0.46 : 0.42, 0.46, 0.39]);
  for (const side of [-1, 1]) {
    const eye = box(body, ['iron_man', 'spiderman'].includes(hero.id) ? '#dcfbff' : '#f2f3eb', [side * 0.16, 2.01, 0.36], [0.19, 0.085, 0.035], true);
    eye.rotation.z = side * 0.16;
  }
  if (hero.id === 'iron_man') {
    box(body, hero.accent, [0, 1.96, 0.33], [0.58, 0.51, 0.1]);
    for (const side of [-1, 1]) box(body, '#a9f7ff', [side * 0.16, 2.04, 0.39], [0.2, 0.065, 0.025], true);
    ball(body, '#b5faff', [0, 1.37, 0.265], [0.14, 0.14, 0.045], true);
    for (const side of [-1, 1]) box(body, hero.accent, [side * 0.24, 0.51, 0.22], [0.18, 0.34, 0.035]);
  }
  if (hero.id === 'spiderman') {
    box(body, '#122239', [0, 1.39, 0.27], [0.075, 0.24, 0.04]);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const leg = box(body, '#122239', [s * 0.09, 1.4 - i * 0.065, 0.27], [0.2, 0.025, 0.04]); leg.rotation.z = s * (0.6 - i * 0.5);
    }
    for (const s of [-1, 1]) { const eye = ball(body, '#effaff', [s * 0.17, 2.04, 0.35], [0.145, 0.16, 0.045], true); eye.rotation.z = -s * 0.3; }
  }
  if (hero.id === 'capitan_america') {
    box(body, '#f0eee8', [0, 1.38, 0.27], [0.24, 0.09, 0.03]);
    box(body, '#f0eee8', [0, 1.38, 0.27], [0.08, 0.25, 0.03]);
    box(body, '#d53b4f', [0, 0.95, 0.27], [0.63, 0.18, 0.03]);
    box(body, '#eeeeea', [0, 2.23, 0.32], [0.1, 0.12, 0.04]);
    const shield = new THREE.Group(); shield.position.set(-0.66, 1.15, 0.35); shield.rotation.x = Math.PI / 2; body.add(shield);
    cylinder(shield, '#c83042', [0, 0, 0], [0.55, 0.1, 0.55]);
    cylinder(shield, '#dce3eb', [0, 0.06, 0], [0.43, 0.02, 0.43]);
    cylinder(shield, '#d33d4a', [0, 0.08, 0], [0.32, 0.02, 0.32]);
    cylinder(shield, '#2b61aa', [0, 0.1, 0], [0.23, 0.02, 0.23]);
    box(shield, '#e8f6ff', [0, 0.12, 0], [0.28, 0.02, 0.07]);
    box(shield, '#e8f6ff', [0, 0.12, 0], [0.07, 0.02, 0.28]);
  }
  if (hero.id === 'thor' || hero.id === 'doctor_strange') {
    const cape = box(body, '#9f2338', [0, 1.08, -0.38], [1.02, 1.35, 0.13]); cape.rotation.x = -0.15;
    box(body, hero.id === 'thor' ? '#bba173' : '#322a2d', [0, 2.31, -0.04], [0.7, 0.2, 0.56]);
    if (hero.id === 'thor') {
      box(body, '#c8a66d', [0, 1.83, 0.32], [0.34, 0.18, 0.07]);
      for (const s of [-1, 1]) for (const y of [1.16, 1.48]) ball(body, '#c2d0d7', [s * 0.23, y, 0.27], [0.12, 0.12, 0.05]);
      box(body, '#725140', [0.68, 1.12, 0.14], [0.1, 0.65, 0.1]);
      box(body, '#c8d7e0', [0.68, 1.48, 0.14], [0.55, 0.36, 0.38]);
    } else {
      box(body, '#352c2c', [0, 1.77, 0.36], [0.15, 0.16, 0.04]);
      ball(body, '#9ce69a', [0, 1.44, 0.3], [0.1, 0.13, 0.04], true);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 5, 28), material('#ffb34f', true)); ring.position.set(0.72, 1.1, 0.32); body.add(ring);
    }
  }
  if (hulk) {
    box(body, '#263e30', [0, 2.3, -0.02], [0.72, 0.16, 0.56]);
    box(body, '#d7dfb3', [0, 1.79, 0.37], [0.3, 0.06, 0.035]);
    body.scale.set(1.12, 1.12, 1.12);
  }
  return root;
}

export function enemyModel(definition, kind) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); root.userData.body = body;
  const c = definition.color;
  box(body, c, [0, 1, 0], [0.7, 0.65, 0.4]);
  ball(body, c, [0, 1.6, 0], [0.31, 0.35, 0.29]);
  box(body, '#ff455e', [0, 1.62, 0.28], [0.43, 0.065, 0.04], true);
  ball(body, '#ff4560', [0, 1.1, 0.23], [0.1, 0.1, 0.03], true);
  const limbs = [];
  for (const side of [-1, 1]) {
    const leg = box(body, '#364555', [side * 0.22, 0.4, 0], [0.25, 0.65, 0.27]); limbs.push(leg);
    box(body, c, [side * 0.51, 1, 0], [0.26, 0.65, 0.3]);
    if (kind === 'boss') box(body, '#5f6d7d', [side * 0.48, 1.33, 0], [0.4, 0.25, 0.5]);
  }
  root.scale.setScalar(definition.scale); root.userData.limbs = limbs;
  const bar = new THREE.Group(); bar.position.y = 2.2;
  box(bar, '#17202a', [0, 0, 0], [1, 0.1, 0.025], true);
  const health = box(bar, '#fb6477', [0, 0, 0.02], [0.92, 0.065, 0.025], true);
  root.add(bar); root.userData.health = health; root.userData.bar = bar;
  return root;
}

export function makePortraits(heroes) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(240, 220); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xddecff, 0x576078, 3));
  const key = new THREE.DirectionalLight(0xffe8c9, 4); key.position.set(-3, 4, 5); scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 240 / 220, 0.1, 20);
  camera.position.set(2.5, 2.4, 5); camera.lookAt(0, 1.3, 0);
  const portraits = {};
  for (const hero of heroes) {
    const model = heroModel(hero, false); scene.add(model);
    renderer.render(scene, camera); portraits[hero.id] = renderer.domElement.toDataURL('image/png'); scene.remove(model);
  }
  renderer.dispose(); renderer.forceContextLoss();
  return portraits;
}
