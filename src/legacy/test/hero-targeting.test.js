import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroTargetIntent, Hero } from '../src/entities/Hero.js';

test('prioridad Rapido elige mayor velocidad', () => {
    const hero = createHero('Rápido');
    const slow = createTarget({ speed: 30, distanceTravelled: 90 });
    const fast = createTarget({ speed: 90, distanceTravelled: 20 });
    assert.equal(hero.getBestTarget([slow, fast], hero.getEffectiveStats()), fast);
});

test('prioridad Sigilo prefiere unidades ocultas detectables', () => {
    const hero = createHero('Sigilo', true);
    const visible = createTarget({ distanceTravelled: 100 });
    const stealth = createTarget({ stealth: true, distanceTravelled: 10 });
    assert.equal(hero.getBestTarget([visible, stealth], hero.getEffectiveStats()), stealth);
});

test('prioridad Jefe usa amenaza como desempate', () => {
    const hero = createHero('Jefe');
    const soldier = createTarget({ threat: 5, distanceTravelled: 100 });
    const lesserBoss = createTarget({ isBoss: true, threat: 3, distanceTravelled: 80 });
    const mainBoss = createTarget({ isBoss: true, threat: 5, distanceTravelled: 10 });
    assert.equal(hero.getBestTarget([soldier, lesserBoss, mainBoss], hero.getEffectiveStats()), mainBoss);
});

test('buildHeroTargetIntent resume objetivo visible del heroe seleccionado', () => {
    const hero = createHero('Jefe');
    const boss = createTarget({ uid: 'boss-1', name: 'Loki', isBoss: true, threat: 5, x: 120, y: 0 });
    const intent = buildHeroTargetIntent(hero, [createTarget({ distanceTravelled: 100 }), boss]);

    assert.equal(intent.targetId, 'boss-1');
    assert.equal(intent.targetName, 'Loki');
    assert.equal(intent.priority, 'Jefe');
    assert.equal(intent.distance, 120);
    assert.equal(intent.danger, 'critical');
});

test('buildHeroTargetIntent se oculta sin enemigos en rango', () => {
    const hero = createHero('Primero');
    const far = createTarget({ x: 500, y: 0 });

    assert.equal(buildHeroTargetIntent(hero, [far]), null);
});

test('rango en anillo ignora enemigos pegados al heroe', () => {
    const hero = createHero('Primero', false, { rangePattern: 'ring', range: 200 });
    const close = createTarget({ x: 40, y: 0, distanceTravelled: 200 });
    const ring = createTarget({ x: 120, y: 0, distanceTravelled: 80 });

    assert.equal(hero.getBestTarget([close, ring], hero.getEffectiveStats()), ring);
});

test('rango en cruz solo cubre carriles cardinales', () => {
    const hero = createHero('Primero', false, { rangePattern: 'cross', range: 200 });
    const diagonal = createTarget({ x: 90, y: 90, distanceTravelled: 200 });
    const horizontal = createTarget({ x: 150, y: 8, distanceTravelled: 80 });

    assert.equal(hero.getBestTarget([diagonal, horizontal], hero.getEffectiveStats()), horizontal);
});

function createHero(priority, canSeeStealth = false, overrides = {}) {
    return new Hero({
        id: 'test', name: 'Test', damage: 10, range: 300, fireRate: 1,
        targetingPriority: priority, canSeeStealth, allowedTerrains: [1],
        ...overrides
    }, 0, 0, {
        heroes: [], resourceManager: { lives: 20 },
        progression: null, showHeroRanges: false
    });
}

function createTarget(overrides = {}) {
    return {
        x: 50, y: 0, hp: 100, speed: 50, distanceTravelled: 0,
        isAlive: true, stealth: false, isBoss: false, threat: 1,
        ...overrides
    };
}
