import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EVOLUTION_CATALOG, applyEvolutionStats, getEvolutionForHero } from '../src/systems/EvolutionSystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

test('el catalogo de evoluciones cubre todo el roster con identidades base distintas', () => {
    const baseHeroIds = Object.values(EVOLUTION_CATALOG).map((entry) => entry.baseHeroId);
    assert.equal(new Set(baseHeroIds).size, baseHeroIds.length);
    assert.equal(baseHeroIds.length, Object.keys(heroes).length);
    for (const [heroId, hero] of Object.entries(heroes)) {
        assert.ok(hero.evolutionId, `${heroId} debe declarar evolucion`);
        assert.equal(EVOLUTION_CATALOG[hero.evolutionId]?.baseHeroId, heroId);
    }
    assert.equal(EVOLUTION_CATALOG.iron_man_extremis.baseHeroId, 'iron_man');
    assert.equal(EVOLUTION_CATALOG.iron_spider.baseHeroId, 'spiderman');
    assert.equal(EVOLUTION_CATALOG.phoenix.baseHeroId, 'jean_grey');
});

test('una evolucion seleccionada modifica estadisticas sin mutar identidad', () => {
    const hero = { ...heroes.spiderman };
    const evolution = getEvolutionForHero(hero, {}, { level: 50 });
    const stats = applyEvolutionStats({ damage: 100, fireRate: 1, range: 200, critChance: 5, canSeeStealth: false }, evolution);
    assert.equal(evolution.id, 'iron_spider');
    assert.ok(Math.abs(stats.range - 232) < 0.0001);
    assert.equal(stats.canSeeStealth, true);
    assert.equal(hero.id, 'spiderman');
});

test('la evolucion por nivel se activa al requisito y no antes', () => {
    assert.equal(getEvolutionForHero(heroes.black_widow, {}, { level: 49 }), null);

    const evolution = getEvolutionForHero(heroes.black_widow, {}, { level: 50 });

    assert.equal(evolution.levelEvolved, true);
    assert.equal(evolution.requiredLevel, 50);
});

test('los requisitos especiales de nivel se respetan', () => {
    const allowedLevels = new Set([50, 100]);
    for (const evolution of Object.values(EVOLUTION_CATALOG)) {
        assert.equal(allowedLevels.has(evolution.requiredLevel), true, `${evolution.id} usa nivel ${evolution.requiredLevel}`);
    }

    assert.equal(getEvolutionForHero(heroes.star_lord, {}, { level: 49 }), null);
    assert.equal(getEvolutionForHero(heroes.star_lord, {}, { level: 50 })?.id, 'star_lord_evolution');
    assert.equal(getEvolutionForHero(heroes.sentry, {}, { level: 99 }), null);
    assert.equal(getEvolutionForHero(heroes.sentry, {}, { level: 100 })?.id, 'sentry_evolution');
});

test('un objeto signature mejora la evolucion sin bloquear la base', () => {
    const base = getEvolutionForHero(heroes.capitan_america, {}, { level: 50 });
    const withItem = getEvolutionForHero(heroes.capitan_america, {}, { level: 50, equippedItemIds: ['mjolnir'] });

    assert.equal(base.id, 'capitan_america_evolution');
    assert.equal(base.activeItemId, undefined);
    assert.equal(withItem.activeItemId, 'mjolnir');
    assert.equal(withItem.transformId, 'capitan_america_mjolnir');
    assert.equal('allowsSupportAttack' in withItem, false);
    assert.ok(withItem.stats.damage > base.stats.damage);
});

test('una evolucion no puede aplicarse al heroe equivocado', () => {
    assert.equal(getEvolutionForHero({ id: 'iron_man', evolutionId: 'phoenix' }, {}, { level: 100 }), null);
});
