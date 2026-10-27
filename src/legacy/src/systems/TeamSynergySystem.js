import { HERO_RARITIES, getRarityClass, normalizeRarity } from '../utils/Rarity.js';

const LEGACY_SYNERGY_DEFINITIONS = {
    Avengers: family('Avengers', 'Epic', '#e63946', 'Ataque coordinado para equipos de primera linea.',
        tier(3, 'Asamblea tactica', { damagePct: 0.04, fireRatePct: 0.02 }),
        tier(5, 'Vengadores unidos', { damagePct: 0.07, fireRatePct: 0.03, critChance: 1 })),
    Mutantes: family('Mutantes', 'Legendary', '#f4d35e', 'Talento mutante que escala critico y control de mapa.',
        tier(4, 'Entrenamiento mutante', { critChance: 5, rangePct: 0.04 }),
        tier(6, 'Equipo dorado', { critChance: 8, damagePct: 0.07, rangePct: 0.05 })),
    Defenders: family('Defenders', 'Rare', '#4aa3ff', 'Defensa urbana resistente y precisa.',
        tier(2, 'Patrulla urbana', { rangePct: 0.04, critChance: 2 }),
        tier(4, 'Defensa sin descanso', { rangePct: 0.09, damagePct: 0.04, detectStealth: true })),
    Guardianes: family('Guardianes', 'Rare', '#40a9ff', 'Cadencia cosmica para rutas largas.',
        tier(3, 'Tripulacion improvisada', { fireRatePct: 0.07, rangePct: 0.03 }),
        tier(5, 'Guardianes de la galaxia', { fireRatePct: 0.1, damagePct: 0.05 })),
    'Místico': family('Místico', 'Mythic', '#b865ff', 'Habilidades mas fuertes y enfriamientos mas cortos.',
        tier(3, 'Circulo arcano', { abilityPower: 0.08, cooldown: 0.04 }),
        tier(5, 'Convergencia mistica', { abilityPower: 0.13, cooldown: 0.08 })),
    Callejero: family('Callejero', 'Common', '#a9b0b8', 'Lectura de amenaza, sigilo y control de barrio.',
        tier(2, 'Red de informantes', { rangePct: 0.035, detectStealth: true }),
        tier(4, 'Heroes del barrio', { rangePct: 0.075, fireRatePct: 0.045, detectStealth: true })),
    Wakanda: family('Wakanda', 'Legendary', '#ffcf4a', 'Tecnologia vibranium y disciplina real.',
        tier(3, 'Wakanda por siempre', { damagePct: 0.08, abilityPower: 0.06, critChance: 2 })),
    'Tecnología': family('Tecnología', 'Epic', '#5be7ff', 'Red tactica para cadencia y cobertura.',
        tier(3, 'Red tactica', { fireRatePct: 0.04, rangePct: 0.03 }),
        tier(5, 'Protocolo integrado', { fireRatePct: 0.05, rangePct: 0.04 })),
    'Cósmico': family('Cósmico', 'Legendary', '#ffdf6f', 'Energia estelar para romper oleadas densas.',
        tier(4, 'Orbita ofensiva', { damagePct: 0.075, rangePct: 0.055 }),
        tier(6, 'Frente galactico', { damagePct: 0.12, rangePct: 0.08, abilityPower: 0.05 })),
    Espías: family('Espías', 'Epic', '#94a3b8', 'Inteligencia S.H.I.E.L.D. contra elites y sigilo.',
        tier(2, 'Operacion encubierta', { critChance: 3, detectStealth: true }),
        tier(4, 'Red de inteligencia', { critChance: 6, rangePct: 0.055, detectStealth: true })),
    Oscuros: family('Oscuros', 'Mythic', '#7c3aed', 'Anti-heroes sobrenaturales con control sostenido.',
        tier(4, 'Pacto nocturno', { abilityPower: 0.09, damagePct: 0.045 }),
        tier(6, 'Medianoche viva', { abilityPower: 0.13, cooldown: 0.06, damagePct: 0.06 })),
    Marciales: family('Marciales', 'Rare', '#fb923c', 'Duelistas de corto alcance con golpes criticos.',
        tier(2, 'Dojo de combate', { critChance: 3, fireRatePct: 0.025 }),
        tier(4, 'Maestros del cuerpo a cuerpo', { critChance: 7, damagePct: 0.055 })),
    Inhumanos: family('Inhumanos', 'Rare', '#38bdf8', 'Control elemental y presion de area.',
        tier(2, 'Linaje terrigeno', { abilityPower: 0.035, rangePct: 0.025 }),
        tier(4, 'Consejo de Attilan', { abilityPower: 0.075, rangePct: 0.055, cooldown: 0.035 })),
    Atlánticos: family('Atlánticos', 'Epic', '#22d3ee', 'Defensa anfibia y ruptura de blindaje.',
        tier(2, 'Guardia de marea', { damagePct: 0.04, rangePct: 0.025 }),
        tier(3, 'Marea real', { damagePct: 0.07, rangePct: 0.04, allowWater: true })),
    Rivales: family('Rivales', 'Secret', '#ff304f', 'Equipos mixtos de choque que convierten variedad en tempo.',
        tier(5, 'Convergencia rival', { damagePct: 0.015, rangePct: 0.015, detectStealth: true }),
        tier(6, 'Crisis secreta', { damagePct: 0.04, rangePct: 0.035, abilityPower: 0.04, detectStealth: true }))
};

export const SYNERGY_DEFINITIONS = {
    Avengers: family('Avengers', 'Epic', '#e63946', 'Ataque coordinado de iconos de primera linea.',
        tier(3, 'Asamblea tactica', { damagePct: 0.04, fireRatePct: 0.02 }),
        tier(5, 'Vengadores unidos', { damagePct: 0.07, fireRatePct: 0.03, critChance: 1 })),
    Mutantes: family('Mutantes', 'Legendary', '#f4d35e', 'Genes extraordinarios que escalan critico y cobertura.',
        tier(3, 'Instinto evolutivo', { critChance: 4, rangePct: 0.035 }),
        tier(5, 'Potencial omega', { critChance: 7, damagePct: 0.06, rangePct: 0.04 })),
    Defenders: family('Defenders', 'Rare', '#4aa3ff', 'Defensa urbana resistente y precisa.',
        tier(2, 'Patrulla urbana', { rangePct: 0.04, critChance: 2 }),
        tier(4, 'Defensa sin descanso', { rangePct: 0.08, damagePct: 0.035, detectStealth: true })),
    Guardianes: family('Guardianes', 'Rare', '#40a9ff', 'Cadencia improvisada para rutas largas.',
        tier(2, 'Tripulacion improvisada', { fireRatePct: 0.055, rangePct: 0.025 }),
        tier(4, 'Plan de media galaxia', { fireRatePct: 0.09, damagePct: 0.04 })),
    'X-Men': family('X-Men', 'Legendary', '#f59e0b', 'Disciplina mutante para sostener lineas mixtas.',
        tier(3, 'Sala de peligro', { damagePct: 0.035, critChance: 3 }),
        tier(5, 'Equipo dorado', { damagePct: 0.07, critChance: 6, rangePct: 0.035 })),
    'Místico': family('Místico', 'Mythic', '#b865ff', 'Habilidades mas fuertes y enfriamientos mas cortos.',
        tier(3, 'Circulo arcano', { abilityPower: 0.08, cooldown: 0.04 }),
        tier(5, 'Convergencia mistica', { abilityPower: 0.13, cooldown: 0.08 })),
    Callejero: family('Callejero', 'Common', '#a9b0b8', 'Lectura de amenaza y control de barrio.',
        tier(2, 'Red de barrio', { rangePct: 0.03, detectStealth: true }),
        tier(4, 'Heroes a pie de calle', { rangePct: 0.065, fireRatePct: 0.04, detectStealth: true })),
    Wakanda: family('Wakanda', 'Legendary', '#ffcf4a', 'Tecnologia vibranium y disciplina real.',
        tier(2, 'Guardia real', { damagePct: 0.055, critChance: 2 }),
        tier(3, 'Wakanda por siempre', { damagePct: 0.085, abilityPower: 0.055, critChance: 3 })),
    'Tecnología': family('Tecnología', 'Epic', '#5be7ff', 'Red tactica para cadencia y cobertura.',
        tier(3, 'Red tactica', { fireRatePct: 0.04, rangePct: 0.03 }),
        tier(5, 'Protocolo integrado', { fireRatePct: 0.075, rangePct: 0.055 })),
    'Cósmico': family('Cósmico', 'Legendary', '#ffdf6f', 'Energia estelar para romper oleadas densas.',
        tier(3, 'Orbita ofensiva', { damagePct: 0.055, rangePct: 0.04 }),
        tier(6, 'Frente galactico', { damagePct: 0.11, rangePct: 0.075, abilityPower: 0.045 })),
    'Espías': family('Espías', 'Rare', '#94a3b8', 'Inteligencia S.H.I.E.L.D. contra elites y sigilo.',
        tier(2, 'Operacion encubierta', { critChance: 3, detectStealth: true }),
        tier(4, 'Red de inteligencia', { critChance: 6, rangePct: 0.05, detectStealth: true })),
    Oscuros: family('Oscuros', 'Mythic', '#7c3aed', 'Anti-heroes sobrenaturales con control sostenido.',
        tier(3, 'Pacto nocturno', { abilityPower: 0.07, damagePct: 0.035 }),
        tier(5, 'Medianoche viva', { abilityPower: 0.12, cooldown: 0.055, damagePct: 0.055 })),
    Marciales: family('Marciales', 'Rare', '#fb923c', 'Duelistas de corto alcance con golpes criticos.',
        tier(2, 'Dojo de combate', { critChance: 3, fireRatePct: 0.025 }),
        tier(4, 'Maestros del cuerpo a cuerpo', { critChance: 7, damagePct: 0.05 })),
    Inhumanos: family('Inhumanos', 'Rare', '#38bdf8', 'Control elemental y presion de area.',
        tier(2, 'Linaje terrigeno', { abilityPower: 0.035, rangePct: 0.025 }),
        tier(4, 'Consejo de Attilan', { abilityPower: 0.075, rangePct: 0.055, cooldown: 0.03 })),
    'Atlánticos': family('Atlánticos', 'Epic', '#22d3ee', 'Defensa anfibia y ruptura de blindaje.',
        tier(2, 'Guardia de marea', { damagePct: 0.04, rangePct: 0.025 }),
        tier(3, 'Marea real', { damagePct: 0.07, rangePct: 0.04, allowWater: true })),
    Arácnidos: family('Arácnidos', 'Rare', '#ef4444', 'Redes, movilidad y lectura contra corredores.',
        tier(2, 'Sentido aracnido', { fireRatePct: 0.04, detectStealth: true }),
        tier(3, 'Red compartida', { fireRatePct: 0.07, rangePct: 0.035, detectStealth: true })),
    Asgardianos: family('Asgardianos', 'Legendary', '#facc15', 'Poder divino para castigar jefes y elites.',
        tier(2, 'Sangre de reino', { damagePct: 0.055, abilityPower: 0.035 }),
        tier(4, 'Guerra de los reinos', { damagePct: 0.095, abilityPower: 0.07, cooldown: 0.035 })),
    Operaciones: family('Operaciones', 'Rare', '#64748b', 'Comando tactico, fuego disciplinado y cobertura anti sigilo.',
        tier(2, 'Orden de campo', { rangePct: 0.035, detectStealth: true }),
        tier(4, 'Mando coordinado', { rangePct: 0.07, critChance: 4, detectStealth: true })),
    'Fantásticos': family('Fantásticos', 'Epic', '#60a5fa', 'Ciencia experimental y control flexible de rutas.',
        tier(2, 'Fundacion Baxter', { rangePct: 0.05, abilityPower: 0.035 }),
        tier(3, 'Familia imposible', { rangePct: 0.08, fireRatePct: 0.045, abilityPower: 0.055 })),
    Mercenarios: family('Mercenarios', 'Epic', '#f97316', 'Suerte, caos y dano oportunista.',
        tier(2, 'Trabajo sucio', { critChance: 4, damagePct: 0.035 }),
        tier(3, 'Contrato imposible', { critChance: 7, damagePct: 0.06, fireRatePct: 0.03 })),
    Bestias: family('Bestias', 'Common', '#84cc16', 'Presion fisica economica y control de grupos.',
        tier(2, 'Instinto de manada', { damagePct: 0.03, fireRatePct: 0.025 }),
        tier(3, 'Caos adorable', { damagePct: 0.055, rangePct: 0.025, fireRatePct: 0.035 })),
    'Nexo Caótico': family('Nexo Caótico', 'Mythic', '#ec4899', 'Poderes raros que alteran ritmo, control y habilidad.',
        tier(2, 'Resonancia imposible', { abilityPower: 0.075, cooldown: 0.035 }),
        tier(4, 'Realidad fracturada', { abilityPower: 0.13, cooldown: 0.07, rangePct: 0.035 })),
    Rivales: family('Rivales', 'Secret', '#ff304f', 'Villanos y anti-heroes de alto riesgo con recompensas explosivas.',
        tier(3, 'Alianza inestable', { damagePct: 0.065, rangePct: 0.035, detectStealth: true }),
        tier(5, 'Crisis secreta', { damagePct: 0.11, rangePct: 0.06, abilityPower: 0.07, detectStealth: true }))
};

export const PAIR_SYNERGIES = [
    pair('ciencia_y_escudo', 'Ciencia y escudo', ['iron_man', 'capitan_america'], { damagePct: 0.03, abilityPower: 0.04 }),
    pair('dios_y_monstruo', 'Dios y monstruo', ['thor', 'hulk'], { damagePct: 0.04, cooldown: 0.03 }),
    pair('caos_y_orden', 'Caos y orden', ['doctor_strange', 'scarlet_witch'], { abilityPower: 0.08, cooldown: 0.05 }),
    pair('reyes_wakanda', 'Reyes de Wakanda', ['black_panther', 'shuri'], { damagePct: 0.05, rangePct: 0.04 }),
    pair('voz_y_reina', 'Voz de Attilan', ['black_bolt', 'medusa'], { abilityPower: 0.06, damagePct: 0.04 }),
    pair('marea_real', 'Marea real', ['namor', 'namora'], { damagePct: 0.05, rangePct: 0.03 })
];

export class TeamSynergySystem {
    constructor(game) {
        this.game = game;
    }

    applyHeroStats(hero, stats) {
        const effects = getHeroTeamEffects(hero, this.game.activeTeam || []);
        stats.damage *= 1 + (effects.damagePct || 0);
        stats.fireRate *= 1 + (effects.fireRatePct || 0);
        stats.range *= 1 + (effects.rangePct || 0);
        stats.critChance += effects.critChance || 0;
        if (effects.detectStealth) stats.canSeeStealth = true;
        if (effects.allowWater && Array.isArray(hero.allowedTerrains) && !hero.allowedTerrains.includes(0)) hero.allowedTerrains.push(0);
        return stats;
    }

    getAbilityModifiers(hero) {
        const effects = getHeroTeamEffects(hero, this.game.activeTeam || []);
        return { abilityPower: effects.abilityPower || 0, cooldown: effects.cooldown || 0 };
    }

    getSnapshot() {
        return analyzeTeam(this.game.activeTeam || []);
    }

    getFormationEffects(hero) {
        return {};
    }

    getFormationStatus(hero) {
        return null;
    }

    renderFormationRadius(ctx, hero) {
        return undefined;
    }
}

export function analyzeTeam(team = []) {
    const tagCounts = {};
    team.forEach((hero) => (hero.tags || []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));
    const families = Object.entries(SYNERGY_DEFINITIONS).map(([tag, definition]) => {
        const count = tagCounts[tag] || 0;
        const activeTier = [...definition.tiers].reverse().find((entry) => count >= entry.count) || null;
        const nextTier = definition.tiers.find((entry) => count < entry.count) || null;
        return { tag, count, definition, activeTier, nextTier };
    });
    const ids = new Set(team.map((hero) => hero.id));
    const pairs = PAIR_SYNERGIES.map((definition) => ({ ...definition, active: definition.heroIds.every((id) => ids.has(id)) }));
    const distinctTags = Object.values(tagCounts).filter((count) => count > 0).length;
    const metrics = ['damage', 'control', 'support', 'detection'].reduce((result, key) => {
        result[key] = team.length ? Math.round(team.reduce((sum, hero) => sum + (hero.teamMetrics?.[key] || 1), 0) / (team.length * 5) * 100) : 0;
        return result;
    }, {});
    metrics.coverage = team.length ? Math.min(100, Math.round(team.reduce((sum, hero) => sum + Math.min(1, (hero.range || 100) / 220), 0) / team.length * 100)) : 0;
    return {
        size: team.length,
        cost: team.reduce((sum, hero) => sum + (hero.cost || 0), 0),
        ids: [...ids],
        tagCounts,
        families,
        pairs,
        distinctTags,
        versatile: false,
        metrics
    };
}

export function getHeroTeamEffects(hero, team) {
    const snapshot = analyzeTeam(team);
    let effects = {};
    snapshot.families.forEach((familySnapshot) => {
        if (familySnapshot.activeTier && hero.tags?.includes(familySnapshot.tag)) {
            effects = mergeEffects(effects, familySnapshot.activeTier.effects);
        }
    });
    snapshot.pairs.forEach((pairSnapshot) => {
        if (pairSnapshot.active && pairSnapshot.heroIds.includes(hero.id)) effects = mergeEffects(effects, pairSnapshot.effects);
    });
    return effects;
}

export function getSynergyMenuModel(snapshot, roster = [], unlockedIds = new Set()) {
    const activeIds = new Set(snapshot?.ids || []);
    return (snapshot?.families || []).filter((familySnapshot) => familySnapshot?.definition?.tiers?.length).map((familySnapshot) => {
        const members = roster.filter((hero) => hero.tags?.includes(familySnapshot.tag));
        const selected = members.filter((hero) => activeIds.has(hero.id));
        const unlocked = members.filter((hero) => unlockedIds.has(hero.id));
        const targetTier = familySnapshot.nextTier || familySnapshot.activeTier || familySnapshot.definition.tiers[0];
        const needed = familySnapshot.nextTier ? Math.max(0, familySnapshot.nextTier.count - familySnapshot.count) : 0;
        const state = familySnapshot.activeTier ? 'active' : needed === 1 ? 'near' : 'locked';
        const rarity = normalizeRarity(familySnapshot.definition.rarity);
        return {
            tag: familySnapshot.tag,
            label: familySnapshot.definition.label,
            color: familySnapshot.definition.color,
            rarity,
            rarityClass: getRarityClass(rarity),
            description: familySnapshot.definition.description,
            count: familySnapshot.count,
            rosterCount: members.length,
            memberNames: members.map((hero) => hero.name),
            selectedNames: selected.map((hero) => hero.name),
            unlockedNames: unlocked.map((hero) => hero.name),
            missingNames: members.filter((hero) => !activeIds.has(hero.id)).map((hero) => hero.name),
            activeTier: familySnapshot.activeTier,
            nextTier: familySnapshot.nextTier,
            state,
            needed,
            progressLabel: targetTier ? `${familySnapshot.count}/${targetTier.count}` : `${familySnapshot.count}/0`,
            effectLabel: formatEffectSummary((familySnapshot.activeTier || familySnapshot.nextTier || targetTier)?.effects)
        };
    }).sort((a, b) => {
        const stateScore = { active: 0, near: 1, locked: 2 };
        return stateScore[a.state] - stateScore[b.state] || b.count - a.count || a.label.localeCompare(b.label);
    });
}

export function getNextSynergyRecommendation(snapshot, roster = [], unlockedIds = new Set()) {
    const activeIds = new Set(snapshot?.ids || []);
    if ((snapshot?.size || activeIds.size) >= 6) return null;
    const candidates = [];
    const rankHero = (hero, unlocked = false) => {
        const rarityRank = HERO_RARITIES.indexOf(normalizeRarity(hero?.rarity));
        return (unlocked ? 24 : -12) + Math.max(0, rarityRank) * 4 + (hero?.teamMetrics?.damage || 0) + (hero?.teamMetrics?.support || 0);
    };
    const pushCandidate = (candidate) => {
        if (!candidate?.hero || activeIds.has(candidate.hero.id)) return;
        candidates.push(candidate);
    };

    (snapshot?.pairs || []).forEach((pairSnapshot) => {
        const pairHeroIds = Array.isArray(pairSnapshot.heroIds) ? pairSnapshot.heroIds : [];
        if (pairSnapshot.active || pairHeroIds.length !== 2) return;
        const presentIds = pairHeroIds.filter((id) => activeIds.has(id));
        const missingIds = pairHeroIds.filter((id) => !activeIds.has(id));
        if (presentIds.length !== 1 || missingIds.length !== 1) return;
        const hero = roster.find((entry) => entry.id === missingIds[0]);
        if (!hero) return;
        const unlocked = unlockedIds.has(hero.id);
        pushCandidate({
            type: 'pair',
            hero,
            groupLabel: pairSnapshot.label,
            action: 'Completa duo',
            progressLabel: '1/2',
            neededAfter: 0,
            effectLabel: formatEffectSummary(pairSnapshot.effects),
            unlocked,
            score: 1200 + rankHero(hero, unlocked)
        });
    });

    getSynergyMenuModel(snapshot, roster, unlockedIds).forEach((group) => {
        if (!group.nextTier || group.needed <= 0 || group.count <= 0) return;
        const missingHeroes = roster
            .filter((hero) => hero.tags?.includes(group.tag) && !activeIds.has(hero.id))
            .sort((a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id))
                || HERO_RARITIES.indexOf(normalizeRarity(b.rarity)) - HERO_RARITIES.indexOf(normalizeRarity(a.rarity))
                || a.name.localeCompare(b.name));
        const hero = missingHeroes[0];
        if (!hero) return;
        const unlocked = unlockedIds.has(hero.id);
        pushCandidate({
            type: 'family',
            hero,
            groupLabel: group.label,
            action: group.needed === 1 ? 'Completa agrupacion' : 'Acerca agrupacion',
            progressLabel: group.progressLabel,
            neededAfter: Math.max(0, group.needed - 1),
            effectLabel: group.effectLabel,
            rarity: group.rarity,
            rarityClass: group.rarityClass,
            unlocked,
            score: (group.needed === 1 ? 1000 : 740) + group.count * 26 + rankHero(hero, unlocked)
        });
    });

    const best = candidates.sort((a, b) => b.score - a.score || a.hero.name.localeCompare(b.hero.name))[0];
    if (!best) return null;
    const rarity = normalizeRarity(best.rarity || best.hero.rarity);
    return {
        ...best,
        heroId: best.hero.id,
        heroName: best.hero.name,
        heroRarity: normalizeRarity(best.hero.rarity),
        rarity,
        rarityClass: best.rarityClass || getRarityClass(rarity),
        statusLabel: best.unlocked ? 'Disponible' : 'Por reclutar'
    };
}

export function formatEffectSummary(effects = {}) {
    const labels = [];
    if (effects.damagePct) labels.push(`+${percent(effects.damagePct)} dano`);
    if (effects.fireRatePct) labels.push(`+${percent(effects.fireRatePct)} cadencia`);
    if (effects.rangePct) labels.push(`+${percent(effects.rangePct)} alcance`);
    if (effects.critChance) labels.push(`+${effects.critChance}% critico`);
    if (effects.abilityPower) labels.push(`+${percent(effects.abilityPower)} poder`);
    if (effects.cooldown) labels.push(`-${percent(effects.cooldown)} cooldown`);
    if (effects.detectStealth) labels.push('detecta sigilo');
    if (effects.allowWater) labels.push('permite agua');
    return labels.join(' · ');
}

function family(label, rarity, color, description, ...tiers) {
    return { label, rarity: normalizeRarity(rarity), color, description, tiers };
}

function tier(count, label, effects) {
    return { count, label, effects };
}

function pair(id, label, heroIds, effects) {
    return { id, label, heroIds, effects };
}

function mergeEffects(...sources) {
    const result = {};
    sources.forEach((source) => Object.entries(source || {}).forEach(([key, value]) => {
        result[key] = typeof value === 'boolean' ? Boolean(result[key] || value) : (result[key] || 0) + value;
    }));
    return result;
}

function percent(value) {
    return Math.round(value * 100);
}

export { mergeEffects };
