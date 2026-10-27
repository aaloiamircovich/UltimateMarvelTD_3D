import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildVillainCodexModel } from '../src/systems/VillainCodexSystem.js';

const enemies = JSON.parse(fs.readFileSync(new URL('../data/enemies.json', import.meta.url), 'utf8'));

test('diccionario de villanos oculta enemigos no avistados', () => {
    const model = buildVillainCodexModel(enemies, []);
    const loki = model.entries.find((entry) => entry.id === 'loki');

    assert.equal(model.discovered, 0);
    assert.equal(loki.name, 'Registro bloqueado');
    assert.equal(loki.sprite, null);
    assert.deepEqual(loki.traits, ['No avistado']);
});

test('diccionario de villanos muestra datos al avistar enemigo', () => {
    const model = buildVillainCodexModel(enemies, ['loki', 'aim_scientist']);
    const loki = model.entries.find((entry) => entry.id === 'loki');
    const aim = model.entries.find((entry) => entry.id === 'aim_scientist');

    assert.equal(model.discovered, 2);
    assert.equal(loki.name, 'Loki');
    assert.equal(loki.isBoss, true);
    assert.ok(loki.sprite.includes('assets/images/enemies/loki/portrait.png'));
    assert.equal(aim.name, 'Científico A.I.M.');
    assert.ok(aim.traits.includes('Cura'));
});
