import * as THREE from "three";
import { muzzleWeight } from "./repulsor-motion.js";
import { assetEvents, releaseHero } from "./hero-assets.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { HERO_BY_ID, ENEMIES, PIXELS_PER_UNIT } from "../game/combat-data.js";
import { getMission } from "../game/missions.js";
import { buildBattleMap } from "./battle-map.js";
import { heroModel, enemyModel } from "./models.js";

export class World {
  constructor(container, onPick, onHover) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#111c2d");
    this.scene.fog = new THREE.FogExp2("#111c2d", 0.009);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Mapa 3D de la Base Avengers. Seleccioná un héroe y hacé clic en una zona libre para desplegarlo.",
    );
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);
    this.container = container;
    const assetStatus = document.createElement("div");
    assetStatus.setAttribute("role", "status");
    Object.assign(assetStatus.style, { position: "absolute", bottom: "8px", left: "12px", color: "#d7efff", background: "#102030dd", padding: "4px 8px", pointerEvents: "none", fontSize: "12px" });
    assetStatus.hidden = true; container.append(assetStatus);
    assetEvents.addEventListener("status", event => { assetStatus.hidden = false; assetStatus.textContent = event.detail; });
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room, .04);
    this.scene.environment = this.environment.texture; room.dispose(); pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 19;
    this.controls.maxDistance = 65;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2.5;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    this.resetCamera();
    this.scene.add(new THREE.HemisphereLight(0xc7e6ff, 0x57516c, 2.6));
    const sun = new THREE.DirectionalLight(0xffdbaf, 3.6);
    sun.position.set(-15, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -24,
      right: 24,
      top: 24,
      bottom: -24,
      near: 1,
      far: 80,
    });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#77bfff", 1.8);
    rim.position.set(15, 15, -18);
    this.scene.add(rim);
    this.units = new Map();
    this.enemies = new Map();
    this.enemyPools = new Map();
    this.effects = [];
    this.projectiles = new Map();
    this.projectilePool = [];
    this.heroPool = new Map();
    this.labels = new Map();
    this.combatTexts = [];
    this.textPool = [];
    this.effectPool = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.buildMap();
    this.range = new THREE.Mesh(
      new THREE.RingGeometry(0.98, 1, 96),
      new THREE.MeshBasicMaterial({
        color: "#6ee7e1",
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.range.rotation.x = -Math.PI / 2;
    this.range.visible = false;
    this.scene.add(this.range);
    this.rangeFill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96),
      new THREE.MeshBasicMaterial({
        color: "#61d9df",
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.rangeFill.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { tint: { value: new THREE.Color() }, pattern: { value: 0 }, geometryScale: { value: 1 }, lane: { value: .16 } },
      vertexShader: 'varying vec2 p; void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 p; uniform vec3 tint; uniform float pattern; uniform float geometryScale; uniform float lane; void main(){if(pattern==1. && length(p)<.38*geometryScale) discard; if(pattern==2. && min(abs(p.x),abs(p.y))>lane) discard; if(pattern==3. && abs(abs(p.x)-abs(p.y))>lane) discard; gl_FragColor=vec4(tint,.16);}'
    });
    this.rangeFill.rotation.x = -Math.PI / 2;
    this.rangeFill.visible = false;
    this.scene.add(this.rangeFill);
    this.placementTile = new THREE.Mesh(
      new THREE.PlaneGeometry(.98, .98),
      new THREE.MeshBasicMaterial({
        color: "#7af5d0",
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    this.placementTile.rotation.x = -Math.PI / 2;
    this.placementTile.visible = false;
    this.scene.add(this.placementTile);
    let down;
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (
        e.button !== 0 ||
        !down ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7
      )
        return;
      const p = this.pickGround(e);
      if (p) onPick(p);
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      const p = this.pickGround(e);
      if (p) onHover(p);
    });
    this.renderer.domElement.addEventListener("pointerleave", () =>
      onHover(null),
    );
    this.renderer.domElement.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  resetCamera() {
    this.camera.position.set(15, 25, 27);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.zoom = Math.min(1, this.camera.aspect / 1.35);
    this.camera.updateProjectionMatrix();
  }
  pickGround(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Pick the visible hero before its ground footprint, including its head and cape.
    for (const [id, mesh] of this.units) {
      if (this.raycaster.intersectObject(mesh, true).length)
        return { x: mesh.position.x, z: mesh.position.z, unitId: id };
    }
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p)
      ? { x: p.x, z: p.z }
      : null;
  }
  label(text, x, y, z, color = "#b5dfff", width = 3.5) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    let size = 54;
    ctx.font = `bold ${size}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (ctx.measureText(text).width > 490) {
      size -= 2;
      ctx.font = `bold ${size}px system-ui`;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(width, width / 4, 1);
    this.scene.add(sprite);
    return sprite;
  }
  buildMap(id = "level_1") {
    this.mapCache ||= new Map();
    if (!this.mapCache.has(id)) this.mapCache.set(id, buildBattleMap(this, getMission(id)));
    if (this.mapGroup) this.scene.remove(this.mapGroup);
    const map = this.mapCache.get(id);
    this.mapGroup = map.group; this.portal = map.portal; this.shield = map.shield;
    this.scene.add(this.mapGroup); this.mapId = id;
    this.renderer.domElement.setAttribute("aria-label", `Mapa 3D: ${getMission(id).level.name}. Seleccioná un héroe y una zona libre para desplegarlo.`);
  }
  setPreview(heroId, point, game, selectedUnit, movingId = null) {
    if (point) point = game.snap(point);
    if (this.ghostId !== heroId) {
      if (this.ghost) { releaseHero(this.ghost); }
      this.ghost = heroId ? heroModel(HERO_BY_ID[heroId]) : null;
      this.ghostId = heroId;
      if (this.ghost) { this.ghost.scale.setScalar(.55); this.scene.add(this.ghost); }
    }
    const preview = heroId && point;
    if (this.ghost) this.ghost.visible = !!preview;
    this.placementTile.visible = !!preview;
    if (preview) {
      this.ghost.position.set(point.x, .15, point.z);
      const valid = !game.placementError(heroId, point.x, point.z, movingId);
      this.placementTile.material.color.set(valid ? "#74f5c6" : "#ff546a");
      this.placementTile.position.set(point.x, .3, point.z);
      this.placementTile.scale.setScalar(game.core.gridSize / PIXELS_PER_UNIT);
      const hero = game.preview(heroId, point), stats = hero.getEffectiveStats();
      this.showRange(point.x, point.z, stats.range / PIXELS_PER_UNIT, valid ? "#7df5dc" : "#ff6574", hero.rangePattern, stats.rangeGeometryScale);
    } else if (selectedUnit) {
      const stats = game.stats(selectedUnit);
      this.showRange(selectedUnit.x, selectedUnit.z, stats.range, HERO_BY_ID[selectedUnit.heroId].color, stats.pattern, stats.geometryScale);
    } else { this.range.visible = false; this.rangeFill.visible = false; }
  }
  showRange(x, z, radius, color, pattern = "circle", geometryScale = 1) {
    for (const [mesh, y] of [
      [this.range, 0.29],
      [this.rangeFill, 0.28],
    ]) {
      mesh.visible = true;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(radius);
      if (mesh === this.rangeFill) {
        mesh.material.uniforms.tint.value.set(color);
        mesh.material.uniforms.pattern.value = { circle: 0, ring: 1, cross: 2, x: 3 }[pattern] || 0;
        mesh.material.uniforms.geometryScale.value = geometryScale || 1;
        mesh.material.uniforms.lane.value = Math.max(18 / (radius * PIXELS_PER_UNIT), .16 * (geometryScale || 1));
      } else mesh.material.color.set(color);
    }
  }
  addEffect(event) {
    if (event.type === "text") {
      if (this.combatTexts.length >= 40) return;
      const sprite = this.textPool.pop() || this.label("", 0, 0, 0, "#fff", 1.8);
      const canvas = sprite.material.map.image, ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 58px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = "#102030"; ctx.lineWidth = 8; ctx.strokeText(String(event.value), 256, 64);
      ctx.fillStyle = event.color || "#f3f8ff"; ctx.fillText(String(event.value), 256, 64);
      sprite.material.map.needsUpdate = true; sprite.material.opacity = 1; sprite.visible = true;
      sprite.position.set(event.x, 1.5, event.z); sprite.userData.life = .75;
      this.combatTexts.push(sprite); return;
    }
    if (this.effects.length >= 160) return;
    const ring =
      event.type !== "attack" || ["slam", "magic"].includes(event.kind);
    const effect =
      this.effectPool.find((e) => e.ring === ring) || this.createEffect(ring);
    const index = this.effectPool.indexOf(effect);
    if (index >= 0) this.effectPool.splice(index, 1);
    effect.life = effect.maxLife = event.type === "attack" ? 0.24 : 0.55;
    effect.mesh.visible = true;
    effect.mesh.material.color.set(event.color || "#9af5e1");
    effect.mesh.material.opacity = 0.9;
    if (ring) {
      const p = event.to || event;
      effect.mesh.position.set(p.x, 0.36, p.z);
      effect.mesh.scale.setScalar(0.3);
      effect.radius = event.worldRadius || (event.kind === "slam" ? 2.4 : .65);
    } else {
      const points = [
        new THREE.Vector3(event.from.x, 1.5, event.from.z),
        ...(event.chain || [event.to]).map(
          (p) => new THREE.Vector3(p.x, 1, p.z),
        ),
      ];
      effect.mesh.geometry.setFromPoints(points);
      effect.mesh.geometry.computeBoundingSphere();
    }
    this.effects.push(effect);
  }
  createEffect(ring) {
    let mesh;
    if (ring) {
      mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1, 32),
        new THREE.MeshBasicMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
    } else
      mesh = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }),
      );
    this.scene.add(mesh);
    return { mesh, ring };
  }
  render(game, dt) {
    if (this.mapId !== game.missionId) this.buildMap(game.missionId);
    const activeUnits = new Set(game.units.map((u) => u.id));
    for (const [id, mesh] of this.units)
      if (!activeUnits.has(id)) {
        this.scene.remove(mesh);
        this.units.delete(id);
        this.heroPool.set(mesh.userData.heroId, mesh);
        if (this.labels.has(id)) {
          const label = this.labels.get(id); this.scene.remove(label);
          label.material.map.dispose(); label.material.dispose(); this.labels.delete(id);
        }
      }
    for (const u of game.units) {
      if (!this.units.has(u.id)) {
        const mesh = this.heroPool.get(u.heroId) || heroModel(HERO_BY_ID[u.heroId]);
        this.heroPool.delete(u.heroId); mesh.userData.heroId = u.heroId; mesh.scale.setScalar(.55);
        this.scene.add(mesh);
        this.units.set(u.id, mesh);
      }
      const mesh = this.units.get(u.id);
      mesh.position.set(u.x, 0.14, u.z);
      mesh.rotation.y = u.angle;

      mesh.userData.body.rotation.z = u.stunned ? .2 : 0;
      if (!this.labels.has(u.id)) this.labels.set(u.id, this.label(HERO_BY_ID[u.heroId].name, u.x, 1.65, u.z, HERO_BY_ID[u.heroId].color, 1.7));
      this.labels.get(u.id).visible = true;
      this.labels.get(u.id).position.set(u.x, 1.65, u.z);
      mesh.userData.body.position.y =
        0.25 + Math.sin(game.time * 2 + u.id) * 0.025;
      mesh.userData.animateCombat?.(game.time, u.lastShotTime, u.stunned);
    }
    const activeEnemies = new Set(game.enemies.map((e) => e.id));
    for (const [id, mesh] of this.enemies)
      if (!activeEnemies.has(id)) {
        mesh.visible = false;
        this.enemies.delete(id);
        if (!this.enemyPools.has(mesh.userData.kind))
          this.enemyPools.set(mesh.userData.kind, []);
        this.enemyPools.get(mesh.userData.kind).push(mesh);
      }
    for (const e of game.enemies) {
      if (!this.enemies.has(e.id)) {
        const mesh =
          this.enemyPools.get(e.kind)?.pop() ||
          enemyModel(ENEMIES[e.kind], e.isBoss ? "boss" : e.kind);
        if (!mesh.userData.privateHealthMaterial) {
          mesh.userData.health.material = mesh.userData.health.material.clone();
          mesh.userData.privateHealthMaterial = true;
          const halo = new THREE.Mesh(new THREE.RingGeometry(.65, .76, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
          halo.rotation.x = -Math.PI / 2; halo.position.y = .05;
          mesh.add(halo); mesh.userData.halo = halo;
        }
        mesh.userData.kind = e.kind;
        mesh.visible = true;
        this.scene.add(mesh);
        this.enemies.set(e.id, mesh);
      }
      const mesh = this.enemies.get(e.id);
      mesh.position.set(e.x, e.flying ? .65 : .15, e.z);
      mesh.userData.health.material.color.set(e.barrier > 0 ? "#7bdfff" : e.debuffs.includes("stun") ? "#ffd166" : e.debuffs.includes("web") ? "#eeeeff" : e.debuffs.includes("poison") ? "#77e492" : "#fb6477");
      mesh.userData.body.visible = !e.stealth || Math.floor(game.time * 4) % 2 === 0;
      const halo = mesh.userData.halo;
      halo.visible = e.barrier > 0 || e.debuffs.length > 0 || Boolean(e.telegraph);
      halo.material.color.set(e.telegraph ? "#ffbf49" : e.barrier > 0 ? "#7bdfff" : e.debuffs.includes("stun") ? "#ffd166" : e.debuffs.includes("web") ? "#eeeeff" : e.debuffs.includes("poison") ? "#77e492" : "#b78aff");
      halo.scale.setScalar(e.telegraph ? 1.2 + .4 * Math.sin(game.time * 10) : 1);
      mesh.rotation.y = e.angle;
      mesh.userData.body.position.y =
        Math.abs(Math.sin(game.time * e.speed * 5)) * 0.08;
      mesh.userData.limbs.forEach(
        (limb, i) =>
          (limb.rotation.x =
            Math.sin(game.time * e.speed * 5 + i * Math.PI) * 0.45),
      );
      mesh.userData.health.scale.x = Math.max(0.001, e.hp / e.maxHp) * 0.92;
      mesh.userData.health.position.x = -(1 - e.hp / e.maxHp) * 0.46;
      mesh.userData.bar.quaternion
        .copy(this.camera.quaternion)
        .premultiply(mesh.quaternion.clone().invert());
    }
    const liveProjectiles = new Set(game.projectiles.map(p => p.id));
    for (const [id, mesh] of this.projectiles) if (!liveProjectiles.has(id)) {
      mesh.visible = false; this.projectiles.delete(id); this.projectilePool.push(mesh);
    }
    for (const p of game.projectiles) {
      if (!this.projectiles.has(p.id)) {
        const mesh = this.projectilePool.pop() || new THREE.Mesh(new THREE.SphereGeometry(.075, 6, 6), new THREE.MeshBasicMaterial());
        mesh.userData.muzzleOffset = null;
        const shooter = this.units.get(p.attackerId);
        if (shooter?.userData.muzzlePosition && p.origin) {
          mesh.userData.muzzleOffset = shooter.userData.muzzlePosition().sub(new THREE.Vector3(p.origin.x, .85, p.origin.z));
        }
        mesh.visible = true; mesh.material.color.set(p.color || "#8ee5f3"); this.scene.add(mesh); this.projectiles.set(p.id, mesh);
      }
      const mesh = this.projectiles.get(p.id);
      mesh.position.set(p.x, .85, p.z);
      if (mesh.userData.muzzleOffset && p.origin) {
        const travelled = Math.hypot(p.x - p.origin.x, p.z - p.origin.z);
        mesh.position.addScaledVector(mesh.userData.muzzleOffset, muzzleWeight(travelled, p.distance));
      }
    }
    for (let i = this.combatTexts.length - 1; i >= 0; i--) {
      const sprite = this.combatTexts[i], elapsed = dt * (game.paused ? 0 : game.speed);
      sprite.userData.life -= elapsed; sprite.position.y += elapsed * .7;
      sprite.material.opacity = Math.max(0, sprite.userData.life / .75);
      if (sprite.userData.life <= 0) { sprite.visible = false; this.combatTexts.splice(i, 1); this.textPool.push(sprite); }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt * (game.paused ? 0 : game.speed);
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife);
      if (effect.ring)
        effect.mesh.scale.setScalar(
          0.3 + (1 - effect.life / effect.maxLife) * effect.radius,
        );
      if (effect.life <= 0) {
        effect.mesh.visible = false;
        this.effects.splice(i, 1);
        this.effectPool.push(effect);
      }
    }
    this.portal.rotation.z = game.time * 0.3;
    this.shield.material.opacity = 0.18 + Math.sin(game.time * 2) * 0.07;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  clear() {
    for (const mesh of this.units.values()) { this.scene.remove(mesh); this.heroPool.set(mesh.userData.heroId, mesh); }
    for (const label of this.labels.values()) { this.scene.remove(label); label.material.map.dispose(); label.material.dispose(); }
    this.labels.clear();
    for (const mesh of this.projectiles.values()) { mesh.visible = false; this.projectilePool.push(mesh); }
    this.projectiles.clear();
    for (const sprite of this.combatTexts) { sprite.visible = false; this.textPool.push(sprite); }
    this.combatTexts.length = 0;
    this.units.clear();
    for (const [id, mesh] of this.enemies) {
      mesh.visible = false;
      if (!this.enemyPools.has(mesh.userData.kind))
        this.enemyPools.set(mesh.userData.kind, []);
      this.enemyPools.get(mesh.userData.kind).push(mesh);
      this.enemies.delete(id);
    }
    for (const e of this.effects) {
      e.mesh.visible = false;
      this.effectPool.push(e);
    }
    this.effects.length = 0;
  }
}
