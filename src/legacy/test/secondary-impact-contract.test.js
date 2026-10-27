import test from 'node:test';
import assert from 'node:assert/strict';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';

const burn = { type: 'burn', duration: 3, power: 0.2, damageBasis: 'attackDamage', chance: 1 };
const base = { damage: 100, attackerType: 'neutral', effects: [burn] };
function target(x, options = {}) {
    return new Enemy({ id: `enemy-${x}`, hp: 1000, speed: 10, ...options }, [{ x, y: 0 }, { x: x + 500, y: 0 }]);
}
function attacker(enemies, random = () => 0) {
    return {
        x: 0, y: 0, range: 10, rangePattern: 'ring', damage: 100, items: [],
        game: { enemies, random: { next: random }, vfx: { addBeam() {}, addBurst() {} } }
    };
}

test('splash es dano incidental fuera del rango, incluso sigilo/voladores, sin estados', () => {
    const primary = target(100);
    const nearby = target(120, { stealth: true, flying: true });
    const far = target(151);
    const source = attacker([primary, nearby, far]);
    const result = CombatSystem.applyImpact({ ...base, splashRadius: 30, splashFactor: 0.5 }, primary, source);
    assert.equal(result.hits, 2);
    assert.equal(nearby.hp, 950);
    assert.equal(nearby.debuffs.length, 0);
    assert.equal(primary.debuffs[0].damagePerSecond, 20);
    assert.equal(far.hp, 1000);
});

test('rebote visita vecinos una vez y reduce dano por salto sin transmitir estados', () => {
    const enemies = [target(100), target(120, { stealth: true }), target(140), target(181)];
    const result = CombatSystem.applyImpact({ ...base, chainCount: 5, chainRange: 25, chainFactor: 0.5 }, enemies[0], attacker(enemies));
    assert.equal(result.hits, 3);
    assert.deepEqual(enemies.map((e) => e.hp), [900, 950, 975, 1000]);
    assert.deepEqual(enemies.map((e) => e.debuffs.length), [1, 0, 0, 0]);
});

test('propagacion usa radio del impacto inicial y no se replica recursivamente', () => {
    const enemies = [target(100), target(120, { stealth: true, flying: true }), target(145), target(165)];
    const source = attacker(enemies);
    const result = CombatSystem.applyImpact({ ...base, propagationCount: 2, propagationRadius: 50, propagationFactor: 0.4 }, enemies[0], source);
    assert.equal(result.hits, 3);
    assert.deepEqual(enemies.map((e) => e.hp), [900, 960, 960, 1000]);
    assert.deepEqual(enemies.map((e) => e.debuffs.length), [1, 1, 1, 0]);
    for (const e of enemies.slice(0, 3)) {
        assert.equal(e.debuffs[0].damagePerSecond, 20);
        assert.equal(e.debuffs[0].source, source);
    }
});

test('propagacion tira la probabilidad por destinatario, sin copiar exito del principal', () => {
    const enemies = [target(100), target(110), target(120)];
    const rolls = [0.8, 0.2, 0.8];
    const source = attacker(enemies, () => rolls.shift());
    CombatSystem.applyImpact({ ...base, effects: [{ ...burn, chance: 0.5 }], propagationCount: 2, propagationRadius: 50, propagationFactor: 0.4 }, enemies[0], source);
    assert.deepEqual(enemies.map((e) => e.debuffs.length), [0, 1, 0]);
    assert.equal(rolls.length, 0);
});

test('cero probabilidad nunca aplica estados aunque el generador devuelva cero', () => {
    const enemies = [target(100), target(110)];
    CombatSystem.applyImpact({ ...base, effects: [{ ...burn, chance: 0 }], propagationCount: 1, propagationRadius: 50, propagationFactor: 0.4 }, enemies[0], attacker(enemies));
    assert.deepEqual(enemies.map((e) => e.debuffs.length), [0, 0]);
});

test('probabilidad uno o implicita aplica; el limite exacto no cuenta como exito', () => {
    const primary = target(100);
    const source = attacker([primary], () => 0.5);
    CombatSystem.applyEffects([{ ...burn, chance: 0.5 }], primary, source);
    assert.equal(primary.debuffs.length, 0);
    CombatSystem.applyEffects([{ ...burn, chance: undefined }], primary, source);
    assert.equal(primary.debuffs.length, 1);
});

test('matar al principal no cancela propagacion ni aplica estados a cadaveres', () => {
    const enemies = [target(100, { hp: 10 }), target(110, { hp: 10 }), target(120)];
    const source = attacker(enemies);
    const kills = [];
    source.recordKill = (_resources, victim) => kills.push(victim);
    CombatSystem.applyImpact({ ...base, propagationCount: 2, propagationRadius: 50, propagationFactor: 0.4 }, enemies[0], source);
    assert.deepEqual(kills, enemies.slice(0, 2));
    assert.deepEqual(enemies.map((e) => e.debuffs.length), [0, 0, 1]);
    CombatSystem.applyImpact(base, enemies[0], source);
    assert.equal(kills.length, 2);
});

test('combinar splash, rebote y propagacion no duplica stacks ni monedas por victima', () => {
    const enemies = [target(100), target(110), target(120)];
    const source = attacker(enemies);
    source.items = [{ effects: { onHitCredit: 1 } }];
    let credits = 0;
    const resources = { addCredits: (amount) => { credits += amount; }, addLife: () => assert.fail('No se cura la base') };
    const poison = { type: 'poison', duration: 3, power: 0.001, chance: 1 };
    const projectile = { ...base, effects: [poison, { type: 'heal', chance: 1 }], splashRadius: 30, splashFactor: 0.5, chainCount: 2, chainRange: 30, chainFactor: 0.5, propagationCount: 2, propagationRadius: 30, propagationFactor: 0.4 };
    CombatSystem.applyImpact(projectile, enemies[0], source, resources);
    assert.equal(credits, 1);
    assert.deepEqual(enemies.map((e) => e.debuffs.map((d) => [d.type, d.stacks])), [[['poison', 1]], [['poison', 1]], [['poison', 1]]]);
    assert.deepEqual(enemies.map((e) => e.hp), [900, 860, 885]);
});

test('quemadura propagada debil no roba la autoria a un estado mas fuerte', () => {
    const enemies = [target(100), target(110, { hp: 80 })];
    const strong = attacker(enemies);
    let kills = 0;
    strong.recordKill = (_resources, victim) => { assert.equal(victim, enemies[1]); kills++; };
    enemies[1].applyStatus({ ...burn, power: 1 }, strong);
    const weak = attacker(enemies);
    weak.recordKill = () => assert.fail('Baja atribuida al estado debil');
    CombatSystem.applyImpact({ ...base, propagationCount: 1, propagationRadius: 30, propagationFactor: 0.1 }, enemies[0], weak);
    enemies[1].updateDebuffs(1);
    assert.equal(kills, 1);
    assert.equal(enemies[1].hp, 0);
});
