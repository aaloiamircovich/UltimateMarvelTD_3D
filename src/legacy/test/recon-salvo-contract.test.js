import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy, buildEnemyStatusPips } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], projectiles: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: hero.items.map(item => item.id) }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game);
    game.heroes = [hero];
    const spawn = (x = 80, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e6, speed: 1, ...extra },
            [{ x, y: 0 }, { x: 10000, y: 0 }], game);
        game.enemies.push(enemy);
        return enemy;
    };
    const shoot = (target, count = 6) => {
        const shots = [];
        for (let i = 0; i < count; i++) hero.shoot(target, hero.getEffectiveStats(), shots);
        return shots;
    };
    const tick = (dt) => {
        hero.visualTime += dt;
        hero.abilitySystem.update(dt, game.enemies, hero.getEffectiveStats(), []);
    };
    return { hero, game, spawn, shoot, tick, kit: hero.abilitySystem.avengerKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`salva nivel ${level}: seis disparos, demora y dano efectivo`, () => {
        const f = setup('war_machine', level), target = f.spawn();
        const damage = f.hero.getEffectiveStats().damage * 0.6 * f.kit.getPowerScale();
        f.shoot(target, 5); assert.equal(f.kit.salvo, null);
        f.shoot(target, 1); assert.ok(f.kit.salvo);
        f.tick(0.89); assert.equal(target.hp, target.maxHp);
        f.tick(0.02); close(target.maxHp - target.hp, damage);
        assert.equal(f.kit.salvo, null);
        f.tick(1); close(target.maxHp - target.hp, damage);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.game.resourceManager.credits, 0);
    });
    test(`recon nivel ${level}: revela con duracion fija y no cambia sigilo nativo`, () => {
        const f = setup('falcon', level), target = f.spawn(180, { stealth: true });
        f.tick(0);
        assert.equal(target.stealth, false);
        assert.equal(target.nativeStealth, true);
        assert.equal(target.debuffs.find(e => e.type === 'reveal').duration, 2);
        target.update(2.01);
        assert.equal(target.stealth, true);
    });
}

test('revelado permite fijar blanco fuera del aura; otro oculto permanece oculto', () => {
    const f = setup('falcon'), target = f.spawn(180, { stealth: true }), other = f.spawn(200, { stealth: true });
    target.distanceTravelled = 300;
    const ally = new Hero(heroes.punisher, 200, 0, f.game);
    f.game.heroes.push(ally);
    f.tick(0);
    assert.equal(ally.getEffectiveStats().canSeeStealth, false);
    assert.equal(ally.getBestTarget([target, other], ally.getEffectiveStats()), target);
    assert.equal(other.stealth, true);
    assert.ok(buildEnemyStatusPips(target.debuffs).visible.some(e => e.type === 'reveal'));
});

test('revelado no altera posteriores cambios de fase ni inmunidades de duracion', () => {
    const f = setup('falcon'), target = f.spawn(80, { stealth: true, statusResistance: 0.5 });
    f.tick(0);
    close(target.debuffs.find(e => e.type === 'reveal').duration, 1);
    target.stealth = false;
    target.update(1.1);
    assert.equal(target.stealth, false);
    target.stealth = true;
    assert.equal(target.stealth, true);
});

test('asalto no revela; alternar modo no reinicia cooldown', () => {
    const f = setup('falcon'), target = f.spawn(80, { stealth: true });
    f.kit.setMode('assault'); f.tick(0);
    assert.equal(target.stealth, true);
    close(f.kit.cooldownRemaining, 1.65);
    f.kit.setMode('recon'); f.tick(0);
    assert.equal(target.stealth, true);
    close(f.kit.cooldownRemaining, 1.65);
});

test('retirar Falcon deja solo la duracion restante de revelado', () => {
    const f = setup('falcon'), target = f.spawn(80, { stealth: true });
    f.tick(0);
    new TacticalActionSystem(f.game).sell(f.hero);
    assert.equal(target.stealth, false);
    target.update(2.01);
    assert.equal(target.stealth, true);
});

test('salva fija no sigue al principal; puede alcanzar un nuevo enemigo en la zona', () => {
    const f = setup('war_machine'), target = f.spawn();
    f.shoot(target);
    const newcomer = f.spawn(100);
    target.x = 300;
    f.tick(1);
    assert.equal(target.hp, target.maxHp);
    assert.ok(newcomer.hp < newcomer.maxHp);
});

test('salva limita cinco victimas detectadas, sin DoT, stun ni recursividad', () => {
    const f = setup('war_machine'), target = f.spawn();
    f.shoot(target);
    const hidden = f.spawn(81, { stealth: true });
    const dead = f.spawn(82); dead.isAlive = false;
    const outside = f.spawn(146);
    for (let i = 0; i < 7; i++) f.spawn(83 + i);
    f.tick(1);
    assert.equal(f.game.enemies.filter(e => e.hp < e.maxHp).length, 5);
    assert.equal(hidden.hp, hidden.maxHp);
    assert.equal(dead.hp, dead.maxHp);
    assert.equal(outside.hp, outside.maxHp);
    assert.ok(f.game.enemies.every(e => e.debuffs.length === 0));
    assert.equal(f.hero.combatStats.shots, 6);
});

for (const action of ['mover', 'stun', 'retirar']) {
    test(`salva se cancela al ${action}`, () => {
        const f = setup('war_machine'), target = f.spawn(); f.shoot(target);
        if (action === 'mover') f.hero.x += 1;
        if (action === 'stun') { f.hero.stunTimer = 2; f.hero.update(0.1, [], []); }
        if (action === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
        f.tick(1);
        assert.equal(f.kit.salvo, null);
        assert.equal(target.hp, target.maxHp);
    });
}

test('no acumula zonas si dispara muy rapido y el telegrafo usa coordenadas del mapa', () => {
    const f = setup('war_machine'), target = f.spawn();
    f.hero.x = 20;
    f.shoot(target); const zone = f.kit.salvo;
    f.shoot(target, 12); assert.equal(f.kit.salvo, zone);
    const arcs = [];
    f.kit.render({ save() {}, restore() {}, setLineDash() {}, beginPath() {}, stroke() {}, arc(...args) { arcs.push(args); } });
    assert.deepEqual(arcs[0].slice(0, 3), [80, 0, 65]);
    f.tick(1);
    assert.equal(f.hero.combatStats.abilityActivations, 1);
});

test('War Machine evolucionado conserva la firma de diez disparos separada de la salva', () => {
    const f = setup('war_machine', 50), target = f.spawn();
    f.hero.items = [items.armadura_war_machine];
    f.shoot(target, 10);
    assert.equal(f.hero.combatStats.shots, 10);
    assert.equal(f.hero.combatStats.abilityActivations, 2);
    assert.ok(f.kit.salvo);
});

test('salva aporta mas contra densidad; corredores fuera de zona no reciben extra', () => {
    function run(count, speed) {
        const f = setup('war_machine');
        const enemies = Array.from({ length: count }, (_, i) => f.spawn(80 + i, { speed }));
        f.shoot(enemies[0]);
        enemies.forEach(enemy => enemy.update(0.91)); f.tick(0.91);
        return enemies.reduce((total, e) => total + e.maxHp - e.hp, 0);
    }
    const single = run(1, 1), dense = run(5, 1);
    close(dense, single * 5);
    assert.equal(run(5, 100), 0);
});
