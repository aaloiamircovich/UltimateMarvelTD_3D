import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TOTAL_COOLDOWN_REDUCTION, applyCooldownReductions, getSpecialCooldownReduction } from '../src/utils/AbilityModifiers.js';

test('applyCooldownReductions combina fuentes pequenas y limita acumulaciones extremas', () => {
    const hero = {
        id: 'loki',
        config: { special: { statModifiers: { cooldown: 0.04 } } },
        game: {
            progression: { getHeroBonuses: () => ({ cooldown: 0.1 }) },
            teamSynergy: { getAbilityModifiers: () => ({ cooldown: 0.05 }) }
        }
    };
    const stackedHero = {
        id: 'thor',
        config: { special: { statModifiers: { cooldown: 0.5 } } },
        game: {
            progression: { getHeroBonuses: () => ({ cooldown: 0.75 }) },
            teamSynergy: { getAbilityModifiers: () => ({ cooldown: 0.75 }) }
        }
    };

    assert.equal(Number(applyCooldownReductions(hero, 10).toFixed(3)), 8.208);
    assert.equal(applyCooldownReductions(stackedHero, 10, 0.5), 10 * (1 - MAX_TOTAL_COOLDOWN_REDUCTION));
});

test('getSpecialCooldownReduction ignora valores invalidos y limita reducciones extremas', () => {
    assert.equal(getSpecialCooldownReduction({ config: { special: { statModifiers: { cooldown: 'nope' } } } }), 0);
    assert.equal(getSpecialCooldownReduction({ config: { special: { statModifiers: { cooldown: 2 } } } }), 0.5);
});
