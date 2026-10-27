import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Hero } from '../src/entities/Hero.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));
const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));

const frontierHeroes = ['war_machine', 'nick_fury', 'wasp', 'nova', 'quake', 'medusa', 'namor', 'iron_fist', 'punisher', 'elektra', 'jessica_jones', 'cloak', 'dagger', 'magik', 'iceman'];
const frontierItems = ['armadura_war_machine', 'localizador_fury', 'alas_wasp', 'casco_nova', 'guante_quake', 'tridente_atlante', 'sello_kun_lun', 'prisma_luz_oscura'];

test('roster frontera agrega quince heroes con contrato tactico y visual', () => {
    assert.equal(frontierHeroes.length, 15);
    for (const id of frontierHeroes) {
        const hero = heroes[id];
        assert.ok(hero, `Falta ${id}`);
        assert.equal(hero.id, id);
        assert.ok(hero.visual?.portrait);
        assert.equal(hero.sprite, hero.visual.portrait);
        assert.ok(hero.abilityDesc.length > 20);
        assert.ok(hero.niche.length > 8);
        assert.ok(hasSpecialContract(hero));
        assert.equal(Object.keys(hero.visual.idle).length, 8);
        assert.equal(hero.visual.attack.frames.length, 9);
    }
});

test('objetos frontera agregan herramientas para nuevos perfiles', () => {
    for (const id of frontierItems) {
        const item = items[id];
        assert.ok(item, `Falta ${id}`);
        assert.ok(['weapon', 'armor', 'artifact'].includes(item.slot));
        assert.ok(item.price > 0);
        assert.ok(Object.keys(item.effects).length > 0);
    }
});

test('Quake conserva visual especial y traslada control a la onda preparada', () => {
    const hero = new Hero(heroes.quake, 0, 0, createGame());
    const stats = hero.getEffectiveStats();
    const effects = hero.getProjectileEffects();

    assert.equal(effects.length, 0);
    assert.equal(hero.abilitySystem.controlKit.cooldown, 4);
    assert.equal(hero.getProjectileVisualStyle(), 'sonic');
    assert.equal(hero.getProjectileColor(), '#76e4f7');
    assert.ok(stats.range >= heroes.quake.range);
});

function createGame() {
    return {
        resourceManager: { lives: 20 },
        heroes: [],
        enemies: [],
        progression: {
            getHeroBonuses: () => null,
            getHeroEvolution: () => null
        },
        teamSynergy: null
    };
}

function hasSpecialContract(hero) {
    return Boolean(hero.special?.statModifiers
        || hero.special?.attackEffects
        || hero.special?.projectileProfile
        || hero.special?.supportAura
        || hero.special?.economyOnHit);
}
