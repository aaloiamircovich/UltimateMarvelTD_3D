import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WaveManager, getFinalBossHealthCurve, getLevelHealthFactor, getWaveHealthCurve } from '../src/systems/WaveManager.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';
import { TypeChart } from '../data/TypeChart.js';

const enemies = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));
const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

test('WaveManager prepara una primera oleada valida', () => {
    const manager = new WaveManager(createGame(), enemies);
    assert.equal(manager.currentWave, 1);
    assert.equal(manager.preparedQueue.length, 7);
    assert.equal(manager.waveModifier.id, 'opening-1');
    assert.equal(manager.waveModifier.label, 'Reconocimiento Hydra');
    assert.ok(manager.getUniqueEnemies().every((enemy) => enemy.previewCount > 0));
});

test('apertura dirigida no fuerza sigilo sin deteccion disponible', () => {
    const manager = new WaveManager(createGame('new-york', [{ id: 'iron_man', teamMetrics: { detection: 1 }, canSeeStealth: false }]), enemies);
    manager.currentWave = 5;
    manager.prepareNextWave();
    const ids = new Set(manager.preparedQueue.map((entry) => entry.config.id));

    assert.equal(manager.waveModifier.id, 'opening-5');
    assert.equal(ids.has('hand_ninja'), false);
    assert.equal(ids.has('chitauri_warrior'), true);
    assert.ok(ids.has('hydra_soldier'));
    assert.equal(manager.getWaveSummary().counter, 'Mejora un heroe antes del elite');
});

test('WaveManager reserva jefes para oleadas 25, 50, 75 y 100', () => {
    const manager = new WaveManager(createGame(), enemies);
    manager.currentWave = 10;
    manager.prepareNextWave();

    assert.notEqual(manager.preparedQueue.length, 1);
    assert.equal(manager.preparedQueue.some((entry) => entry.config.isBoss), false);

    manager.currentWave = 25;
    manager.prepareNextWave();

    assert.equal(manager.preparedQueue.length, 1);
    assert.equal(manager.preparedQueue[0].config.isBoss, true);
    assert.equal(manager.preparedQueue[0].config.id, 'loki');
});

test('WaveManager expone briefing de milestone solo en oleadas de boss', () => {
    const manager = new WaveManager(createGame('avengers'), enemies);
    manager.currentWave = 24;
    manager.prepareNextWave();

    assert.equal(manager.buildPreparedSummary().bossMilestone, null);

    manager.currentWave = 25;
    manager.prepareNextWave();
    const mini = manager.buildPreparedSummary().bossMilestone;

    assert.equal(mini.label, 'Mini boss 1/3');
    assert.equal(mini.bossName, 'Ultrón Prime');
    assert.equal(mini.isFinalBoss, false);
    assert.match(mini.warning, /pierdes/);

    manager.currentWave = 100;
    manager.prepareNextWave();
    const finalBoss = manager.buildPreparedSummary().bossMilestone;

    assert.equal(finalBoss.label, 'Final boss');
    assert.equal(finalBoss.isFinalBoss, true);
    assert.equal(finalBoss.bossName, 'Thanos (Guantelete)');
});

test('WaveManager mantiene a Ultron como primer mini boss vencible en Base Avengers', () => {
    const game = createGame('avengers');
    game.currentLevel = { id: 'level_1', theme: { id: 'avengers' }, difficulty: 'Fácil' };
    game.levelsData = [{ id: 'level_1' }];
    const manager = new WaveManager(game, enemies);
    manager.currentWave = 25;
    manager.prepareNextWave();

    const boss = manager.preparedQueue[0].config;
    assert.equal(boss.id, 'ultron_prime');
    assert.equal(boss.isBoss, true);
    assert.ok(boss.hp >= 14500);
    assert.ok(boss.hp <= 16000);
    assert.ok(boss.armor <= 0.34);
    assert.equal(boss.immuneToStun, false);
    assert.equal(manager.getWaveSummary().counter, 'Penetracion, control y dano sostenido');
});

test('primer mini boss de Base Avengers pide varios intentos pero no bloquea el progreso', () => {
    const game = createGame('avengers');
    game.currentLevel = { id: 'level_1', theme: { id: 'avengers' }, difficulty: 'Fácil' };
    game.levelsData = [{ id: 'level_1' }];
    const manager = new WaveManager(game, enemies);
    manager.currentWave = 25;
    manager.prepareNextWave();

    const boss = manager.preparedQueue[0].config;
    const firstAttempt = estimateBossDamage([
        ['cyclops', 30],
        ['black_widow', 15],
        ['hawkeye', 15],
        ['groot', 15],
        ['korg', 15],
        ['ms_marvel', 15]
    ], boss);
    const fourthAttempt = estimateBossDamage([
        ['cyclops', 34],
        ['black_widow', 20],
        ['hawkeye', 20],
        ['groot', 20],
        ['korg', 20],
        ['ms_marvel', 20]
    ], boss);

    assert.ok(firstAttempt < boss.hp * 0.95);
    assert.ok(fourthAttempt > boss.hp * 1.08);
});

test('WaveManager conserva la marca de jefe final en la ultima oleada', () => {
    const manager = new WaveManager(createGame(), enemies);
    assert.equal(manager.maxWaves, 100);
    manager.currentWave = manager.maxWaves;
    manager.prepareNextWave();

    assert.equal(manager.preparedQueue.length, 1);
    assert.equal(manager.preparedQueue[0].config.id, 'thanos_final');
    assert.equal(manager.preparedQueue[0].config.isBoss, true);
    assert.equal(manager.preparedQueue[0].config.isFinalBoss, true);
});

test('WaveManager usa la faccion correspondiente al mapa', () => {
    const game = createGame('avengers');
    const manager = new WaveManager(game, enemies);
    const ids = new Set(manager.preparedQueue.map((entry) => entry.config.id));

    assert.equal(manager.faction.label, 'Legión de Ultrón');
    assert.deepEqual(ids, new Set(['doombot', 'ultron_drone']));
});

test('Knowhere incorpora Kree, Chitauri y Orden Negra por progresión', () => {
    const manager = new WaveManager(createGame('knowhere'), enemies);
    manager.currentWave = 25;
    manager.prepareNextWave();
    const pool = new Set(manager.getEnemyPoolForWave().map((enemy) => enemy.id));

    assert.equal(manager.faction.label, 'Kree / Chitauri / Orden Negra');
    assert.ok(pool.has('kree_commander'));
    assert.ok(pool.has('chitauri_phaser'));
    assert.ok(pool.has('black_order_magus'));
});

test('WaveManager aplica modificadores sin depender solo de salud', () => {
    const manager = new WaveManager(createGame(), enemies);
    manager.currentWave = 8;
    manager.prepareNextWave();

    assert.equal(manager.waveModifier.id, 'rush');
    assert.ok(manager.preparedQueue.every((entry) => entry.config.speed > enemies.normal[entry.config.id].speed));
});

test('curva de salud escala suave, exponencial y extrema por oleada', () => {
    const wave1 = getWaveHealthCurve(1);
    const wave30 = getWaveHealthCurve(30);
    const wave60 = getWaveHealthCurve(60);
    const wave100 = getWaveHealthCurve(100);
    const boss100 = getWaveHealthCurve(100, true);
    const final100 = getFinalBossHealthCurve(100);
    assert.ok(wave30 > wave1 * 2);
    assert.ok(wave60 > wave30 * 3);
    assert.ok(wave100 > wave60 * 10);
    assert.ok(boss100 > wave100 * 1.7);
    assert.ok(final100 < wave100);
    assert.ok(final100 > wave30 * 3.5);
});

test('jefe final queda por encima del ultimo mini boss sin salto desmedido', () => {
    const game = createGame('avengers');
    game.currentLevel = { id: 'level_1', theme: { id: 'avengers' }, difficulty: 'Fácil' };
    game.levelsData = [{ id: 'level_1' }];
    const manager = new WaveManager(game, enemies);

    manager.currentWave = 75;
    manager.prepareNextWave();
    const lateMiniBossHp = manager.preparedQueue[0].config.hp;

    manager.currentWave = 100;
    manager.prepareNextWave();
    const finalBoss = manager.preparedQueue[0].config;

    assert.equal(finalBoss.id, 'thanos_final');
    assert.equal(finalBoss.isFinalBoss, true);
    assert.ok(finalBoss.hp > lateMiniBossHp * 1.8);
    assert.ok(finalBoss.hp < lateMiniBossHp * 2.4);
});

test('factor de salud sube con dificultad fija y posicion del mapa', () => {
    const manhattan = getLevelHealthFactor({ id: 'level_1', difficulty: 'Fácil' }, 0);
    const avengers = getLevelHealthFactor({ id: 'level_2', difficulty: 'Normal' }, 1);
    const extreme = getLevelHealthFactor({ id: 'level_8', difficulty: 'Extrema' }, 7);

    assert.ok(avengers > manhattan);
    assert.ok(extreme > avengers);
});

test('WaveManager prepara barreras globales en la oleada protegida', () => {
    const manager = new WaveManager(createGame(), enemies);
    manager.currentWave = 9;
    manager.prepareNextWave();

    assert.equal(manager.waveModifier.id, 'shielded');
    assert.ok(manager.preparedQueue.every((entry) => entry.config.barrierRatio >= 0.16));
});

test('WaveManager resume cantidad, botin y counter de la cola preparada', () => {
    const manager = new WaveManager(createGame(), enemies);
    const summary = manager.getWaveSummary();

    assert.equal(summary.total, manager.preparedQueue.length);
    assert.ok(summary.reward > 110);
    assert.ok(summary.fastest > 0);
    assert.ok(summary.maxThreat >= 1);
    assert.equal(typeof summary.counter, 'string');
    assert.equal(summary.pressureScore, 14);
    assert.equal(summary.threatTier.id, 'guarded');
    assert.equal(summary.readiness.id, 'empty');
    assert.equal(summary.totalHp > 0, true);
    assert.equal(summary.effectiveHp >= summary.totalHp, true);
    assert.equal(summary.readiness.damageCheck.tone, 'danger');
});

test('WaveManager expone cadencia compacta enemiga', () => {
    const manager = new WaveManager(createGame(), enemies);
    const timeline = manager.getSpawnTimeline();

    assert.equal(timeline.totalEnemies, manager.preparedQueue.length);
    assert.equal(timeline.entries.length, 2);
    assert.equal(timeline.entries[0].name, 'Soldado de Hydra');
    assert.equal(timeline.entries[0].count, 4);
    assert.equal(timeline.entries[0].etaLabel, '0.2-3.3s');
    assert.equal(timeline.entries[1].count, 3);
    assert.equal(timeline.overflow, 0);
});

test('WaveManager ya no anticipa bonus perfecto en el resumen preparado', () => {
    const manager = new WaveManager(createGame(), enemies);
    const summary = manager.buildPreparedSummary();

    assert.equal('perfectBonus' in summary, false);
    assert.equal(typeof manager.getPerfectWaveBonus, 'undefined');
});

test('WaveManager eleva la lectura de amenaza cuando hay barreras y sigilo', () => {
    const manager = new WaveManager(createGame('sanctum'), enemies);
    manager.currentWave = 9;
    manager.prepareNextWave();
    const summary = manager.getWaveSummary();

    assert.equal(manager.waveModifier.id, 'shielded');
    assert.equal(summary.barrierCount, manager.preparedQueue.length);
    assert.ok(summary.stealthCount > 0);
    assert.equal(summary.threatTier.id, 'critical');
});

test('WaveManager evalua preparacion con heroes desplegados y creditos', () => {
    const game = createGame('new-york', [], [
        deployedHero({ id: 'iron_man', damage: 58, fireRate: 1.4, range: 180, level: 2 }),
        deployedHero({ id: 'spiderman', damage: 34, fireRate: 1.8, range: 160, canSeeStealth: true })
    ]);
    game.resourceManager.credits = 360;
    const manager = new WaveManager(game, enemies);
    const summary = manager.getWaveSummary();

    assert.ok(summary.readiness.score > summary.pressureScore);
    assert.equal(summary.readiness.id, 'ready');
    assert.ok(summary.readiness.margin > 0);
    assert.ok(summary.readiness.damageCheck.expectedDamage > summary.readiness.damageCheck.requiredDamage);
    assert.match(summary.readiness.damageCheck.detail, /HP estimado/);
    assert.deepEqual(summary.readiness.damageCheck.contributors.map((entry) => entry.name), ['iron_man', 'spiderman']);
    assert.equal(summary.readiness.damageCheck.contributors.reduce((total, entry) => total + entry.share, 0), 100);
});

test('WaveManager no cuenta soportes de aura pura como DPS esperado', () => {
    const game = createGame('new-york', [], [
        deployedHero({
            id: 'capitan_america',
            name: 'Capitán América',
            damage: 1,
            fireRate: 0,
            range: 255,
            special: { supportAura: { type: 'damage', power: 0.12, range: 255 } }
        }),
        deployedHero({ id: 'iron_man', damage: 58, fireRate: 1.4, range: 180 })
    ]);
    const manager = new WaveManager(game, enemies);
    const check = manager.getDamageCheckForSummary(game.heroes, { effectiveHp: 1600, totalHp: 1600 });

    assert.equal(check.requiredDamage, 1600);
    assert.ok(check.expectedDamage > 0);
    assert.deepEqual(check.contributors.map((entry) => entry.name), ['iron_man']);
    assert.equal(check.contributors.reduce((total, entry) => total + entry.share, 0), 100);
});

test('WaveManager reduce DPS esperado sin deteccion contra sigilo', () => {
    const striker = deployedHero({ id: 'hulk', name: 'Hulk', damage: 100, fireRate: 1, range: 170 });
    const detector = deployedHero({ id: 'black_widow', name: 'Black Widow', damage: 30, fireRate: 2, range: 150, canSeeStealth: true });
    const manager = new WaveManager(createGame('new-york', [], [striker]), enemies);

    const blocked = manager.getDamageCheckForSummary([striker], {
        total: 4,
        stealthCount: 4,
        roles: ['stealth'],
        effectiveHp: 1200,
        totalHp: 1200
    });
    const mixed = manager.getDamageCheckForSummary([striker], {
        total: 4,
        stealthCount: 2,
        roles: ['stealth'],
        effectiveHp: 1200,
        totalHp: 1200
    });
    const covered = manager.getDamageCheckForSummary([striker, detector], {
        total: 4,
        stealthCount: 4,
        roles: ['stealth'],
        effectiveHp: 1200,
        totalHp: 1200
    });

    assert.equal(blocked.expectedDamage, 0);
    assert.equal(blocked.contributors.length, 0);
    assert.match(blocked.detail, /DPS sin deteccion reducido/);
    assert.ok(mixed.expectedDamage > 0);
    assert.ok(mixed.expectedDamage < covered.expectedDamage);
    assert.deepEqual(covered.contributors.map((entry) => entry.name), ['Black Widow']);
    assert.doesNotMatch(covered.detail, /DPS sin deteccion reducido/);
});

test('WaveManager refresca el radar tactico al cambiar heroes desplegados', () => {
    const rendered = [];
    const game = createGame();
    game.uiManager = {
        renderWavePreview: (...args) => rendered.push(args.at(-1)),
        setNextWaveEnabled: (_enabled, summary) => rendered.push(summary)
    };
    const manager = new WaveManager(game, enemies);
    assert.equal(manager.getWaveSummary().readiness.id, 'empty');

    game.heroes.push(deployedHero({ id: 'iron_man', damage: 58, fireRate: 1.4, range: 180, level: 2 }));
    game.resourceManager.credits = 240;
    const refreshed = manager.refreshWaveIntel();

    assert.notEqual(refreshed.readiness.id, 'empty');
    assert.equal(rendered.at(-1).readiness.id, refreshed.readiness.id);
});

test('WaveManager incluye cadencia enemiga en el resumen preparado', () => {
    const manager = new WaveManager(createGame(), enemies);
    const summary = manager.buildPreparedSummary();

    assert.equal(summary.spawnTimeline.totalEnemies, manager.preparedQueue.length);
    assert.ok(summary.spawnTimeline.entries[0].etaLabel.includes('s'));
});

test('WaveManager limpia presion de combate al cerrar oleada', () => {
    const pressureCalls = [];
    const game = createGame();
    game.uiManager = {
        renderWavePreview: () => {},
        setNextWaveEnabled: () => {},
        showToast: () => {},
        updateCombatPressure: (...args) => pressureCalls.push(args)
    };
    const manager = new WaveManager(game, enemies);
    manager.isWaveActive = true;
    manager.finishWave();

    assert.deepEqual(pressureCalls[0], [[], game.path, false]);
});

test('WaveManager emite informe tactico con deltas de la oleada', () => {
    const reports = [];
    const cleared = [];
    const game = createGame('new-york', [], [
        deployedHero({ id: 'iron_man', name: 'Iron Man', damage: 58, fireRate: 1.4, range: 180, level: 2 })
    ]);
    game.resourceManager.credits = 300;
    game.resourceManager.lives = 20;
    game.uiManager = {
        renderWavePreview: () => {},
        setNextWaveEnabled: () => {},
        clearWaveReport: () => cleared.push(true),
        renderWaveReport: (report) => reports.push(report),
        updateCombatPressure: () => {},
        showToast: () => {}
    };
    const manager = new WaveManager(game, enemies);

    manager.startNextWave();
    game.heroes[0].combatStats.damageDealt += 640;
    game.heroes[0].combatStats.kills += 5;
    game.heroes[0].combatStats.controlSeconds = 3;
    game.heroes[0].combatStats.armorBreaks = 2;
    game.resourceManager.lives = 18;
    manager.enemiesQueue = [];
    manager.finishWave();

    assert.equal(cleared.length, 1);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].wave, 1);
    assert.equal(reports[0].leaks, 2);
    assert.equal(reports[0].kills, 5);
    assert.equal(reports[0].bestHero, 'Iron Man');
    assert.equal(reports[0].bestHeroId, 'iron_man');
    assert.equal(reports[0].tactical.controlSeconds, 3);
    assert.equal(reports[0].tactical.armorBreaks, 2);
    assert.equal(reports[0].tactical.mvp, 'Iron Man');
    assert.ok(reports[0].tactical.score > 0);
    assert.ok(reports[0].credits >= 188);
});

test('WaveManager registra dano a base con counter y progreso de ruta', () => {
    const reports = [];
    const game = createGame('new-york', [], [
        deployedHero({ id: 'iron_man', name: 'Iron Man', damage: 58, fireRate: 1.4, range: 180, level: 2 })
    ]);
    game.resourceManager.credits = 300;
    game.resourceManager.lives = 20;
    game.uiManager = {
        renderWavePreview: () => {},
        setNextWaveEnabled: () => {},
        clearWaveReport: () => {},
        renderWaveReport: (report) => reports.push(report),
        updateCombatPressure: () => {},
        showToast: () => {}
    };
    const manager = new WaveManager(game, enemies);

    manager.startNextWave();
    manager.recordLeak({
        id: 'hand_ninja',
        name: 'Ninja de La Mano',
        archetype: 'stealth',
        stealth: true,
        speed: 92,
        distanceTravelled: 36
    }, { lifeLoss: 1 });
    game.resourceManager.lives = 19;
    manager.enemiesQueue = [];
    manager.finishWave();

    assert.equal(reports[0].baseDamageEvents.length, 1);
    assert.equal(reports[0].baseDamageEvents[0].counter, 'Deteccion');
    assert.equal(reports[0].baseDamageEvents[0].segmentPct, 90);
    assert.deepEqual(reports[0].baseDamageEvents[0].traits, ['Sigilo', 'Rapido']);
    assert.equal(reports[0].leakEvents.length, 1);
});

test('WaveManager paga solo recompensa base al cerrar una oleada sin danos', () => {
    const reports = [];
    const game = createGame('new-york', [], [
        deployedHero({ id: 'iron_man', name: 'Iron Man', damage: 58, fireRate: 1.4, range: 180, level: 2 })
    ]);
    game.resourceManager.credits = 300;
    game.resourceManager.lives = 20;
    game.uiManager = {
        renderWavePreview: () => {},
        setNextWaveEnabled: () => {},
        clearWaveReport: () => {},
        renderWaveReport: (report) => reports.push(report),
        updateCombatPressure: () => {},
        showToast: () => {}
    };
    const manager = new WaveManager(game, enemies);

    manager.startNextWave();
    game.heroes[0].combatStats.damageDealt += 900;
    game.heroes[0].combatStats.kills += 7;
    manager.enemiesQueue = [];
    manager.finishWave();

    assert.equal('cleanBonus' in reports[0], false);
    assert.equal(game.resourceManager.credits, 300 + 188);
});

test('WaveManager no altera la recompensa base cuando hubo dano a base', () => {
    const reports = [];
    const game = createGame('new-york', [], [
        deployedHero({ id: 'iron_man', name: 'Iron Man', damage: 58, fireRate: 1.4, range: 180, level: 2 })
    ]);
    game.resourceManager.credits = 300;
    game.resourceManager.lives = 20;
    game.uiManager = {
        renderWavePreview: () => {},
        setNextWaveEnabled: () => {},
        clearWaveReport: () => {},
        renderWaveReport: (report) => reports.push(report),
        updateCombatPressure: () => {},
        showToast: () => {}
    };
    const manager = new WaveManager(game, enemies);

    manager.startNextWave();
    game.resourceManager.lives = 19;
    manager.enemiesQueue = [];
    manager.finishWave();

    assert.equal('cleanBonus' in reports[0], false);
    assert.equal(game.resourceManager.credits, 300 + 188);
});

test('WaveManager anuncia jefes al entrar en ruta', () => {
    const calls = captureThreatCalls();
    const game = createGame();
    game.uiManager = calls.uiManager;
    game.audio = calls.audio;
    game.vfx = calls.vfx;
    game.spawnEnemy = (config) => ({ ...config, x: 24, y: 36 });
    const manager = new WaveManager(game, enemies);
    manager.currentWave = 25;
    manager.prepareNextWave();
    manager.startNextWave();
    manager.update(1);

    const threatToast = calls.toasts.find(([message]) => message.includes('Jefe en ruta'));
    assert.deepEqual(threatToast, ['Jefe en ruta: Loki', 'warning']);
    assert.ok(calls.audioEvents.includes('boss'));
    assert.equal(calls.rings[0][0], 24);
    assert.equal(calls.rings[0][2].radius, 86);
    assert.equal(calls.texts[0][2], 'JEFE');
});

test('WaveManager anuncia elites de amenaza alta', () => {
    const calls = captureThreatCalls();
    const game = createGame();
    game.uiManager = calls.uiManager;
    game.audio = calls.audio;
    game.vfx = calls.vfx;
    game.spawnEnemy = (config) => ({ ...config, x: 14, y: 18 });
    const manager = new WaveManager(game, enemies);
    manager.preparedQueue = [{ config: { id: 'sentinel', name: 'Centinela', hp: 400, speed: 1, reward: 30, threat: 5 }, delay: 0 }];
    manager.startNextWave();
    manager.update(1);

    const threatToast = calls.toasts.find(([message]) => message.includes('Elite en ruta'));
    assert.deepEqual(threatToast, ['Elite en ruta: Centinela', 'warning']);
    assert.ok(calls.audioEvents.includes('warning'));
    assert.equal(calls.rings[0][2].radius, 58);
    assert.equal(calls.texts[0][2], 'ELITE');
});

test('WaveManager no anuncia enemigos comunes', () => {
    const calls = captureThreatCalls();
    const game = createGame();
    game.uiManager = calls.uiManager;
    game.audio = calls.audio;
    game.vfx = calls.vfx;
    game.spawnEnemy = (config) => ({ ...config, x: 14, y: 18 });
    const manager = new WaveManager(game, enemies);
    manager.preparedQueue = [{ config: { id: 'hydra_soldier', name: 'Soldado Hydra', hp: 80, speed: 1, reward: 10, threat: 2 }, delay: 0 }];
    manager.startNextWave();
    manager.update(1);

    assert.equal(calls.toasts.some(([message]) => message.includes('en ruta')), false);
    assert.equal(calls.rings.length, 0);
    assert.equal(calls.texts.length, 0);
});

function createGame(theme = 'new-york', activeTeam = [], deployed = []) {
    const resourceManager = {
        credits: 0,
        lives: 20,
        addCredits(amount) {
            this.credits += amount;
        }
    };
    return {
        uiManager: null,
        heroes: deployed,
        activeTeam,
        enemies: [],
        completedWaves: [],
        stars: 0,
        path: [{ x: 0, y: 0 }, { x: 40, y: 0 }],
        currentLevel: { theme: { id: theme } },
        resourceManager,
        pause: () => {}
    };
}

function captureThreatCalls() {
    const toasts = [];
    const audioEvents = [];
    const rings = [];
    const texts = [];
    return {
        toasts,
        audioEvents,
        rings,
        texts,
        uiManager: {
            renderWavePreview: () => {},
            setNextWaveEnabled: () => {},
            clearWaveReport: () => {},
            showToast: (...args) => toasts.push(args)
        },
        audio: { play: (event) => audioEvents.push(event) },
        vfx: {
            addRing: (...args) => rings.push(args),
            addFloatingText: (...args) => texts.push(args)
        }
    };
}

function deployedHero({ id, name = id, damage, fireRate, range, level = 1, canSeeStealth = false, special = null }) {
    return {
        id,
        name,
        damage,
        fireRate,
        range,
        level,
        canSeeStealth,
        items: [],
        combatStats: { damageDealt: 0, kills: 0, shots: 0, crits: 0, goldGenerated: 0, abilityActivations: 0 },
        config: { id, level, special },
        special,
        getEffectiveStats: () => ({ damage, fireRate, range, canSeeStealth })
    };
}

function estimateBossDamage(teamPlan, boss, seconds = 24) {
    return teamPlan.reduce((total, [heroId, level]) => {
        const hero = heroes[heroId];
        if (!hero) return total;
        const damage = getHeroDamageAtLevel(hero.damage, level, hero.rarity);
        const fireRate = Number(hero.fireRate || 1);
        const critChance = Number(hero.critChance || 5) / 100;
        const critMultiplier = Number(hero.critMultiplier || 2);
        const critFactor = 1 + critChance * (critMultiplier - 1);
        const typeMultiplier = TypeChart[hero.category]?.[boss.category] || 1;
        const resistance = Number(boss.resistances?.[hero.category] || 0);
        const armor = Number(boss.armor || 0);
        return total + damage * fireRate * critFactor * typeMultiplier * (1 - resistance) * (1 - armor) * seconds;
    }, 0);
}

test('Manhattan usa amenazas urbanas coherentes con Hydra, A.I.M., Chitauri y Loki', () => {
    const manager = new WaveManager(createGame('new-york'), enemies);
    manager.currentWave = 24;
    manager.prepareNextWave();
    const allowed = new Set(['hydra_soldier', 'aim_scientist', 'chitauri_warrior', 'chitauri_skimmer', 'chitauri_phaser']);
    const pool = new Set(manager.getEnemyPoolForWave().map((enemy) => enemy.id));

    assert.deepEqual(pool, allowed);
    assert.deepEqual(manager.faction.bosses, ['loki']);
});
