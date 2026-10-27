import { resetSupportAura } from './SupportAuraSystem.js';

export class TacticalActionSystem {
    constructor(game) {
        this.game = game;
    }

    getCurrentWave() {
        return this.game.waveManager?.currentWave || 1;
    }

    getSellRefund(hero) {
        return 0;
    }

    canReposition(hero) {
        if (!hero || this.game.isGameOver || !this.game.heroes.includes(hero)) {
            return { ok: false, reason: 'El héroe no está desplegado.' };
        }
        return { ok: true, reason: '' };
    }

    markRepositioned(hero) {
        const permission = this.canReposition(hero);
        if (!permission.ok) return permission;
        return { ok: true, reason: '' };
    }

    canSell(hero) {
        if (!hero || !this.game.heroes.includes(hero)) {
            return { ok: false, reason: 'El héroe no está desplegado.' };
        }
        return { ok: true, reason: '' };
    }

    sell(hero) {
        const permission = this.canSell(hero);
        if (!permission.ok) return permission;

        const index = this.game.heroes.indexOf(hero);
        this.game.heroes.splice(index, 1);
        hero.abilitySystem?.cosmicKit?.checkEnergyPosition();
        hero.abilitySystem?.avengerKit?.checkDensityPosition();
        hero.abilitySystem?.mutantKit?.checkPhoenixPosition();
        resetSupportAura(hero);
        hero.abilitySystem?.fieldDevice?.clear();
        hero.abilitySystem?.focusKit?.reset();
        hero.abilitySystem?.martialKit?.reset();
        hero.abilitySystem?.controlKit?.reset();
        hero.abilitySystem?.elementalKit?.reset();
        hero.abilitySystem?.coastalKit?.reset();
        hero.abilitySystem?.psychicKit?.reset();
        hero.abilitySystem?.vigilanceKit?.reset();
        hero.abilitySystem?.mysticKit?.reset();
        hero.abilitySystem?.fateKit?.reset();
        hero.abilitySystem?.darkfireKit?.reset();
        hero.abilitySystem?.arcaneStormKit?.reset();
        hero.abilitySystem?.energyReserveKit?.reset();
        hero.abilitySystem?.mutantKit?.checkOpticPosition();
        hero.abilitySystem?.cosmicKit?.checkTrajectoryPosition();
        hero.abilitySystem?.streetKit?.resetHunter();
        hero.abilitySystem?.mutantKit?.checkWeather();
        hero.abilitySystem?.cosmicKit?.checkRoots();
        hero.abilitySystem?.mutantKit?.updatePursuit(0);
        if (hero.abilitySystem?.streetKit) hero.abilitySystem.streetKit.suppression = null;
        if (hero.abilitySystem?.avengerKit) hero.abilitySystem.avengerKit.salvo = null;
        if (this.game.selectedUnit === hero) this.game.selectedUnit = null;
        return { ok: true, refund: 0 };
    }
}
