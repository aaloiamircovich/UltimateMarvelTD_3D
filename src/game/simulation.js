import {
  HERO_BY_ID,
  PATH,
  BUILDINGS,
  OBSTACLES,
  ENEMIES,
  MAX_UNITS,
  WAVE_COUNT,
  PRIORITIES,
  waveDefinition,
} from "./data.js";

export const squaredDistance = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const segments = PATH.slice(1).map((p, i) => ({
  a: PATH[i],
  b: p,
  length: Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]),
}));
export const PATH_LENGTH = segments.reduce((sum, s) => sum + s.length, 0);
export function pathPosition(distance) {
  let remaining = Math.max(0, distance);
  for (const { a, b, length } of segments) {
    if (remaining <= length) {
      const t = remaining / length;
      return {
        x: a[0] + (b[0] - a[0]) * t,
        z: a[1] + (b[1] - a[1]) * t,
        angle: Math.atan2(b[0] - a[0], b[1] - a[1]),
      };
    }
    remaining -= length;
  }
  return { x: PATH.at(-1)[0], z: PATH.at(-1)[1], angle: Math.PI / 2 };
}
export function distanceToPath(x, z) {
  return Math.min(
    ...segments.map(({ a, b, length }) => {
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) /
            length ** 2,
        ),
      );
      return Math.hypot(
        x - a[0] - t * (b[0] - a[0]),
        z - a[1] - t * (b[1] - a[1]),
      );
    }),
  );
}
export function placementError(x, z, units = []) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > 14 ||
    Math.abs(z) > 9
  )
    return "Fuera del área de despliegue";
  if (distanceToPath(x, z) < 1.8) return "La avenida debe quedar libre";
  if (
    BUILDINGS.some(
      (b) =>
        Math.abs(x - b.x) < b.w / 2 + 0.65 &&
        Math.abs(z - b.z) < b.d / 2 + 0.65,
    )
  )
    return "No se puede desplegar sobre edificios";
  if (
    OBSTACLES.some(
      (b) =>
        Math.abs(x - b.x) < b.w / 2 + 0.55 &&
        Math.abs(z - b.z) < b.d / 2 + 0.55,
    )
  )
    return "Hay un objeto de la ciudad en este espacio";
  if (units.some((u) => Math.abs(x - u.x) < 1.25 && Math.abs(z - u.z) < 1.25))
    return "Este espacio ya está ocupado";
  return null;
}
export function selectTarget(enemies, unit, range) {
  const candidates = enemies.filter(
    (e) => e.hp > 0 && squaredDistance(e, unit) <= range ** 2,
  );
  candidates.sort((a, b) =>
    unit.priority === "Fuerte"
      ? b.hp - a.hp || b.distance - a.distance
      : unit.priority === "Último"
        ? a.distance - b.distance
        : b.distance - a.distance,
  );
  return candidates[0];
}

// No DOM, WebGL or wall clock: the same simulation runs in browser and balance tests.
export class Game {
  constructor() {
    this.reset();
  }
  reset() {
    this.cash = 1000;
    this.health = 100;
    this.wave = 0;
    this.kills = 0;
    this.units = [];
    this.enemies = [];
    this.events = [];
    this.nextId = 1;
    this.phase = "preparing";
    this.paused = false;
    this.speed = 1;
    this.auto = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.betweenTimer = 4;
    this.time = 0;
  }
  get avengerCount() {
    return new Set(
      this.units
        .filter((u) => HERO_BY_ID[u.heroId].avenger)
        .map((u) => u.heroId),
    ).size;
  }
  stats(unit) {
    const h = HERO_BY_ID[unit.heroId];
    const aura = this.units.some(
      (a) =>
        a.id !== unit.id &&
        a.heroId === "capitan_america" &&
        squaredDistance(a, unit) <=
          (HERO_BY_ID[a.heroId].range + (a.level - 1) * 0.4) ** 2,
    );
    return {
      damage: Math.round(
        h.damage *
          1.58 ** (unit.level - 1) *
          (aura ? 1.25 : 1) *
          (this.avengerCount >= 3 && h.avenger ? 1.1 : 1),
      ),
      range: h.range + (unit.level - 1) * 0.4,
      interval: h.interval * 0.94 ** (unit.level - 1),
      upgradeCost:
        unit.level >= 4 ? null : Math.round(h.cost * 0.8 * unit.level ** 1.35),
      sellValue: Math.floor(unit.invested * 0.7),
      aura,
    };
  }
  deploy(heroId, x, z) {
    if (!["preparing", "combat"].includes(this.phase))
      return { error: "La misión ya terminó" };
    const h = HERO_BY_ID[heroId];
    if (!h) return { error: "Héroe desconocido" };
    if (this.units.length >= MAX_UNITS)
      return { error: "Límite de 12 unidades alcanzado" };
    if (this.cash < h.cost) return { error: "Créditos insuficientes" };
    x = Math.round(x);
    z = Math.round(z);
    const error = placementError(x, z, this.units);
    if (error) return { error };
    const unit = {
      id: this.nextId++,
      heroId,
      x,
      z,
      level: 1,
      invested: h.cost,
      cooldown: 0,
      shots: 0,
      damageDealt: 0,
      priority: "Primero",
      angle: Math.PI,
    };
    this.units.push(unit);
    this.cash -= h.cost;
    this.events.push({ type: "deploy", x, z, color: h.color });
    return { unit };
  }
  upgrade(id) {
    if (!["preparing", "combat"].includes(this.phase)) return false;
    const u = this.units.find((u) => u.id === id);
    if (!u) return false;
    const cost = this.stats(u).upgradeCost;
    if (cost === null || this.cash < cost) return false;
    this.cash -= cost;
    u.invested += cost;
    u.level++;
    this.events.push({
      type: "upgrade",
      x: u.x,
      z: u.z,
      color: HERO_BY_ID[u.heroId].color,
    });
    return true;
  }
  sell(id) {
    if (!["preparing", "combat"].includes(this.phase)) return false;
    const u = this.units.find((u) => u.id === id);
    if (!u) return false;
    this.cash += this.stats(u).sellValue;
    this.units = this.units.filter((a) => a !== u);
    return true;
  }
  cyclePriority(id) {
    const u = this.units.find((u) => u.id === id);
    if (u)
      u.priority =
        PRIORITIES[(PRIORITIES.indexOf(u.priority) + 1) % PRIORITIES.length];
  }
  startWave() {
    if (this.phase !== "preparing" || this.wave >= WAVE_COUNT || this.paused)
      return false;
    this.wave++;
    this.definition = waveDefinition(this.wave);
    this.spawnQueue = [...this.definition.enemies];
    this.spawnTimer = 0;
    this.phase = "combat";
    this.events.push({ type: "wave", wave: this.wave });
    return true;
  }
  spawn(kind) {
    const d = ENEMIES[kind];
    const hp = Math.round(
      d.hp *
        this.definition.multiplier *
        (kind === "boss" && this.wave === 6 ? 0.65 : 1),
    );
    const e = {
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      distance: 0,
      speed: d.speed,
      slow: 1,
      slowTime: 0,
      ...pathPosition(0),
    };
    this.enemies.push(e);
    if (kind === "boss") this.events.push({ type: "boss" });
  }
  hit(enemy, damage, unit, slow = 1) {
    if (enemy.hp <= 0) return;
    const dealt = Math.min(enemy.hp, damage);
    enemy.hp -= damage;
    unit.damageDealt += dealt;
    if (slow < 1) {
      enemy.slow = Math.min(enemy.slow, slow);
      enemy.slowTime = 2;
    }
    if (enemy.hp <= 0) {
      this.cash += ENEMIES[enemy.kind].reward;
      this.kills++;
      this.events.push({
        type: "kill",
        x: enemy.x,
        z: enemy.z,
        color: "#ffca6a",
      });
    }
  }
  attack(unit, target, stats) {
    const h = HERO_BY_ID[unit.heroId];
    unit.shots++;
    unit.angle = Math.atan2(target.x - unit.x, target.z - unit.z);
    const damage =
      stats.damage * (h.kind === "beam" && unit.shots % 3 === 0 ? 2 : 1);
    const event = {
      type: "attack",
      kind: h.kind,
      from: { x: unit.x, z: unit.z },
      to: { x: target.x, z: target.z },
      color: h.color,
    };
    if (h.kind === "chain") {
      const chain = [target];
      while (chain.length < 3) {
        const next = this.enemies
          .filter(
            (e) =>
              e.hp > 0 &&
              !chain.includes(e) &&
              squaredDistance(e, chain.at(-1)) <= 3.5 ** 2,
          )
          .sort(
            (a, b) =>
              squaredDistance(a, chain.at(-1)) -
              squaredDistance(b, chain.at(-1)),
          )[0];
        if (!next) break;
        chain.push(next);
      }
      event.chain = chain.map((e) => ({ x: e.x, z: e.z }));
      chain.forEach((e, i) => this.hit(e, damage * 0.7 ** i, unit));
    } else if (h.kind === "slam" || h.kind === "magic") {
      const radius = h.kind === "slam" ? 2.4 : 2;
      this.enemies
        .filter((e) => squaredDistance(e, target) <= radius ** 2)
        .forEach((e) =>
          this.hit(e, damage, unit, h.kind === "magic" ? 0.7 : 1),
        );
    } else this.hit(target, damage, unit, h.kind === "web" ? 0.6 : 1);
    this.events.push(event);
  }
  update(dt) {
    if (this.paused || !["preparing", "combat"].includes(this.phase)) return;
    // Bound integration so a delayed frame cannot skip combat or enemy route segments.
    let left = Math.max(0, Math.min(dt, 0.25)) * this.speed;
    while (left > 0) {
      const step = Math.min(left, 1 / 30);
      this.step(step);
      left -= step;
    }
  }
  step(dt) {
    if (!["preparing", "combat"].includes(this.phase)) return;
    this.time += dt;
    if (this.phase === "preparing") {
      if (this.auto && this.wave > 0) {
        this.betweenTimer -= dt;
        if (this.betweenTimer <= 0) this.startWave();
      }
      return;
    }
    this.spawnTimer -= dt;
    while (this.spawnTimer <= 0 && this.spawnQueue.length) {
      this.spawn(this.spawnQueue.shift());
      this.spawnTimer += this.definition.interval;
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.slowTime = Math.max(0, e.slowTime - dt);
      if (e.slowTime === 0) e.slow = 1;
      e.distance += e.speed * e.slow * dt;
      Object.assign(e, pathPosition(e.distance));
      if (e.distance >= PATH_LENGTH) {
        e.hp = 0;
        this.health = Math.max(0, this.health - ENEMIES[e.kind].damage);
        this.events.push({ type: "leak" });
      }
    }
    if (this.health <= 0) {
      this.phase = "defeat";
      this.events.push({ type: "end" });
      return;
    }
    for (const u of this.units) {
      if (HERO_BY_ID[u.heroId].kind === "aura") continue;
      u.cooldown = Math.max(0, u.cooldown - dt);
      if (u.cooldown > 0) continue;
      const stats = this.stats(u),
        target = selectTarget(this.enemies, u, stats.range);
      if (target) {
        this.attack(u, target, stats);
        u.cooldown = stats.interval;
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (!this.spawnQueue.length && !this.enemies.length) {
      this.cash += this.definition.bonus;
      this.betweenTimer = 4;
      this.phase = this.wave === WAVE_COUNT ? "victory" : "preparing";
      this.events.push({
        type: this.phase === "victory" ? "end" : "clear",
        bonus: this.definition.bonus,
      });
    }
  }
  drainEvents() {
    return this.events.splice(0);
  }
}
