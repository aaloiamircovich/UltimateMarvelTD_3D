import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    isStarterEligible,
    RECOMMENDED_STARTER_IDS,
    scoreStarterHero,
    selectStarterHeroes
} from '../src/utils/StarterSelection.js';

const realHeroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

const hero = (overrides) => ({
    id: 'hero',
    name: 'Hero',
    rarity: 'Common',
    cost: 200,
    damage: 20,
    fireRate: 1.4,
    range: 140,
    visual: { idle: 'hero.png' },
    teamMetrics: { damage: 3, control: 3, detection: 2 },
    ...overrides
});

test('selectStarterHeroes mantiene tres opciones comunes recomendadas', () => {
    const heroes = {
        iron_man: hero({ id: 'iron_man', name: 'Iron Man', rarity: 'Legendary', damage: 60 }),
        black_widow: hero({ id: 'black_widow', name: 'Black Widow', canSeeStealth: true, formationRole: 'support' }),
        hawkeye: hero({ id: 'hawkeye', name: 'Hawkeye', range: 220, formationRole: 'artillery' }),
        korg: hero({
            id: 'korg',
            name: 'Korg',
            damage: 39,
            range: 85,
            formationRole: 'vanguard',
            special: { projectileProfile: { splashRadius: 48 } }
        }),
        shuri: hero({ id: 'shuri', name: 'Shuri', damage: 28, range: 210 })
    };

    assert.deepEqual(RECOMMENDED_STARTER_IDS, ['black_widow', 'hawkeye', 'korg']);
    assert.deepEqual(selectStarterHeroes(heroes).map((entry) => entry.id), ['black_widow', 'hawkeye', 'korg']);
});

test('selector inicial usa el roster real con tres comunes sin auras puras', () => {
    const selected = selectStarterHeroes(realHeroes);
    const ids = selected.map((entry) => entry.id);

    assert.deepEqual(ids, RECOMMENDED_STARTER_IDS);
    assert.equal(selected.length, 3);
    assert.equal(selected.every((entry) => entry.rarity === 'Common'), true);
    assert.equal(selected.every((entry) => !entry.special?.supportAura), true);
    assert.equal(ids.includes('iron_man'), false);
    assert.equal(ids.includes('capitan_america'), false);
});

test('selectStarterHeroes filtra rarezas altas, auras puras y heroes sin visual', () => {
    const selected = selectStarterHeroes({
        rare_carry: hero({ id: 'rare_carry', rarity: 'Rare', damage: 80 }),
        aura_bot: hero({ id: 'aura_bot', supportAura: { type: 'damage', power: 0.2 } }),
        invisible: hero({ id: 'invisible', visual: null, sprite: '' }),
        punisher: hero({ id: 'punisher', name: 'Punisher', damage: 24, range: 190, formationRole: 'artillery' }),
        yelena: hero({ id: 'yelena', name: 'Yelena', canSeeStealth: true, formationRole: 'support' }),
        groot: hero({ id: 'groot', name: 'Groot', damage: 45, fireRate: 0.7, formationRole: 'vanguard' })
    });

    assert.deepEqual(selected.map((entry) => entry.id), ['yelena', 'punisher', 'groot']);
    assert.equal(selected.every(isStarterEligible), true);
});

test('scoreStarterHero premia control temprano y deteccion sin depender de rareza', () => {
    const detector = hero({ id: 'detector', canSeeStealth: true, teamMetrics: { damage: 2, control: 3, detection: 5 } });
    const plain = hero({ id: 'plain', canSeeStealth: false, teamMetrics: { damage: 2, control: 3, detection: 0 } });

    assert.ok(scoreStarterHero(detector) > scoreStarterHero(plain));
});
