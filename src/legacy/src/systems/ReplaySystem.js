export class ReplaySystem {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset(seed = 'campaign', levelId = 'level_1', modeId = 'campaign') {
        this.replay = { format: 'marvel-td-replay', version: 1, seed, levelId, modeId, actions: [] };
    }

    record(type, payload = {}) {
        this.replay.actions.push({ wave: this.game.waveManager?.currentWave || 1, type, payload });
    }

    exportReplay() {
        return JSON.stringify(this.replay, null, 2);
    }

    exportReplayCode(metadata = {}) {
        return encodeCompactPayload({
            format: 'marvel-td-replay-code',
            version: 1,
            replay: this.replay,
            summary: createReplaySummary(metadata.summary || this.game.progression?.state?.lastMissionSummary),
            buildCode: metadata.buildCode || this.game.progression?.exportBuildCode?.() || ''
        });
    }

    importReplay(source) {
        try {
            const replay = typeof source === 'string' ? JSON.parse(source) : source;
            if (replay?.format !== 'marvel-td-replay' || replay.version !== 1 || typeof replay.seed !== 'string' || !Array.isArray(replay.actions)) throw new Error('Replay no valido');
            this.replay = structuredClone(replay);
            return { ok: true, replay: this.replay };
        } catch (error) {
            return { ok: false, reason: error.message || 'Replay no valido' };
        }
    }

    importReplayCode(source) {
        try {
            const parsed = decodeCompactPayload(source);
            if (parsed?.format !== 'marvel-td-replay-code' || parsed.version !== 1 || !parsed.replay) throw new Error('Codigo de replay no valido');
            const result = this.importReplay(parsed.replay);
            if (!result.ok) throw new Error(result.reason);
            return {
                ok: true,
                replay: this.replay,
                summary: parsed.summary || null,
                buildCode: typeof parsed.buildCode === 'string' ? parsed.buildCode : ''
            };
        } catch (error) {
            return { ok: false, reason: error.message || 'Codigo de replay no valido' };
        }
    }
}

function createReplaySummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    return {
        result: summary.result || '',
        mode: summary.mode || '',
        map: summary.map || '',
        wave: Math.max(0, Number(summary.wave) || 0),
        lives: Math.max(0, Number(summary.lives) || 0),
        bestHero: summary.bestHero || '',
        kills: Math.max(0, Number(summary.totals?.kills) || 0),
        tacticalScore: Math.max(0, Number(summary.tactical?.tacticalScore) || 0),
        recordedAt: summary.recordedAt || ''
    };
}

function encodeCompactPayload(payload) {
    const json = JSON.stringify(payload);
    const base64 = typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(json)))
        : Buffer.from(json, 'utf8').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCompactPayload(source) {
    const text = String(source || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = text.padEnd(Math.ceil(text.length / 4) * 4, '=');
    const json = typeof atob === 'function'
        ? decodeURIComponent(escape(atob(padded)))
        : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
}
