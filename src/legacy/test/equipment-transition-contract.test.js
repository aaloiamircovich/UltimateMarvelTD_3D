import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Projectile } from '../src/entities/Projectile.js';
import { ProgressionManager } from '../src/systems/ProgressionManager.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { ITEM_SIGNATURES, buildSignatureAttackContext, resolveSignatureAfterAttack } from '../src/systems/ItemSignatureSystem.js';
import { resolveStatusDamage } from '../src/utils/StatusDamage.js';

const data = Object.fromEntries(['heroes', 'items', 'enemies', 'levels'].map(key => [key,
    JSON.parse(fs.readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf8'))]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(ids) {
    const game = { heroes: [], enemies: [], currentLevel: { id: 'level_1' }, random: { next: () => 0 },
        audio: { setEnabled() {}, play() {} }, resourceManager: { lives: 20, maxLives: 20 } };
    const values = new Map();
    const manager = new ProgressionManager({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
    manager.initialize(game, structuredClone(data)); game.progression = manager;
    manager.state.unlockedHeroIds = [...ids]; manager.state.activeTeamIds = [...ids];
    for (const id of ids) manager.setHeroLevel(id, 100, { sync: false, save: false });
    game.heroes = ids.map(id => new Hero(manager.data.heroes[id], 0, 0, game)); manager.syncGame();
    const hero = game.heroes[0];
    const equip = (id, itemId) => {
        if (!manager.hasItem(itemId)) manager.state.ownedItemIds.push(itemId);
        assert.equal(manager.equipItem(id, itemId), true);
    };
    const spawn = () => {
        const stats = hero.getEffectiveStats(), diagonal = hero.rangePattern === 'x';
        const x = stats.range * (diagonal ? 0.45 : 0.65), y = diagonal ? x : 0;
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e9, speed: 0 }, [{ x, y }, { x: x + 1000, y }], game);
        game.enemies.push(enemy); return enemy;
    };
    return { game, manager, hero, equip, spawn };
}

for (const id of Object.keys(data.heroes)) {
    test(`${id}: cambiar equipo limpia reservas de objetos, sincronizar no reinicia kit`, () => {
        const f = setup([id]); f.equip(id, 'reactor_arc');
        const state = { count: 9, extraShots: 3, timedBuff: { remaining: 3 }, critBonus: 25 };
        f.hero.signatureState.reactor_arc = state; f.hero.consecutiveHits = 8; f.hero.lastTargetId = 'target';
        f.hero.abilitySystem.attackCount = 7;
        f.manager.syncGame(); assert.equal(f.hero.signatureState.reactor_arc, state);
        f.equip(id, 'reactor_arc'); assert.equal(f.hero.signatureState.reactor_arc, state);
        f.equip(id, 'lentes_edith'); assert.deepEqual(f.hero.signatureState, {});
        assert.equal(f.hero.consecutiveHits, 0); assert.equal(f.hero.lastTargetId, null);
        assert.equal(f.hero.abilitySystem.attackCount, 7); assert.equal(f.hero.level, 100);
        assert.equal(f.manager.getHeroEvolution(id).levelEvolved, true);
    });
}

for (const [itemId, signatures] of Object.entries(ITEM_SIGNATURES)) for (const [id, config] of Object.entries(signatures)) {
    test(`${id}/${itemId}: quitar y reequipar no recupera reserva de firma`, () => {
        const f = setup([id]); f.equip(id, itemId); const target = f.spawn();
        const count = Number.isFinite(config.interval) ? config.interval + 3 : 12;
        for (let i = 0; i < count; i++) {
            const context = buildSignatureAttackContext(f.hero, target, f.hero.getEffectiveStats());
            resolveSignatureAfterAttack(f.hero, target, context.stats, {}, [], context);
        }
        assert.ok(f.hero.signatureState[itemId]);
        assert.equal(f.manager.unequipItem(id), true);
        assert.deepEqual(f.hero.signatureState, {});
        f.equip(id, itemId);
        assert.deepEqual(f.hero.signatureState, {});
        assert.equal(f.manager.getHeroLevel(id), 100);
    });
}

test('transferir objeto entre heroes limpia ambos estados sin duplicar inventario', () => {
    const f = setup(['vision', 'winter_soldier']); f.equip('vision', 'nucleo_adaptativo');
    const [a, b] = f.game.heroes;
    a.signatureState.nucleo_adaptativo = { extraShots: 3, count: 9 };
    b.signatureState.nucleo_adaptativo = { count: 9 };
    assert.equal(f.manager.equipItem('winter_soldier', 'nucleo_adaptativo'), true);
    assert.deepEqual(a.items, []); assert.equal(b.items[0].id, 'nucleo_adaptativo');
    assert.deepEqual(a.signatureState, {}); assert.deepEqual(b.signatureState, {});
    assert.equal(f.manager.state.ownedItemIds.filter(id => id === 'nucleo_adaptativo').length, 0);
});

test('loadout distinto invalida reservas; loadout identico conserva progreso', () => {
    const f = setup(['vision']); f.equip('vision', 'nucleo_adaptativo'); f.manager.saveLoadout('vision');
    f.hero.signatureState.nucleo_adaptativo = { count: 8 }; f.manager.applyLoadout('vision');
    assert.equal(f.hero.signatureState.nucleo_adaptativo.count, 8);
    f.equip('vision', 'reactor_arc'); f.hero.signatureState.reactor_arc = { count: 9 };
    f.manager.applyLoadout('vision'); assert.deepEqual(f.hero.signatureState, {});
});

test('Captain conserva snapshot de preparacion y recarga al cambiar objeto', () => {
    const f = setup(['captain_marvel']); f.equip('captain_marvel', 'reactor_arc'); const target = f.spawn();
    const kit = f.hero.abilitySystem.cosmicKit; kit.resource = 60;
    kit.update(9, f.game.enemies, f.hero.getEffectiveStats()); const run = kit.binaryRun;
    assert.ok(run); const damage = run.damage;
    f.manager.unequipItem('captain_marvel'); assert.equal(kit.binaryRun, run); assert.equal(kit.cooldownRemaining, 9);
    kit.update(0.45, f.game.enemies, f.hero.getEffectiveStats()); close(target.maxHp - target.hp, damage);
});

for (const id of ['human_torch', 'sentry']) test(`${id}: DoT emitido no cambia al quitar o colocar objeto`, () => {
    for (const initiallyEquipped of [false, true]) {
        const f = setup([id]); if (initiallyEquipped) f.equip(id, 'reactor_arc');
        const target = f.spawn(), shots = []; const before = f.hero.getEffectiveStats().damage;
        f.hero.shoot(target, f.hero.getEffectiveStats(), shots);
        const shot = shots[0], burn = shot.effects.find(e => e.type === 'burn' && e.damageBasis === 'attackDamage');
        assert.ok(burn); close(burn.attackDamageSnapshot, before);
        if (initiallyEquipped) f.manager.unequipItem(id); else f.equip(id, 'reactor_arc');
        CombatSystem.applyImpact(shot, target, f.hero, f.game.resourceManager);
        const applied = target.debuffs.find(e => e.type === 'burn'); close(applied.damagePerSecond, before * burn.power);
    }
});

test('pool captura nuevo poder sin mutar plantilla de efecto; porcentaje de HP sigue por blanco', () => {
    const effect = { type: 'burn', damageBasis: 'attackDamage', power: 0.3, duration: 2 };
    const attacker = { damage: 100 }; const shot = new Projectile(0, 0, {}, { attacker, effects: [effect] });
    close(shot.effects[0].attackDamageSnapshot, 100); assert.equal(effect.attackDamageSnapshot, undefined);
    attacker.damage = 200; shot.reset(0, 0, {}, { attacker, effects: [effect] });
    close(shot.effects[0].attackDamageSnapshot, 200);
    close(resolveStatusDamage({ type: 'poison', damageBasis: 'maxHealth', power: 0.01 }, { maxHp: 1000 }, attacker).damagePerSecond, 10);
    close(resolveStatusDamage({ type: 'burn', damageBasis: 'flat', power: 7 }, {}, attacker).damagePerSecond, 7);
    shot.reset(0, 0, {}, {}); assert.deepEqual(shot.effects, []);
});

test('objetos al impacto pertenecen al disparo original, no al equipo actual', () => {
    const f = setup(['human_torch']), target = f.spawn(); target.reward = 100;
    const incomeItem = Object.values(data.items).find(item => item.effects?.onHitCreditPct);
    const attacker = f.hero;
    attacker.items = [structuredClone(incomeItem)];
    const emitted = new Projectile(0, 0, target, { attacker, damage: 1 });
    attacker.items[0].effects.onHitCreditPct = 1; attacker.items = [];
    let credits = 0; const resource = { addCredits(n) { credits += n; } };
    CombatSystem.applyImpact(emitted, target, attacker, resource);
    assert.equal(credits, Math.ceil(100 * incomeItem.effects.onHitCreditPct));
    const unarmed = new Projectile(0, 0, target, { attacker, damage: 1 });
    attacker.items = [incomeItem]; credits = 0;
    CombatSystem.applyImpact(unarmed, target, attacker, resource); assert.equal(credits, 0);
    emitted.reset(0, 0, target, { damage: 1 }); assert.equal(emitted.impactItems, null);
});
