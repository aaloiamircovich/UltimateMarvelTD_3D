import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null, getHeroEvolution: () => hero
            ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: hero.items.map(item => item.id) }) : null } };
    hero = new Hero({ ...heroes[id], level }, 0, 0, game); game.heroes = [hero];
    const spawn = (extra = {}, x = 80) => {
        const enemy = new Enemy({ id: 'target', category: 'Urbano', hp: 1e7, speed: 1, ...extra },
            [{ x, y: 0 }, { x: 10000, y: 0 }], game);
        game.enemies.push(enemy); return enemy;
    };
    const shoot = (target) => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots[0]; };
    const kit = hero.abilitySystem.focusKit;
    return { game, hero, spawn, shoot, kit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Cable nivel ${level}: 3 segundos, un disparo reforzado y reinicio`, () => {
        const f = setup('cable', level), target = f.spawn({ isBoss: true });
        f.kit.update(0); f.kit.update(2.9);
        const damage = f.hero.getEffectiveStats().damage;
        close(f.shoot(target).damage, damage);
        f.kit.update(0.11);
        assert.equal(f.kit.getDisplayState().ready, true);
        close(f.shoot(target).damage, damage * 1.9);
        close(f.shoot(target).damage, damage);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Nebula nivel ${level}: progresion de penetracion acotada`, () => {
        const f = setup('nebula', level), target = f.spawn();
        for (let i = 0; i < 15; i++) close(f.shoot(target).armorPenetration, Math.min(5, i) * 0.1);
        assert.equal(f.kit.stacks, 5);
        assert.equal(f.game.resourceManager.credits, 0);
        assert.equal(f.game.resourceManager.lives, 20);
    });
}

for (const extra of [{ isBoss: true }, { isMiniBoss: true }, { isFinalBoss: true }, { threat: 4 }]) {
    test(`Cable reconoce objetivo resistente ${JSON.stringify(extra)}`, () => {
        const f = setup('cable'), target = f.spawn(extra); f.kit.update(0); f.kit.update(3);
        assert.equal(f.kit.damageMultiplier(target), 1.9);
    });
}

test('Cable no carga sobre enemigos comunes ni acumula varios remates', () => {
    const f = setup('cable'), target = f.spawn(); f.kit.update(0); f.kit.update(100);
    assert.equal(f.kit.damageMultiplier(target), 1);
    target.threat = 4; f.kit.update(0); f.kit.update(100);
    f.shoot(target);
    assert.equal(f.kit.damageMultiplier(target), 1);
});

for (const id of ['cable', 'nebula']) {
    for (const reason of ['blanco', 'mover', 'stun', 'fuera', 'muerto', 'retirar']) {
        test(`${id}: reinicia por ${reason}`, () => {
            const f = setup(id), target = f.spawn({ isBoss: true });
            f.kit.update(0); f.kit.update(3);
            if (id === 'nebula') for (let i = 0; i < 5; i++) f.shoot(target);
            if (reason === 'blanco') {
                const next = f.spawn({ isBoss: true }); next.distanceTravelled = 1000;
                if (id === 'nebula') { close(f.shoot(next).armorPenetration, 0); assert.equal(f.kit.stacks, 1); return; }
            }
            if (reason === 'mover') f.hero.x += 1;
            if (reason === 'stun') f.hero.stunTimer = 2;
            if (reason === 'fuera') target.x = 10000;
            if (reason === 'muerto') target.isAlive = false;
            if (reason === 'retirar') new TacticalActionSystem(f.game).sell(f.hero);
            else f.kit.update(0.1);
            assert.equal(f.kit.damageMultiplier(target), 1);
            assert.equal(f.kit.penetration(target), 0);
            assert.equal(f.kit.elapsed, 0);
        });
    }
}

test('Cable respeta brazos de cruz y no carga sobre diagonal', () => {
    const f = setup('cable'), target = f.spawn({ isBoss: true }, 140); target.y = 140;
    f.kit.update(0); f.kit.update(10);
    assert.equal(f.kit.damageMultiplier(target), 1);
});

test('Nebula: ventaja tecnologica explicita en ambas grafias; sin bonus de dano', () => {
    for (const category of ['Tecnológico', 'Tecnologico', 'Urbano']) {
        const f = setup('nebula'), target = f.spawn({ category });
        const damage = f.hero.getEffectiveStats().damage;
        for (let i = 0; i < 6; i++) {
            const shot = f.shoot(target);
            close(shot.damage, damage);
            close(shot.armorPenetration, Math.min(i, 5) * 0.1 + (i && category !== 'Urbano' ? 0.1 : 0));
        }
    }
});

test('Nebula: pausa de 2.5 s borra adaptacion; consultas no la consumen', () => {
    const f = setup('nebula'), target = f.spawn(); f.shoot(target);
    f.kit.update(2.49);
    for (let i = 0; i < 5; i++) close(f.kit.penetration(target), 0.1);
    f.kit.update(0.02); close(f.kit.penetration(target), 0);
});

test('proyectiles en vuelo conservan dano y penetracion tras cambiar blanco', () => {
    for (const id of ['cable', 'nebula']) {
        const f = setup(id), target = f.spawn({ isBoss: true });
        f.kit.update(0); f.kit.update(3);
        if (id === 'nebula') f.shoot(target);
        const shot = f.shoot(target), damage = shot.damage, penetration = shot.armorPenetration;
        f.shoot(f.spawn()); f.kit.reset();
        assert.equal(shot.damage, damage); assert.equal(shot.armorPenetration, penetration);
    }
});

test('objetos respetan techo de penetracion y firmas no cargan adaptacion', () => {
    const f = setup('nebula', 50), target = f.spawn({ category: 'Tecnologico' });
    f.hero.items = [{ id: 'probe', effects: { armorPenetration: 0.5 } }];
    for (let i = 0; i < 6; i++) f.shoot(target);
    close(f.shoot(target).armorPenetration, 0.85);
    f.hero.items = [items.comunicador_guardianes]; f.kit.reset();
    for (let i = 0; i < 8; i++) f.shoot(target);
    assert.equal(f.kit.stacks, 5);
    assert.ok(f.hero.combatStats.abilityActivations >= 1);
});

test('penetracion mejora contra armadura, no multiplica dano a blancos desnudos', () => {
    function hit(armor, prepare) {
        const f = setup('nebula'), target = f.spawn({ armor });
        if (prepare) for (let i = 0; i < 5; i++) f.shoot(target);
        const shot = f.shoot(target); shot.effects = [];
        CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
        return target.maxHp - target.hp;
    }
    close(hit(0, true), hit(0, false));
    assert.ok(hit(0.6, true) > hit(0.6, false));
});

test('Cable: 60 s de combate continuo refuerzan disparos sin cambiar cadencia', () => {
    const f = setup('cable'), target = f.spawn({ isBoss: true });
    let shots = 0, charged = 0;
    const damage = f.hero.getEffectiveStats().damage;
    for (let frame = 0; frame < 3600; frame++) {
        const projectiles = [];
        f.hero.update(1 / 60, [target], projectiles);
        for (const shot of projectiles) { shots++; if (shot.damage > damage * 1.5) charged++; }
    }
    assert.ok(shots >= 55 && shots <= 58);
    assert.ok(charged >= 17 && charged <= 20);
    assert.equal(f.hero.combatStats.abilityActivations, charged);
});

test('Nebula: el reloj y stun de Hero.update borran adaptacion sin disparar', () => {
    const f = setup('nebula'), target = f.spawn(); f.shoot(target);
    f.hero.stunTimer = 1;
    f.hero.update(0.5, [target], []);
    assert.equal(f.kit.stacks, 0);
    assert.equal(f.hero.combatStats.shots, 1);
});
