import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const ids = ['cyclops', 'silver_surfer', 'nova', 'black_bolt', 'magneto', 'adam_warlock', 'ms_marvel', 'sentry', 'beta_ray_bill', 'yondu'];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const kit = hero.abilitySystem.energyReserveKit || (id === 'cyclops' ? hero.abilitySystem.mutantKit : hero.abilitySystem.cosmicKit);
    const spawn = (x = 120, y = id === 'cyclops' || id === 'silver_surfer' ? x : 0, extra = {}) => {
        const e = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra },
            [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(e, { x, y, distanceTravelled: x }); game.enemies.push(e); return e;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots; };
    const impact = shot => CombatSystem.applyImpact(shot, shot.target, hero, game.resourceManager);
    const tick = dt => kit.update(dt, game.enemies, hero.getEffectiveStats());
    return { hero, game, kit, spawn, shoot, impact, tick };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Cyclops ${level}: cambia linea, pierde carga; linea limita4`, () => {
        const f = setup('cyclops', level), a = f.spawn(80), b = f.spawn(80, -80);
        f.shoot(a); f.shoot(a); f.shoot(b); close(a.hp, a.maxHp); close(b.hp, b.maxHp);
        assert.equal(f.kit.opticCharge, 1);
        const aligned = Array.from({ length: 5 }, (_, i) => f.spawn(85 + i * 5, -85 - i * 5));
        f.shoot(b); f.shoot(b); assert.ok(b.hp < b.maxHp);
        assert.ok(aligned.slice(0, 3).every(e => e.hp < e.maxHp)); close(aligned[3].hp, aligned[3].maxHp);
    });
    test(`Surfer ${level}: trayectoria rinde mas lejos y limita6`, () => {
        const f = setup('silver_surfer', level), near = f.spawn(40), far = f.spawn(130);
        f.shoot(far); f.shoot(far);
        assert.ok(far.maxHp - far.hp > near.maxHp - near.hp);
        const more = Array.from({ length: 6 }, (_, i) => f.spawn(140 + i * 3));
        f.shoot(far); f.shoot(far); assert.ok(more.slice(0, 4).every(e => e.hp < e.maxHp));
        close(more[4].hp, more[4].maxHp);
    });
    test(`Nova ${level}: cinco disparos y6s, pulso acotado4`, () => {
        const f = setup('nova', level), enemies = Array.from({ length: 5 }, (_, i) => f.spawn(100 + i * 5));
        f.tick(6); for (let i = 0; i < 4; i++) f.shoot(enemies[0]);
        assert.ok(enemies.every(e => e.hp === e.maxHp)); f.shoot(enemies[0]);
        assert.ok(enemies.slice(0, 4).every(e => e.hp < e.maxHp)); close(enemies[4].hp, enemies[4].maxHp);
        assert.equal(f.kit.charge, 0); assert.equal(f.kit.cooldown, 6);
    });
    test(`Black Bolt ${level}: blanco estable, silencio1s y grito5`, () => {
        const f = setup('black_bolt', level), enemies = Array.from({ length: 6 }, (_, i) => f.spawn(150 + i * 4));
        f.tick(10); for (let i = 0; i < 3; i++) f.shoot(enemies[0]);
        assert.equal(f.kit.pending.kind, 'voice'); const damage = f.kit.pending.damage;
        assert.equal(f.shoot(enemies[0]).length, 0); f.hero.damage *= 2;
        f.tick(0.99); assert.ok(enemies.every(e => e.hp === e.maxHp)); f.tick(0.02);
        for (const e of enemies.slice(0, 5)) close(e.maxHp - e.hp, damage);
        close(enemies[5].hp, enemies[5].maxHp);
    });
    test(`Magneto ${level}: solo ruptura real genera fragmentos`, () => {
        const f = setup('magneto', level), target = f.spawn(150);
        f.tick(6); f.shoot(target); assert.equal(f.kit.charge, 0);
        for (let i = 0; i < 3; i++) {
            target.behavior.barrier = 1;
            CombatSystem.applyDamage({ damage: 2, attackerType: f.hero.category }, target, f.hero, f.game.resourceManager, 1);
        }
        assert.equal(f.kit.charge, 3); const before = target.hp; f.shoot(target);
        assert.ok(target.hp < before); assert.equal(f.kit.charge, 0); assert.equal(f.kit.cooldown, 6);
    });
    test(`Adam ${level}: capullo sin blancos, rafaga3 sin curacion`, () => {
        const f = setup('adam_warlock', level); f.tick(12);
        assert.equal(f.kit.pending.kind, 'cocoon'); const target = f.spawn();
        assert.equal(f.shoot(target).length, 0); f.tick(2);
        const damage = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 3; i++) close(f.shoot(target)[0].damage, damage * 1.45);
        close(f.shoot(target)[0].damage, damage); assert.equal(f.kit.burst, 0);
        assert.equal(f.game.resourceManager.lives, 20);
    });
    test(`Ms Marvel ${level}: impacto real inicia remate a otro blanco`, () => {
        const f = setup('ms_marvel', level), a = f.spawn(), b = f.spawn(140);
        f.tick(4); const shot = f.shoot(a)[0]; assert.equal(shot.chainCount, 0);
        f.tick(0.3); close(b.hp, b.maxHp); f.impact(shot); f.tick(0.22);
        close(b.maxHp - b.hp, f.hero.getEffectiveStats().damage * 1.05);
        f.tick(0.22); f.tick(0.22); assert.equal(f.kit.route, null);
    });
    test(`Sentry ${level}:6 ataques, descarga5, agotamiento2s`, () => {
        const f = setup('sentry', level), enemies = Array.from({ length: 6 }, (_, i) => f.spawn(90 + i * 5));
        f.tick(10); for (let i = 0; i < 6; i++) f.shoot(enemies[0]);
        assert.equal(f.kit.pending.kind, 'solar'); assert.equal(f.shoot(enemies[0]).length, 0);
        f.tick(0.5); assert.ok(enemies.slice(0, 5).every(e => e.hp < e.maxHp)); close(enemies[5].hp, enemies[5].maxHp);
        close(f.shoot(enemies[0])[0].damage, f.hero.getEffectiveStats().damage * 0.65); assert.equal(f.kit.charge, 0);
        f.tick(2); close(f.shoot(enemies[0])[0].damage, f.hero.getEffectiveStats().damage); assert.equal(f.kit.charge, 1);
    });
    test(`Bill ${level}: retorno solo primario, sin stun extra`, () => {
        const f = setup('beta_ray_bill', level), a = f.spawn(), b = f.spawn(130);
        f.tick(4); const shot = f.shoot(a)[0]; assert.equal(shot.chainCount, 1); f.impact(shot);
        const before = [a.hp, b.hp]; f.tick(0.59); close(before[0], a.hp); f.tick(0.02);
        close(before[0] - a.hp, f.hero.getEffectiveStats().damage * 1.2); close(before[1], b.hp);
        assert.equal(a.debuffs.filter(d => d.type === 'stun').length, 0);
    });
    test(`Yondu ${level}: una flecha, dos saltos distintos y retorno`, () => {
        const f = setup('yondu', level), a = f.spawn(), b = f.spawn(140), c = f.spawn(160), d = f.spawn(180);
        const shot = f.shoot(a)[0]; assert.equal(shot.chainCount, 0); assert.equal(f.shoot(a).length, 0);
        f.impact(shot); f.tick(0.22); assert.ok(b.hp < b.maxHp); close(c.hp, c.maxHp);
        f.tick(0.22); assert.ok(c.hp < c.maxHp); close(d.hp, d.maxHp);
        f.tick(0.22); assert.equal(f.shoot(a).length, 0); f.tick(0.22);
        assert.equal(f.shoot(a).length, 1);
    });
}

for (const id of ids) for (const action of ['move', 'stun', 'sell']) {
    test(`${id}: ${action} cancela cargas y pendientes sin alterar progreso`, () => {
        const f = setup(id, 50), target = f.spawn(150);
        f.tick(12); f.shoot(target);
        if (action === 'move') f.hero.x = 1;
        if (action === 'stun') f.hero.applyStun(1);
        if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
        f.hero.update(0, [], []);
        if (id === 'cyclops') assert.equal(f.kit.opticCharge, 0);
        else if (id === 'silver_surfer') assert.equal(f.kit.trajectoryCharge, 0);
        else { assert.equal(f.kit.charge, 0); assert.equal(f.kit.pending, null); assert.equal(f.kit.flight, null); assert.equal(f.kit.route, null); }
        assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.credits, 0); assert.equal(f.game.resourceManager.lives, 20);
    });
}

test('Black Bolt pierde preparacion si el blanco sale de la linea o muere', () => {
    for (const action of ['line', 'dead', 'escape']) {
        const f = setup('black_bolt'), a = f.spawn(150); f.tick(10);
        for (let i = 0; i < 3; i++) f.shoot(a);
        if (action === 'line') a.y = 80;
        if (action === 'dead') a.isAlive = false;
        if (action === 'escape') a.hasReachedEnd = true;
        f.tick(1); close(a.hp, a.maxHp); assert.equal(f.kit.pending, null);
    }
});

test('Magneto no carga con golpes parciales ni rupturas secundarias', () => {
    const f = setup('magneto'), a = f.spawn(150); a.behavior.barrier = 10;
    CombatSystem.applyDamage({ damage: 2 }, a, f.hero, f.game.resourceManager, 1); assert.equal(f.kit.charge, 0);
    CombatSystem.applyDamage({ damage: 20, secondaryEntity: true }, a, f.hero, f.game.resourceManager, 1); assert.equal(f.kit.charge, 0);
});

test('Rutas no persiguen ocultos, escapados ni fuera de cobertura; token viejo no inicia ruta', () => {
    for (const id of ['ms_marvel', 'yondu', 'beta_ray_bill']) {
        const f = setup(id), a = f.spawn(), hidden = f.spawn(130), escaped = f.spawn(140), outside = f.spawn(500);
        hidden.stealth = true; escaped.hasReachedEnd = true; f.tick(4);
        const shot = f.shoot(a)[0]; f.impact(shot); a.isAlive = false;
        for (let i = 0; i < 5; i++) f.tick(0.22);
        for (const e of [hidden, escaped, outside]) {
            // Bill retains one native incidental bounce; this assertion isolates the new route.
            if (id !== 'beta_ray_bill') close(e.hp, e.maxHp);
        }
        f.kit.reset(); f.kit.onImpact(shot, a); assert.equal(f.kit.route, null);
        shot.reset(0, 0, a, {}); assert.equal(shot.energyToken, null);
    }
});

test('Yondu recupera flecha si el primario muere antes del impacto', () => {
    const f = setup('yondu'), a = f.spawn(); f.shoot(a); a.isAlive = false; f.tick(0.1);
    assert.equal(f.kit.flight, null); assert.equal(f.shoot(f.spawn(140)).length, 1);
});

test('Descargas secundarias acreditan bajas sin recargar firmas', () => {
    const f = setup('nova'), a = f.spawn(120, 0, { hp: 1 }); let procs = 0;
    f.hero.abilitySystem.onKill = () => procs++; f.tick(6);
    for (let i = 0; i < 5; i++) f.shoot(a);
    assert.equal(a.isAlive, false); assert.equal(procs, 0); assert.equal(f.hero.combatStats.kills, 1);
});

test('Cyclops pierde carga por inactividad y modo; Surfer por modo', () => {
    const f = setup('cyclops'), a = f.spawn(80); f.shoot(a); f.tick(3); assert.equal(f.kit.opticCharge, 0);
    f.shoot(a); f.kit.setMode('ricochet'); assert.equal(f.kit.opticCharge, 0);
    const s = setup('silver_surfer'); s.shoot(s.spawn(80)); s.kit.setMode('control'); assert.equal(s.kit.trajectoryCharge, 0);
});

for (const level of [1, 50, 100]) for (const id of ids) {
    test(`${id} ${level}: combate real20s con proyectiles, sin vida/monedas extra`, () => {
        const f = setup(id, level), stats = f.hero.getEffectiveStats();
        const diagonal = id === 'cyclops' || id === 'silver_surfer';
        const offset = stats.range * (diagonal ? 0.45 : 0.65);
        let target;
        const shots = [];
        for (let frame = 0; frame < 1200; frame++) {
            if (!target && (id !== 'adam_warlock' || frame > 850)) target = f.spawn(offset, diagonal ? offset : 0);
            if (id === 'magneto' && target && target.behavior.barrier === 0) target.behavior.barrier = 1;
            f.hero.update(1 / 60, f.game.enemies, shots);
            for (const shot of shots) shot.update(1 / 60);
            for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].isActive) shots.splice(i, 1);
            assert.ok(shots.length < 20);
        }
        assert.ok(Number.isFinite(target.hp) && target.hp < target.maxHp);
        assert.ok(f.hero.combatStats.abilityActivations > 0, id);
        assert.equal(f.game.resourceManager.lives, 20); assert.equal(f.game.resourceManager.credits, 0);
        assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0);
    });
}
