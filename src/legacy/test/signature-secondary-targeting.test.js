import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { buildSignatureAttackContext, resolveSignatureAfterAttack } from '../src/systems/ItemSignatureSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const cases = [
    ['punisher', 'armadura_war_machine', 10, 3],
    ['war_machine', 'armadura_war_machine', 10, 3],
    ['nightcrawler', 'protocolo_danger_room', 10, 4],
    ['x_23', 'protocolo_danger_room', 10, 3],
    ['gamora', 'comunicador_guardianes', 8, 3],
    ['deadpool', 'arsenal_deadpool', 3, 2],
    ['falcon', 'redwing_mk2', 4, 1]
];

function setup(id, itemId) {
    let hero;
    const game = {
        heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(value) { this.credits += value; } },
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => getEvolutionForHero(hero, {}, { level: 50, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...heroes[id], level: 50 }, 0, 0, game);
    hero.items = [items[itemId]];
    game.heroes = [hero];
    const spawn = (x, options = {}) => {
        const target = new Enemy({ id: 'dummy', hp: 100000, speed: 1, category: hero.category, reward: 100, ...options }, [{ x, y: 0 }, { x: 2000, y: 0 }]);
        game.enemies.push(target);
        return target;
    };
    const trigger = (primary, count, isCrit = false) => {
        const shots = [];
        for (let n = 0; n < count; n++) {
            const ctx = buildSignatureAttackContext(hero, primary, hero.getEffectiveStats());
            resolveSignatureAfterAttack(hero, primary, ctx.stats, {}, shots, { ...ctx, isCrit });
        }
        return shots;
    };
    return { hero, game, spawn, trigger };
}

for (const [id, itemId, interval, cap] of cases) {
    test(`${id}: firma no vuelve al blanco original fuera de alcance`, () => {
        const f = setup(id, itemId);
        const primary = f.spawn(5000);
        const dead = f.spawn(40);
        dead.isAlive = false;
        assert.equal(f.trigger(primary, interval).length, 0);
        assert.equal(f.hero.combatStats.abilityActivations, 0);
    });

    test(`${id}: firma conserva limite, blancos unicos y prioridad de jefe`, () => {
        const f = setup(id, itemId);
        const primary = f.spawn(40);
        const boss = f.spawn(50, { isBoss: true });
        for (let i = 0; i < 5; i++) f.spawn(35 + i);
        const shots = f.trigger(primary, interval);
        assert.equal(shots.length, cap);
        assert.equal(shots[0].target, boss);
        assert.equal(new Set(shots.map((shot) => shot.target)).size, cap);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}

test('salva de Punisher no recupera un blanco fuera de los carriles de su cruz', () => {
    const f = setup('punisher', 'armadura_war_machine');
    const primary = f.spawn(90);
    primary.y = 90;
    assert.equal(f.hero.getBestTarget([primary], f.hero.getEffectiveStats()), null);
    assert.equal(f.trigger(primary, 10).length, 0);
});

test('Corte Multiple no recupera un blanco que se ha ocultado sin deteccion', () => {
    const f = setup('x_23', 'protocolo_danger_room');
    const primary = f.spawn(40, { stealth: true });
    assert.equal(f.hero.getEffectiveStats().canSeeStealth, false);
    assert.equal(f.trigger(primary, 10).length, 0);
});

test('Domino omite disparo critico adicional sin blanco valido y conserva monedas del proc', () => {
    const f = setup('domino', 'matriz_probabilidad');
    const primary = f.spawn(5000);
    assert.equal(f.trigger(primary, 1, true).length, 0);
    assert.equal(f.game.resourceManager.credits, 12);
});

test('Domino permite repetir blanco valido aislado o prefiere otro sin duplicar monedas', () => {
    const f = setup('domino', 'matriz_probabilidad');
    const primary = f.spawn(40);
    assert.equal(f.trigger(primary, 1, true)[0].target, primary);
    const other = f.spawn(50);
    assert.equal(f.trigger(primary, 1, true)[0].target, other);
    assert.equal(f.game.resourceManager.credits, 24);
    const shots = [];
    f.game.random.next = () => 0;
    f.hero.shoot(primary, f.hero.getEffectiveStats(), shots);
    assert.equal(f.game.resourceManager.credits, 24 + 15 + 12);
    assert.equal(shots.length, 2);
});

test('Gamora no anuncia combo signature vacio si ejecuta al unico blanco antes del proc', () => {
    const f = setup('gamora', 'comunicador_guardianes');
    const primary = f.spawn(40);
    f.trigger(primary, 7);
    primary.hp = 100;
    const shots = [];
    f.hero.shoot(primary, f.hero.getEffectiveStats(), shots);
    assert.equal(primary.isAlive, false);
    assert.equal(shots.length, 1);
    // Only the ordinary execution activates, not a signature with no recipients.
    assert.equal(f.hero.combatStats.abilityActivations, 1);
});
