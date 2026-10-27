import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { EVOLUTION_CATALOG, getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { ITEM_SIGNATURES, getSignatureConfig, buildSignatureAttackContext, resolveSignatureAfterAttack,
    renderSignatureVisuals } from '../src/systems/ItemSignatureSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
function setup(id, level = 100, itemId) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => getEvolutionForHero(heroes[id], {},
            { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).slice(0, 1).map(item => item.id) }) } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes.push(hero);
    hero.items = itemId ? [items[itemId]] : [];
    const spawn = (hp = 1e9) => {
        const range = hero.getEffectiveStats().range;
        const p = hero.rangePattern === 'x' ? { x: range * 0.45, y: range * 0.45 } : { x: range * 0.6, y: 0 };
        const enemy = new Enemy({ id: 'target', category: hero.category, hp, speed: 0, reward: 100 },
            [p, { x: p.x + 1000, y: p.y }], game);
        game.enemies.push(enemy); return enemy;
    };
    const trigger = (target, count, config = {}) => {
        const shots = [];
        for (let i = 0; i < count; i++) {
            const context = buildSignatureAttackContext(hero, target, hero.getEffectiveStats());
            resolveSignatureAfterAttack(hero, target, context.stats, config, shots, { ...context, isCrit: true });
        }
        return shots;
    };
    return { hero, game, spawn, trigger };
}

for (const [id, config] of Object.entries(heroes)) {
    test(`${id}: todos los objetos, umbral evolutivo y retiro conservan estadisticas validas`, () => {
        const threshold = EVOLUTION_CATALOG[config.evolutionId].requiredLevel;
        const f = setup(id);
        for (const level of [threshold - 1, threshold, 100]) {
            f.hero.level = level;
            for (const item of [null, ...Object.values(items)]) {
                f.hero.items = item ? [item] : [];
                const evolution = f.game.progression.getHeroEvolution();
                assert.equal(Boolean(evolution?.levelEvolved), level >= threshold);
                const signature = ITEM_SIGNATURES[item?.id]?.[id];
                assert.equal(Boolean(getSignatureConfig(f.hero)), Boolean(signature && (level >= threshold || signature.requiresEvolution === false)));
                const stats = f.hero.getEffectiveStats();
                for (const key of ['damage', 'range', 'fireRate', 'critChance', 'critDamage'])
                    assert.ok(Number.isFinite(stats[key]) && stats[key] >= 0, `${id}/${item?.id}/${level}/${key}`);
                if (evolution?.transformId) assert.equal(evolution.activeItemId, item.id);
            }
            f.hero.items = [];
            assert.equal(Boolean(f.game.progression.getHeroEvolution()?.levelEvolved), level >= threshold);
            assert.equal(f.game.progression.getHeroEvolution()?.transformId, undefined);
        }
    });
}

for (const [itemId, signatures] of Object.entries(ITEM_SIGNATURES)) for (const [id, config] of Object.entries(signatures)) {
    test(`${id}/${itemId}: firma en primer slot y proyectiles secundarios`, () => {
        const f = setup(id, 100, itemId), target = f.spawn();
        const count = Number.isFinite(config.interval) ? config.interval + 4 : 12;
        const shots = f.trigger(target, count, { energyToken: {}, effects: [{ type: 'burn', power: 1, duration: 2 }] });
        for (const shot of shots) {
            assert.equal(shot.secondaryEntity, true); assert.equal(shot.energyToken, null);
            assert.ok(shot.effects.every(effect => effect.secondaryEntity));
        }
        f.hero.items = []; assert.equal(getSignatureConfig(f.hero, itemId), null);
        f.hero.items = [{ id: 'other', effects: {} }, items[itemId]];
        assert.equal(getSignatureConfig(f.hero, itemId), null);
    });
}

test('Falcon no dibuja Redwing sin equiparlo, incluso evolucionado', () => {
    const f = setup('falcon'); let draws = 0;
    const ctx = new Proxy({}, { get: () => () => draws++ });
    renderSignatureVisuals(f.hero, ctx); assert.equal(draws, 0);
    f.hero.items = [items.redwing_mk2]; renderSignatureVisuals(f.hero, ctx); assert.ok(draws > 0);
});

for (const [id, itemId, interval] of [['nova', 'casco_nova', 8], ['quake', 'guante_quake', 5], ['sentry', 'el_vacio', 24]]) {
    test(`${id}: baja de firma no activa kit por baja, incluida ejecucion The Void`, () => {
        const f = setup(id, 100, itemId), target = f.spawn(1); let procs = 0;
        f.hero.abilitySystem.onKill = () => procs++;
        f.trigger(target, interval);
        assert.equal(target.isAlive, false); assert.equal(procs, 0); assert.equal(f.hero.combatStats.kills, 1);
    });
}

test('Redwing conserva dano pero no vuelve a cobrar efectos de impacto', () => {
    const f = setup('falcon', 100, 'redwing_mk2'), target = f.spawn();
    f.hero.items = [{ ...items.redwing_mk2, effects: { onHitCredit: 10 } }];
    const shots = f.trigger(target, getSignatureConfig(f.hero).interval);
    assert.ok(shots.length > 0);
    for (const shot of shots) CombatSystem.applyImpact(shot, shot.target, f.hero, f.game.resourceManager);
    assert.ok(target.hp < target.maxHp); assert.equal(f.game.resourceManager.credits, 0);
    CombatSystem.applyImpact({ damage: 1, effects: [] }, target, f.hero, f.game.resourceManager);
    assert.equal(f.game.resourceManager.credits, 10);
});

test('Quemadura de firma conserva autoria secundaria hasta matar', () => {
    const f = setup('human_torch', 100, 'traje_moleculas_inestables'), target = f.spawn(); let procs = 0;
    f.hero.abilitySystem.onKill = () => procs++; f.trigger(target, 7);
    const burn = target.debuffs.find(e => e.type === 'burn'); assert.equal(burn.secondaryEntity, true);
    target.hp = 1; target.updateDebuffs(1);
    assert.equal(target.isAlive, false); assert.equal(procs, 0); assert.equal(f.hero.combatStats.kills, 1);
});

test('Objetos signature no convierten los nueve soportes en atacantes', () => {
    for (const [id, config] of Object.entries(heroes).filter(([, c]) => c.special?.supportAura)) {
        const f = setup(id); f.spawn();
        for (const item of Object.values(items)) {
            f.hero.items = [item]; const shots = []; f.hero.timer = 100;
            f.hero.update(0.1, f.game.enemies, shots);
            assert.equal(shots.length, 0, `${id}/${item.id}`); assert.equal(f.hero.combatStats.shots, 0, id);
        }
        assert.equal(f.game.resourceManager.lives, 20);
    }
});
