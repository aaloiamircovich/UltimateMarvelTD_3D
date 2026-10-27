import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACHIEVEMENT_CATALOG, ProgressionManager, SAVE_KEY, SAVE_VERSION } from '../src/systems/ProgressionManager.js';
import { getHeroDamageAtLevel } from '../src/utils/HeroLevel.js';

const data = {
    heroes: JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8')),
    enemies: JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8')),
    items: JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8')),
    levels: JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'))
};

test('ProgressionManager migra un guardado antiguo', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
        credits: 700,
        heroes: ['iron_man'],
        team: ['iron_man'],
        items: ['reactor_arc'],
        settings: { tutorialHints: false, showFps: true }
    }));
    const manager = new ProgressionManager(storage);
    manager.initialize(createGame(), data);

    assert.equal(manager.state.version, SAVE_VERSION);
    assert.equal(manager.state.credits, 700);
    assert.deepEqual(manager.state.unlockedHeroIds, ['iron_man']);
    assert.deepEqual(manager.state.ownedItemIds, ['reactor_arc']);
    assert.equal(manager.state.settings.showFps, true);
    assert.equal('tutorialHints' in manager.state.settings, false);
});

test('objetos termicos ya equipados recargan las estadisticas del catalogo actual', () => {
    const storage = new MemoryStorage();
    const oldData = structuredClone(data);
    oldData.items.emisor_termico.effects = { burnChance: 0.18, burnDuration: 3, burnPower: 0.012 };
    const first = new ProgressionManager(storage);
    first.initialize(createGame(), oldData);
    first.startProfile('spiderman');
    first.addOwnedItem('emisor_termico');
    first.equipItem('spiderman', 'emisor_termico');
    const reopened = new ProgressionManager(storage);
    reopened.initialize(createGame(), data);
    const hero = { id: 'spiderman', items: [] };
    reopened.applyEquippedItem(hero);
    assert.equal(hero.items.length, 1);
    assert.equal(hero.items[0].effects.burnAttackDamagePct, 0.12);
    assert.equal(hero.items[0].effects.burnPower, undefined);
});

test('Migracion conserva un solo objeto equipado antiguo', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
        version: 4,
        heroes: ['iron_man'],
        team: ['iron_man'],
        equippedItems: { iron_man: 'lentes_edith' }
    }));
    const manager = new ProgressionManager(storage);
    manager.initialize(createGame(), data);

    assert.deepEqual(manager.state.equippedItems.iron_man, { artifact: 'lentes_edith' });
});

test('ProgressionManager conserva heroes, creditos y equipo al reabrir', () => {
    const storage = new MemoryStorage();
    const first = new ProgressionManager(storage);
    first.initialize(createGame(), data);
    first.startProfile('spiderman');
    first.addOwnedItem('reactor_arc');
    first.equipItem('spiderman', 'reactor_arc');
    first.addCredits(300);

    const reopenedGame = createGame();
    const reopened = new ProgressionManager(storage);
    reopened.initialize(reopenedGame, data);

    assert.deepEqual(reopenedGame.activeTeam.map((hero) => hero.id), ['spiderman']);
    assert.deepEqual(reopened.state.equippedItems.spiderman, { weapon: 'reactor_arc' });
    assert.equal(reopened.state.credits, 1500);
});

test('ProgressionManager recupera guardados corruptos sin bloquear el arranque', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{perfil-roto');
    const manager = new ProgressionManager(storage);
    manager.initialize(createGame(), data);

    assert.equal(manager.recoveredFromCorruptSave, true);
    assert.equal(manager.state.version, SAVE_VERSION);
    assert.deepEqual(manager.state.unlockedHeroIds, []);
    assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version, SAVE_VERSION);
});

test('ProgressionManager reinicia todo el progreso persistido', () => {
    const storage = new MemoryStorage();
    const game = createGame();
    const manager = new ProgressionManager(storage);
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    manager.addOwnedItem('reactor_arc');
    manager.state.mapProgress.level_1 = { bestWave: 8, stars: 3, challenges: [], missionObjectives: [] };
    manager.updateSetting('locale', 'en');

    assert.equal(manager.resetAllProgress(), true);

    const saved = JSON.parse(storage.getItem(SAVE_KEY));
    assert.deepEqual(manager.state.unlockedHeroIds, []);
    assert.deepEqual(manager.state.activeTeamIds, []);
    assert.deepEqual(manager.state.ownedItemIds, []);
    assert.deepEqual(manager.state.mapProgress, {});
    assert.equal(manager.state.settings.locale, 'es');
    assert.deepEqual(game.activeTeam, []);
    assert.equal(saved.version, SAVE_VERSION);
    assert.deepEqual(saved.unlockedHeroIds, []);
});

test('modo admin requiere contraseña y desbloquea contenido completo', () => {
    const game = createGame();
    let infiniteCredits = false;
    game.resourceManager.setInfiniteCredits = (enabled) => { infiniteCredits = enabled; };
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);

    assert.equal(manager.enableAdminMode('1234').ok, false);
    assert.equal(manager.state.settings.adminMode, false);

    const result = manager.enableAdminMode('0000');

    assert.equal(result.ok, true);
    assert.equal(manager.state.settings.adminMode, true);
    assert.equal(manager.state.unlockedHeroIds.length, Object.keys(data.heroes).length);
    assert.equal(manager.state.ownedItemIds.length, Object.keys(data.items).length);
    assert.equal(manager.state.activeTeamIds.length, 6);
    assert.equal(manager.state.credits, 999999999);
    assert.equal(manager.getTotalStars(), data.levels.length * 100);
    assert.equal('difficulty' in manager.getMapProgress('level_1'), false);
    assert.equal(infiniteCredits, true);
    assert.equal(manager.spendCredits(500000), true);
    assert.equal(manager.state.credits, 999999999);
});

test('arbol de habilidades queda retirado y no aplica bonos ocultos', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.state.heroUpgrades.iron_man = ['assault_1'];
    const funds = manager.state.credits;

    const result = manager.purchaseUpgrade(data.heroes.iron_man, 'assault_1');
    assert.equal(result.ok, false);
    assert.equal(manager.state.credits, funds);
    assert.deepEqual(manager.getHeroBonuses('iron_man'), {
        damage: 0,
        range: 0,
        fireRate: 0,
        critChance: 0,
        abilityPower: 0,
        cooldown: 0
    });
});

test('Equipar un segundo objeto reemplaza el anterior aunque sea otra ranura', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.addOwnedItem('reactor_arc');
    manager.addOwnedItem('lentes_edith');
    manager.equipItem('iron_man', 'reactor_arc');
    manager.equipItem('iron_man', 'lentes_edith');

    assert.deepEqual(manager.state.equippedItems.iron_man, { artifact: 'lentes_edith' });
    assert.deepEqual(manager.state.ownedItemIds, ['reactor_arc']);
});

test('Reemplazar un objeto devuelve la ranura anterior al inventario', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.addOwnedItem('reactor_arc');
    manager.addOwnedItem('municion_repulsora');
    manager.equipItem('iron_man', 'reactor_arc');
    manager.equipItem('iron_man', 'municion_repulsora');

    assert.deepEqual(manager.state.equippedItems.iron_man, { weapon: 'municion_repulsora' });
    assert.deepEqual(manager.state.ownedItemIds, ['reactor_arc']);
});

test('Mover un objeto equipado lo transfiere a otro heroe si no hay copia libre', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.unlockHero('spiderman');
    manager.addOwnedItem('reactor_arc');
    manager.equipItem('iron_man', 'reactor_arc');

    assert.equal(manager.getOwnedQuantity('reactor_arc'), 0);
    assert.equal(manager.equipItem('spiderman', 'reactor_arc'), true);
    assert.equal(manager.state.equippedItems.iron_man, undefined);
    assert.deepEqual(manager.state.equippedItems.spiderman, { weapon: 'reactor_arc' });
});

test('Forja y reciclaje de objetos no existen en progreso', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.addOwnedItem('reactor_arc');
    manager.addOwnedItem('reactor_arc');

    assert.equal(manager.getOwnedQuantity('reactor_arc'), 2);
    assert.equal(typeof manager.salvageItem, 'undefined');
    assert.equal(typeof manager.upgradeItem, 'undefined');
    assert.equal(typeof manager.getForgeCost, 'undefined');
    assert.equal(typeof manager.getItemLevel, 'undefined');
    assert.equal(typeof manager.spendMetaCredits, 'undefined');
    assert.equal(typeof manager.addMetaCredits, 'undefined');
    manager.state.forgeMaterials = 500;
    manager.sanitize();
    assert.equal('forgeMaterials' in manager.state, false);
    assert.equal('itemLevels' in manager.state, false);
});

test('Loadout restaura un solo objeto de forma atomica', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    ['reactor_arc', 'chaleco_tactico', 'lentes_edith', 'municion_repulsora'].forEach((id) => manager.addOwnedItem(id));
    manager.equipItem('iron_man', 'reactor_arc');
    manager.saveLoadout('iron_man');
    manager.equipItem('iron_man', 'municion_repulsora');

    assert.equal(manager.applyLoadout('iron_man').ok, true);
    assert.deepEqual(manager.state.equippedItems.iron_man, { weapon: 'reactor_arc' });
});

test('Loadout de mapa guarda y restaura el equipo activo', () => {
    const game = createGame();
    game.currentLevel = data.levels[0];
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    manager.unlockHero('spiderman');
    manager.unlockHero('hulk');
    manager.setActiveTeam(['iron_man', 'spiderman']);

    const saved = manager.saveMapTeamLoadout('level_1');

    assert.equal(saved.ok, true);
    assert.deepEqual(manager.state.mapTeamLoadouts.level_1, ['iron_man', 'spiderman']);
    assert.match(saved.label, /Iron Man/);

    manager.setActiveTeam(['hulk']);
    const applied = manager.applyMapTeamLoadout('level_1');

    assert.equal(applied.ok, true);
    assert.deepEqual(manager.state.activeTeamIds, ['iron_man', 'spiderman']);
    assert.deepEqual(game.activeTeam.map((hero) => hero.id), ['iron_man', 'spiderman']);
});

test('Loadout de mapa descarta mapas y heroes invalidos', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    manager.unlockHero('spiderman');
    manager.state.mapTeamLoadouts = {
        level_1: ['iron_man', 'missing', 'spiderman', 'iron_man'],
        mapa_roto: ['iron_man']
    };

    manager.sanitize();

    assert.deepEqual(manager.state.mapTeamLoadouts, { level_1: ['iron_man', 'spiderman'] });
});
test('favoritos de heroes persisten y se sanean contra el roster', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');

    assert.equal(manager.isHeroFavorite('spiderman'), false);
    assert.deepEqual(manager.toggleHeroFavorite('spiderman'), { ok: true, favorite: true });
    assert.equal(manager.isHeroFavorite('spiderman'), true);
    assert.deepEqual(manager.toggleHeroFavorite('spiderman'), { ok: true, favorite: false });
    assert.deepEqual(manager.setHeroFavorite('spiderman', true), { ok: true, favorite: true });
    assert.equal(manager.setHeroFavorite('missing', true).ok, false);

    manager.state.favoriteHeroIds = ['spiderman', 'missing', 'spiderman', 'iron_man'];
    manager.sanitize();

    assert.deepEqual(manager.state.favoriteHeroIds, ['spiderman', 'iron_man']);
});
test('prioridad de objetivo por heroe persiste al sincronizar equipo y campo', () => {
    const game = createGame();
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    game.heroes = [{ id: 'iron_man', name: 'Iron Man', targetingPriority: 'Primero', config: { id: 'iron_man', targetingPriority: 'Primero' } }];

    assert.deepEqual(manager.setHeroTargetingPriority('iron_man', 'Jefe'), { ok: true, priority: 'Jefe' });
    manager.syncGame();

    assert.equal(manager.getHeroTargetingPriority('iron_man'), 'Jefe');
    assert.equal(game.activeTeam[0].targetingPriority, 'Jefe');
    assert.equal(game.heroes[0].targetingPriority, 'Jefe');
    assert.equal(game.heroes[0].config.targetingPriority, 'Jefe');

    manager.state.heroTargetPriorities = { iron_man: 'Rápido', spiderman: 'Roto', missing: 'Jefe' };
    manager.sanitize();

    assert.deepEqual(manager.state.heroTargetPriorities, { iron_man: 'Rápido' });
});
test('Progreso de mapa guarda estrellas y desafio de jefe', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    game.progression = manager;
    manager.state.mapProgress.level_1 = { bestWave: 8, stars: 3, challenges: ['sin_danos', 'fantasma'], missionObjectives: [] };

    assert.deepEqual(manager.getMapProgress('level_1').challenges, []);

    manager.recordWave(game, 25);

    const progress = manager.getMapProgress('level_1');
    assert.equal(progress.bestWave, 25);
    assert.equal(progress.stars, 25);
    assert.equal('difficulty' in progress, false);
    assert.deepEqual(progress.challenges, ['cazajefes']);
});

test('Cada oleada nueva superada cuenta como una estrella', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    game.progression = manager;

    for (let wave = 1; wave <= 100; wave++) manager.recordWave(game, wave);
    manager.recordWave(game, 25);
    manager.recordWave(game, 125);

    const progress = manager.getMapProgress('level_1');
    assert.equal(progress.bestWave, 100);
    assert.equal(progress.stars, 100);
    assert.equal(game.stars, 100);
});

test('Objetivos de misión entregan una recompensa una sola vez', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);

    assert.equal(manager.completeMissionObjective('level_1', 'ny_first_contact', 200), true);
    assert.equal(manager.completeMissionObjective('level_1', 'ny_first_contact', 200), false);
    assert.equal(manager.state.credits, 1400);
    assert.deepEqual(manager.getMapProgress('level_1').missionObjectives, ['ny_first_contact']);
});

test('Ajustes accesibles conservan tipos y límites válidos', () => {
    const previousDocument = globalThis.document;
    const classes = new Set();
    globalThis.document = {
        body: {
            classList: {
                toggle(name, enabled) {
                    if (enabled) classes.add(name);
                    else classes.delete(name);
                }
            },
            dataset: {}
        }
    };
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    try {
        manager.initialize(game, data);
        manager.updateSetting('highContrast', true);
        manager.updateSetting('combatText', false);
        manager.updateSetting('uiScale', 'large');
        manager.updateSetting('musicVolume', 4);
        manager.updateSetting('simplifiedUi', true);
        manager.updateSetting('pixelArtCrisp', true);
        manager.updateSetting('reducedVfx', true);
        manager.updateSetting('showFps', true);

        assert.equal(manager.state.settings.highContrast, true);
        assert.equal(manager.state.settings.combatText, false);
        assert.equal(game.showCombatText, false);
        assert.equal(manager.state.settings.uiScale, 'large');
        assert.equal(manager.state.settings.musicVolume, 1);
        assert.equal(manager.state.settings.simplifiedUi, true);
        assert.equal('tutorialHints' in manager.state.settings, false);
        assert.equal(manager.state.settings.pixelArtCrisp, true);
        assert.equal(manager.state.settings.reducedVfx, true);
        assert.equal(manager.state.settings.showFps, true);
        assert.equal(game.pixelArtCrisp, true);
        assert.equal(game.reducedVfx, true);
        assert.equal(game.showFps, true);
        assert.ok(classes.has('simple-ui'));
        assert.ok(classes.has('pixel-art-crisp'));
        assert.ok(classes.has('reduced-vfx'));
    } finally {
        globalThis.document = previousDocument;
    }
});

test('rankings de modos se guardan separados de campaña', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.recordModeScore('daily', 900, 8, 'defeat', 'daily:2026-06-23');
    manager.recordModeScore('survival', 1400, 12, 'extracted', 'survival:level_1');

    assert.equal(manager.getModeRecord('daily').bestScore, 900);
    assert.equal(manager.getModeRecord('survival').bestWave, 12);
    assert.equal(manager.getMapProgress('level_1').bestWave, 0);
});

test('evoluciones se activan automaticamente por nivel y respetan objetos signature', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    manager.startProfile('capitan_america');

    manager.setHeroLevel('capitan_america', 49);
    assert.equal(manager.getHeroEvolution('capitan_america'), null);

    manager.setHeroLevel('capitan_america', 50);
    const base = manager.getHeroEvolution('capitan_america');
    assert.equal(base.id, 'capitan_america_evolution');
    assert.equal(base.activeItemId, undefined);

    manager.addOwnedItem('mjolnir');
    assert.equal(manager.equipItem('capitan_america', 'mjolnir'), true);
    const withItem = manager.getHeroEvolution('capitan_america');
    assert.equal(withItem.activeItemId, 'mjolnir');
    assert.equal('allowsSupportAttack' in withItem, false);
    assert.ok(withItem.stats.damage > base.stats.damage);
});

test('saneado conserva solo evoluciones guardadas que pertenecen al heroe', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
        version: SAVE_VERSION,
        unlockedHeroIds: ['thor', 'iron_man'],
        activeTeamIds: ['thor'],
        selectedEvolutions: { thor: 'thor_evolution', iron_man: 'phoenix' }
    }));
    const manager = new ProgressionManager(storage);
    manager.initialize(createGame(), data);

    assert.deepEqual(manager.state.selectedEvolutions, { thor: 'thor_evolution' });
});

test('maestria recompensa desafios una sola vez y el codice persiste hallazgos', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    manager.startProfile('iron_man');
    const hero = { id: 'iron_man', combatStats: { damageDealt: 5100, abilityActivations: 6, kills: 30 } };

    assert.equal(manager.evaluateHeroMastery(hero).length, 3);
    assert.equal(manager.evaluateHeroMastery(hero).length, 0);
    assert.equal(manager.state.credits, 1500);
    assert.equal(manager.discoverCodex('enemies', 'hydra_soldier'), true);
    assert.equal(manager.state.codexDiscovered.enemies.includes('hydra_soldier'), true);
    assert.equal(manager.getCodexSnapshot().enemies.total, 49);
    assert.equal(manager.state.codexDiscovered.heroes.includes('iron_man'), true);
});

test('resumen de mision acumula estadisticas y logros una sola vez', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    game.heroes = [{ id: 'iron_man', name: 'Iron Man', combatStats: { damageDealt: 8200, kills: 31, shots: 60, crits: 8, goldGenerated: 90, abilityActivations: 6 } }];
    game.waveManager = { currentWave: 25 };
    game.modeSystem = { modeId: 'campaign' };

    const summary = manager.recordMissionSummary(game, 'victory');
    manager.recordMissionSummary(game, 'victory');

    assert.equal(summary.bestHero, 'Iron Man');
    assert.equal(manager.state.statistics.missions, 1);
    assert.equal(manager.state.statistics.enemiesDefeated, 31);
    assert.ok(manager.state.achievements.includes('primera_defensa'));
    assert.ok(manager.state.achievements.includes('intocable'));
    assert.ok(manager.state.achievements.includes('cazajefes'));
});

test('resumen de mision desbloquea logros tacticos y sinergia activa', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    manager.unlockHero('capitan_america');
    manager.unlockHero('thor');
    game.activeTeam = [data.heroes.iron_man, data.heroes.capitan_america, data.heroes.thor];
    game.heroes = [
        {
            id: 'iron_man',
            name: 'Iron Man',
            combatStats: {
                damageDealt: 8200,
                kills: 31,
                shots: 60,
                crits: 8,
                goldGenerated: 90,
                abilityActivations: 6,
                controlSeconds: 32,
                armorBreaks: 4,
                marks: 5,
                detectionReveals: 3,
                tacticalScore: 2700
            }
        }
    ];
    game.waveManager = { currentWave: 11, faction: { label: 'Hydra / A.I.M.' } };

    manager.recordMissionSummary(game, 'victory');

    assert.ok(manager.state.achievements.includes('tactico_superior'));
    assert.ok(manager.state.achievements.includes('protector'));
    assert.match(ACHIEVEMENT_CATALOG.protector.description, /rupturas/);
    assert.ok(manager.state.achievements.includes('controlador'));
    assert.ok(manager.state.achievements.includes('arsenal_vivo'));
    assert.ok(manager.state.achievements.includes('sinergia_activa'));
    assert.equal(manager.state.lastMissionSummary.tactical.controlSeconds, 32);
});

test('contratos semanales se completan una vez y pagan creditos', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);
    const now = new Date('2026-07-13T12:00:00Z');
    const factionContract = manager.getWeeklyContractSnapshot(now).contracts.find((contract) => contract.id.includes(':faction_'));
    const before = manager.state.credits;
    const summary = {
        result: 'victory',
        lives: 20,
        enemyFaction: factionContract.group,
        totals: { kills: 35 },
        tactical: { controlSeconds: 25 },
        synergies: { activeFamilies: 1 }
    };

    const first = manager.evaluateWeeklyContracts(summary, now);
    const second = manager.evaluateWeeklyContracts(summary, now);

    assert.equal(first.length, 4);
    assert.equal(second.length, 0);
    assert.equal(manager.getWeeklyContractSnapshot(now).completed, 4);
    assert.equal(manager.state.credits, before + first.reduce((sum, contract) => sum + contract.reward, 0));
});

test('contratos semanales desbloquean emblemas por semanas completas', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(createGame(), data);

    completeWeeklyContracts(manager, new Date('2026-07-13T12:00:00Z'));
    assert.equal(manager.getContractEmblemSnapshot().streak, 1);
    assert.equal(manager.getContractEmblemSnapshot().bestStreak, 1);
    assert.equal(manager.getContractEmblemSnapshot().emblems.find((emblem) => emblem.id === 'weekly_streak_1').unlocked, true);

    completeWeeklyContracts(manager, new Date('2026-07-20T12:00:00Z'));
    assert.equal(manager.getContractEmblemSnapshot().streak, 2);
    assert.equal(manager.getContractEmblemSnapshot().bestStreak, 2);
    assert.equal(manager.getContractEmblemSnapshot().emblems.find((emblem) => emblem.id === 'weekly_streak_2').unlocked, true);

    const duplicatedWeek = manager.evaluateWeeklyContracts(buildWeeklySummary(manager, new Date('2026-07-20T12:00:00Z')), new Date('2026-07-20T12:00:00Z'));
    assert.equal(duplicatedWeek.length, 0);
    assert.equal(manager.getContractEmblemSnapshot().streak, 2);

    completeWeeklyContracts(manager, new Date('2026-08-03T12:00:00Z'));
    assert.equal(manager.getContractEmblemSnapshot().streak, 1);
    assert.equal(manager.getContractEmblemSnapshot().bestStreak, 2);
});

test('retos de agrupacion detectan equipo activo y pagan una sola vez', () => {
    const manager = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    manager.unlockHero('capitan_america');
    manager.unlockHero('thor');
    game.activeTeam = [data.heroes.iron_man, data.heroes.capitan_america, data.heroes.thor];

    const snapshot = manager.getSynergyChallengeSnapshot();
    assert.ok(snapshot.challenges.some((challenge) => challenge.id === 'family:Avengers' && challenge.active));
    assert.ok(snapshot.challenges.some((challenge) => challenge.id === 'pair:ciencia_y_escudo' && challenge.active));

    const before = manager.state.credits;
    const summary = {
        result: 'victory',
        totals: { kills: 30 },
        synergies: { activeFamilyTags: ['Avengers'], activePairIds: ['ciencia_y_escudo'] }
    };
    const first = manager.evaluateSynergyChallenges(summary);
    const second = manager.evaluateSynergyChallenges(summary);

    assert.equal(first.length, 2);
    assert.equal(second.length, 0);
    assert.equal(manager.state.synergyChallenges.includes('family:Avengers'), true);
    assert.equal(manager.state.synergyChallenges.includes('pair:ciencia_y_escudo'), true);
    assert.equal(manager.state.credits, before + first.reduce((sum, challenge) => sum + challenge.reward, 0));
});

function buildWeeklySummary(manager, now) {
    const factionContract = manager.getWeeklyContractSnapshot(now).contracts.find((contract) => contract.id.includes(':faction_'));
    return {
        result: 'victory',
        lives: 20,
        enemyFaction: factionContract.group,
        totals: { kills: 35 },
        tactical: { controlSeconds: 25 },
        synergies: { activeFamilies: 1 }
    };
}

function completeWeeklyContracts(manager, now) {
    return manager.evaluateWeeklyContracts(buildWeeklySummary(manager, now), now);
}

test('codigo de build exporta e importa equipo, objetos y evoluciones validas', () => {
    const first = new ProgressionManager(new MemoryStorage());
    first.initialize(createGame(), data);
    first.startProfile('spiderman');
    first.addOwnedItem('reactor_arc');
    first.equipItem('spiderman', 'reactor_arc');
    const code = first.exportBuildCode();

    const secondGame = createGame();
    const second = new ProgressionManager(new MemoryStorage());
    second.initialize(secondGame, data);
    second.startProfile('spiderman');
    second.addOwnedItem('reactor_arc');

    assert.equal(second.importBuildCode(code).ok, true);
    assert.deepEqual(second.state.activeTeamIds, ['spiderman']);
    assert.deepEqual(second.state.equippedItems.spiderman, { weapon: 'reactor_arc' });
    assert.deepEqual(second.state.ownedItemIds, []);
    assert.deepEqual(secondGame.activeTeam.map((hero) => hero.id), ['spiderman']);
    assert.equal(second.importBuildCode('no-es-build').ok, false);
});

test('exportar e importar conserva progreso y rechaza formatos ajenos', () => {
    const first = new ProgressionManager(new MemoryStorage());
    first.initialize(createGame(), data);
    first.startProfile('spiderman');
    first.updateKeyBinding('pause', 'q');
    first.updateSetting('locale', 'en');
    const exported = first.exportSave();

    const second = new ProgressionManager(new MemoryStorage());
    const game = createGame();
    second.initialize(game, data);
    assert.equal(second.importSave(exported).ok, true);
    assert.equal(second.state.settings.keyBindings.pause, 'q');
    assert.equal(second.state.settings.locale, 'en');
    assert.deepEqual(game.activeTeam.map((hero) => hero.id), ['spiderman']);
    assert.equal(second.importSave('{"untrusted":true}').ok, false);
    assert.deepEqual(game.activeTeam.map((hero) => hero.id), ['spiderman']);
});

test('quitar un heroe del equipo tambien lo retira del campo', () => {
    const game = createGame();
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);
    manager.state.unlockedHeroIds = ['iron_man', 'spiderman', 'thor'];
    manager.setActiveTeam(['iron_man', 'spiderman']);

    const removedHero = { id: 'iron_man', name: 'Iron Man' };
    const keptHero = { id: 'spiderman', name: 'Spider-Man' };
    const removedProjectile = { attacker: removedHero, isActive: true, deactivate() { this.isActive = false; } };
    const keptProjectile = { attacker: keptHero, isActive: true, deactivate() { this.isActive = false; } };
    game.heroes = [removedHero, keptHero];
    game.selectedUnit = removedHero;
    game.projectiles = [removedProjectile, keptProjectile];
    game.inputManager = {
        placingHero: data.heroes.iron_man,
        movingHero: removedHero,
        cleared: false,
        clearPlacement() {
            this.cleared = true;
            this.placingHero = null;
            this.movingHero = null;
        }
    };
    game.waveManager = { refreshed: 0, refreshWaveIntel() { this.refreshed++; } };

    manager.setActiveTeam(['spiderman', 'thor']);

    assert.deepEqual(game.activeTeam.map((hero) => hero.id), ['spiderman', 'thor']);
    assert.deepEqual(game.heroes.map((hero) => hero.id), ['spiderman']);
    assert.equal(game.selectedUnit, null);
    assert.equal(removedProjectile.isActive, false);
    assert.equal(keptProjectile.isActive, true);
    assert.equal(game.inputManager.cleared, true);
    assert.equal(game.waveManager.refreshed, 1);
});

test('nivel de heroe persiste al retirarlo del campo y del equipo', () => {
    const game = createGame();
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);
    manager.startProfile('iron_man');
    manager.setHeroLevel('iron_man', 12);

    game.heroes = [{ id: 'iron_man', name: 'Iron Man', config: { ...data.heroes.iron_man } }];
    manager.setActiveTeam([]);

    assert.equal(manager.getHeroLevel('iron_man'), 12);
    assert.deepEqual(game.heroes, []);

    manager.setActiveTeam(['iron_man']);

    assert.equal(game.activeTeam[0].level, 12);
    assert.equal(
        game.activeTeam[0].damage,
        getHeroDamageAtLevel(game.activeTeam[0].baseDamage, 12, game.activeTeam[0].rarity)
    );
});

test('subir nivel solo aumenta dano y mantiene alcance y cadencia base', () => {
    const game = createGame();
    const manager = new ProgressionManager(new MemoryStorage());
    manager.initialize(game, data);
    manager.startProfile('spiderman');

    const hero = game.activeTeam[0];
    const baseDamage = hero.baseDamage;
    const baseRange = hero.baseRange;
    const baseFireRate = hero.baseFireRate;

    manager.setHeroLevel('spiderman', 80);

    assert.equal(hero.level, 80);
    assert.equal(hero.range, baseRange);
    assert.equal(hero.fireRate, baseFireRate);
    assert.equal(hero.damage, getHeroDamageAtLevel(baseDamage, 80, hero.rarity));
    assert.ok(hero.damage > baseDamage);
});

function createGame() {
    return {
        heroes: [], audio: { setEnabled: () => {} }, resourceManager: { lives: 20, maxLives: 20 },
        currentLevel: { id: 'level_1' }, showHeroRanges: true, showGrid: true
    };
}

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
}
