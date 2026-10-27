import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { buildSignatureAttackContext, resolveSignatureAfterAttack, getSignatureConfig } from '../src/systems/ItemSignatureSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const cases = [['x_23', 'protocolo_danger_room', 10], ['deadpool', 'arsenal_deadpool', 3], ['kate_bishop', 'carcaj_flechas_truco', 4]];
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

function makeHero(id, itemId, level = 50) {
    let hero;
    const game = {
        heroes: [], enemies: [], random: { next: () => 0.99 }, resourceManager: { lives: 20 },
        progression: {
            getHeroBonuses: () => ({ damage: 0, range: 0, fireRate: 0, critChance: 0 }),
            getHeroEvolution: () => getEvolutionForHero(hero, {}, { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...heroes[id], level, damage: getHeroDamageAtLevel(heroes[id].damage, level, heroes[id].rarity) }, 0, 0, game);
    hero.items = [items[itemId]];
    game.heroes = [hero];
    return hero;
}

function enemy(x = 40, hp = 100000) {
    return new Enemy({ id: 'dummy', hp, speed: 10 }, [{ x, y: 0 }, { x: 500, y: 0 }]);
}

function advance(hero, target, attacks, projectiles = []) {
    for (let index = 0; index < attacks; index++) {
        const context = buildSignatureAttackContext(hero, target, hero.getEffectiveStats());
        resolveSignatureAfterAttack(hero, target, context.stats, {}, projectiles, context);
    }
    return projectiles;
}

function impact(projectile) {
    projectile.x = projectile.target.x;
    projectile.y = projectile.target.y;
    projectile.update(0);
    assert.equal(projectile.isActive, false);
}

for (const [id, itemId, interval] of cases) {
    test(`${id}: firma bloqueada a nivel 49 y sin el objeto en su unico slot`, () => {
        const hero = makeHero(id, itemId, 49);
        const target = enemy();
        hero.game.enemies = [target];
        assert.equal(advance(hero, target, interval * 2).length, 0);
        assert.equal(target.hp, target.maxHp);
        assert.equal(getSignatureConfig(hero), null);
        hero.level = 50;
        assert.equal(getSignatureConfig(hero).interval, interval);
        hero.items = [{ id: 'unrelated', effects: {} }, items[itemId]];
        assert.equal(getSignatureConfig(hero), null);
        hero.items = [];
        assert.equal(getSignatureConfig(hero), null);
        assert.equal(hero.game.progression.getHeroEvolution().levelEvolved, true);
    });
}

test('X-23: Corte Multiple escala por nivel sin depender de salud enemiga', () => {
    let previous = 0;
    for (const level of [50, 75, 100]) {
        for (const hp of [100000, 1000000]) {
            const hero = makeHero('x_23', 'protocolo_danger_room', level);
            const targets = [enemy(30, hp), enemy(40, hp), enemy(50, hp), enemy(60, hp)];
            hero.game.enemies = targets;
            const projectiles = advance(hero, targets[0], 9);
            assert.equal(projectiles.length, 0);
            advance(hero, targets[0], 1, projectiles);
            assert.equal(projectiles.length, 3);
            assert.equal(new Set(projectiles.map((shot) => shot.target)).size, 3);
            const dps = hero.getEffectiveStats().damage * 0.3;
            for (const shot of projectiles) {
                const target = shot.target;
                impact(shot);
                const bleed = target.debuffs.find((effect) => effect.type === 'bleed');
                assert.equal(bleed.damageBasis, 'attackDamage');
                assert.equal(bleed.duration, 4);
                closeTo(bleed.damagePerSecond, dps);
                const before = target.hp;
                target.updateDebuffs(2);
                closeTo(before - target.hp, dps * 2);
            }
            assert.equal(targets[3].hp, hp);
            assert.equal(targets[3].debuffs.length, 0);
            if (hp === 100000) {
                assert.ok(dps > previous);
                previous = dps;
            }
        }
    }
});

test('X-23: un jefe aislado recibe un corte; el sangrado mas fuerte reemplaza al normal', () => {
    const hero = makeHero('x_23', 'protocolo_danger_room');
    const target = enemy();
    target.isBoss = true;
    hero.game.enemies = [target];
    hero.game.random.next = () => 0;
    CombatSystem.applyEffects(hero.getProjectileEffects(target), target, hero);
    const normal = target.debuffs.find((effect) => effect.type === 'bleed').damagePerSecond;
    const shots = advance(hero, target, 10);
    assert.equal(shots.length, 1);
    impact(shots[0]);
    const bleeds = target.debuffs.filter((effect) => effect.type === 'bleed');
    assert.equal(bleeds.length, 1);
    closeTo(bleeds[0].damagePerSecond, hero.getEffectiveStats().damage * 0.3);
    assert.ok(bleeds[0].damagePerSecond > normal);
    const captured = bleeds[0].damagePerSecond;
    hero.damage *= 2;
    const before = target.hp;
    target.updateDebuffs(2);
    closeTo(before - target.hp, captured * 2);
});

test('X-23: cortes dirigidos excluyen sigilo y enemigos fuera de alcance', () => {
    const hero = makeHero('x_23', 'protocolo_danger_room');
    const primary = enemy();
    const hidden = enemy(45);
    hidden.stealth = true;
    const outside = enemy(1000);
    hero.game.enemies = [primary, hidden, outside];
    assert.equal(hero.getEffectiveStats().canSeeStealth, false);
    const shots = advance(hero, primary, 10);
    assert.equal(shots.length, 1);
    assert.equal(shots[0].target, primary);
});

test('X-23: el sangrado especial acredita una sola baja y no cura la base', () => {
    const hero = makeHero('x_23', 'protocolo_danger_room');
    const target = enemy();
    hero.game.enemies = [target];
    impact(advance(hero, target, 10)[0]);
    target.hp = 1;
    const before = hero.combatStats.kills;
    target.updateDebuffs(0.4);
    target.updateDebuffs(0.4);
    assert.equal(target.isAlive, false);
    assert.equal(hero.combatStats.kills, before + 1);
    assert.equal(hero.game.resourceManager.lives, 20);
});

test('Deadpool: pistolas-katana-explosivos empieza desde la primera activacion y repite', () => {
    const hero = makeHero('deadpool', 'arsenal_deadpool');
    const targets = [enemy(30), enemy(40), enemy(50)];
    hero.game.enemies = targets;
    for (const [style, factor, count, radius] of [
        ['ballistic', 0.72, 2, 0], ['blade', 1.18, 1, 0], ['explosive', 0.92, 2, 48], ['ballistic', 0.72, 2, 0]
    ]) {
        const shots = advance(hero, targets[0], 2);
        assert.equal(shots.length, 0);
        advance(hero, targets[0], 1, shots);
        assert.equal(shots.length, count);
        assert.equal(new Set(shots.map((shot) => shot.target)).size, count);
        for (const shot of shots) {
            assert.equal(shot.visualStyle, style);
            assert.equal(shot.splashRadius, radius);
            closeTo(shot.damage, hero.getEffectiveStats().damage * factor);
            assert.equal(shot.effects.length, 0);
        }
    }
});

test('Deadpool: cada fase produce un solo disparo especial ante un jefe aislado', () => {
    const hero = makeHero('deadpool', 'arsenal_deadpool');
    const boss = enemy();
    boss.isBoss = true;
    hero.game.enemies = [boss];
    for (let phase = 0; phase < 3; phase++) assert.equal(advance(hero, boss, 3).length, 1);
});

test('Kate Bishop: empieza con explosion, sigue con slow y armor break, luego repite', () => {
    const hero = makeHero('kate_bishop', 'carcaj_flechas_truco');
    for (const [kind, factor] of [['splash', 0.9], ['slow', 0.72], ['armorBreak', 0.82], ['splash', 0.9]]) {
        const primary = enemy(40);
        const neighbor = enemy(60);
        const outside = enemy(100);
        hero.game.enemies = [primary, neighbor, outside];
        advance(hero, primary, 3);
        assert.equal(primary.hp, primary.maxHp);
        advance(hero, primary, 1);
        closeTo(primary.maxHp - primary.hp, hero.getEffectiveStats().damage * factor);
        if (kind === 'splash') {
            closeTo(neighbor.maxHp - neighbor.hp, hero.getEffectiveStats().damage * factor * 0.45);
            assert.equal(primary.debuffs.length, 0);
        } else {
            const effect = primary.debuffs.find((entry) => entry.type === kind);
            assert.ok(effect);
            assert.equal(effect.power, kind === 'slow' ? 0.48 : 0.2);
            assert.equal(neighbor.hp, neighbor.maxHp);
            assert.equal(neighbor.debuffs.length, 0);
        }
        assert.equal(outside.hp, outside.maxHp);
    }
});

test('dos Deadpool mantienen contadores de ciclo independientes', () => {
    const first = makeHero('deadpool', 'arsenal_deadpool');
    const second = makeHero('deadpool', 'arsenal_deadpool');
    const target = enemy();
    first.game.enemies = second.game.enemies = [target];
    advance(first, target, 3);
    assert.equal(advance(first, target, 3)[0].visualStyle, 'blade');
    assert.equal(advance(second, target, 3)[0].visualStyle, 'ballistic');
});
