import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { TacticalActionSystem } from '../src/systems/TacticalActionSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const periods = { jubilee: 6, loki: 5, thor: 11, doctor_strange: 9 };
function setup(id, level = 1) {
    let hero;
    const game = { heroes: [], enemies: [], random: { next: () => 0.99 },
        resourceManager: { lives: 20, credits: 0, addCredits(n) { this.credits += n; } },
        progression: { getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, { level, equippedItemIds: [] }) : null } };
    hero = new Hero({ ...roster[id], level }, 0, 0, game); game.heroes.push(hero);
    const spawn = (x = 110, y = 0, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e8, speed: 100, ...extra },
            [{ x: 0, y: 0 }, { x: 1000, y: 0 }], game);
        Object.assign(enemy, { x, y, distanceTravelled: x }); game.enemies.push(enemy); return enemy;
    };
    const shoot = target => { const shots = []; hero.shoot(target, hero.getEffectiveStats(), shots); return shots; };
    return { game, hero, spawn, shoot, kit: hero.abilitySystem.arcaneStormKit };
}

for (const level of [1, 49, 50, 51, 99, 100]) {
    test(`Jubilee ${level}: destello preparado retrasa apoyo sin stun ni dano extra`, () => {
        const f = setup('jubilee', level), enemy = f.spawn(110, 0, { archetype: 'support', behaviorCooldown: 4 });
        enemy.behavior.actionTimer = 0.5;
        f.kit.update(6); f.shoot(enemy);
        close(enemy.behavior.actionTimer, 4.5); close(enemy.hp, enemy.maxHp);
        assert.equal(enemy.behavior.interruptRecovery, 6); assert.equal(enemy.debuffs.length, 0);
        assert.equal(f.kit.cooldown, 6); assert.equal(f.hero.combatStats.abilityActivations, 1);
        assert.equal(f.hero.getProjectileProfile(f.hero.getEffectiveStats(), enemy).splashRadius, 42);
    });
    test(`Loki ${level}: una replica diferida con snapshot y solo slow permitido`, () => {
        const f = setup('loki', level), enemy = f.spawn(), other = f.spawn(120);
        const power = f.hero.getEffectiveStats().damage;
        f.kit.update(5); const shots = f.shoot(enemy);
        assert.equal(shots.length, 1); close(enemy.hp, enemy.maxHp);
        f.hero.damage *= 3; f.kit.update(0.59); close(enemy.hp, enemy.maxHp); f.kit.update(0.02);
        close(enemy.maxHp - enemy.hp, power * 0.55); close(other.hp, other.maxHp);
        assert.deepEqual(enemy.debuffs.map(s => s.type), ['slow']); close(enemy.debuffs[0].duration, 1.2);
        assert.equal(f.kit.echo, null); assert.equal(f.hero.combatStats.shots, 1);
        assert.equal(f.hero.combatStats.abilityActivations, 1); assert.equal(f.game.heroes.length, 1);
    });
    test(`Thor ${level}: red de cinco madura1s y no golpea sexto`, () => {
        const f = setup('thor', level), enemies = Array.from({ length: 6 }, (_, i) => f.spawn(90 + i * 5));
        const power = f.hero.getEffectiveStats().damage;
        f.kit.update(11); f.shoot(enemies[0]); assert.equal(f.kit.network.targets.length, 5);
        f.hero.damage *= 3; f.kit.update(0.99); assert.ok(enemies.every(e => e.hp === e.maxHp));
        f.kit.update(0.02);
        for (const enemy of enemies.slice(0, 5)) {
            close(enemy.maxHp - enemy.hp, power * 1.45); close(enemy.debuffs[0].duration, 0.3);
        }
        close(enemies[5].hp, enemies[5].maxHp); assert.equal(f.kit.network, null);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
    test(`Strange ${level}: portal limitado a4 y un eco65% al vecino`, () => {
        const f = setup('doctor_strange', level), enemies = Array.from({ length: 6 }, (_, i) => f.spawn(110 + i * 5));
        const power = f.hero.getEffectiveStats().damage;
        f.kit.update(9); assert.equal(f.shoot(enemies[0]).length, 1);
        assert.equal(f.kit.portal.touched.size, 4); assert.equal(f.kit.echo.target, enemies[1]);
        assert.ok(enemies.slice(0, 4).every(e => e.debuffs[0].power === 0.45));
        assert.ok(enemies.slice(4).every(e => e.debuffs.length === 0));
        f.kit.update(0.65); close(enemies[1].maxHp - enemies[1].hp, power * 0.65);
        close(enemies[0].hp, enemies[0].maxHp); assert.equal(f.kit.echo, null);
        assert.equal(f.hero.combatStats.abilityActivations, 1);
    });
}

for (const id of Object.keys(periods)) {
    for (const action of ['move', 'stun', 'sell']) {
        test(`${id}: ${action} cancela preparacion sin cambiar progreso o recursos`, () => {
            const f = setup(id, 50), enemies = [f.spawn(), f.spawn(120), f.spawn(130)];
            f.kit.update(periods[id]); f.shoot(enemies[0]);
            if (action === 'move') f.hero.x = 2;
            if (action === 'stun') f.hero.applyStun(1);
            if (action === 'sell') new TacticalActionSystem(f.game).sell(f.hero);
            f.hero.update(0, [], []);
            assert.equal(f.kit.cooldown, periods[id]); assert.equal(f.kit.echo, null);
            assert.equal(f.kit.network, null); assert.equal(f.kit.portal, null);
            for (const enemy of enemies) {
                close(enemy.hp, enemy.maxHp);
                assert.ok(enemy.debuffs.every(effect => !effect.fieldActive || !effect.fieldActive()));
            }
            assert.equal(f.hero.level, 50); assert.equal(f.game.resourceManager.lives, 20);
            assert.equal(f.game.resourceManager.credits, 0);
        });
    }
}

test('Jubilee: ventana de1s, inmunidad compartida y resistencias', () => {
    const f = setup('jubilee'), enemy = f.spawn(110, 0, { archetype: 'support', statusResistance: 0.5 });
    f.kit.update(6); enemy.behavior.actionTimer = 1.01; f.shoot(enemy); assert.equal(f.kit.cooldown, 0);
    enemy.behavior.actionTimer = 1; f.shoot(enemy); close(enemy.behavior.actionTimer, 3);
    enemy.behavior.actionTimer = 0.5; assert.equal(enemy.behavior.interruptAction(), false);
    enemy.behavior.update(6); enemy.behavior.actionTimer = 0; assert.equal(enemy.behavior.interruptAction(), true);
    close(enemy.behavior.actionTimer, 2);
});

test('Jubilee: interrumpe cura, invocacion y orden sin consumir recursos de invocacion', () => {
    for (const archetype of ['support', 'summoner', 'commander']) {
        const f = setup('jubilee'), enemy = f.spawn(110, 0, { archetype, summonLimit: 2 });
        let actions = 0;
        for (const fn of ['healAllies', 'summonReinforcement', 'commandAllies']) enemy.behavior[fn] = () => actions++;
        enemy.behavior.actionTimer = 0.5; f.kit.update(6); f.shoot(enemy); enemy.behavior.update(0.75);
        assert.equal(actions, 0); assert.equal(enemy.behavior.summonsRemaining, 2);
        assert.equal(enemy.speed, 100);
    }
});

test('Jubilee: excluye jefes, phasers, inmunes, agotados y sabotaje activo', () => {
    for (const config of [{ isBoss: true }, { isFinalBoss: true }, { isMiniBoss: true },
        { archetype: 'phaser', affix: { id: 'commander' } }, { archetype: 'soldier' },
        { immuneToInterrupt: true }, { archetype: 'summoner' }]) {
        const f = setup('jubilee'), enemy = f.spawn(110, 0, { archetype: 'support', ...config });
        enemy.behavior.actionTimer = 0.5; f.kit.update(6); f.shoot(enemy);
        close(enemy.behavior.actionTimer, 0.5); assert.equal(f.kit.cooldown, 0);
    }
    const f = setup('jubilee'), enemy = f.spawn(110, 0, { archetype: 'support' });
    enemy.behavior.actionTimer = 0.5; enemy.behavior.applySabotage(2);
    assert.equal(enemy.behavior.interruptAction(), false);
});

test('Jubilee: boss conserva fase pendiente y no recibe interrupcion', () => {
    const f = setup('jubilee'), enemy = f.spawn(110, 0, { isBoss: true, archetype: 'support',
        phases: [{ name: 'Escudo', threshold: 0.9, barrier: 0.2, telegraph: 1 }] });
    enemy.hp *= 0.8; enemy.behavior.update(0); enemy.behavior.actionTimer = 0.5;
    f.kit.update(6); f.shoot(enemy); enemy.behavior.update(1);
    assert.equal(enemy.currentPhase, 'Escudo'); assert.ok(enemy.behavior.barrier > 0);
});

for (const id of ['loki', 'doctor_strange']) {
    test(`${id}: eco no hereda critico, procs, estados ni area del proyectil`, () => {
        const f = setup(id), enemy = f.spawn(), other = f.spawn(150);
        f.game.random.next = () => 0;
        const power = f.hero.getEffectiveStats().damage;
        f.kit.update(periods[id]);
        f.hero.abilitySystem.onAttack(enemy, f.hero.getEffectiveStats(), { damage: power * 20,
            effects: [{ type: 'poison', power: 0.1, duration: 10 }], chainCount: 20, propagationCount: 20, splashRadius: 500 }, []);
        const echoTarget = f.kit.echo.target;
        f.kit.update(1);
        close(echoTarget.maxHp - echoTarget.hp, power * (id === 'loki' ? 0.55 : 0.65));
        assert.equal(echoTarget.debuffs.some(s => s.type !== 'slow'), false);
        const untouched = echoTarget === enemy ? other : enemy; close(untouched.hp, untouched.maxHp);
        assert.equal(f.game.resourceManager.credits, 0); assert.equal(f.game.resourceManager.lives, 20);
        assert.equal(f.hero.combatStats.shots, 0);
    });
    test(`${id}: eco cancela por muerte, salida o fin de ruta, sin cambiar de presa`, () => {
        for (const action of ['dead', 'outside', 'escaped']) {
            const f = setup(id), enemy = f.spawn(); f.kit.update(periods[id]); f.shoot(enemy);
            const other = f.spawn(120);
            if (action === 'dead') enemy.isAlive = false;
            if (action === 'outside') enemy.x = 2000;
            if (action === 'escaped') enemy.hasReachedEnd = true;
            f.kit.update(1); assert.equal(f.kit.echo, null); close(other.hp, other.maxHp);
        }
    });
    test(`${id}: una baja secundaria sin firma recursiva ni doble recompensa`, () => {
        const f = setup(id), enemy = f.spawn(110, 0, { hp: 1 });
        let signatures = 0; f.hero.abilitySystem.onKill = () => signatures++;
        f.kit.update(periods[id]); f.shoot(enemy); f.kit.update(1); f.kit.update(1);
        assert.equal(enemy.isAlive, false); assert.equal(f.hero.combatStats.kills, 1);
        assert.equal(signatures, 0); assert.equal(f.game.resourceManager.credits, 0);
    });
}

test('Thor: requiere3 conectados, no usa ocultos, muertos ni fuera de alcance', () => {
    const f = setup('thor'), anchor = f.spawn(100), other = f.spawn(-100);
    f.spawn(110, 0, { stealth: true }); const dead = f.spawn(120); dead.isAlive = false; f.spawn(2000);
    f.kit.update(11); f.shoot(anchor); assert.equal(f.kit.network, null); assert.equal(f.kit.cooldown, 0);
    other.x = 120; f.shoot(anchor); assert.equal(f.kit.network, null);
    f.spawn(130); f.shoot(anchor); assert.equal(f.kit.network.targets.length, 3);
});

test('Thor: perder un puente cancela la descarga y los nuevos no heredan carga', () => {
    const f = setup('thor'), anchor = f.spawn(20), bridge = f.spawn(90), last = f.spawn(160);
    f.kit.update(11); f.shoot(anchor); assert.equal(f.kit.network.targets.length, 3);
    f.kit.update(0.5); bridge.y = 120; f.spawn(85); f.kit.update(0.5);
    assert.equal(f.kit.network, null); close(anchor.hp, anchor.maxHp); close(last.hp, last.maxHp);
    assert.ok(f.kit.cooldown > 0);
});

test('Thor: dano pasa defensas, control respeta resistencia e inmunidad', () => {
    const f = setup('thor'), a = f.spawn(90, 0, { armor: 0.5 }), b = f.spawn(110, 0, { statusResistance: 0.5 }),
        c = f.spawn(130, 0, { immuneToStun: true });
    const power = f.hero.getEffectiveStats().damage;
    f.kit.update(11); f.shoot(a); f.kit.update(1);
    close(a.maxHp - a.hp, power * 1.45 * 0.5); close(b.debuffs[0].duration, 0.15);
    assert.equal(c.debuffs.length, 0);
});

test('Strange: radio fijo y punto ciego excluyen tanto eco como campo', () => {
    const f = setup('doctor_strange'), inner = f.spawn(65), anchor = f.spawn(100), far = f.spawn(190);
    f.kit.update(9); f.shoot(anchor); assert.equal(f.kit.echo.target, anchor);
    assert.equal(inner.debuffs.length, 0); assert.equal(far.debuffs.length, 0);
    anchor.x = 60; f.kit.update(0.7); close(anchor.hp, anchor.maxHp);
    assert.equal(anchor.debuffs[0].fieldActive(), false);
});

test('Strange: un contacto por campo, deja de ralentizar al salir y preserva slow aliado', () => {
    const f = setup('doctor_strange'), enemy = f.spawn();
    enemy.applyStatus({ type: 'slow', power: 0.2, duration: 10 }, { id: 'ally' });
    f.kit.update(9); f.shoot(enemy);
    const field = enemy.debuffs.find(s => s.fieldActive); assert.equal(field.fieldActive(), true);
    enemy.x = 190; f.kit.update(0); assert.equal(field.fieldActive(), false);
    enemy.updateDebuffs(0.1); close(enemy.speed, 80);
    enemy.x = 110; f.kit.update(0.1);
    assert.equal(enemy.debuffs.some(s => s.fieldActive), false);
    f.kit.update(3); assert.equal(f.kit.portal, null); assert.equal(enemy.debuffs[0].source.id, 'ally');
});

test('Strange: el portal nunca sigue a la presa y los resistentes no refrescan su slow', () => {
    const f = setup('doctor_strange'), enemy = f.spawn(110, 0, { statusResistance: 0.5 });
    f.kit.update(9); f.shoot(enemy); close(enemy.debuffs[0].duration, 1.5);
    enemy.x = 130; enemy.updateDebuffs(1.6); f.kit.update(1.6);
    assert.equal(f.kit.portal.x, 110); assert.equal(enemy.debuffs.length, 0);
});

test('los cuatro kits requieren despliegue y respetan objetivos invalidos sin gastar cooldown', () => {
    for (const id of Object.keys(periods)) {
        const f = setup(id), enemy = f.spawn(110, 0, { archetype: 'support' }); enemy.behavior.actionTimer = 0.5;
        f.kit.update(periods[id]); enemy.hasReachedEnd = true; f.kit.onAttack(enemy, f.hero.getEffectiveStats());
        assert.equal(f.kit.cooldown, 0);
        enemy.hasReachedEnd = false; f.game.heroes = []; f.kit.onAttack(enemy, f.hero.getEffectiveStats());
        assert.equal(f.hero.combatStats.abilityActivations, 0);
    }
});

test('render de ilusion reutiliza sprite sin mover heroe ni agregar plazas', () => {
    const f = setup('loki'), enemy = f.spawn(); f.kit.update(5); f.shoot(enemy);
    let draw;
    f.hero.animator.render = (ctx, x, y) => { draw = { x, y, alpha: ctx.globalAlpha }; };
    f.kit.render({ save() {}, restore() {} });
    assert.deepEqual(draw, { x: 24, y: -18, alpha: 0.45 });
    assert.equal(f.hero.x, 0); assert.equal(f.hero.y, 0); assert.equal(f.game.heroes.length, 1);
});
