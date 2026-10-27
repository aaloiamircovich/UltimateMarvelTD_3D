import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
function setup(id, level = 49) {
    let hero;
    const game = { heroes: [], enemies: [], resourceManager: { lives: 20 },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => getEvolutionForHero(heroes[id], {},
            { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).map(item => item.id) }) } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes.push(hero);
    const changeLevel = value => { hero.level = value; hero.damage = getHeroDamageAtLevel(heroes[id].damage, value, heroes[id].rarity); };
    changeLevel(level);
    for (let i = 0; i < 3; i++) {
        const x = hero.getEffectiveStats().range * 0.6 + i * 4;
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e9, speed: 0 }, [{ x, y: 0 }, { x: x + 1000, y: 0 }], game);
        game.enemies.push(enemy);
    }
    return { hero, game, changeLevel };
}

const cases = [
    ['captain_marvel', 'cosmicKit', 'binaryRun', 0.45],
    ['jean_grey', 'mutantKit', 'phoenixWave', 0.6],
    ['storm', 'mutantKit', 'weatherZone', 0.8],
    ['loki', 'arcaneStormKit', 'echo', 0.6],
    ['doctor_strange', 'arcaneStormKit', 'echo', 0.65],
    ['thor', 'arcaneStormKit', 'network', 1],
    ['human_torch', 'darkfireKit', 'zone', 3],
    ['black_bolt', 'energyReserveKit', 'pending', 1],
    ['sentry', 'energyReserveKit', 'pending', 0.5]
];
function prepare(f, id, key, field) {
    const kit = f.hero.abilitySystem[key], stats = f.hero.getEffectiveStats();
    if ('cooldown' in kit) kit.cooldown = 0;
    if ('cooldownRemaining' in kit) kit.cooldownRemaining = 0;
    if (id === 'captain_marvel' || id === 'jean_grey') {
        kit.resource = id === 'captain_marvel' ? 60 : 100;
        kit.update(0, f.game.enemies, f.hero.getEffectiveStats());
    } else if (id === 'storm') {
        kit.setMode('lightning'); kit.update(0, f.game.enemies, f.hero.getEffectiveStats());
    } else {
        for (let i = 0; i < (id === 'black_bolt' ? 3 : id === 'sentry' ? 6 : 1); i++) kit.onAttack(f.game.enemies[0], stats);
    }
    assert.ok(kit[field], `${id}: preparacion`); return kit;
}

for (const [id, key, field, delay] of cases) {
    for (const [before, after] of [[49, 50], [99, 100], [100, 49]]) {
        test(`${id}: ${before}->${after} no reescala descarga preparada ni devuelve recarga`, () => {
            const f = setup(id, before), kit = prepare(f, id, key, field), pending = kit[field];
            const expected = pending.damage, cooldown = kit.cooldownRemaining ?? kit.cooldown;
            const victim = id === 'doctor_strange' ? pending.target : f.game.enemies[0];
            f.changeLevel(after); assert.equal(kit[field], pending);
            assert.equal(kit.cooldownRemaining ?? kit.cooldown, cooldown);
            kit.update(delay, f.game.enemies, f.hero.getEffectiveStats());
            close(victim.maxHp - victim.hp, expected);
            assert.equal(f.game.resourceManager.lives, 20);
        });
    }
    for (const action of ['move', 'stun', 'remove']) {
        test(`${id}: ${action} cancela la descarga incluso tras evolucionar`, () => {
            const f = setup(id), kit = prepare(f, id, key, field); f.changeLevel(50);
            if (action === 'move') f.hero.x = 1;
            if (action === 'stun') f.hero.stunTimer = 1;
            if (action === 'remove') f.game.heroes = [];
            kit.update(delay, f.game.enemies, f.hero.getEffectiveStats());
            assert.ok(f.game.enemies.every(e => e.hp === e.maxHp)); assert.equal(kit[field], null);
        });
    }
    test(`${id}: cambiar objeto durante espera conserva poder capturado`, () => {
        const f = setup(id, 100); f.hero.items = [items.reactor_arc];
        const kit = prepare(f, id, key, field), pending = kit[field];
        const victim = id === 'doctor_strange' ? pending.target : f.game.enemies[0];
        f.hero.items = [items.espada_infinito]; kit.update(delay, f.game.enemies, f.hero.getEffectiveStats());
        close(victim.maxHp - victim.hp, pending.damage);
    });
}

test('Storm: cambiar modo no convierte una tormenta ya creada en otro campo', () => {
    const f = setup('storm', 50), kit = prepare(f, 'storm', 'mutantKit', 'weatherZone');
    const zone = kit.weatherZone; kit.setMode('blizzard'); kit.update(0.8, f.game.enemies, f.hero.getEffectiveStats());
    assert.equal(zone.mode, 'lightning'); close(f.game.enemies[0].maxHp - f.game.enemies[0].hp, zone.damage);
});

test('Jean: quitar objeto Dark Phoenix conserva evolucion y la onda ya preparada', () => {
    const f = setup('jean_grey', 50); f.hero.items = [items.formula_phoenix];
    const kit = prepare(f, 'jean_grey', 'mutantKit', 'phoenixWave'); const wave = kit.phoenixWave;
    assert.equal(f.game.progression.getHeroEvolution().transformId, 'dark_phoenix');
    f.hero.items = []; assert.equal(f.game.progression.getHeroEvolution().id, 'phoenix');
    assert.equal(f.game.progression.getHeroEvolution().transformId, undefined);
    kit.update(0.6, f.game.enemies, f.hero.getEffectiveStats()); close(f.game.enemies[0].maxHp - f.game.enemies[0].hp, wave.damage);
});

test('Rocket: bajar poder no borra reserva ya pagada; mayor poder solo aporta con nuevos disparos', () => {
    const f = setup('rocket_raccoon', 100), kit = f.hero.abilitySystem.fieldDevice;
    kit.update(6, f.game.enemies); const initial = f.hero.getEffectiveStats().damage;
    kit.onAttack({ damage: initial * 8 }); close(kit.device.budget, initial * 2);
    f.changeLevel(1); kit.onAttack({ damage: f.hero.getEffectiveStats().damage }); close(kit.device.budget, initial * 2);
    const target = f.game.enemies[0]; kit.update(0.5, f.game.enemies);
    close(target.maxHp - target.hp, initial * 2); assert.equal(kit.device.budget, 0);
    f.changeLevel(100); assert.equal(kit.device.budget, 0);
    kit.onAttack({ damage: 40 }); close(kit.device.budget, 10);
});

for (const id of ['rocket_raccoon', 'peni_parker']) test(`${id}: enemigos escapados no crean ni consumen dispositivos`, () => {
    const f = setup(id), kit = f.hero.abilitySystem.fieldDevice;
    for (const e of f.game.enemies) e.hasReachedEnd = true;
    kit.update(8, f.game.enemies); assert.equal(kit.device, null);
    for (const e of f.game.enemies) e.hasReachedEnd = false;
    kit.update(0, f.game.enemies); const device = kit.device; assert.ok(device);
    if (id === 'rocket_raccoon') kit.onAttack({ damage: 40 });
    for (const e of f.game.enemies) e.hasReachedEnd = true;
    kit.update(1, f.game.enemies);
    assert.equal(kit.device, device); assert.ok(f.game.enemies.every(e => e.hp === e.maxHp && !e.debuffs.length));
    if (id === 'rocket_raccoon') close(device.budget, 10);
});
