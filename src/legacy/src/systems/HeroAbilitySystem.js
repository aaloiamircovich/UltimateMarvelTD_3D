import { CombatSystem } from './CombatSystem.js';
import { AvengerKitSystem } from './AvengerKitSystem.js';
import { CosmicKitSystem } from './CosmicKitSystem.js';
import { StreetKitSystem } from './StreetKitSystem.js';
import { MutantKitSystem } from './MutantKitSystem.js';
import { TargetFocusSystem } from './TargetFocusSystem.js';
import { FieldDeviceSystem } from './FieldDeviceSystem.js';
import { MartialKitSystem } from './MartialKitSystem.js';
import { ControlKitSystem } from './ControlKitSystem.js';
import { ElementalKitSystem } from './ElementalKitSystem.js';
import { CoastalKitSystem } from './CoastalKitSystem.js';
import { PsychicKitSystem } from './PsychicKitSystem.js';
import { VigilanceKitSystem } from './VigilanceKitSystem.js';
import { MysticKitSystem } from './MysticKitSystem.js';
import { FateKitSystem } from './FateKitSystem.js';
import { DarkfireKitSystem } from './DarkfireKitSystem.js';
import { ArcaneStormKitSystem } from './ArcaneStormKitSystem.js';
import { EnergyReserveKitSystem, ENERGY_PERIOD } from './EnergyReserveKitSystem.js';
import { getLineEndpoint, getLineTargets } from '../utils/LineTargeting.js';
import { getHeroRangePattern, isPointInRangePattern } from '../utils/RangePattern.js';
import { getEffectiveSupportAura, getSupportAuraDisplayState } from './SupportAuraSystem.js';

export const ARC_COOLING_SECONDS = 2;

export class HeroAbilitySystem {
    constructor(hero) {
        this.hero = hero;
        this.attackCount = 0;
        this.arcCharge = 0;
        // Re-deploying must not bypass the reactor's thermal limit.
        this.arcCooling = hero.id === 'iron_man' ? ARC_COOLING_SECONDS : 0;
        this.avengerKit = new AvengerKitSystem(hero);
        this.cosmicKit = new CosmicKitSystem(hero);
        this.streetKit = new StreetKitSystem(hero);
        this.mutantKit = new MutantKitSystem(hero);
        this.focusKit = ['cable', 'nebula', 'mockingbird', 'yelena_belova', 'x_23', 'okoye', 'echo', 'drax', 'angela'].includes(hero.id) ? new TargetFocusSystem(hero) : null;
        this.martialKit = ['valkyrie', 'rogue', 'beast', 'lady_sif', 'white_tiger', 'tigra', 'deadpool', 'devil_dinosaur', 'miles_morales'].includes(hero.id) ? new MartialKitSystem(hero) : null;
        this.fieldDevice = ['rocket_raccoon', 'peni_parker'].includes(hero.id) ? new FieldDeviceSystem(hero) : null;
        this.controlKit = ['quake', 'medusa'].includes(hero.id) ? new ControlKitSystem(hero) : null;
        this.elementalKit = ['iceman', 'crystal', 'namor'].includes(hero.id) ? new ElementalKitSystem(hero) : null;
        this.coastalKit = ['namora', 'triton', 'jeff_the_land_shark', 'luna_snow'].includes(hero.id) ? new CoastalKitSystem(hero) : null;
        this.psychicKit = ['mantis', 'emma_frost', 'nightcrawler', 'cosmo'].includes(hero.id) ? new PsychicKitSystem(hero) : null;
        this.vigilanceKit = ['heimdall', 'squirrel_girl'].includes(hero.id) ? new VigilanceKitSystem(hero) : null;
        this.mysticKit = ['scarlet_witch', 'cloak', 'dagger', 'magik'].includes(hero.id) ? new MysticKitSystem(hero) : null;
        this.fateKit = ['black_cat', 'elsa_bloodstone', 'gambit', 'hela'].includes(hero.id) ? new FateKitSystem(hero) : null;
        this.darkfireKit = ['human_torch', 'the_hood', 'psylocke', 'venom'].includes(hero.id) ? new DarkfireKitSystem(hero) : null;
        this.arcaneStormKit = ['jubilee', 'loki', 'thor', 'doctor_strange'].includes(hero.id) ? new ArcaneStormKitSystem(hero) : null;
        this.energyReserveKit = Object.hasOwn(ENERGY_PERIOD, hero.id) ? new EnergyReserveKitSystem(hero) : null;
    }

    update(dt, enemies, stats, projectiles) {
        this.arcCooling = Math.max(0, this.arcCooling - dt);
        this.avengerKit.update(dt, enemies, stats, projectiles);
        this.cosmicKit.update(dt, enemies, stats, projectiles);
        this.streetKit.update(dt, enemies, stats, projectiles);
        this.mutantKit.update(dt, enemies, stats, projectiles);
    }

    onAttack(target, stats, projectileConfig, projectiles) {
        this.attackCount++;
        this.fieldDevice?.onAttack(projectileConfig);
        this.focusKit?.onAttack(target);
        this.martialKit?.onAttack(target, stats);
        this.controlKit?.onAttack(target, stats);
        this.elementalKit?.onAttack(target, stats);
        this.coastalKit?.onAttack(target, stats);
        this.psychicKit?.onAttack(target, stats);
        this.vigilanceKit?.onAttack(target, stats);
        this.mysticKit?.onAttack(target, stats);
        this.fateKit?.onAttack(target, stats, projectileConfig);
        this.darkfireKit?.onAttack(target, stats);
        this.arcaneStormKit?.onAttack(target, stats);
        this.energyReserveKit?.onAttack(target, stats);
        this.avengerKit.onAttack(target, stats, projectileConfig, projectiles);
        this.cosmicKit.onAttack(target, stats, projectileConfig, projectiles);
        this.streetKit.onAttack(target, stats, projectileConfig, projectiles);
        this.mutantKit.onAttack(target, stats, projectileConfig, projectiles);

        if (this.hero.id === 'iron_man') {
            this.hero.game.audio?.play('repulsor');
            this.arcCharge = Math.min(this.getArcInterval(), this.arcCharge + 1);
            if (this.arcCharge >= this.getArcInterval() && this.arcCooling <= 1e-9
                && this.activateArcOverload(target, stats)) {
                this.arcCharge = 0;
                this.arcCooling = ARC_COOLING_SECONDS;
            }
        }

        if (this.hero.id === 'spiderman') { this.webTarget = target; this.hero.game.audio?.play('web'); }
        if (this.hero.id === 'capitan_america') this.hero.game.audio?.play('shield');
    }

    getAttackEffects(target) {
        const effects = [...this.avengerKit.getAttackEffects(target), ...this.cosmicKit.getAttackEffects(target), ...this.streetKit.getAttackEffects(target), ...this.mutantKit.getAttackEffects(target)];
        effects.push(...(this.focusKit?.attackEffects(target) || []));
        effects.push(...(this.coastalKit?.attackEffects(target) || []));
        effects.push(...(this.psychicKit?.attackEffects(target) || []));
        effects.push(...(this.mysticKit?.attackEffects(target) || []));
        effects.push(...(this.fateKit?.attackEffects(target) || []));
        effects.push(...(this.darkfireKit?.attackEffects(target) || []));
        if (this.hero.id === 'spiderman') {
            const evolved = this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'iron_spider';
            effects.push({ type: 'web', duration: evolved ? 3.2 : 2.6, power: evolved ? 0.28 : 0.2, chance: 1 });
        }
        return effects;
    }

    applyStatModifiers(stats) {
        this.martialKit?.applyStats(stats);
        this.avengerKit.applyStatModifiers(stats);
        this.cosmicKit.applyStatModifiers(stats);
        this.streetKit.applyStatModifiers(stats);
        return this.mutantKit.applyStatModifiers(stats);
    }

    getAttackDamageMultiplier(target) {
        return this.avengerKit.getAttackDamageMultiplier()
            * this.mutantKit.getAttackDamageMultiplier()
            * this.streetKit.getAttackDamageMultiplier(target)
            * (this.focusKit?.damageMultiplier(target) || 1)
            * (this.martialKit?.damageMultiplier(target) || 1)
            * (this.elementalKit?.damageMultiplier() || 1)
            * (this.coastalKit?.damageMultiplier(target) || 1)
            * (this.mysticKit?.damageMultiplier(target) || 1)
            * (this.fateKit?.damageMultiplier(target) || 1)
            * (this.darkfireKit?.damageMultiplier(target) || 1)
            * (this.energyReserveKit?.damageMultiplier() || 1)
            * (this.fieldDevice?.damageMultiplier() || 1);
    }

    activateArcOverload(target, stats) {
        if (!target?.isAlive || (target.stealth && !stats.canSeeStealth)) return false;
        const targets = getLineTargets(
            this.hero,
            target,
            (this.hero.game.enemies || []).filter((enemy) => !enemy.stealth || stats.canSeeStealth),
            stats.range * 1.2,
            24
        );
        if (!targets.length) return false;
        const endpoint = getLineEndpoint(this.hero, target, stats.range * 1.2);
        const damage = stats.damage * 0.9 * this.getPowerScale();

        targets.forEach((enemy) => CombatSystem.applyDamage({
            attackerType: this.hero.category,
            damage,
            armorPenetration: 0.35
        }, enemy, this.hero, this.hero.game.resourceManager, 1));

        this.hero.game.vfx?.addBeam(this.hero, endpoint, { color: '#42dcff', width: 12, duration: 0.24 });
        this.hero.game.audio?.play('arc');
        this.hero.recordAbility();
        return true;
    }

    getTargetsInRange(enemies, range, stats = this.hero.getEffectiveStats()) {
        const pattern = getHeroRangePattern(this.hero);
        return enemies.filter((enemy) => enemy.isAlive
            && (!enemy.stealth || stats.canSeeStealth)
            && isPointInRangePattern(this.hero, enemy, range, pattern, stats.rangeGeometryScale));
    }

    getArcInterval() {
        return this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'iron_man_extremis' ? 2 : 3;
    }

    getPowerScale() {
        const progression = this.hero.game.progression?.getHeroBonuses(this.hero.id);
        const synergy = this.hero.game.teamSynergy?.getAbilityModifiers(this.hero);
        return 1 + Math.min(0.4, Math.max(0, this.hero.level - 1) * 0.04) + (progression?.abilityPower || 0) + (synergy?.abilityPower || 0);
    }

    getDisplayState() {
        if (this.energyReserveKit) return this.energyReserveKit.getDisplayState();
        if (this.martialKit) return this.martialKit.getDisplayState();
        if (this.controlKit) return this.controlKit.getDisplayState();
        if (this.elementalKit) return this.elementalKit.getDisplayState();
        if (this.coastalKit) return this.coastalKit.getDisplayState();
        if (this.psychicKit) return this.psychicKit.getDisplayState();
        if (this.vigilanceKit) return this.vigilanceKit.getDisplayState();
        if (this.mysticKit) return this.mysticKit.getDisplayState();
        if (this.fateKit) return this.fateKit.getDisplayState();
        if (this.darkfireKit) return this.darkfireKit.getDisplayState();
        if (this.arcaneStormKit) return this.arcaneStormKit.getDisplayState();
        if (this.fieldDevice) return this.fieldDevice.getDisplayState();
        if (this.focusKit) return this.focusKit.getDisplayState();
        const aura = getEffectiveSupportAura(this.hero);
        if (aura?.type) {
            const networkState = getSupportAuraDisplayState(this.hero);
            if (networkState) return networkState;
            const labels = { damage: 'Daño', fireRate: 'Cadencia', range: 'Alcance' };
            return { label: `${labels[aura.type] || 'Aura'} +${Math.round((aura.power || 0) * 100)}%`, progress: null, ready: true };
        }
        if (this.hero.id === 'iron_man') {
            const interval = this.getArcInterval();
            const charge = Math.min(interval, this.arcCharge);
            if (this.arcCooling > 1e-9) return {
                label: `ARC ${charge}/${interval} · Enfriando ${this.arcCooling.toFixed(1)} s`,
                progress: 1 - this.arcCooling / ARC_COOLING_SECONDS, ready: false
            };
            return { label: `Carga ARC ${charge}/${interval}`, progress: charge / interval, ready: charge >= interval - 1 };
        }
        if (this.hero.id === 'spiderman') {
            const threshold = this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'iron_spider' ? 2 : 3;
            const target = this.webTarget;
            const stacks = target?.isAlive ? target.debuffs?.find(effect => effect.type === 'web' && effect.duration > 0)?.stacks || 0 : 0;
            const cooldown = target?.isAlive ? target.webBindCooldown || 0 : 0;
            return { label: `Redes ${stacks}/${threshold}${cooldown > 0 ? ` | Resistencia ${cooldown.toFixed(1)}s` : ''}`,
                progress: Math.min(1, stacks / threshold), ready: stacks >= threshold - 1 && cooldown === 0 };
        }
        return this.avengerKit.getDisplayState() || this.cosmicKit.getDisplayState() || this.streetKit.getDisplayState() || this.mutantKit.getDisplayState();
    }

    getControlState() {
        if (this.psychicKit?.getControlState()) return this.psychicKit.getControlState();
        return this.avengerKit.getControlState() || this.cosmicKit.getControlState() || this.streetKit.getControlState() || this.mutantKit.getControlState();
    }

    setCombatMode(mode) {
        if (this.psychicKit?.setMode(mode)) return true;
        return this.avengerKit.setMode(mode) || this.cosmicKit.setMode(mode) || this.streetKit.setMode(mode) || this.mutantKit.setMode(mode);
    }

    getCombatMode() {
        if (this.hero.id === 'emma_frost') return this.psychicKit.mode;
        return this.avengerKit.getMode() || this.cosmicKit.getMode() || this.streetKit.getMode() || this.mutantKit.getMode();
    }

    getProjectileProfile() {
        const profile = { ...this.avengerKit.getProjectileProfile(), ...this.cosmicKit.getProjectileProfile(), ...this.streetKit.getProjectileProfile(), ...this.mutantKit.getProjectileProfile(), ...this.martialKit?.getProjectileProfile() };
        Object.assign(profile, this.energyReserveKit?.getProjectileProfile());
        if (this.hero.game.progression?.getHeroEvolution?.(this.hero.id)?.id === 'iron_spider') profile.armorPenetration = 0.3;
        return profile;
    }

    getProjectileColor() {
        if (this.hero.id === 'crystal' && this.elementalKit.cooldown === 0) return ['#f97316', '#a7f3ff', '#fff19c'][this.elementalKit.element];
        return this.avengerKit.getProjectileColor() || this.cosmicKit.getProjectileColor() || this.streetKit.getProjectileColor() || this.mutantKit.getProjectileColor();
    }

    getProjectileVisualStyle() {
        if (this.hero.id === 'deadpool') return this.martialKit.weapon === 1 ? 'blade' : 'ballistic';
        return this.avengerKit.getProjectileVisualStyle() || this.cosmicKit.getProjectileVisualStyle() || this.streetKit.getProjectileVisualStyle() || this.mutantKit.getProjectileVisualStyle();
    }

    render(ctx) {
        this.energyReserveKit?.render(ctx);
        this.fieldDevice?.render(ctx);
        this.controlKit?.render(ctx);
        this.coastalKit?.render(ctx);
        this.psychicKit?.render(ctx);
        this.vigilanceKit?.render(ctx);
        this.mysticKit?.render(ctx);
        this.fateKit?.render(ctx);
        this.darkfireKit?.render(ctx);
        this.arcaneStormKit?.render(ctx);
        this.avengerKit.render(ctx);
        this.cosmicKit.render(ctx);
        this.streetKit.render(ctx);
        this.mutantKit.render(ctx);
    }

    onKill(target) {
        this.fateKit?.onKill(target);
        this.focusKit?.onKill(target);
        this.cosmicKit.onKill();
        this.streetKit.onKill(target);
        this.mutantKit.onKill(target);
    }

    static getLineEndpoint(origin, target, distance) {
        return getLineEndpoint(origin, target, distance);
    }

    static getLineTargets(origin, target, enemies, distance, width) {
        return getLineTargets(origin, target, enemies, distance, width);
    }
}
