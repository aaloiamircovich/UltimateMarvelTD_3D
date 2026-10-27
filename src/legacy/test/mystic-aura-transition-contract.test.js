import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { getPriorityOrderDamageMultiplier } from '../src/systems/SupportAuraSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function setup(id, level = 49) {
    const game = { heroes: [], enemies: [], resourceManager: { lives: 20 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: heroId => {
            const hero = game.heroes.find(h => h.id === heroId);
            return hero ? getEvolutionForHero(hero.config, {}, { level: hero.level,
                equippedItemIds: hero.items.map(item => item.id) }) : null;
        } } };
    const hero = new Hero({ ...roster[id], level }, 0, 0, game);
    game.heroes.push(hero);
    const targets = [80, 85].map(x => new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 1 },
        [{ x, y: 0 }, { x: 1000, y: 0 }], game));
    game.enemies = targets;
    return { hero, game, targets, kit: hero.abilitySystem.mysticKit };
}

for (const level of [49, 50, 99, 100]) {
    for (const invalidation of ['move', 'stun', 'remove', 'leave-range', 'expire', 'dispel', 'escape']) {
        test(`Hill/Dagger nivel ${level}: ${invalidation} invalida orden sin esperar update del enemigo`, () => {
            const f = setup('dagger', level), target = f.targets[0];
            const hill = new Hero({ ...roster.maria_hill, level }, 0, 0, f.game);
            const ally = new Hero({ id: 'ally', damage: 100, range: 200 }, 0, 0, f.game);
            f.game.heroes.push(hill, ally);
            f.kit.mark(target);
            assert.ok(getPriorityOrderDamageMultiplier(ally, target) > 1);
            if (invalidation === 'move') f.hero.x = 1;
            if (invalidation === 'stun') f.hero.applyStun(1);
            if (invalidation === 'remove') f.game.heroes = f.game.heroes.filter(h => h !== f.hero);
            if (invalidation === 'leave-range') target.x = 10000;
            if (invalidation === 'expire') f.kit.update(3);
            if (invalidation === 'dispel') target.debuffs = [];
            if (invalidation === 'escape') target.hasReachedEnd = true;
            close(getPriorityOrderDamageMultiplier(ally, target), 1);
            if (invalidation !== 'escape') {
                close(CombatSystem.applyDamage({ damage: 100 }, target, ally, f.game.resourceManager, 1).damage, 100);
                target.applyStatus({ type: 'mark', power: 0.2, duration: 10 }, ally);
                assert.ok(getPriorityOrderDamageMultiplier(ally, target) > 1);
            }
        });
    }
}

for (const id of ['scarlet_witch', 'magik']) {
    for (const [before, after] of [[49, 50], [99, 100]]) {
        for (const invalidation of ['none', 'escape', 'dead', 'range', 'curse', 'stealth']) {
            test(`${id} ${before}->${after}: conserva snapshot y valida ${invalidation}`, () => {
                const f = setup(id, before), target = f.targets[0];
                for (const enemy of f.targets) enemy.applyStatus({ type: 'curse', power: 0.001, duration: 10 }, f.hero);
                f.kit.update(7);
                f.kit.onAttack(target, f.hero.getEffectiveStats());
                const prepared = f.kit.network || f.kit.returnCut;
                assert.ok(prepared);
                const captured = prepared.damage;
                f.hero.level = after;
                f.hero.damage = getHeroDamageAtLevel(roster[id].damage, after, roster[id].rarity);
                if (invalidation === 'escape') target.hasReachedEnd = true;
                if (invalidation === 'dead') target.isAlive = false;
                if (invalidation === 'range') target.x = 10000;
                if (invalidation === 'curse') target.debuffs = [];
                if (invalidation === 'stealth') {
                    target.stealth = true;
                    const stats = f.hero.getEffectiveStats.bind(f.hero);
                    f.hero.getEffectiveStats = () => ({ ...stats(), canSeeStealth: false });
                }
                f.kit.update(2);
                close(target.maxHp - target.hp, invalidation === 'none' ? captured : 0);
                assert.equal(f.kit.network, null);
                assert.equal(f.kit.returnCut, null);
                const hp = target.hp;
                f.kit.update(2);
                close(target.hp, hp);
            });
        }
    }
}
