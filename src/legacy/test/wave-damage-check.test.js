import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWaveDamageCheck } from '../src/systems/WaveDamageCheck.js';

test('buildWaveDamageCheck ignora auras puras como dano directo', () => {
    const check = buildWaveDamageCheck({
        waveSeconds: 20,
        waveModel: { total: 4, effectiveHp: 1600, totalHp: 1600 },
        heroes: [
            { id: 'capitan_america', name: 'Capitan America', rarity: 'Common', level: 100, damage: 1, fireRate: 0, range: 255, special: { supportAura: { type: 'damage', power: 0.12, range: 255 } } },
            { id: 'iron_man', name: 'Iron Man', damage: 58, fireRate: 1.4, range: 180 }
        ]
    });

    assert.equal(check.requiredDamage, 1600);
    assert.ok(check.expectedDamage > 0);
    assert.deepEqual(check.contributors.map((entry) => entry.name), ['Iron Man']);
    assert.deepEqual(check.supports.map((entry) => entry.name), ['Capitan America']);
    assert.equal(check.supports[0].label, '+22% dano');
    assert.equal(check.supports[0].range, 270);
});

test('buildWaveDamageCheck trata phaser como amenaza invisible sin detector', () => {
    const striker = { id: 'hulk', name: 'Hulk', damage: 100, fireRate: 1, range: 170 };
    const detector = { id: 'black_widow', name: 'Black Widow', damage: 30, fireRate: 2, range: 150, canSeeStealth: true };
    const waveModel = {
        total: 3,
        roles: ['phaser'],
        effectiveHp: 1200,
        totalHp: 1200
    };

    const blocked = buildWaveDamageCheck({ heroes: [striker], waveModel, waveSeconds: 20 });
    const covered = buildWaveDamageCheck({ heroes: [striker, detector], waveModel, waveSeconds: 20 });

    assert.equal(blocked.expectedDamage, 0);
    assert.equal(blocked.contributors.length, 0);
    assert.equal(blocked.supports.length, 0);
    assert.deepEqual(blocked.warnings.map((entry) => entry.id), ['detection']);
    assert.equal(blocked.warnings[0].detail, 'DPS reducido contra fase.');
    assert.match(blocked.detail, /DPS sin deteccion reducido/);
    assert.ok(covered.expectedDamage > 0);
    assert.equal(covered.warnings.length, 0);
    assert.deepEqual(covered.contributors.map((entry) => entry.name), ['Black Widow']);
});

test('buildWaveDamageCheck reconoce detectores por metrica tactica', () => {
    const detector = {
        id: 'daredevil',
        name: 'Daredevil',
        damage: 42,
        fireRate: 1.4,
        range: 145,
        teamMetrics: { detection: 4 }
    };
    const check = buildWaveDamageCheck({
        heroes: [detector],
        waveSeconds: 20,
        waveModel: {
            total: 4,
            stealthCount: 4,
            roles: ['stealth'],
            effectiveHp: 1000,
            totalHp: 1000
        }
    });

    assert.ok(check.expectedDamage > 0);
    assert.equal(check.warnings.length, 0);
    assert.deepEqual(check.contributors.map((entry) => entry.name), ['Daredevil']);
});

test('buildWaveDamageCheck distingue amenazas mixtas de deteccion', () => {
    const check = buildWaveDamageCheck({
        heroes: [{ id: 'hulk', name: 'Hulk', damage: 100, fireRate: 1, range: 170 }],
        waveSeconds: 20,
        waveModel: {
            total: 5,
            stealthCount: 2,
            roles: ['stealth', 'phaser'],
            effectiveHp: 1500,
            totalHp: 1500
        }
    });

    assert.ok(check.expectedDamage > 0);
    assert.ok(check.expectedDamage < 2000);
    assert.equal(check.warnings[0].detail, 'DPS reducido contra sigilo/fase.');
});
