import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBossTelegraphTheme, buildEnemyStatusPips, Enemy, shouldRenderEnemyStatusDetails } from '../src/entities/Enemy.js';

test('Enemy permanece fijado a un tramo horizontal', () => {
    const enemy = new Enemy({ id: 'test', hp: 10, speed: 50 }, [
        { x: 0, y: 100 },
        { x: 200, y: 100 }
    ]);

    enemy.y = 105;
    enemy.update(0.5);
    assert.equal(enemy.y, 100);
});

test('Enemy permanece fijado a un tramo vertical', () => {
    const enemy = new Enemy({ id: 'test', hp: 10, speed: 50 }, [
        { x: 120, y: 0 },
        { x: 120, y: 200 }
    ]);

    enemy.x = 126;
    enemy.update(0.5);
    assert.equal(enemy.x, 120);
});

test('Enemy aplica armadura porcentual', () => {
    const enemy = new Enemy({ id: 'test', hp: 100, speed: 50, armor: 0.5 }, [{ x: 0, y: 0 }]);
    enemy.takeDamage(20);
    assert.equal(enemy.hp, 90);
});

test('Enemy retrocede por los segmentos sin salir del camino', () => {
    const enemy = new Enemy({ id: 'test', hp: 100, speed: 100 }, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
    ]);

    enemy.moveForward(150);
    enemy.moveBackward(80);

    assert.equal(enemy.pathIndex, 0);
    assert.equal(enemy.x, 70);
    assert.equal(enemy.y, 0);
    assert.equal(enemy.distanceTravelled, 70);
});

test('Enemy corrige desplazamientos externos al punto mas cercano de la ruta', () => {
    const enemy = new Enemy({ id: 'test', hp: 100, speed: 0 }, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
    ]);

    enemy.moveForward(120);
    enemy.x = 220;
    enemy.y = 80;
    enemy.update(0);

    assert.equal(enemy.pathIndex, 1);
    assert.equal(enemy.x, 100);
    assert.equal(enemy.y, 80);
    assert.equal(enemy.distanceTravelled, 180);
});

test('Enemy en ruta exacta entra visualmente en la meta antes de fugar', () => {
    const game = { currentLevel: { rendering: { pathMode: 'exact', tileSize: 32 } } };
    const enemy = new Enemy({ id: 'test', hp: 100, speed: 100, visual: { size: 96 } }, [
        { x: 40, y: 40 },
        { x: 40, y: 100 }
    ], game);

    enemy.moveForward(60);
    assert.equal(enemy.x, 40);
    assert.equal(enemy.y, 100);
    assert.equal(enemy.hasReachedEnd, false);

    enemy.moveForward(12);
    assert.equal(enemy.y, 112);
    assert.equal(enemy.hasReachedEnd, false);

    enemy.moveForward(13);
    assert.equal(enemy.y, 124);
    assert.equal(enemy.hasReachedEnd, true);
});

test('Enemigos voladores se dibujan centrados sobre la ruta', () => {
    const enemy = new Enemy({ id: 'flyer', name: 'Centinela Nova', hp: 100, speed: 0, flying: true }, [
        { x: 0, y: 40 },
        { x: 160, y: 40 }
    ]);
    enemy.x = 75;
    enemy.distanceTravelled = 75;
    const calls = [];
    const ctx = {
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        translate: (x, y) => calls.push(['translate', x, y]),
        beginPath: () => calls.push(['beginPath']),
        arc: (x, y, radius) => calls.push(['arc', x, y, radius]),
        ellipse: (x, y, radiusX, radiusY) => calls.push(['ellipse', x, y, radiusX, radiusY]),
        fill: () => calls.push(['fill']),
        stroke: () => calls.push(['stroke']),
        fillRect: (x, y, width, height) => calls.push(['fillRect', x, y, width, height]),
        fillText: (text, x, y) => calls.push(['fillText', text, x, y]),
        set fillStyle(value) { calls.push(['fillStyle', value]); },
        set strokeStyle(value) { calls.push(['strokeStyle', value]); },
        set lineWidth(value) { calls.push(['lineWidth', value]); },
        set font(value) { calls.push(['font', value]); },
        set textAlign(value) { calls.push(['textAlign', value]); },
        set textBaseline(value) { calls.push(['textBaseline', value]); },
        set globalAlpha(value) { calls.push(['globalAlpha', value]); }
    };

    enemy.render(ctx);

    assert.equal(calls.some((call) => call[0] === 'translate'), false);
    assert.ok(calls.some((call) => call[0] === 'arc' && call[1] === 75 && call[2] === 40 && call[3] === 15));
});

test('Enemy dibuja la barra de vida por encima del sprite visual completo', () => {
    const enemy = new Enemy({
        id: 'aim_scientist',
        hp: 100,
        speed: 0,
        visual: {
            size: 96,
            anchor: { x: 0.5, y: 0.5 },
            idle: { south: 'aim.png' }
        }
    }, [{ x: 0, y: 0 }]);
    enemy.x = 120;
    enemy.y = 140;
    const fillRects = [];
    const ctx = {
        fillRect: (...args) => fillRects.push(args),
        set fillStyle(value) {}
    };

    enemy.renderHealthBar(ctx);

    assert.equal(fillRects[0][1], 83);
    assert.ok(fillRects[0][1] < enemy.y - enemy.size / 2);
});

test('Enemy dibuja la barra de vida como overlay final', () => {
    const enemy = new Enemy({
        id: 'boss',
        name: 'Ultron',
        hp: 100,
        speed: 0,
        isBoss: true,
        phases: [{ threshold: 0.8, name: 'Pulso', telegraph: 1 }]
    }, [{ x: 0, y: 0 }]);
    enemy.x = 80;
    enemy.y = 80;
    enemy.telegraph = { label: 'Pulso', duration: 0.5, maxDuration: 1 };
    const calls = [];
    const ctx = {
        save: () => calls.push('save'),
        restore: () => calls.push('restore'),
        beginPath: () => calls.push('beginPath'),
        arc: () => calls.push('arc'),
        fill: () => calls.push('fill'),
        stroke: () => calls.push('stroke'),
        fillRect: () => calls.push('fillRect'),
        fillText: () => calls.push('fillText'),
        setLineDash: () => calls.push('setLineDash'),
        set fillStyle(value) {},
        set strokeStyle(value) {},
        set lineWidth(value) {},
        set font(value) {},
        set textAlign(value) {},
        set textBaseline(value) {}
    };

    enemy.render(ctx);

    assert.ok(calls.lastIndexOf('fillRect') > calls.lastIndexOf('stroke'));
});

test('Enemy atribuye una baja por quemadura a su fuente', () => {
    const enemy = new Enemy({ id: 'test', hp: 5, speed: 50 }, [{ x: 0, y: 0 }]);
    const stats = { damage: 0, kills: 0 };
    const source = {
        recordDamage: (amount) => { stats.damage += amount; },
        recordKill: () => { stats.kills++; },
        game: { resourceManager: null }
    };

    enemy.applyStatus({ type: 'burn', duration: 1, power: 10 }, source);
    enemy.updateDebuffs(0.5);

    assert.equal(enemy.isAlive, false);
    assert.equal(stats.damage, 5);
    assert.equal(stats.kills, 1);
});

test('Enemy aplica veneno acumulable como dano porcentual', () => {
    const enemy = new Enemy({ id: 'test', hp: 1000, speed: 50 }, [{ x: 0, y: 0 }]);
    const source = { recordDamage: () => {}, recordKill: () => {} };

    enemy.applyStatus({ type: 'poison', duration: 2, power: 0.01 }, source);
    enemy.applyStatus({ type: 'poison', duration: 2, power: 0.01 }, source);
    enemy.updateDebuffs(0.5);

    assert.equal(enemy.hp, 990);
    assert.equal(enemy.debuffs.find((status) => status.type === 'poison').stacks, 2);
});

test('Enemy aplica maldicion como dano porcentual persistente', () => {
    const enemy = new Enemy({ id: 'test', hp: 1000, speed: 50 }, [{ x: 0, y: 0 }]);
    const source = { recordDamage: () => {}, recordKill: () => {} };

    enemy.applyStatus({ type: 'curse', duration: 2, power: 0.01 }, source);
    enemy.updateDebuffs(0.5);

    assert.equal(enemy.hp, 995);
});

test('Enemy registra contribucion tactica al aplicar estados', () => {
    const enemy = new Enemy({ id: 'stealth', hp: 100, speed: 50, stealth: true }, [{ x: 0, y: 0 }]);
    const applied = [];
    const source = {
        recordStatusApplied: (effect, target) => applied.push({ effect, target })
    };

    enemy.applyStatus({ type: 'slow', duration: 2.4, power: 0.3 }, source);
    enemy.applyStatus({ type: 'armorBreak', duration: 3, power: 0.2 }, source);
    enemy.applyStatus({ type: 'mark', duration: 2, power: 0.12 }, source);

    assert.equal(applied.length, 3);
    assert.deepEqual(applied.map((entry) => entry.effect.type), ['slow', 'armorBreak', 'mark']);
    assert.equal(applied[0].target, enemy);
});

test('buildEnemyStatusPips fusiona estados repetidos y conserva stacks', () => {
    const state = buildEnemyStatusPips([
        { type: 'slow', duration: 1.2, power: 0.2 },
        { type: 'slow', duration: 2.6, power: 0.4 },
        { type: 'mark', duration: 1, power: 0.12, stacks: 2 }
    ]);

    assert.equal(state.total, 2);
    assert.equal(state.visible[0].type, 'slow');
    assert.equal(state.visible[0].durationLabel, '3s');
    assert.equal(state.visible[0].stackLabel, 'x2');
    assert.equal(state.visible[1].type, 'mark');
    assert.equal(state.visible[1].stackLabel, 'x2');
});

test('buildEnemyStatusPips prioriza control y limita overflow visual', () => {
    const state = buildEnemyStatusPips([
        { type: 'mark', duration: 5 },
        { type: 'burn', duration: 2 },
        { type: 'armorBreak', duration: 4 },
        { type: 'stun', duration: 0.5 },
        { type: 'web', duration: 3 },
        { type: 'haste', duration: 3 }
    ], 4);

    assert.deepEqual(state.visible.map((status) => status.type), ['stun', 'web', 'burn', 'armorBreak']);
    assert.equal(state.overflow, 2);
});

test('Enemy compacta pips de estado hasta hover, seleccion o boss', () => {
    const game = { selectedUnit: null, hoveredEnemy: null, hoveredEnemyUid: null };
    const enemy = new Enemy({ id: 'status', hp: 100, speed: 0 }, [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
    ], game);
    enemy.x = 50;
    enemy.y = 0;
    enemy.applyStatus({ type: 'slow', duration: 2, power: 0.3 });
    enemy.applyStatus({ type: 'burn', duration: 2, power: 4 });

    const compactCtx = createStatusContextSpy();
    enemy.renderDebuffPips(compactCtx);

    assert.equal(shouldRenderEnemyStatusDetails(enemy), false);
    assert.equal(compactCtx.calls.filter((call) => call[0] === 'fillText').length, 0);
    assert.ok(compactCtx.calls.some((call) => call[0] === 'arc'));

    game.hoveredEnemy = enemy;
    const detailedCtx = createStatusContextSpy();
    enemy.renderDebuffPips(detailedCtx);

    assert.equal(shouldRenderEnemyStatusDetails(enemy), true);
    assert.ok(detailedCtx.calls.some((call) => call[0] === 'fillText' && call[1] === '~'));
    assert.ok(detailedCtx.calls.some((call) => call[0] === 'fillText' && call[1] === 'F'));
});

test('Enemy combina marca, ruptura y penetracion de armadura', () => {
    const enemy = new Enemy({ id: 'test', hp: 100, speed: 50, armor: 0.5 }, [{ x: 0, y: 0 }]);
    enemy.applyStatus({ type: 'armorBreak', duration: 2, power: 0.2 });
    enemy.applyStatus({ type: 'mark', duration: 2, power: 0.25 });

    const result = enemy.takeDamage(20 * enemy.getDamageTakenMultiplier(), { armorPenetration: 0.5 });
    assert.equal(result.damage, 21.25);
});

test('Enemy consume la barrera antes de perder salud', () => {
    const enemy = new Enemy({ id: 'shield', hp: 100, speed: 50, barrierRatio: 0.2 }, [{ x: 0, y: 0 }]);

    enemy.takeDamage(10);
    assert.equal(enemy.hp, 100);
    assert.equal(enemy.behavior.barrier, 10);

    enemy.takeDamage(20);
    assert.equal(enemy.hp, 90);
    assert.equal(enemy.behavior.barrier, 0);
});

test('Enemy aplica resistencias por categoria de atacante', () => {
    const enemy = new Enemy({
        id: 'resistant', hp: 100, speed: 50, resistances: { Tecnológico: 0.25 }
    }, [{ x: 0, y: 0 }]);

    enemy.takeDamage(20, { attackerType: 'Tecnológico' });
    assert.equal(enemy.hp, 85);
});

test('Soporte cura aliados cercanos sin superar su salud maxima', () => {
    const game = createEnemyGame();
    const support = new Enemy({
        id: 'support', hp: 100, speed: 1, archetype: 'support', healPower: 0.1, behaviorCooldown: 0.1
    }, game.path, game);
    const ally = new Enemy({ id: 'ally', hp: 100, speed: 1 }, game.path, game);
    ally.hp = 50;
    game.enemies = [support, ally];

    support.update(0.2);
    assert.equal(ally.hp, 60);
});

test('Invocador crea refuerzos sobre su misma ruta', () => {
    const game = createEnemyGame();
    let summon = null;
    game.enemyDatabase = { normal: { drone: { id: 'drone', hp: 20, speed: 20 } } };
    game.spawnEnemy = (config, source) => { summon = { config, source }; };
    const summoner = new Enemy({
        id: 'summoner', hp: 100, speed: 1, archetype: 'summoner', summonId: 'drone', summonLimit: 1, behaviorCooldown: 0.1
    }, game.path, game);

    summoner.update(0.2);
    assert.equal(summon.config.id, 'drone');
    assert.equal(summon.source, summoner);
});

test('Comandante Kree acelera aliados cercanos', () => {
    const game = createEnemyGame();
    const commander = new Enemy({ id: 'commander', hp: 100, speed: 1, archetype: 'commander', behaviorCooldown: 0.1, commandPower: 0.25 }, game.path, game);
    const ally = new Enemy({ id: 'ally', hp: 100, speed: 40 }, game.path, game);
    game.enemies = [commander, ally];

    commander.update(0.2);
    ally.updateDebuffs(0.1);
    assert.ok(ally.debuffs.some((effect) => effect.type === 'haste'));
    assert.equal(ally.speed, 50);
});

test('Faseador Chitauri entra en sigilo sin salir de la ruta', () => {
    const game = createEnemyGame();
    const phaser = new Enemy({ id: 'phaser', hp: 100, speed: 40, archetype: 'phaser', behaviorCooldown: 0.1 }, game.path, game);
    phaser.x = 40;
    phaser.distanceTravelled = 40;

    phaser.update(0.2);
    assert.equal(phaser.stealth, true);
    assert.equal(phaser.y, 0);
    assert.ok(phaser.x > 40);
});

test('Jefe anuncia y activa una fase por umbral de salud', () => {
    const game = createEnemyGame();
    const boss = new Enemy({
        id: 'boss', hp: 100, speed: 1, isBoss: true, archetype: 'boss',
        phases: [{ threshold: 0.8, name: 'Fase de prueba', telegraph: 0.2, barrier: 0.2 }]
    }, game.path, game);
    boss.takeDamage(30);

    boss.update(0.1);
    assert.equal(boss.telegraph.label, 'Fase de prueba');
    boss.update(0.2);
    assert.equal(boss.currentPhase, 'Fase de prueba');
    assert.equal(boss.behavior.barrier, 20);
});

test('Jefes tienen silueta ampliada y telegraph tematico', () => {
    const boss = new Enemy({ id: 'ultron', hp: 100, speed: 1, isBoss: true, category: 'Tecnológico' }, [{ x: 0, y: 0 }]);
    const finalBoss = new Enemy({ id: 'thanos', hp: 100, speed: 1, isBoss: true, isFinalBoss: true, category: 'Cósmico' }, [{ x: 0, y: 0 }]);
    const theme = buildBossTelegraphTheme(boss, { name: 'Protocolo' });

    assert.equal(boss.size, 54);
    assert.equal(finalBoss.size, 62);
    assert.equal(theme.color, '#40c9ff');
    assert.equal(theme.label, 'PROTOCOLO');
    assert.deepEqual(theme.dash, [12, 7]);
});

test('Thanos activa guantelete y aturde heroes al cincuenta por ciento', () => {
    const game = createEnemyGame();
    const heroes = [{ stunTimer: 0, applyStun(duration) { this.stunTimer = duration; } }, { stunTimer: 0, applyStun(duration) { this.stunTimer = duration; } }];
    game.heroes = heroes;
    const boss = new Enemy({
        id: 'thanos_final',
        name: 'Thanos',
        hp: 100,
        speed: 1,
        isBoss: true,
        isFinalBoss: true,
        archetype: 'boss',
        phases: [{ threshold: 0.5, name: 'Guantelete del Infinito', telegraph: 0.1, stunHeroes: true, stunDuration: 4 }]
    }, game.path, game);
    boss.playPhaseAnimation = () => { boss.phaseAnimationPlayed = true; };

    boss.takeDamage(50);
    boss.update(0.05);
    assert.equal(boss.telegraph.label, 'Guantelete del Infinito');
    boss.update(0.1);

    assert.equal(boss.currentPhase, 'Guantelete del Infinito');
    assert.equal(boss.phaseAnimationPlayed, true);
    assert.deepEqual(heroes.map((hero) => hero.stunTimer), [4, 4]);
});

test('Refuerzo aparece detras del invocador y permanece sobre un giro', () => {
    const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const source = new Enemy({ id: 'source', hp: 100, speed: 1 }, path);
    const reinforcement = new Enemy({ id: 'reinforcement', hp: 20, speed: 1 }, path);
    source.moveForward(150);

    reinforcement.copyPathPosition(source, 30);
    assert.equal(reinforcement.pathIndex, 1);
    assert.equal(reinforcement.x, 100);
    assert.equal(reinforcement.y, 20);
    assert.equal(reinforcement.distanceTravelled, 120);
});

function createStatusContextSpy() {
    const calls = [];
    return {
        calls,
        save: () => calls.push(['save']),
        restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['beginPath']),
        arc: (...args) => calls.push(['arc', ...args]),
        fill: () => calls.push(['fill']),
        stroke: () => calls.push(['stroke']),
        fillText: (...args) => calls.push(['fillText', ...args]),
        set fillStyle(value) { calls.push(['fillStyle', value]); },
        set strokeStyle(value) { calls.push(['strokeStyle', value]); },
        set lineWidth(value) { calls.push(['lineWidth', value]); },
        set font(value) { calls.push(['font', value]); },
        set textAlign(value) { calls.push(['textAlign', value]); },
        set textBaseline(value) { calls.push(['textBaseline', value]); }
    };
}
function createEnemyGame() {
    return {
        path: [{ x: 0, y: 0 }, { x: 500, y: 0 }],
        enemies: [],
        vfx: { addRing: () => {}, addBurst: () => {} },
        audio: { play: () => {} },
        uiManager: { showToast: () => {} }
    };
}
