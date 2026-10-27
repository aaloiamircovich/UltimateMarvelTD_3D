import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SYNERGY_DEFINITIONS, analyzeTeam, getHeroTeamEffects } from '../src/systems/TeamSynergySystem.js';

const heroes = JSON.parse(fs.readFileSync(new URL('../data/heroes.json', import.meta.url), 'utf8'));

const allegianceHeroes = ['shuri', 'okoye', 'black_bolt', 'crystal', 'namora', 'triton'];
const requiredGroups = ['Avengers', 'Mutantes', 'Defenders', 'Guardianes', 'Místico', 'Callejero', 'Wakanda', 'Tecnología', 'Cósmico', 'Espías', 'Oscuros', 'Marciales', 'Inhumanos', 'Atlánticos', 'Rivales'];

test('agrupaciones tienen catalogo completo y umbral jugable', () => {
    const groups = Object.keys(SYNERGY_DEFINITIONS);
    assert.ok(groups.length >= 20);
    for (const tag of groups) {
        const members = Object.values(heroes).filter((hero) => hero.tags?.includes(tag));
        assert.ok(members.length >= 2, `${tag} necesita al menos dos miembros`);
    }
    for (const hero of Object.values(heroes)) {
        assert.ok(hero.tags.length >= 1 && hero.tags.length <= 2, `${hero.id} debe tener una o dos agrupaciones`);
    }
});

test('refuerzos de agrupacion tienen contrato tactico y visual', () => {
    for (const id of allegianceHeroes) {
        const hero = heroes[id];
        assert.ok(hero, `Falta ${id}`);
        assert.equal(hero.id, id);
        assert.ok(hero.visual?.portrait);
        assert.equal(hero.sprite, hero.visual.portrait);
        assert.equal(Object.keys(hero.visual.idle).length, 8);
        assert.equal(hero.visual.attack.frames.length, 9);
        assert.ok(hero.abilityDesc.length > 20);
        assert.ok(hero.niche.length > 8);
        assert.ok(hero.special?.statModifiers || hero.special?.attackEffects || hero.special?.projectileProfile);
    }
});

test('Atlánticos habilita defensa sobre agua para sus miembros', () => {
    const team = [heroes.namor, heroes.namora, heroes.triton];
    const snapshot = analyzeTeam(team);
    const atlanticos = snapshot.families.find((family) => family.tag === 'Atlánticos');
    const effects = getHeroTeamEffects(heroes.namora, team);

    assert.equal(atlanticos.activeTier.count, 3);
    assert.equal(effects.allowWater, true);
    assert.ok(effects.damagePct > 0);
});
