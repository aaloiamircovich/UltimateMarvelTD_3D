import { RandomSource } from '../utils/Random.js';

export const GAME_MODES = {
    daily: { id: 'daily', name: 'Operación diaria', icon: 'fa-calendar-day', description: 'Mapa, equipo y semilla compartidos durante el día.', maxWaves: 20 },
    boss_rush: { id: 'boss_rush', name: 'Boss Rush', icon: 'fa-skull-crossbones', description: 'Diez jefes consecutivos con recompensa entre combates.', maxWaves: 10 },
    survival: { id: 'survival', name: 'Supervivencia', icon: 'fa-infinity', description: 'Oleadas sin límite, hitos y extracción voluntaria.', maxWaves: Number.MAX_SAFE_INTEGER },
    draft: { id: 'draft', name: 'Draft heroico', icon: 'fa-layer-group', description: 'Empieza con tres héroes y elige refuerzos cada tres rondas.', maxWaves: 15 }
};

export class GameModeSystem {
    constructor(game, progression) {
        this.game = game;
        this.progression = progression;
        this.reset();
    }

    reset() {
        this.modeId = 'campaign';
        this.score = 0;
        this.wavesCleared = 0;
        this.lastWaveScore = 0;
        this.finished = false;
        this.seedKey = 'campaign';
        this.draftPool = [];
        this.pendingDraft = [];
    }

    setCampaign() {
        this.reset();
        this.publish();
    }

    start(modeId) {
        const mode = GAME_MODES[modeId];
        if (!mode) return false;
        const levels = this.game.levelsData || [];
        const dateKey = new Date().toISOString().slice(0, 10);
        const random = new RandomSource(`${modeId}:${dateKey}`);
        const level = modeId === 'daily' ? levels[Math.floor(random.next() * levels.length)] : this.game.currentLevel || levels[0];

        this.reset();
        this.modeId = modeId;
        this.seedKey = modeId === 'daily' ? `${modeId}:${dateKey}` : `${modeId}:${level.id}`;
        if (modeId === 'draft') this.prepareDraftRoster(random);
        if (modeId === 'daily') this.prepareDailyRoster(random);
        this.game.loadLevel(level, { preserveMode: true });
        return true;
    }

    configureRun() {
        if (this.modeId === 'campaign') return;
        const mode = GAME_MODES[this.modeId];
        this.game.waveManager.maxWaves = mode.maxWaves;
        if (this.modeId === 'boss_rush') this.game.resourceManager.reset(30, 900);
        if (this.modeId === 'survival') this.game.resourceManager.reset(20, 750);
        this.publish();
    }

    prepareDailyRoster(random) {
        const heroes = Object.values(this.game.heroDatabase || {});
        this.game.activeTeam = sampleUnique(heroes, 6, random);
        this.game.assetPreloader?.preloadHeroes(this.game.activeTeam);
    }

    prepareDraftRoster(random) {
        const heroes = Object.values(this.game.heroDatabase || {});
        const shuffled = sampleUnique(heroes, heroes.length, random);
        this.game.activeTeam = shuffled.slice(0, 3);
        this.draftPool = shuffled.slice(3);
        this.game.assetPreloader?.preloadHeroes([...this.game.activeTeam, ...this.draftPool.slice(0, 3)]);
    }

    buildWave(waveNumber, manager) {
        if (this.modeId !== 'boss_rush') return null;
        const bosses = Object.values(manager.data.bosses);
        const boss = bosses[(waveNumber - 1) % bosses.length];
        return [{ config: manager.scaleEnemy(boss, 0.8 + waveNumber * 0.16, true), delay: 0.2 }];
    }

    onWaveFinished(waveNumber) {
        if (this.modeId === 'campaign' || this.finished) return;
        const lives = this.game.resourceManager.lives;
        this.wavesCleared++;
        this.lastWaveScore = Math.round(100 * waveNumber + lives * 12 + (this.modeId === 'boss_rush' ? 250 : 0));
        this.score += this.lastWaveScore;
        if (this.modeId === 'boss_rush') this.game.resourceManager.addCredits(180 + waveNumber * 35);
        if (this.modeId === 'survival' && waveNumber % 5 === 0) {
            this.game.resourceManager.addCredits(300);
            this.game.uiManager?.showToast(`Hito ${waveNumber}: +$300`, 'reward');
        }
        if (this.modeId === 'draft' && waveNumber % 3 === 0 && this.draftPool.length) this.offerDraft();
        this.publish();
    }

    offerDraft() {
        this.pendingDraft = this.draftPool.splice(0, Math.min(3, this.draftPool.length));
        this.game.pause();
        this.game.uiManager?.showDraftChoice(this.pendingDraft, (heroId) => this.chooseDraft(heroId));
    }

    chooseDraft(heroId) {
        const hero = this.pendingDraft.find((candidate) => candidate.id === heroId);
        if (!hero) return false;
        if (this.game.activeTeam.length < 6) this.game.activeTeam.push(hero);
        else this.game.activeTeam[this.game.activeTeam.length - 1] = hero;
        this.pendingDraft = [];
        this.game.assetPreloader?.preloadHeroes(this.game.activeTeam);
        this.game.replaySystem?.record('draft', { heroId });
        this.game.uiManager?.renderHeroRoster(this.game.activeTeam, (config) => this.game.inputManager.setPlacementMode(config));
        this.game.uiManager?.closePanel();
        this.game.start();
        this.publish();
        return true;
    }

    update() {}

    handleLeak() {
        return false;
    }

    render() {}

    extract() {
        if (this.modeId !== 'survival' || this.finished || this.game.waveManager?.isWaveActive) return false;
        this.finishRun('extracted');
        this.game.pause();
        this.game.uiManager?.showModeResult('Extracción completada', this.getSnapshot());
        return true;
    }

    finishRun(result = 'defeat') {
        if (this.modeId === 'campaign' || this.finished) return;
        this.finished = true;
        const wave = this.game.waveManager?.currentWave || 1;
        this.progression?.recordModeScore(this.modeId, this.score, wave, result, this.seedKey);
        this.progression?.recordMissionSummary?.(this.game, result === 'victory' ? 'victory' : result);
        this.publish();
    }

    getSeed() {
        return this.seedKey;
    }

    getSnapshot() {
        const mode = GAME_MODES[this.modeId];
        if (!mode) return null;
        const best = this.progression?.getModeRecord(this.modeId)?.bestScore || 0;
        const streakDetail = this.wavesCleared >= 2 ? `Oleadas superadas x${this.wavesCleared}` : null;
        return {
            id: this.modeId, name: mode.name, score: this.score, best,
            wave: this.game.waveManager?.currentWave || 1,
            detail: this.modeId === 'draft' ? `Equipo ${this.game.activeTeam.length}/6`
                : this.modeId === 'survival' ? 'Extracción disponible entre oleadas' : `Récord ${best}`,
            streakDetail,
            wavesCleared: this.wavesCleared,
            lastWaveScore: this.lastWaveScore,
            canExtract: this.modeId === 'survival' && !this.game.waveManager?.isWaveActive && !this.finished
        };
    }

    publish(force = true) {
        this.game.uiManager?.updateModeStatus(this.getSnapshot());
    }
}

function sampleUnique(values, count, random) {
    const pool = [...values];
    const result = [];
    while (pool.length && result.length < count) result.push(pool.splice(Math.floor(random.next() * pool.length), 1)[0]);
    return result;
}
