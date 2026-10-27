import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

function setup(id = 'iron_man', level = 1) {
    let hero;
    const game = {
        heroes: [], enemies: [], projectiles: [], random: { next: () => 0.99 },
        resourceManager: { credits: 0, lives: 15, addCredits(n) { this.credits += n; } },
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, {
                level: hero.level, equippedItemIds: hero.items.map((item) => item.id)
            }) : null
        }
    };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game);
    game.heroes = [hero];
    const spawn = (x = 70, y = 0, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e9, speed: 1, reward: 100, ...extra },
            [{ x, y }, { x: 3000, y }], game);
        game.enemies.push(enemy);
        return enemy;
    };
    const target = spawn();
    const shoot = () => {
        const shots = [];
        hero.shoot(target, hero.getEffectiveStats(), shots);
        return shots;
    };
    const advance = (dt) => hero.abilitySystem.update(dt, game.enemies, hero.getEffectiveStats(), []);
    return { game, hero, target, spawn, shoot, advance };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`ARC nivel ${level}: umbral, calor fijo y carga saturada sin descargas gratuitas`, () => {
        const f = setup('iron_man', level);
        const kit = f.hero.abilitySystem;
        assert.equal(kit.getArcInterval(), level >= 50 ? 2 : 3);
        for (let i = 0; i < 20; i++) f.shoot();
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(kit.arcCharge, kit.getArcInterval());
        f.advance(2);
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        assert.equal(kit.getDisplayState().ready, true);
        f.shoot();
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(kit.arcCharge, 0);
        assert.equal(kit.arcCooling, 2);
        for (let i = 0; i < 20; i++) f.shoot();
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        f.advance(1.99);
        f.shoot();
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        f.advance(0.01);
        f.shoot();
        assert.equal(f.hero.combatStats.abilityActivations, 2);
    });
}

test('ARC distingue alineados, laterales, detras, muertos y sigilo sin deteccion', () => {
    const f = setup();
    const line = f.spawn(150, 24);
    const side = f.spawn(100, 25);
    const behind = f.spawn(-20);
    const far = f.spawn(3000);
    const hidden = f.spawn(90, 0, { stealth: true });
    const dead = f.spawn(80); dead.isAlive = false;
    f.hero.config.canSeeStealth = false;
    f.advance(2);
    for (let i = 0; i < 3; i++) f.shoot();
    for (const target of [f.target, line]) assert.ok(target.hp < target.maxHp);
    for (const target of [side, behind, far, hidden, dead]) assert.equal(target.hp, target.maxHp);
    f.hero.config.canSeeStealth = true;
    f.advance(2);
    for (let i = 0; i < 3; i++) f.shoot();
    assert.ok(hidden.hp < hidden.maxHp);
});

test('ARC no gasta carga ni anuncia activacion sin blanco vivo', () => {
    const f = setup();
    f.advance(2);
    f.target.isAlive = false;
    for (let i = 0; i < 3; i++) f.shoot();
    assert.equal(f.hero.combatStats.abilityActivations, 0);
    assert.equal(f.hero.abilitySystem.arcCharge, 3);
    assert.equal(f.hero.abilitySystem.arcCooling, 0);
});

test('mover conserva calor; retirar y redesplegar exige carga y arranque nuevos', () => {
    const f = setup('iron_man', 50);
    f.advance(2);
    f.shoot(); f.shoot();
    f.hero.x = 5;
    for (let i = 0; i < 5; i++) f.shoot();
    assert.equal(f.hero.combatStats.abilityActivations, 1);
    new TacticalActionSystem(f.game).sell(f.hero);
    const replacement = new Hero(f.hero.config, 0, 0, f.game);
    f.game.heroes = [replacement];
    assert.equal(replacement.abilitySystem.arcCharge, 0);
    assert.equal(replacement.abilitySystem.arcCooling, 2);
});

test('stun no ejecuta ni enfria ARC; sin blancos no se carga', () => {
    const f = setup();
    f.hero.applyStun(5);
    f.hero.update(1, [f.target], []);
    assert.equal(f.hero.abilitySystem.arcCooling, 2);
    assert.equal(f.hero.combatStats.shots, 0);
    f.hero.stunTimer = 0;
    f.hero.update(3, [], []);
    assert.equal(f.hero.abilitySystem.arcCharge, 0);
    assert.equal(f.hero.abilitySystem.arcCooling, 0);
});

for (const mode of ['explosive', 'cryo', 'piercing']) {
    for (const level of [1, 50, 100]) {
        test(`Hawkeye ${mode} nivel ${level}: cuarto disparo reforzado, luego vuelve a normal`, () => {
            const f = setup('hawkeye', level);
            f.hero.abilitySystem.setCombatMode(mode);
            const first = f.shoot()[0];
            f.shoot(); f.shoot();
            assert.equal(f.hero.abilitySystem.getDisplayState().ready, true);
            const prepared = f.shoot()[0];
            close(prepared.damage, first.damage * 1.35);
            if (mode === 'explosive') assert.equal(prepared.splashRadius, 85);
            if (mode === 'cryo') assert.equal(prepared.effects.find((e) => e.type === 'slow').power, 0.6);
            if (mode === 'piercing') assert.equal(prepared.armorPenetration, 0.8);
            assert.equal(f.hero.combatStats.abilityActivations, 1);
            close(f.shoot()[0].damage, first.damage);
            assert.equal(f.hero.abilitySystem.getDisplayState().ready, false);
        });
    }
}

test('cambiar municion lista no reinicia timer/carga ni altera flechas en vuelo', () => {
    const f = setup('hawkeye');
    const flying = f.shoot()[0];
    f.shoot(); f.shoot();
    f.hero.timer = 0.2;
    for (const mode of ['cryo', 'piercing', 'explosive', 'cryo']) {
        assert.equal(f.hero.abilitySystem.setCombatMode(mode), true);
        assert.equal(f.hero.timer, 0.2);
        assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 3);
    }
    assert.equal(f.hero.abilitySystem.setCombatMode('invalid'), false);
    const prepared = f.shoot()[0];
    assert.equal(prepared.effects[0].power, 0.6);
    assert.equal(flying.splashRadius, 68);
    assert.equal(flying.effects.some((e) => e.type === 'slow'), false);
    f.hero.abilitySystem.setCombatMode('explosive');
    assert.equal(prepared.effects[0].power, 0.6);
});

test('sin blanco, stun y enemigos fuera de la cruz no preparan flechas', () => {
    const f = setup('hawkeye');
    f.hero.update(4, [], []);
    f.target.x = 90; f.target.y = 90;
    f.hero.update(4, [f.target], []);
    f.target.y = 0;
    f.hero.applyStun(4);
    f.hero.update(1, [f.target], []);
    assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 0);
});

test('objeto y rebotes no cargan flechas ni duplican dinero o activaciones nativas', () => {
    const f = setup('hawkeye', 50);
    f.hero.items = [items.carcaj_flechas_truco];
    assert.ok(f.hero.items[0]);
    f.spawn(90);
    for (let i = 0; i < 12; i++) {
        const shots = f.shoot();
        for (const shot of shots) {
            Object.assign(shot, { chainCount: 1, chainRange: 120, chainFactor: 0.5 });
            CombatSystem.applyImpact(shot, shot.target, f.hero, f.game.resourceManager);
        }
    }
    assert.equal(f.hero.abilitySystem.avengerKit.attackCount, 12);
    assert.equal(f.hero.combatStats.shots, 12);
    assert.equal(f.hero.combatStats.abilityActivations, 3);
    assert.equal(f.game.resourceManager.credits, 0);
    assert.equal(f.game.resourceManager.lives, 15);
});

function simulate(id, baseline, { rate = 1.5, aligned = true, mode = 'explosive' } = {}) {
    const f = setup(id, 50);
    f.hero.damage = 100;
    f.hero.fireRate = rate;
    f.game.progression.getHeroEvolution = () => null;
    f.hero.abilitySystem.setCombatMode(mode);
    f.spawn(110, aligned ? 0 : 45);
    if (baseline && id === 'iron_man') {
        f.hero.abilitySystem.onAttack = (target, stats) => {
            if (++f.hero.abilitySystem.attackCount % 3 === 0) f.hero.abilitySystem.activateArcOverload(target, stats);
        };
    } else if (baseline) f.hero.abilitySystem.avengerKit.isArrowPrepared = () => false;
    for (let frame = 0; frame < 3600; frame++) {
        const shots = [];
        f.hero.update(1 / 60, [f.target], shots);
        for (const shot of shots) CombatSystem.applyImpact(shot, shot.target, f.hero, f.game.resourceManager);
    }
    return { damage: f.hero.combatStats.damageDealt, activations: f.hero.combatStats.abilityActivations };
}

test('comparativa 60 s: ARC conserva cadencia normal, limita spam y premia alineacion', () => {
    const normal = simulate('iron_man', false);
    const before = simulate('iron_man', true);
    close(normal.damage, before.damage);
    assert.ok(simulate('iron_man', false, { rate: 8 }).activations <= 30);
    assert.ok(simulate('iron_man', true, { rate: 8 }).activations > 100);
    assert.ok(normal.damage > simulate('iron_man', false, { aligned: false }).damage);
});

test('comparativa 60 s: carcaj gana dano acotado y municion explosiva gana contra grupos', () => {
    const normal = simulate('hawkeye', false, { rate: 1.1 });
    const before = simulate('hawkeye', true, { rate: 1.1 });
    const ratio = normal.damage / before.damage;
    assert.ok(ratio > 1.07 && ratio < 1.10, `ratio=${ratio}`);
    assert.ok(normal.damage > simulate('hawkeye', false, { rate: 1.1, mode: 'piercing' }).damage);
});
