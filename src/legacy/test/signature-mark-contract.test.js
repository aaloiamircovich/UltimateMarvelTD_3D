import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';
import { buildSignatureAttackContext, resolveSignatureAfterAttack } from '../src/systems/ItemSignatureSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

function setup(id, itemId, level = 50) {
    let hero;
    const game = {
        heroes: [], enemies: [], resourceManager: { lives: 20 }, random: { next: () => 0.99 },
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => getEvolutionForHero(hero, {}, { level: hero?.level ?? level, equippedItemIds: (hero?.items || []).map((item) => item.id) })
        }
    };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game);
    hero.items = [items[itemId]];
    game.heroes = [hero];
    const spawn = (x = 60, config = {}) => {
        const target = new Enemy({ id: 'dummy', hp: 100000, speed: 1, category: hero.category, ...config }, [{ x, y: 0 }, { x: 1000, y: 0 }], game);
        game.enemies.push(target);
        return target;
    };
    const context = (target) => buildSignatureAttackContext(hero, target, hero.getEffectiveStats());
    const attack = (target, count = 1) => {
        let ctx;
        for (let n = 0; n < count; n++) {
            ctx = context(target);
            resolveSignatureAfterAttack(hero, target, ctx.stats, {}, [], ctx);
        }
        return ctx;
    };
    const advance = (dt) => {
        game.enemies.forEach((enemy) => enemy.updateDebuffs(dt));
        hero.update(dt, [], []);
    };
    return { hero, game, spawn, context, attack, advance };
}

test('Elsa aplica marca al cuarto ataque y el bonus propio empieza en el quinto', () => {
    const f = setup('elsa_bloodstone', 'fragmento_bloodstone');
    const target = f.spawn();
    const base = f.hero.getEffectiveStats().damage;
    closeTo(f.attack(target, 4).stats.damage, base);
    assert.equal(target.debuffs[0].type, 'mark');
    closeTo(target.debuffs[0].power, 0.32);
    closeTo(f.context(target).stats.damage, base * 1.32);
});

test('Elsa pierde bonus al caducar y debe volver a completar cuatro ataques', () => {
    const f = setup('elsa_bloodstone', 'fragmento_bloodstone');
    const target = f.spawn();
    const base = f.hero.getEffectiveStats().damage;
    f.attack(target, 4);
    f.advance(5);
    closeTo(f.context(target).stats.damage, base);
    closeTo(f.attack(target, 3).stats.damage, base);
    assert.equal(target.debuffs.length, 0);
    f.attack(target);
    closeTo(f.context(target).stats.damage, base * 1.32);
});

test('Elsa no recupera el bonus anterior tras cambiar de presa y volver', () => {
    const f = setup('elsa_bloodstone', 'fragmento_bloodstone');
    const a = f.spawn();
    const b = f.spawn(70);
    const base = f.hero.getEffectiveStats().damage;
    f.attack(a, 4);
    f.attack(b);
    closeTo(f.context(a).stats.damage, base);
    assert.ok(a.debuffs.some((entry) => entry.type === 'mark'));
    closeTo(f.attack(a, 4).stats.damage, base);
    closeTo(f.context(a).stats.damage, base * 1.32);
});

test('Elsa refresca su ventana al continuar sobre la presa sin multiplicar el bonus', () => {
    const f = setup('elsa_bloodstone', 'fragmento_bloodstone');
    const target = f.spawn();
    const base = f.hero.getEffectiveStats().damage;
    f.attack(target, 4);
    f.advance(4);
    closeTo(f.attack(target).stats.damage, base * 1.32);
    f.advance(4);
    closeTo(f.context(target).stats.damage, base * 1.32);
    f.advance(1);
    closeTo(f.context(target).stats.damage, base);
});

test('Elsa no aplica marca al blanco muerto antes de resolver su cuarto ataque', () => {
    const f = setup('elsa_bloodstone', 'fragmento_bloodstone');
    const target = f.spawn();
    f.attack(target, 3);
    const ctx = f.context(target);
    target.isAlive = false;
    resolveSignatureAfterAttack(f.hero, target, ctx.stats, {}, [], ctx);
    assert.equal(target.debuffs.length, 0);
    assert.equal(f.hero.signatureState.fragmento_bloodstone.huntHits, 0);
});

for (const [id, itemId, hits, duration] of [['elsa_bloodstone', 'fragmento_bloodstone', 4, 5], ['beast', 'protocolo_danger_room', 1, 2.2]]) {
    test(`${id}: duracion propia respeta resistencia de jefe y no se extiende por otra marca`, () => {
        const f = setup(id, itemId);
        const target = f.spawn(60, { isBoss: true, statusResistance: 0.4, statusResistances: { mark: 0.3 } });
        const base = f.hero.getEffectiveStats().damage;
        f.attack(target, hits);
        closeTo(target.debuffs[0].duration, duration * 0.3);
        target.applyStatus({ type: 'mark', duration: 100, power: 0.5 }, { id: 'other' });
        f.advance(duration * 0.3);
        assert.ok(target.debuffs.some((entry) => entry.type === 'mark'));
        closeTo(f.context(target).stats.damage, base);
    });

    test(`${id}: una marca eliminada o un blanco muerto no conserva bonus propio`, () => {
        for (const removed of ['mark', 'target']) {
            const f = setup(id, itemId);
            const target = f.spawn();
            const base = f.hero.getEffectiveStats().damage;
            f.attack(target, hits);
            if (removed === 'mark') target.debuffs = [];
            else target.isAlive = false;
            closeTo(f.context(target).stats.damage, base);
        }
    });

    test(`${id}: marca signature requiere nivel 50 y objeto en primer slot`, () => {
        const f = setup(id, itemId, 49);
        const target = f.spawn();
        f.attack(target, 20);
        assert.equal(target.debuffs.length, 0);
        f.hero.level = 50;
        f.hero.items = [{ id: 'other' }, items[itemId]];
        f.attack(target, 20);
        assert.equal(target.debuffs.length, 0);
        f.hero.items = [items[itemId]];
        f.attack(target, hits);
        assert.ok(target.debuffs.some((entry) => entry.type === 'mark'));
    });
}

test('Beast analiza inicialmente y cada diez ataques sin pulso generico extra', () => {
    const f = setup('beast', 'protocolo_danger_room');
    const target = f.spawn();
    f.attack(target, 10);
    assert.equal(target.hp, target.maxHp);
    assert.equal(f.hero.combatStats.abilityActivations, 0);
    f.advance(2.2);
    closeTo(f.context(target).stats.damage, f.hero.getEffectiveStats().damage * 1.18);
});

test('analisis mantiene prioridad de jefe y excluye blancos fuera de alcance', () => {
    const f = setup('beast', 'protocolo_danger_room');
    const normal = f.spawn();
    const boss = f.spawn(80, { isBoss: true });
    const far = f.spawn(5000, { isBoss: true });
    f.attack(normal);
    assert.equal(normal.debuffs.length, 0);
    assert.equal(far.debuffs.length, 0);
    assert.equal(boss.debuffs[0].type, 'mark');
    closeTo(f.context(boss).stats.damage, f.hero.getEffectiveStats().damage * 1.18);
});

test('Localizador marca al oculto detectable sin eliminar su sigilo permanentemente', () => {
    const f = setup('mockingbird', 'localizador_fury');
    const target = f.spawn(60, { stealth: true });
    f.attack(target);
    assert.ok(target.debuffs.some((entry) => entry.type === 'mark'));
    assert.equal(target.stealth, true);
    const ally = new Hero(heroes.hulk, 0, 0, f.game);
    assert.equal(ally.getBestTarget([target], ally.getEffectiveStats()), null);
    f.advance(2.2);
    assert.equal(target.stealth, true);
});

test('Localizador no convierte a Nick Fury ni Maria Hill en atacantes', () => {
    for (const id of ['nick_fury', 'maria_hill']) {
        const f = setup(id, 'localizador_fury');
        const target = f.spawn();
        const projectiles = [];
        f.hero.update(10, [target], projectiles);
        assert.equal(f.hero.isSupportAuraOnly(), true);
        assert.equal(projectiles.length, 0);
        assert.equal(target.debuffs.length, 0);
        assert.equal(target.hp, target.maxHp);
    }
});
