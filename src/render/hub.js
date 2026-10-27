import * as THREE from "three";
import { box, ball, cylinder } from "./models.js";
import { HUB_STATIONS, moveAvatar, nearbyStation } from "../game/hub.js";

// A separate scene keeps player movement and lobby input out of the TD simulation.
export class HubWorld {
  constructor(container, interact) {
    this.container = container;
    this.interact = interact;
    this.active = true;
    this.blocked = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0.48;
    this.distance = 10;
    this.time = 0;
    this.velocityY = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#142b45");
    this.scene.fog = new THREE.Fog("#142b45", 32, 95);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-label", "HUB 3D. WASD o flechas para caminar, arrastrar para girar cámara, E para interactuar.");
    canvas.tabIndex = 0;
    canvas.style.touchAction = "none";
    container.append(canvas);
    this.scene.add(new THREE.HemisphereLight("#cdefff", "#28344c", 3));
    const sun = new THREE.DirectionalLight("#ffe4bd", 3);
    sun.position.set(-14, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, far: 80 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.portals = [];
    this.cameraObstacles = [];
    this.cameraRay = new THREE.Raycaster();
    this.buildPlaza();
    this.player = this.buildPlayer();
    this.player.position.set(0, 0, 7);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    this.camera.position.set(0, 6, 17);
    window.addEventListener("keydown", e => {
      if (!this.active || this.blocked || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
        this.keys.add(e.code);
      }
      if (e.code === "KeyE" && !e.repeat && this.nearby) this.interact(this.nearby.id);
      if (e.code === "Space" && !e.repeat && this.player.position.y === 0) this.velocityY = 6;
    });
    window.addEventListener("keyup", e => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.releaseInput());
    document.addEventListener("visibilitychange", () => this.releaseInput());
    let pointer = null;
    canvas.addEventListener("pointerdown", e => {
      if (!this.active || this.blocked) return;
      canvas.focus();
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (!pointer || pointer.id !== e.pointerId || this.blocked) return;
      this.yaw -= (e.clientX - pointer.x) * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - pointer.y) * 0.004, 0.15, 0.95);
      pointer.x = e.clientX; pointer.y = e.clientY;
    });
    canvas.addEventListener("lostpointercapture", () => { pointer = null; });
    canvas.addEventListener("pointerup", () => { pointer = null; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.008, 5, 15);
    }, { passive: false });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  releaseInput() { this.keys.clear(); }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  label(text, x, y, z, color, width = 6) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.font = "800 64px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 512, 64, 980);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    sprite.position.set(x, y, z); sprite.scale.set(width, width / 8, 1);
    this.scene.add(sprite);
  }
  buildPlaza() {
    box(this.scene, "#233b53", [0, -0.6, 0], [42, 1.2, 42]);
    box(this.scene, "#496275", [0, 0.015, 0], [6, 0.03, 39]);
    box(this.scene, "#496275", [0, 0.02, 3], [39, 0.03, 5]);
    for (let x = -18; x <= 18; x += 3) {
      box(this.scene, "#648296", [x, 0.04, 0], [0.025, 0.02, 40]);
      box(this.scene, "#648296", [0, 0.04, x], [40, 0.02, 0.025]);
    }
    for (const x of [-20, 20]) {
      box(this.scene, "#93e6ed", [x, 0.3, 0], [0.12, 0.12, 40], true);
      box(this.scene, "#93e6ed", [0, 0.3, x], [40, 0.12, 0.12], true);
    }
    cylinder(this.scene, "#102b44", [0, 0.1, -3], [3.4, 0.2, 3.4]);
    cylinder(this.scene, "#64e5ff", [0, 0.22, -3], [3, 0.035, 3], true);
    cylinder(this.scene, "#18374e", [0, 0.26, -3], [2.85, 0.04, 2.85]);
    this.label("A", 0, 2, -3, "#a4f1ff", 3);
    for (const station of HUB_STATIONS) {
      const { x, z, color, name } = station;
      cylinder(this.scene, "#152438", [x, 0.18, z], [3.2, 0.36, 3.2]);
      cylinder(this.scene, color, [x, 0.38, z], [2.9, 0.035, 2.9], true);
      cylinder(this.scene, "#23354b", [x, 0.41, z], [2.75, 0.04, 2.75]);
      this.cameraObstacles.push(box(this.scene, "#172e48", [x, 2.8, z - 1.7], [6, 5.6, 0.7]));
      for (const side of [-1, 1]) box(this.scene, color, [x + side * 2.5, 2.6, z - 1.22], [0.13, 4.7, 0.12], true);
      box(this.scene, color, [x, 5, z - 1.22], [5.1, 0.14, 0.12], true);
      const portal = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.1, 8, 48), new THREE.MeshBasicMaterial({ color }));
      portal.position.set(x, 2.7, z - 1.16);
      this.scene.add(portal); this.portals.push(portal);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 }));
      orb.position.set(x, 2.7, z - 1.1);
      this.scene.add(orb); this.portals.push(orb);
      this.label(name, x, 6.1, z - 1, color, 7);
    }
    // A distant skyline frames the walkable plaza without obstructing the camera.
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const x = Math.cos(angle) * 38, z = Math.sin(angle) * 38;
      const height = 7 + (i * 7 % 17);
      box(this.scene, i % 2 ? "#243d57" : "#1c324c", [x, height / 2 - 4, z], [4, height, 4]);
      for (let y = 0; y < height - 2; y += 2)
        box(this.scene, "#56889c", [x, y - 2, z + (z < 0 ? 2.02 : -2.02)], [2.7, 0.35, 0.04], true);
    }
    for (const x of [-6, 6]) for (const z of [5, 11]) {
      cylinder(this.scene, "#14283a", [x, 0.3, z], [0.8, 0.6, 0.8]);
      cylinder(this.scene, "#506360", [x, 1.3, z], [0.13, 2, 0.13]);
      ball(this.scene, "#479586", [x, 2.7, z], [1.3, 1.6, 1.3]);
    }
  }
  buildPlayer() {
    const root = new THREE.Group();
    const torso = new THREE.Group();
    root.add(torso); root.userData.body = torso;
    box(torso, "#e4ecf4", [0, 1.25, 0], [0.8, 0.9, 0.45]);
    box(torso, "#2c648a", [0, 1.35, 0.24], [0.58, 0.3, 0.04]);
    box(torso, "#65edff", [0, 1.35, 0.28], [0.18, 0.18, 0.04], true);
    box(torso, "#d4a180", [0, 2.05, 0], [0.68, 0.68, 0.62]);
    box(torso, "#26364e", [0, 2.39, -0.05], [0.72, 0.18, 0.67]);
    box(torso, "#70dff5", [0, 2.1, 0.32], [0.57, 0.16, 0.04], true);
    root.userData.limbs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.23, 0.85, 0);
      box(leg, "#28374f", [0, -0.4, 0], [0.34, 0.8, 0.4]);
      box(leg, "#c6d8e5", [0, -0.72, 0.08], [0.38, 0.2, 0.56]);
      torso.add(leg); root.userData.limbs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.57, 1.6, 0);
      box(arm, "#4e8fac", [0, -0.3, 0], [0.3, 0.65, 0.35]);
      ball(arm, "#d4a180", [0, -0.7, 0], [0.17, 0.18, 0.18]);
      torso.add(arm); root.userData.limbs.push(arm);
    }
    return root;
  }
  render(dt) {
    if (!this.active) return;
    this.time += dt;
    const down = (...keys) => keys.some(k => this.keys.has(k));
    const x = this.blocked ? 0 : Number(down("KeyD", "ArrowRight")) - Number(down("KeyA", "ArrowLeft"));
    const z = this.blocked ? 0 : Number(down("KeyS", "ArrowDown")) - Number(down("KeyW", "ArrowUp"));
    const dx = x * Math.cos(this.yaw) + z * Math.sin(this.yaw);
    const dz = z * Math.cos(this.yaw) - x * Math.sin(this.yaw);
    const next = moveAvatar(this.player.position, dx, dz, dt);
    this.player.position.x = next.x; this.player.position.z = next.z;
    if (!this.blocked) {
      this.velocityY -= dt * 18;
      this.player.position.y = Math.max(0, this.player.position.y + this.velocityY * dt);
      if (this.player.position.y === 0) this.velocityY = 0;
    }
    if (x || z) this.player.rotation.y = Math.atan2(dx, dz);
    this.player.userData.limbs.forEach((limb, i) => {
      limb.rotation.x = (x || z) ? Math.sin(this.time * 12 + (i < 2 ? 0 : Math.PI)) * 0.5 * (i % 2 ? -1 : 1) : 0;
    });
    const target = this.player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    const offset = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.distance);
    this.scene.updateMatrixWorld(true);
    this.cameraRay.set(target, offset.clone().normalize());
    this.cameraRay.far = this.distance;
    const obstruction = this.cameraRay.intersectObjects(this.cameraObstacles)[0];
    if (obstruction) offset.setLength(Math.max(0.7, obstruction.distance - 0.45));
    if (obstruction) this.camera.position.copy(target).add(offset);
    else this.camera.position.lerp(target.clone().add(offset), 1 - Math.exp(-12 * dt));
    this.camera.lookAt(target);
    this.portals.forEach((p, i) => { p.rotation.z = this.time * (i % 2 ? 0.5 : -0.2); });
    this.nearby = nearbyStation(this.player.position);
    this.renderer.render(this.scene, this.camera);
  }
}
