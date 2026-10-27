import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { EVOLUTION_CATALOG, getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { ITEM_SIGNATURES } from '../src/systems/ItemSignatureSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';
import { DOT_TYPES, resolveStatusDamage } from '../src/utils/StatusDamage.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const levels = [1, 49, 50, 51, 99, 100];

function setup(config, level) {
    let hero;
    const game = {
        heroes: [], enemies: [], projectiles: [], random: { next: () => 0.01 },
        resourceManager: { lives: 15, credits: 0, addCredits(amount) { this.credits += amount; } },
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => getEvolutionForHero(config, {}, { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...config, level, damage: getHeroDamageAtLevel(config.damage, level, config.rarity) }, 0, 0, game);
    game.heroes = [hero];
    const point = (range = hero.getEffectiveStats().range) => hero.rangePattern === 'x'
        ? { x: range * 0.45, y: range * 0.45 }
        : { x: range * 0.6, y: 0 };
    const spawn = (overrides = {}) => {
        const origin = point();
        const enemy = new Enemy({ id: 'contract-target', hp: 1e9, speed: 1, reward: 80, category: hero.category, ...overrides }, [origin, { x: origin.x + 2000, y: origin.y }]);
        game.enemies.push(enemy);
        return enemy;
    };
    return { hero, game, spawn, point };
}

function checkStats(hero, context) {
    const stats = hero.getEffectiveStats();
    for (const key of ['damage', 'fireRate', 'range', 'critChance', 'critDamage']) {
        assert.ok(Number.isFinite(stats[key]) && stats[key] >= 0, `${context}: ${key}=${stats[key]}`);
    }
    assert.ok(stats.fireRate > 0 && stats.range > 0, context);
    const display = hero.abilitySystem.getDisplayState();
    if (display?.progress != null) {
        assert.ok(Number.isFinite(display.progress) && display.progress >= 0 && display.progress <= 1, `${context}: medidor ${display.progress}`);
    }
    return stats;
}

test('matriz de identidad y catalogos cubren IDs reales sin duplicados ni omisiones', () => {
    const matrix = fs.readFileSync(new URL('../docs/MATRIZ_IDENTIDAD_HEROES.md', import.meta.url), 'utf8');
    const ids = [...matrix.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
    assert.equal(ids.length, 105);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.sort(), Object.keys(heroes).sort());
    for (const [itemId, signatures] of Object.entries(ITEM_SIGNATURES)) {
        assert.ok(items[itemId], itemId);
        for (const heroId of Object.keys(signatures)) assert.ok(heroes[heroId], heroId);
    }
});

for (const [id, config] of Object.entries(heroes)) {
    test(`${id}: contrato base en seis niveles y todos sus modos`, () => {
        for (const level of levels) {
            const { hero, game, spawn } = setup(config, level);
            const modes = hero.abilitySystem.getControlState()?.options || [{ id: null }];
            const evolution = game.progression.getHeroEvolution(id);
            assert.equal(Boolean(evolution?.levelEvolved), level >= EVOLUTION_CATALOG[config.evolutionId].requiredLevel);
            for (const mode of modes) {
                if (mode.id) assert.equal(hero.abilitySystem.setCombatMode(mode.id), true);
                const context = `${id}/${level}/${mode.id || 'base'}`;
                const stats = checkStats(hero, context);
                const target = spawn();
                assert.equal(hero.getBestTarget([target], stats), target, context);
                target.stealth = true;
                assert.equal(hero.getBestTarget([target], stats), stats.canSeeStealth ? target : null, context);
                target.stealth = false;
                target.x = stats.range * 10;
                assert.equal(hero.getBestTarget([target], stats), null, context);
                target.isAlive = false;
                assert.equal(hero.getBestTarget([target], stats), null, context);
                for (const effect of hero.getProjectileEffects(target)) {
                    assert.notEqual(effect.type, 'heal', context);
                    if (DOT_TYPES.has(effect.type)) {
                        const resolved = resolveStatusDamage(effect, target, hero);
                        assert.ok(resolved && resolved.damagePerSecond > 0, `${context}: ${effect.type}`);
                        if (['burn', 'bleed'].includes(effect.type)) assert.ok(effect.damageBasis, `${context}: unidad explicita`);
                    }
                }
                game.enemies = [];
            }
        }
    });

    test(`${id}: combate real base/maximo sin curacion, NaN ni ataques de soporte`, () => {
        for (const level of [1, 100]) {
            const { hero, game, spawn } = setup(config, level);
            const support = hero.isSupportAuraOnly();
            hero.update(1, [], game.projectiles);
            assert.equal(game.projectiles.length, 0);
            assert.equal(hero.combatStats.shots, 0);
            for (let i = 0; i < 3; i++) spawn();
            // Stationary targets and immediate arrivals isolate combat, not navigation or travel time.
            for (let step = 0; step < 400; step++) {
                hero.update(0.1, game.enemies, game.projectiles);
                for (const shot of game.projectiles) {
                    assert.ok(Number.isFinite(shot.damage) && shot.damage >= 0, `${id}: proyectil`);
                    shot.x = shot.target.x;
                    shot.y = shot.target.y;
                    shot.update(0);
                }
                game.projectiles = [];
                for (const enemy of game.enemies) {
                    enemy.updateDebuffs(0.1);
                    assert.ok(Number.isFinite(enemy.hp) && enemy.hp >= 0, `${id}: HP`);
                }
                checkStats(hero, `${id}/${level}/tick${step}`);
            }
            for (const [key, value] of Object.entries(hero.combatStats)) assert.ok(Number.isFinite(value) && value >= 0, `${id}: ${key}`);
            assert.equal(game.resourceManager.lives, 15);
            assert.equal(hero.combatStats.shots > 0, !support);
            assert.equal(hero.combatStats.damageDealt > 0, !support);
            if (support) {
                assert.equal(hero.combatStats.abilityActivations, 0);
                assert.ok(game.enemies.every((enemy) => enemy.hp === enemy.maxHp && enemy.debuffs.length === 0));
            }
        }
    });
}
