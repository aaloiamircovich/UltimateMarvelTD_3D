import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { ProgressionManager } from '../src/systems/ProgressionManager.js';
import { getEffectiveSupportAura, getMentalLinks, recordSupportAttack } from '../src/systems/SupportAuraSystem.js';
import { ENERGY_PERIOD } from '../src/systems/EnergyReserveKitSystem.js';

const data = Object.fromEntries(['heroes', 'items', 'enemies', 'levels'].map(key => [key,
    JSON.parse(fs.readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf8'))]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function setup(id, level = 49) {
    const values = new Map();
    const manager = new ProgressionManager({ getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value) });
    const game = { heroes: [], enemies: [], currentLevel: { id: 'level_1' },
        audio: { setEnabled() {}, play() {} }, resourceManager: { lives: 20, maxLives: 20 } };
    manager.initialize(game, structuredClone(data)); game.progression = manager;
    manager.state.unlockedHeroIds = [id]; manager.state.activeTeamIds = [id];
    manager.setHeroLevel(id, level, { sync: false, save: false });
    const support = new Hero(manager.data.heroes[id], 0, 0, game);
    game.heroes.push(support); manager.syncGame();
    const add = x => {
        const ally = new Hero({ id: `ally-${game.heroes.length}`, damage: 100, fireRate: 1, range: 100 }, x, 0, game);
        game.heroes.push(ally); return ally;
    };
    return { game, manager, support, add };
}

for (const level of [1, 49, 50, 99, 100]) {
    for (const count of [1, 3, 5]) {
        test(`Profesor X ${level}/${count} aliados: preview al entrar coincide con colocacion real sin mutar enlaces`, () => {
            const f = setup('profesor_x', level);
            for (let n = 0; n < count; n++) f.add(20 + n);
            const moving = f.add(1000);
            const links = getMentalLinks(f.support);
            const liveRate = f.game.heroes[1].getEffectiveStats().fireRate;
            const preview = moving.getEffectiveStats({ x: 50, y: 0 });
            assert.equal(moving.x, 1000);
            assert.deepEqual(getMentalLinks(f.support), links);
            close(f.game.heroes[1].getEffectiveStats().fireRate, liveRate);
            moving.x = 50;
            close(preview.fireRate, moving.getEffectiveStats().fireRate);
            assert.ok(preview.fireRate > 1);
            const outside = moving.getEffectiveStats({ x: 1000, y: 0 });
            close(outside.fireRate, 1);
            assert.equal(getMentalLinks(f.support).length, count + 1);
        });
    }
}

const supports = Object.values(data.heroes).filter(hero => hero.special?.supportAura?.type);
for (const id of Object.keys(ENERGY_PERIOD)) {
    for (const level of [49, 99]) {
        test(`${id} ${level}: sincronizar evolucion y objetos conserva reserva nativa preparada`, () => {
            const f = setup(id, level), hero = f.support, kit = hero.abilitySystem.energyReserveKit;
            const target = { x: 70, y: 0, isAlive: true, hasReachedEnd: false };
            if (id === 'adam_warlock') kit.update(12);
            else {
                kit.update(10);
                const stats = hero.getEffectiveStats();
                if (id === 'magneto') for (let n = 0; n < 2; n++) kit.onBarrierBroken({});
                else if (['ms_marvel', 'yondu', 'beta_ray_bill'].includes(id)) {
                    const projectile = {};
                    kit.prepareProjectile(projectile, target, stats);
                    kit.onImpact(projectile, target);
                } else for (let n = 0; n < 2; n++) kit.onAttack(target, stats);
            }
            const snapshot = () => ({ charge: kit.charge, cooldown: kit.cooldown,
                idle: kit.idle, burst: kit.burst, exhaustion: kit.exhaustion,
                pending: kit.pending, route: kit.route, flight: kit.flight, target: kit.target });
            const before = structuredClone(snapshot());
            assert.ok(kit.charge > 0 || kit.pending || kit.route);
            f.manager.setHeroLevel(id, level + 1);
            f.manager.state.ownedItemIds.push('reactor_arc', 'lentes_edith');
            for (const itemId of ['reactor_arc', 'lentes_edith', null]) {
                if (itemId) assert.equal(f.manager.equipItem(id, itemId), true);
                else assert.equal(f.manager.unequipItem(id), true);
                f.manager.syncGame();
                assert.deepEqual(snapshot(), before);
            }
            assert.equal(hero.level, level + 1);
            assert.equal(f.game.resourceManager.lives, 20);
        });
    }
}

for (const config of supports) {
    for (const level of [49, 99]) {
        test(`${config.id} ${level}: evolucion y equipo conservan ciclo, no disparan ni curan`, () => {
            const f = setup(config.id, level), ally = f.add(30);
            ally.id = 'hawkeye';
            ally.config = data.heroes.hawkeye;
            f.manager.state.unlockedHeroIds.push('hawkeye');
            f.manager.state.activeTeamIds.push('hawkeye');
            f.support.update(config.id === 'wong' ? 4.5 : config.id === 'wasp' ? 6.5 : 9, [], []);
            if (config.id === 'black_panther') for (let n = 0; n < 6; n++) recordSupportAttack(ally);
            const before = structuredClone({ pulse: f.support.supportPulseState, network: f.support.supportNetworkState });
            const aura = getEffectiveSupportAura(f.support);
            const expectedRange = getEffectiveSupportAura(f.support, { level: level + 1 }).range;
            f.manager.setHeroLevel(config.id, level + 1);
            const evolved = getEffectiveSupportAura(f.support);
            assert.ok(evolved.power >= aura.power);
            close(evolved.range, expectedRange);
            f.manager.state.ownedItemIds.push('reactor_arc', 'lentes_edith');
            for (const itemId of ['reactor_arc', 'lentes_edith', null]) {
                if (itemId) assert.equal(f.manager.equipItem(config.id, itemId), true);
                else assert.equal(f.manager.unequipItem(config.id), true);
                assert.deepEqual({ pulse: f.support.supportPulseState, network: f.support.supportNetworkState }, before);
                close(getEffectiveSupportAura(f.support).power, evolved.power);
                const shots = [];
                f.support.shoot({ x: 40, y: 0 }, f.support.getEffectiveStats(), shots);
                assert.equal(shots.length, 0);
            }
            assert.equal(f.support.level, level + 1);
            assert.equal(f.support.combatStats.damageDealt, 0);
            assert.equal(f.game.resourceManager.lives, 20);
        });
    }
}
