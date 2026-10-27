import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hero } from '../src/entities/Hero.js';
import { Enemy } from '../src/entities/Enemy.js';
import { CombatSystem } from '../src/systems/CombatSystem.js';
import { getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const roster = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

function setup(id = 'domino', level = 1, reward = 80) {
    let hero;
    const game = {
        heroes: [], enemies: [], projectiles: [], random: { next: () => 0.99 },
        resourceManager: { lives: 15, credits: 0, addCredits(n) { this.credits += n; } },
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => hero ? getEvolutionForHero(hero.config, {}, {
                level: hero.level, equippedItemIds: hero.items.map((item) => item.id)
            }) : null
        }
    };
    hero = new Hero({ ...roster[id], level }, 0, 0, game);
    game.heroes = [hero];
    const spawn = (x = 40, extra = {}) => {
        const enemy = new Enemy({ id: 'target', category: hero.category, hp: 1e9, speed: 1, reward, ...extra },
            [{ x, y: 0 }, { x: 3000, y: 0 }], game);
        game.enemies.push(enemy);
        return enemy;
    };
    const target = spawn();
    const shoot = () => {
        const shots = [];
        hero.shoot(target, hero.getEffectiveStats(), shots);
        return shots;
    };
    const money = (expected) => {
        assert.equal(game.resourceManager.credits, expected);
        assert.equal(hero.combatStats.goldGenerated, expected);
        assert.equal(game.resourceManager.lives, 15);
    };
    return { game, hero, target, spawn, shoot, money };
}

test('Domino es la unica economia nativa del roster y conserva 15%', () => {
    assert.deepEqual(Object.values(roster).filter((h) => h.special?.economyOnHit).map((h) => h.id), ['domino']);
    assert.equal(roster.domino.special.economyOnHit.rewardPct, 0.15);
});

for (const level of [1, 49, 50, 100]) {
    test(`Domino nivel ${level}: paga por disparo antes del impacto, sin escalar el porcentaje`, () => {
        const f = setup('domino', level);
        const [shot] = f.shoot();
        f.money(12);
        assert.equal(f.target.hp, f.target.maxHp);
        CombatSystem.applyImpact(shot, f.target, f.hero, f.game.resourceManager);
        f.money(12);
        f.shoot();
        f.money(24);
    });
    test(`Shang-Chi nivel ${level}: tres patrones sin ingreso oculto`, () => {
        const f = setup('shang_chi', level);
        for (const mode of ['orbit', 'volley', 'guard']) {
            assert.equal(f.hero.abilitySystem.setCombatMode(mode), true);
            for (let i = 0; i < 12; i++) f.shoot();
            f.money(0);
        }
        assert.ok(f.hero.getEffectiveStats().fireRate > f.hero.fireRate);
        assert.ok(f.hero.getEffectiveStats().damage > 0);
    });
}

for (const reward of [1, 7, 80, 101, 0, -1, Infinity, NaN]) {
    test(`recompensa ${reward}: redondeo y valores invalidos no corrompen dinero`, () => {
        const f = setup();
        f.target.reward = reward;
        f.shoot();
        f.money(Number.isFinite(reward) && reward > 0 ? Math.ceil(reward * 0.15) : 0);
    });
}

test('recompensa final del enemigo prevalece sobre la base del catalogo', () => {
    const f = setup();
    f.target.config.reward = 10;
    f.target.reward = 200;
    f.shoot();
    f.money(30);
});

test('splash, rebotes, propagacion y DoT no repiten el 15%', () => {
    const f = setup();
    f.spawn(45);
    f.spawn(50);
    const [shot] = f.shoot();
    Object.assign(shot, { splashRadius: 100, splashFactor: 0.5, chainCount: 2, chainRange: 100,
        chainFactor: 0.5, propagationCount: 2, propagationRadius: 100, propagationFactor: 0.5,
        effects: [{ type: 'poison', power: 0.001, duration: 3, chance: 1 }] });
    const result = CombatSystem.applyImpact(shot, f.target, f.hero, f.game.resourceManager);
    assert.equal(result.hits, 7);
    for (const enemy of f.game.enemies) enemy.updateDebuffs(1);
    assert.ok(f.game.enemies.every((enemy) => enemy.hp < enemy.maxHp));
    f.money(12);
});

test('proyectil perdido y retorno no generan un segundo pago ni reembolsan el disparo', () => {
    const f = setup();
    const [lost] = f.shoot();
    f.target.isAlive = false;
    lost.update(1);
    assert.equal(lost.isActive, false);
    f.money(12);
    f.target.isAlive = true;
    const [returning] = f.shoot();
    returning.returning = true;
    returning.x = f.target.x;
    returning.update(0.1);
    returning.x = f.hero.x;
    returning.update(0.1);
    assert.equal(returning.isActive, false);
    f.money(24);
});

test('sin blanco, fuera de alcance o aturdida no cobra por actualizarse', () => {
    const f = setup();
    f.hero.update(2, [], []);
    f.money(0);
    f.target.x = 3000;
    f.hero.update(2, [f.target], []);
    f.money(0);
    f.target.x = 40;
    f.hero.applyStun(3);
    f.hero.update(1, [f.target], []);
    f.money(0);
});

test('enemigo controlado: sin tope oculto y pago exactamente igual a disparos reales', () => {
    const f = setup();
    f.target.applyStatus({ type: 'stun', power: 1, duration: 60 }, f.hero);
    for (let frame = 0; frame < 3600; frame++) f.hero.update(1 / 60, [f.target], f.game.projectiles);
    assert.ok(f.hero.combatStats.shots > 50);
    f.money(f.hero.combatStats.shots * 12);
});

for (const itemId of ['contrato_stark', 'moneda_madripoor']) {
    test(`${itemId}: ingreso de objeto separado al impacto, sin repetir ingreso nativo`, () => {
        const f = setup('domino', 50, 100);
        f.hero.items = [items[itemId]];
        const [shot] = f.shoot();
        f.money(15);
        CombatSystem.applyImpact(shot, f.target, f.hero, f.game.resourceManager);
        f.money(15 + Math.ceil(items[itemId].effects.onHitCreditPct * 100));
    });
}

test('Doble Suerte: critico suma bonus de firma una vez y no otro 15% por proyectil extra', () => {
    const f = setup('domino', 50, 100);
    f.hero.items = [items.matriz_probabilidad];
    f.game.random.next = () => 0;
    const shots = f.shoot();
    assert.equal(shots.length, 2);
    assert.equal(f.hero.combatStats.shots, 1);
    f.money(27);
    for (const shot of shots) CombatSystem.applyImpact(shot, f.target, f.hero, f.game.resourceManager);
    f.money(27);
});
