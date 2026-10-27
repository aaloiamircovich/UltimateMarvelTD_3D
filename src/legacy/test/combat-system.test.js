import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { Hero } from '../src/entities/Hero.js';

test('CombatSystem aplica ventaja de tipo', () => {
    let received = 0;
    const target = createTarget('Urbano', (damage) => {
        received = damage;
        return { damage, killed: false };
    });

    CombatSystem.applyImpact({
        attackerType: 'Tecnológico',
        damage: 20,
        effects: []
    }, target, null, null);

    assert.equal(received, 30);
});

test('Contrato Stark genera un credito por impacto', () => {
    let credits = 0;
    const attacker = { items: [{ id: 'contrato_stark', effects: { onHitCredit: 1 } }], killCount: 0 };
    const target = createTarget('Urbano', (damage) => ({ damage, killed: false }));

    CombatSystem.applyImpact({ attackerType: 'Urbano', damage: 10, effects: [] }, target, attacker, {
        addCredits: (amount) => { credits += amount; }
    });

    assert.equal(credits, 1);
});

test('Las bajas de heroes no curan la base', () => {
    let lives = 0;
    const attacker = {
        items: [],
        killCount: 14
    };
    const target = createTarget('Urbano', (damage) => ({ damage, killed: true }));

    CombatSystem.applyImpact({ attackerType: 'Urbano', damage: 10, effects: [] }, target, attacker, {
        addLife: (amount) => { lives += amount; }
    });

    assert.equal(lives, 0);
    assert.equal(attacker.killCount, 15);
});

test('CombatSystem aplica dano de area solo dentro del radio', () => {
    const primary = createPositionedTarget(0, 0);
    const near = createPositionedTarget(20, 0);
    const far = createPositionedTarget(80, 0);
    const attacker = createAttacker([primary, near, far]);

    const result = CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 20,
        effects: [],
        splashRadius: 35,
        splashFactor: 0.5
    }, primary, attacker, null);

    assert.equal(primary.hp, 80);
    assert.equal(near.hp, 90);
    assert.equal(far.hp, 100);
    assert.equal(result.hits, 2);
});

test('CombatSystem encadena objetivos cercanos con dano decreciente', () => {
    const targets = [
        createPositionedTarget(0, 0),
        createPositionedTarget(20, 0),
        createPositionedTarget(40, 0)
    ];
    const attacker = createAttacker(targets);

    const result = CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 20,
        effects: [],
        chainCount: 2,
        chainRange: 25,
        chainFactor: 0.5
    }, targets[0], attacker, null);

    assert.deepEqual(targets.map((target) => target.hp), [80, 90, 95]);
    assert.equal(result.hits, 3);
    assert.equal(attacker.damageDealt, 35);
});

test('CombatSystem propaga dano y estados a enemigos agrupados', () => {
    const targets = [
        createPositionedTarget(0, 0),
        createPositionedTarget(30, 0),
        createPositionedTarget(55, 0),
        createPositionedTarget(140, 0)
    ];
    const applied = [];
    targets.forEach((target) => {
        target.applyStatus = (effect) => applied.push([target.x, effect.type]);
    });
    const attacker = createAttacker(targets);

    const result = CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 30,
        effects: [{ type: 'slow', duration: 1, power: 0.2, chance: 1 }],
        propagationCount: 2,
        propagationRadius: 70,
        propagationFactor: 0.4
    }, targets[0], attacker, null);

    assert.deepEqual(targets.map((target) => target.hp), [70, 88, 88, 100]);
    assert.deepEqual(applied, [[0, 'slow'], [30, 'slow'], [55, 'slow']]);
    assert.equal(result.hits, 3);
});

test('CombatSystem usa la fuente aleatoria sembrada para efectos', () => {
    let applied = 0;
    const target = createTarget('Urbano', (damage) => ({ damage, killed: false }));
    target.applyStatus = () => { applied++; };
    const attacker = {
        items: [],
        game: { random: { next: () => 0.8 }, enemies: [] }
    };

    CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 10,
        effects: [{ type: 'stun', duration: 1, power: 1, chance: 0.5 }]
    }, target, attacker, null);

    assert.equal(applied, 0);
});

test('CombatSystem ignora efectos heal de proyectiles de heroes', () => {
    let lives = 0;
    const target = createTarget('Urbano', (damage) => ({ damage, killed: false }));
    const attacker = {
        items: [],
        game: {
            enemies: [],
            random: { next: () => 0 },
            resourceManager: { addLife: (amount) => { lives += amount; } }
        }
    };

    CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 10,
        effects: [{ type: 'heal', power: 1, chance: 1 }]
    }, target, attacker, null);

    assert.equal(lives, 0);
});

test('CombatSystem no aplica heal como estado del enemigo', () => {
    const applied = [];
    const target = createTarget('Urbano', (damage) => ({ damage, killed: false }));
    target.applyStatus = (effect) => applied.push(effect.type);
    const attacker = {
        items: [],
        game: {
            enemies: [],
            random: { next: () => 0 },
            resourceManager: { addLife: () => {} }
        }
    };

    CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 10,
        effects: [{ type: 'heal', power: 1, chance: 1 }]
    }, target, attacker, null);

    assert.deepEqual(applied, []);
});

test('CombatSystem describe feedback visual de impacto por critico y KO', () => {
    const critical = CombatSystem.buildImpactVfxState({ attackerType: 'Urbano', critical: true }, { damage: 20, killed: false });
    const killed = CombatSystem.buildImpactVfxState({ attackerType: 'Urbano', color: '#123456' }, { damage: 20, killed: true });

    assert.equal(critical.kind, 'critical');
    assert.equal(critical.color, '#ff6b6b');
    assert.equal(killed.kind, 'ko');
    assert.equal(killed.color, '#ffdf6f');
    assert.ok(killed.radius > critical.radius);
});

test('CombatSystem emite burst de impacto sin depender del texto flotante', () => {
    const bursts = [];
    const target = createPositionedTarget(12, 24);
    const attacker = createAttacker([target]);
    attacker.game.showCombatText = false;
    attacker.game.vfx = {
        addBurst: (...args) => bursts.push(args)
    };

    CombatSystem.applyImpact({
        attackerType: 'TecnolÃ³gico',
        damage: 20,
        color: '#40c9ff',
        effects: []
    }, target, attacker, null);

    assert.equal(bursts.length, 1);
    assert.deepEqual(bursts[0].slice(0, 2), [12, 24]);
    assert.equal(bursts[0][2].kind, 'hit');
    assert.equal(bursts[0][2].color, '#40c9ff');
});

test('CombatSystem emite texto flotante para impactos criticos y bajas', () => {
    const floating = [];
    const target = createPositionedTarget(0, 0);
    target.hp = 20;
    const attacker = createAttacker([target]);
    attacker.game.vfx = {
        addFloatingText: (...args) => floating.push(args)
    };

    CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 50,
        critical: true,
        color: '#40c9ff',
        effects: []
    }, target, attacker, null);

    assert.equal(floating.length, 1);
    assert.equal(floating[0][2], 'KO 20');
    assert.equal(floating[0][3].color, '#ffdf6f');
    assert.equal(floating[0][3].size, 17);
});

test('CombatSystem respeta ajuste para ocultar texto flotante de combate', () => {
    const floating = [];
    const target = createPositionedTarget(0, 0);
    const attacker = createAttacker([target]);
    attacker.game.showCombatText = false;
    attacker.game.vfx = {
        addFloatingText: (...args) => floating.push(args)
    };

    CombatSystem.applyImpact({
        attackerType: 'Urbano',
        damage: 20,
        color: '#40c9ff',
        effects: []
    }, target, attacker, null);

    assert.equal(floating.length, 0);
});

test('Hero acumula control, ruptura, marcas y deteccion', () => {
    const hero = new Hero({
        id: 'black_widow',
        name: 'Black Widow',
        damage: 10,
        range: 100,
        fireRate: 1,
        canSeeStealth: true
    }, 0, 0, {
        resourceManager: { lives: 20 },
        progression: null,
        teamSynergy: null
    });
    const stealthTarget = { stealth: true };

    hero.recordStatusApplied({ type: 'slow', duration: 2.2 }, stealthTarget);
    hero.recordStatusApplied({ type: 'stun', duration: 0.5 }, stealthTarget);
    hero.recordStatusApplied({ type: 'armorBreak', duration: 2 }, stealthTarget);
    hero.recordStatusApplied({ type: 'mark', duration: 2 }, stealthTarget);

    assert.equal(hero.combatStats.controlSeconds, 2.7);
    assert.equal(hero.combatStats.armorBreaks, 1);
    assert.equal(hero.combatStats.marks, 1);
    assert.equal(hero.combatStats.detectionReveals, 4);
});

function createTarget(category, takeDamage) {
    return {
        category,
        isAlive: true,
        armor: 0,
        takeDamage,
        applyDebuff: () => {}
    };
}

function createPositionedTarget(x, y) {
    return {
        x,
        y,
        hp: 100,
        category: 'Urbano',
        isAlive: true,
        armor: 0,
        debuffs: [],
        takeDamage(amount) {
            const damage = Math.min(this.hp, amount);
            this.hp -= damage;
            this.isAlive = this.hp > 0;
            return { damage, killed: !this.isAlive };
        },
        applyStatus: () => {}
    };
}

function createAttacker(enemies) {
    return {
        items: [],
        damageDealt: 0,
        game: { enemies, random: { next: () => 0 } },
        recordDamage(amount) {
            this.damageDealt += amount;
        }
    };
}
