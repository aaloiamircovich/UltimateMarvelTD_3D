import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HERO_BY_ID, PATH, BUILDINGS, PARKS, LAMPS, CARS, ENEMIES } from '../game/data.js';
import { placementError } from '../game/simulation.js';
import { box, ball, cylinder, material, heroModel, enemyModel } from './models.js';

export class World {
  constructor(container, onPick, onHover) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#111c2d');
    this.scene.fog = new THREE.FogExp2('#111c2d', 0.009);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'Mapa 3D de Manhattan. Seleccioná un héroe y hacé clic en una zona libre para desplegarlo.');
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement); this.container = container;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 19; this.controls.maxDistance = 65;
    this.controls.minPolarAngle = 0.25; this.controls.maxPolarAngle = Math.PI / 2.5;
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.resetCamera();
    this.scene.add(new THREE.HemisphereLight(0xc7e6ff, 0x57516c, 2.6));
    const sun = new THREE.DirectionalLight(0xffdbaf, 3.6); sun.position.set(-15, 28, 12);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 }); sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#77bfff', 1.8); rim.position.set(15, 15, -18); this.scene.add(rim);
    this.units = new Map(); this.enemies = new Map(); this.enemyPools = new Map(); this.effects = []; this.effectPool = [];
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.buildMap();
    this.range = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 96), new THREE.MeshBasicMaterial({ color: '#6ee7e1', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    this.range.rotation.x = -Math.PI / 2; this.range.visible = false; this.scene.add(this.range);
    this.rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: '#61d9df', transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }));
    this.rangeFill.rotation.x = -Math.PI / 2; this.rangeFill.visible = false; this.scene.add(this.rangeFill);
    this.placementTile = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: '#7af5d0', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    this.placementTile.rotation.x = -Math.PI / 2; this.placementTile.visible = false; this.scene.add(this.placementTile);
    let down;
    this.renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (e.button !== 0 || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) return;
      const p = this.pickGround(e); if (p) onPick(p);
    });
    this.renderer.domElement.addEventListener('pointermove', e => { const p = this.pickGround(e); if (p) onHover(p); });
    this.renderer.domElement.addEventListener('pointerleave', () => onHover(null));
    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container); this.resize();
  }
  resetCamera() { this.camera.position.set(26, 32, 36); this.controls.target.set(0, 0, 0); this.controls.update(); }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.zoom = Math.min(1, this.camera.aspect / 1.35); this.camera.updateProjectionMatrix();
  }
  pickGround(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Pick the visible hero before its ground footprint, including its head and cape.
    for (const [id, mesh] of this.units) {
      if (this.raycaster.intersectObject(mesh, true).length) return { x: mesh.position.x, z: mesh.position.z, unitId: id };
    }
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p) ? { x: Math.round(p.x), z: Math.round(p.z) } : null;
  }
  label(text, x, y, z, color = '#b5dfff', width = 3.5) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); let size = 54; ctx.font = `bold ${size}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    while (ctx.measureText(text).width > 490) { size -= 2; ctx.font = `bold ${size}px system-ui`; }
    ctx.fillStyle = color; ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, z); sprite.scale.set(width, width / 4, 1); this.scene.add(sprite); return sprite;
  }
  buildMap() {
    const s = this.scene;
    box(s, '#111d31', [0, -0.9, 0], [31.6, 1.5, 22.2]);
    box(s, '#405560', [0, -0.12, 0], [31, 0.25, 21.5]);
    box(s, '#48bbcc', [0, -0.66, 11.12], [28, 0.045, 0.035], true);
    box(s, '#48bbcc', [15.82, -0.66, 0], [0.035, 0.045, 19], true);
    const grid = new THREE.GridHelper(30, 30, '#748993', '#526871'); grid.position.y = 0.015; grid.scale.z = 0.7; grid.material.transparent = true; grid.material.opacity = 0.2; s.add(grid);
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i], b = PATH[i + 1], horizontal = a[1] === b[1], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const pos = [(a[0] + b[0]) / 2, 0.02, (a[1] + b[1]) / 2];
      box(s, '#7c8f96', pos, [horizontal ? length + 2.6 : 2.6, 0.12, horizontal ? 2.6 : length + 2.6]);
      box(s, '#253343', [pos[0], 0.09, pos[2]], [horizontal ? length + 2.1 : 2.1, 0.025, horizontal ? 2.1 : length + 2.1]);
      for (let k = 0.7; k < length - 0.4; k += 1.7) {
        const t = k / length; box(s, '#cdbb8a', [a[0] + (b[0] - a[0]) * t, 0.12, a[1] + (b[1] - a[1]) * t], [horizontal ? 0.65 : 0.055, 0.015, horizontal ? 0.055 : 0.65]);
      }
    }
    // Crosswalks and route arrows make the winding route legible from the default camera.
    for (const [x, z, rotate] of [[-12, 5, false], [-9, 0, true], [2.5, 4, false], [7, -1, true]]) {
      for (let i = -2; i <= 2; i++) box(s, '#b0c3c4', [x + (rotate ? 0 : i * 0.24), 0.13, z + (rotate ? i * 0.24 : 0)], [rotate ? 1.7 : 0.12, 0.01, rotate ? 0.12 : 1.7]);
    }
    for (const b of BUILDINGS) {
      box(s, '#26384b', [b.x, 0.17, b.z], [b.w + 0.3, 0.35, b.d + 0.3]);
      box(s, b.color, [b.x, b.h / 2 + 0.3, b.z], [b.w, b.h, b.d]);
      box(s, '#273e52', [b.x, b.h + 0.4, b.z], [b.w + 0.2, 0.23, b.d + 0.2]);
      box(s, '#647c88', [b.x + 0.3, b.h + 0.7, b.z], [b.w * 0.45, 0.45, b.d * 0.5]);
      for (let y = 0.9; y < b.h; y += 0.8) {
        for (let x = -b.w / 2 + 0.35; x < b.w / 2; x += 0.65) box(s, (Math.round(y * 10 + x * 10) % 3 === 0) ? '#8acbd9' : '#597d92', [b.x + x, y, b.z + b.d / 2 + 0.012], [0.28, 0.39, 0.035], true);
        for (let z = -b.d / 2 + 0.4; z < b.d / 2; z += 0.65) box(s, '#628c9d', [b.x + b.w / 2 + 0.012, y, b.z + z], [0.035, 0.39, 0.29], true);
      }
      if (b.stark) {
        this.label('A', b.x, b.h - 0.6, b.z + 1.8, '#b7f6ff', 2.8);
        this.label('STARK', b.x, b.h + 1.3, b.z, '#c8f5ff', 3.3);
        box(s, '#8fe8ed', [b.x, b.h + 1.4, b.z], [0.08, 1.5, 0.08], true);
      }
    }
    for (const [x, z] of PARKS) {
      box(s, '#778784', [x, 0.1, z], [3.2, 0.22, 2.4]);
      box(s, '#55775a', [x, 0.23, z], [3, 0.08, 2.2]);
      // Tree trunks share obstacle definitions with placement validation.
      for (const side of [-1, 1]) {
        cylinder(s, '#6c5946', [x + side, 0.75, z + 0.5], [0.1, 1.1, 0.1]);
        ball(s, '#649378', [x + side, 1.55, z + 0.5], [0.58, 0.73, 0.55]);
      }
    }
    for (const [x, z] of LAMPS) {
      cylinder(s, '#253647', [x, 1.3, z], [0.05, 2.6, 0.05]);
      box(s, '#253647', [x + 0.25, 2.6, z], [0.65, 0.08, 0.1]);
      box(s, '#ffe2a0', [x + 0.5, 2.54, z], [0.24, 0.07, 0.2], true);
    }
    for (const [x, z, color] of CARS) {
      box(s, color, [x, 0.5, z], [1.7, 0.55, 0.9]); box(s, '#243e52', [x, 0.94, z], [0.9, 0.4, 0.78]);
      for (const a of [-0.55, 0.55]) for (const b of [-0.46, 0.46]) ball(s, '#172133', [x + a, 0.29, z + b], [0.22, 0.22, 0.11]);
    }
    const portal = new THREE.Group(); portal.position.set(-14.4, 1.7, 5); portal.rotation.y = Math.PI / 2; s.add(portal); this.portal = portal;
    for (const radius of [1.3, 1.5]) portal.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.065, 6, 48), material('#bb8dff', true)));
    const interior = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshBasicMaterial({ color: '#8753d3', transparent: true, opacity: 0.32, side: THREE.DoubleSide })); portal.add(interior);
    this.label('PORTAL ENEMIGO', -14, 3.8, 5, '#d7b5ff', 4);
    cylinder(s, '#264557', [14, 0.18, -5], [1.2, 0.3, 1.2]);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#61efd6', wireframe: true, transparent: true, opacity: 0.25 }));
    shield.position.set(14, 0.2, -5); s.add(shield); this.shield = shield;
    this.label('BASE', 14, 2.3, -5, '#91f5d8', 2);
    this.label('MANHATTAN  /  SECTOR 07', -0.5, -0.15, 11.3, '#79a7b5', 8);
    // Distant city silhouettes anchor the floating tactical diorama.
    for (let i = 0; i < 18; i++) {
      const x = -44 + i * 5.2, h = 3 + (i * 7 % 11);
      box(s, '#1c2b40', [x, h / 2 - 3, -27 - i % 3 * 3], [3.5, h, 4]);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#111c2c', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3; floor.receiveShadow = true; s.add(floor);
    // Batch static scenery by material; windows no longer cost one draw call each.
    s.updateMatrixWorld(true);
    const batches = new Map();
    for (const mesh of [...s.children]) {
      if (!mesh.isMesh || mesh === shield || mesh === floor) continue;
      const key = `${mesh.material.uuid}:${mesh.castShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      const merged = new THREE.Mesh(mergeGeometries(geometries), meshes[0].material);
      merged.castShadow = meshes[0].castShadow; merged.receiveShadow = meshes[0].receiveShadow;
      s.add(merged); meshes.forEach(mesh => s.remove(mesh)); geometries.forEach(g => g.dispose());
    }
  }
  setPreview(heroId, point, game, selectedUnit) {
    if (this.ghostId !== heroId) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = heroId ? heroModel(HERO_BY_ID[heroId]) : null; this.ghostId = heroId;
      if (this.ghost) this.scene.add(this.ghost);
    }
    const preview = heroId && point;
    if (this.ghost) this.ghost.visible = !!preview;
    this.placementTile.visible = !!preview;
    if (preview) {
      this.ghost.position.set(point.x, 0.15, point.z);
      const valid = !placementError(point.x, point.z, game.units) && game.cash >= HERO_BY_ID[heroId].cost && game.units.length < 12;
      this.placementTile.material.color.set(valid ? '#74f5c6' : '#ff546a'); this.placementTile.position.set(point.x, 0.3, point.z);
      this.showRange(point.x, point.z, HERO_BY_ID[heroId].range, valid ? '#7df5dc' : '#ff6574');
    } else if (selectedUnit) this.showRange(selectedUnit.x, selectedUnit.z, game.stats(selectedUnit).range, HERO_BY_ID[selectedUnit.heroId].color);
    else { this.range.visible = false; this.rangeFill.visible = false; }
  }
  showRange(x, z, radius, color) {
    for (const [mesh, y] of [[this.range, 0.29], [this.rangeFill, 0.28]]) {
      mesh.visible = true; mesh.position.set(x, y, z); mesh.scale.setScalar(radius); mesh.material.color.set(color);
    }
  }
  addEffect(event) {
    const ring = event.type !== 'attack' || ['slam', 'magic'].includes(event.kind);
    const effect = this.effectPool.find(e => e.ring === ring) || this.createEffect(ring);
    const index = this.effectPool.indexOf(effect); if (index >= 0) this.effectPool.splice(index, 1);
    effect.life = effect.maxLife = event.type === 'attack' ? 0.24 : 0.55;
    effect.mesh.visible = true; effect.mesh.material.color.set(event.color || '#9af5e1');
    effect.mesh.material.opacity = 0.9;
    if (ring) {
      const p = event.to || event;
      effect.mesh.position.set(p.x, 0.36, p.z); effect.mesh.scale.setScalar(0.3); effect.radius = event.kind === 'slam' ? 2.4 : 1.6;
    } else {
      const points = [new THREE.Vector3(event.from.x, 1.5, event.from.z), ...(event.chain || [event.to]).map(p => new THREE.Vector3(p.x, 1, p.z))];
      effect.mesh.geometry.setFromPoints(points);
      effect.mesh.geometry.computeBoundingSphere();
    }
    this.effects.push(effect);
  }
  createEffect(ring) {
    let mesh;
    if (ring) {
      mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false })); mesh.rotation.x = -Math.PI / 2;
    } else mesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }));
    this.scene.add(mesh); return { mesh, ring };
  }
  render(game, dt) {
    const activeUnits = new Set(game.units.map(u => u.id));
    for (const [id, mesh] of this.units) if (!activeUnits.has(id)) { this.scene.remove(mesh); this.units.delete(id); }
    for (const u of game.units) {
      if (!this.units.has(u.id)) { const mesh = heroModel(HERO_BY_ID[u.heroId]); this.scene.add(mesh); this.units.set(u.id, mesh); }
      const mesh = this.units.get(u.id); mesh.position.set(u.x, 0.14, u.z); mesh.rotation.y = u.angle;
      mesh.userData.body.position.y = 0.25 + Math.sin(game.time * 2 + u.id) * 0.025;
    }
    const activeEnemies = new Set(game.enemies.map(e => e.id));
    for (const [id, mesh] of this.enemies) if (!activeEnemies.has(id)) {
      mesh.visible = false; this.enemies.delete(id);
      if (!this.enemyPools.has(mesh.userData.kind)) this.enemyPools.set(mesh.userData.kind, []);
      this.enemyPools.get(mesh.userData.kind).push(mesh);
    }
    for (const e of game.enemies) {
      if (!this.enemies.has(e.id)) {
        const mesh = this.enemyPools.get(e.kind)?.pop() || enemyModel(ENEMIES[e.kind], e.kind);
        mesh.userData.kind = e.kind; mesh.visible = true; this.scene.add(mesh); this.enemies.set(e.id, mesh);
      }
      const mesh = this.enemies.get(e.id); mesh.position.set(e.x, 0.15, e.z); mesh.rotation.y = e.angle;
      mesh.userData.body.position.y = Math.abs(Math.sin(game.time * e.speed * 5)) * 0.08;
      mesh.userData.limbs.forEach((limb, i) => limb.rotation.x = Math.sin(game.time * e.speed * 5 + i * Math.PI) * 0.45);
      mesh.userData.health.scale.x = Math.max(0.001, e.hp / e.maxHp) * 0.92;
      mesh.userData.health.position.x = -(1 - e.hp / e.maxHp) * 0.46;
      mesh.userData.bar.quaternion.copy(this.camera.quaternion).premultiply(mesh.quaternion.clone().invert());
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.life -= dt * (game.paused ? 0 : game.speed);
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife);
      if (effect.ring) effect.mesh.scale.setScalar(0.3 + (1 - effect.life / effect.maxLife) * effect.radius);
      if (effect.life <= 0) { effect.mesh.visible = false; this.effects.splice(i, 1); this.effectPool.push(effect); }
    }
    this.portal.rotation.z = game.time * 0.3;
    this.shield.material.opacity = 0.18 + Math.sin(game.time * 2) * 0.07;
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }
  clear() {
    for (const mesh of this.units.values()) this.scene.remove(mesh); this.units.clear();
    for (const [id, mesh] of this.enemies) { mesh.visible = false; if (!this.enemyPools.has(mesh.userData.kind)) this.enemyPools.set(mesh.userData.kind, []); this.enemyPools.get(mesh.userData.kind).push(mesh); this.enemies.delete(id); }
    for (const e of this.effects) { e.mesh.visible = false; this.effectPool.push(e); } this.effects.length = 0;
  }
}
