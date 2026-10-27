import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_RARITIES } from '../src/utils/Rarity.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

test('heroes usan las seis rarezas auditadas', () => {
    const counts = Object.values(heroes).reduce((acc, hero) => {
        acc[hero.rarity] = (acc[hero.rarity] || 0) + 1;
        return acc;
    }, {});

    assert.deepEqual(Object.keys(counts).sort(), [...HERO_RARITIES].sort());
    assert.deepEqual(counts, {
        Common: 30,
        Rare: 26,
        Epic: 24,
        Legendary: 16,
        Mythic: 8,
        Secret: 1
    });
});

test('heroes clave quedan en rarezas coherentes con su poder y habilidad', () => {
    assert.equal(heroes.spiderman.rarity, 'Epic');
    assert.equal(heroes.iron_man.rarity, 'Legendary');
    assert.equal(heroes.hulk.rarity, 'Mythic');
    assert.equal(heroes.thor.rarity, 'Mythic');
    assert.equal(heroes.silver_surfer.rarity, 'Mythic');
    assert.equal(heroes.scarlet_witch.rarity, 'Secret');
    assert.equal(heroes.loki.rarity, 'Legendary');
    assert.equal(heroes.profesor_x.rarity, 'Mythic');
});

test('presupuesto de DPS base sube por rareza sin contar soportes puros', () => {
    const medians = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret']
        .map((rarity) => {
            const values = Object.values(heroes)
                .filter((hero) => hero.rarity === rarity && !hero.special?.supportAura)
                .map((hero) => Math.round(Number(hero.damage || 0) * Number(hero.fireRate || 1) * (1 + Number(hero.critChance ?? 5) / 100)));
            return median(values);
        });

    for (let index = 1; index < medians.length; index++) {
        assert.ok(medians[index] > medians[index - 1], `${medians[index]} debe superar ${medians[index - 1]}`);
    }
});

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}
