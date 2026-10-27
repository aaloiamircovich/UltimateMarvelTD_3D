import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
function setup(id = 'yondu') {
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null } };
    const hero = new Hero(heroes[id], 0, 0, game);
    game.heroes.push(hero);
    game.progression.getHeroEvolution = () => getEvolutionForHero(hero.config, {}, {
        level: hero.level, equippedItemIds: hero.items.map(item => item.id)
    });
    const spawn = (x, escaped = false) => {
        const enemy = new Enemy({ id: 'test', category: hero.category, hp: 10000, speed: 1, reward: 100 },
            [{ x, y: 0 }, { x: 1000, y: 0 }], game);
        enemy.hasReachedEnd = escaped;
        game.enemies.push(enemy);
        return enemy;
    };
    return { game, hero, spawn };
}

for (const id of Object.keys(heroes)) {
    test(`${id}: impacto escapado no causa dano, estados, dinero ni habilidad`, () => {
        const f = setup(id), target = f.spawn(80, true), neighbour = f.spawn(81);
        f.hero.items = [{ effects: { onHitCredit: 5, onHitCreditPct: 0.1 } }];
        const before = structuredClone(f.hero.combatStats);
        const result = CombatSystem.applyImpact({ damage: 20000, effects: [{ type: 'mark', duration: 3, power: 0.2 }],
            splashRadius: 100, splashFactor: 1, chainCount: 2, chainRange: 100,
            propagationCount: 2, propagationRadius: 100, propagationFactor: 1, beaconRadius: 100 },
        target, f.hero, f.game.resourceManager);
        assert.deepEqual(result, { damage: 0, killed: false, hits: 0 });
        assert.equal(target.hp, target.maxHp);
        assert.equal(neighbour.hp, neighbour.maxHp);
        assert.equal(target.debuffs.length + neighbour.debuffs.length, 0);
        assert.deepEqual(f.hero.combatStats, before);
        assert.equal(f.game.resourceManager.credits, 0);
    });
}

for (const mode of ['splash', 'chain', 'propagation', 'beacon']) {
    test(`${mode}: excluye escapados sin consumir cupos de enemigos validos`, () => {
        const f = setup(), primary = f.spawn(80), escaped = f.spawn(81, true), live = f.spawn(82);
        const profiles = {
            splash: { splashRadius: 100, splashFactor: 0.5 },
            chain: { chainCount: 1, chainRange: 100, chainFactor: 0.5 },
            propagation: { propagationCount: 1, propagationRadius: 100, propagationFactor: 0.5 },
            beacon: { beaconRadius: 100 }
        };
        const result = CombatSystem.applyImpact({ damage: 100, ...profiles[mode] }, primary, f.hero, f.game.resourceManager);
        assert.equal(escaped.hp, escaped.maxHp);
        assert.equal(escaped.debuffs.length, 0);
        if (mode === 'beacon') assert.ok(live.debuffs.some(e => e.type === 'reveal'));
        else {
            assert.equal(result.hits, 2);
            assert.equal(live.maxHp - live.hp, 50);
        }
    });
}

test('dano directo y ejecucion no acreditan bajas ni rompen barreras de escapados', () => {
    const f = setup('magneto'), target = f.spawn(80, true);
    target.behavior.barrier = 1;
    assert.deepEqual(CombatSystem.applyDamage({ damage: 20000 }, target, f.hero, f.game.resourceManager, 1), { damage: 0, killed: false });
    assert.deepEqual(CombatSystem.executeNonBoss(target, f.hero, f.game.resourceManager), { damage: 0, killed: false });
    assert.equal(target.behavior.barrier, 1);
    assert.equal(f.hero.abilitySystem.energyReserveKit.charge, 0);
    assert.equal(f.hero.combatStats.kills, 0);
});

test('proyectil en vuelo se desactiva al escapar el blanco, aunque este lejos', () => {
    const f = setup(), target = f.spawn(200, true);
    const shot = new Projectile(0, 0, target, { attacker: f.hero, damage: 100 });
    shot.update(0.01);
    assert.equal(shot.isActive, false);
    assert.equal(shot.x, 0);
    assert.equal(target.hp, target.maxHp);
});

for (const id of ['ms_marvel', 'yondu', 'beta_ray_bill']) {
    for (const change of ['49->50', '99->100', 'equip', 'unequip']) {
        test(`${id}: ${change} conserva dano preparado y retorno sin ingresos secundarios`, () => {
            const f = setup(id), primary = f.spawn(80), next = f.spawn(85);
            const kit = f.hero.abilitySystem.energyReserveKit;
            const item = { id: 'test', effects: { damagePct: 0.5, onHitCredit: 5 } };
            const level = change === '99->100' ? 99 : 49;
            f.hero.level = level;
            f.hero.damage = getHeroDamageAtLevel(heroes[id].damage, level, heroes[id].rarity);
            if (change === 'unequip') f.hero.items = [item];
            kit.update(4);
            const stats = f.hero.getEffectiveStats();
            const config = { damage: 1 };
            kit.prepareProjectile(config, primary, stats);
            assert.ok(kit.flight);
            if (change.includes('->')) {
                f.hero.level++;
                f.hero.damage = getHeroDamageAtLevel(heroes[id].damage, f.hero.level, heroes[id].rarity);
            } else f.hero.items = change === 'equip' ? [item] : [];
            CombatSystem.applyImpact(config, primary, f.hero, f.game.resourceManager);
            const target = id === 'beta_ray_bill' ? primary : next;
            const hp = target.hp, credits = f.game.resourceManager.credits;
            kit.update(id === 'beta_ray_bill' ? 0.6 : 0.22);
            const factor = id === 'beta_ray_bill' ? 1.2 : id === 'yondu' ? 0.6 : 1.05;
            assert.ok(Math.abs(hp - target.hp - stats.damage * factor) < 1e-6);
            const after = target.hp;
            for (let n = 0; n < 4; n++) kit.update(0.22);
            assert.equal(target.hp, after);
            assert.equal(kit.route, null);
            assert.equal(f.game.resourceManager.credits, credits);
            assert.equal(f.hero.combatStats.abilityActivations, 1);
        });
    }
    test(`${id}: un token correcto no inicia retorno desde un enemigo escapado`, () => {
        const f = setup(id), target = f.spawn(80), kit = f.hero.abilitySystem.energyReserveKit;
        kit.update(4);
        const config = {};
        kit.prepareProjectile(config, target, f.hero.getEffectiveStats());
        assert.ok(config.energyToken);
        target.hasReachedEnd = true;
        kit.onImpact(config, target);
        assert.equal(kit.route, null);
        assert.equal(f.hero.combatStats.abilityActivations, 0);
        kit.update(0);
        assert.equal(kit.flight, null);
    });
    test(`${id}: un impacto letal legitimo sigue iniciando la ruta`, () => {
        const f = setup(id), target = f.spawn(80), kit = f.hero.abilitySystem.energyReserveKit;
        kit.update(4);
        const config = { damage: 20000 };
        kit.prepareProjectile(config, target, f.hero.getEffectiveStats());
        CombatSystem.applyImpact(config, target, f.hero, f.game.resourceManager);
        assert.equal(target.isAlive, false);
        assert.ok(kit.route);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}
