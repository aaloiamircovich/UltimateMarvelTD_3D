import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

test('soportes con aura son puros y tienen variantes por tipo', () => {
    const expected = {
        capitan_america: ['damage', 0.10, 255],
        black_panther: ['damage', 0.20, 135],
        nick_fury: ['fireRate', 0.08, 265],
        wasp: ['fireRate', 0.18, 125],
        invisible_woman: ['range', 0.08, 245],
        mister_fantastic: ['range', 0.15, 145]
    };

    for (const [id, [type, power, range]] of Object.entries(expected)) {
        const game = createGame();
        const hero = new Hero(heroes[id], 0, 0, game);
        game.heroes = [hero];
        const aura = hero.config.special.supportAura;

        assert.equal(aura.type, type);
        assert.equal(aura.power, power);
        assert.equal(aura.range, range);

        const projectiles = [];
        hero.update(3, [{ isAlive: true, x: 30, y: 0, stealth: false }], projectiles);
        assert.equal(projectiles.length, 0, `${id} no debe atacar`);
    }

    const supportHeroes = Object.values(heroes).filter((hero) => hero.special?.supportAura?.type);
    for (const heroConfig of supportHeroes) {
        const game = createGame();
        const hero = new Hero(heroConfig, 0, 0, game);
        const projectiles = [];
        game.heroes = [hero];

        hero.update(3, [{ isAlive: true, x: 30, y: 0, stealth: false }], projectiles);
        assert.equal(projectiles.length, 0, `${heroConfig.id} debe buffear sin atacar`);
    }

    for (const type of ['damage', 'fireRate', 'range']) {
        const variants = supportHeroes
            .filter((hero) => hero.special.supportAura.type === type)
            .map((hero) => ({ id: hero.id, aura: hero.special.supportAura }));
        assert.ok(variants.length >= 2, `${type} necesita al menos dos soportes`);

        const widest = [...variants].sort((a, b) => b.aura.range - a.aura.range)[0];
        const strongest = [...variants].sort((a, b) => b.aura.power - a.aura.power)[0];
        assert.notEqual(widest.id, strongest.id, `${type} necesita una variante de rango y otra de potencia`);
        assert.ok(widest.aura.range > strongest.aura.range);
        assert.ok(widest.aura.power < strongest.aura.power);
    }
});

test('auras de soporte modifican solo aliados dentro del radio', () => {
    const game = createGame();
    const captain = new Hero(heroes.capitan_america, 0, 0, game);
    const fury = new Hero(heroes.nick_fury, 0, 0, game);
    const reed = new Hero(heroes.mister_fantastic, 0, 0, game);
    const ally = new Hero(createHeroConfig('ally', { damage: 100, fireRate: 1, range: 100 }), 100, 0, game);
    const far = new Hero(createHeroConfig('far', { damage: 100, fireRate: 1, range: 100 }), 400, 0, game);
    game.heroes = [captain, fury, reed, ally, far];

    const boosted = ally.getEffectiveStats();
    assert.equal(Math.round(boosted.damage), 110);
    assert.equal(Number(boosted.fireRate.toFixed(2)), 1.08);
    assert.equal(Math.round(boosted.range), 115);

    const untouched = far.getEffectiveStats();
    assert.equal(Math.round(untouched.damage), 100);
    assert.equal(Number(untouched.fireRate.toFixed(2)), 1);
    assert.equal(Math.round(untouched.range), 100);
});

test('auras de soporte mejoran al subir nivel del heroe soporte', () => {
    const game = createGame();
    const captain = new Hero({ ...heroes.capitan_america, level: 100 }, 0, 0, game);
    const ally = new Hero(createHeroConfig('ally', { damage: 100 }), 100, 0, game);
    game.heroes = [captain, ally];

    assert.equal(Math.round(ally.getEffectiveStats().damage), 121);
});

test('auras de soporte tienen pulso visual diferenciado por tipo', () => {
    const game = createGame();
    const captain = new Hero(heroes.capitan_america, 0, 0, game);
    const fury = new Hero(heroes.nick_fury, 0, 0, game);
    const reed = new Hero(heroes.mister_fantastic, 0, 0, game);

    const damageCtx = createAuraContextSpy();
    const cadenceCtx = createAuraContextSpy();
    const rangeCtx = createAuraContextSpy();
    captain.renderSupportAura(damageCtx);
    fury.renderSupportAura(cadenceCtx);
    reed.renderSupportAura(rangeCtx);

    assert.ok(damageCtx.calls.some((call) => call[0] === 'arc' && call[3] === 255));
    assert.ok(cadenceCtx.calls.some((call) => call[0] === 'arc' && call[3] === 265));
    assert.ok(rangeCtx.calls.some((call) => call[0] === 'arc' && call[3] === 145));
    assert.notEqual(damageCtx.strokeStyles[0], cadenceCtx.strokeStyles[0]);
    assert.notEqual(cadenceCtx.strokeStyles[0], rangeCtx.strokeStyles[0]);
});

test('Domino genera 15 por ciento de recompensa por cada ataque realizado', () => {
    const game = createGame();
    const domino = new Hero(heroes.domino, 0, 0, game);
    const target = { uid: 'enemy-1', x: 100, y: 0, reward: 80 };
    const projectiles = [];
    game.heroes = [domino];

    domino.shoot(target, domino.getEffectiveStats(), projectiles);

    assert.equal(game.resourceManager.credits, 12);
    assert.equal(domino.combatStats.goldGenerated, 12);
    assert.ok(projectiles[0].damage <= 12);
});

function createGame() {
    return {
        heroes: [],
        enemies: [],
        projectiles: [],
        resourceManager: {
            lives: 20,
            credits: 0,
            addCredits(amount) { this.credits += amount; }
        },
        random: { next: () => 0.5 },
        vfx: { addBeam: () => {}, addBurst: () => {}, addFloatingText: () => {}, addLightning: () => {}, addRing: () => {} },
        audio: { play: () => {} },
        showHeroRanges: false
    };
}

function createAuraContextSpy() {
    const calls = [];
    const strokeStyles = [];
    return {
        calls,
        strokeStyles,
        globalAlpha: 1,
        lineWidth: 1,
        fillStyle: '',
        get strokeStyle() {
            return this._strokeStyle;
        },
        set strokeStyle(value) {
            this._strokeStyle = value;
            strokeStyles.push(value);
        },
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        setLineDash: (value) => calls.push(['setLineDash', value]),
        beginPath: () => calls.push(['beginPath']),
        arc: (x, y, radius, start, end) => calls.push(['arc', x, y, radius, start, end]),
        stroke: () => calls.push(['stroke']),
        fill: () => calls.push(['fill'])
    };
}

function createHeroConfig(id, overrides = {}) {
    return {
        id,
        name: id,
        damage: 10,
        range: 100,
        fireRate: 1,
        category: 'Urbano',
        allowedTerrains: [1],
        ...overrides
    };
}
