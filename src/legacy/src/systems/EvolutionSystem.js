export const DEFAULT_EVOLUTION_LEVEL = 50;

const DEFAULT_STATS = { damage: 0.24, fireRate: 0.06, range: 0.04, critChance: 4 };
const HIGH_POWER_STATS = { damage: 0.3, fireRate: 0.08, range: 0.05, critChance: 5 };
const SUPPORT_STATS = { damage: 0.16, fireRate: 0.04, range: 0.08, critChance: 3 };
const PURE_SUPPORT_IDS = new Set(['capitan_america', 'black_panther', 'nick_fury', 'wasp',
    'invisible_woman', 'mister_fantastic', 'wong', 'maria_hill', 'profesor_x']);

const ROSTER_EVOLUTION_IDS = [
    'adam_warlock', 'angela', 'ant_man', 'black_bolt', 'black_cat', 'black_panther', 'black_widow',
    'blade', 'capitan_america', 'captain_marvel', 'cloak', 'crystal', 'cyclops', 'dagger',
    'daredevil', 'deadpool', 'devil_dinosaur', 'doctor_strange', 'domino', 'elektra',
    'elsa_bloodstone', 'emma_frost', 'falcon', 'gambit', 'gamora', 'ghost_rider', 'groot',
    'hawkeye', 'hela', 'hulk', 'human_torch', 'iceman', 'invisible_woman', 'iron_fist',
    'iron_man', 'jean_grey', 'jeff_the_land_shark', 'jessica_jones', 'jubilee', 'loki',
    'luke_cage', 'luna_snow', 'magik', 'magneto', 'mantis', 'medusa', 'mister_fantastic',
    'moon_knight', 'ms_marvel', 'namor', 'namora', 'nick_fury', 'nightcrawler', 'nova',
    'okoye', 'peni_parker', 'psylocke', 'punisher', 'quake', 'rocket_raccoon', 'scarlet_witch',
    'shang_chi', 'she_hulk', 'shuri', 'silver_surfer', 'spiderman', 'squirrel_girl',
    'star_lord', 'storm', 'the_hood', 'thor', 'triton', 'venom', 'vision', 'war_machine',
    'wasp', 'winter_soldier', 'wolverine', 'yelena_belova', 'mbaku', 'red_guardian', 'korg',
    'nebula', 'wong', 'yondu', 'maria_hill', 'echo', 'howard_the_duck', 'valkyrie', 'rogue',
    'beast', 'cable', 'miles_morales', 'sentry', 'x_23', 'beta_ray_bill', 'drax', 'cosmo',
    'lady_sif', 'heimdall', 'white_tiger', 'tigra', 'mockingbird', 'kate_bishop', 'profesor_x'
];

const OVERRIDES = {
    adam_warlock: {
        stats: HIGH_POWER_STATS,
        transforms: [transform('guantelete_infinito', 'adam_warlock_gauntlet', 'Adam Warlock Gauntlet', { rarity: 'Secret', stats: { damage: 0.18, fireRate: 0.08, range: 0.04, critChance: 4 } })]
    },
    angela: { name: 'Angela Queen of Hel', rarity: 'Legendary', color: '#69e58c', stats: HIGH_POWER_STATS },
    ant_man: {
        transforms: [transform('particulas_pym', 'ant_man_colonia_pym', 'Ant-Man Colonia Pym', { rarity: 'Epic', stats: { damage: 0.12, fireRate: 0.1, range: 0.04, critChance: 3 } })]
    },
    black_panther: { name: "King T'Challa", color: '#9d4edd', stats: HIGH_POWER_STATS },
    blade: { name: 'Blade King of the Vampires', rarity: 'Legendary', color: '#ff3b5f', stats: { damage: 0.18, fireRate: 0.06, range: 0.04, critChance: 5 } },
    capitan_america: {
        stats: SUPPORT_STATS,
        transforms: [transform('mjolnir', 'capitan_america_mjolnir', 'Captain America Mjolnir', { stats: { damage: 0.26, fireRate: 0.12, range: 0.05, critChance: 4 }, canSeeStealth: true })]
    },
    captain_marvel: { name: 'Binary', rarity: 'Mythic', color: '#ffd166', stats: HIGH_POWER_STATS },
    cloak: { name: 'Cloak Fusion', rarity: 'Epic', color: '#111827', stats: { damage: 0.22, fireRate: 0.05, range: 0.07, critChance: 3 } },
    cyclops: { name: 'Cyclops Desatado', rarity: 'Legendary', color: '#ff3b3b', stats: HIGH_POWER_STATS },
    dagger: { name: 'Dagger Fusion', rarity: 'Epic', color: '#e0f2fe', stats: { damage: 0.22, fireRate: 0.05, range: 0.07, critChance: 3 } },
    doctor_strange: {
        stats: HIGH_POWER_STATS,
        transforms: [transform('pocion_yggdrasil', 'doctor_strange_dios_magia', 'Dios de la Magia', { rarity: 'Mythic', stats: { damage: 0.18, fireRate: 0.08, range: 0.1, critChance: 4 }, canSeeStealth: true })]
    },
    emma_frost: { name: 'Emma Frost Diamond Form', color: '#dff7ff', stats: HIGH_POWER_STATS },
    ghost_rider: { name: 'Ghost Rider King of Hell', color: '#ff7b3d', stats: HIGH_POWER_STATS },
    groot: { name: 'King Groot', rarity: 'Rare', color: '#7ee081', stats: { damage: 0.26, fireRate: 0.04, range: 0.06, critChance: 2 } },
    hawkeye: { name: 'Ronin', rarity: 'Rare', color: '#d8dee9', stats: { damage: 0.26, fireRate: 0.06, range: 0.06, critChance: 5 } },
    hulk: { name: 'World Breaker Hulk', color: '#69e58c', stats: { damage: 0.34, fireRate: 0.04, range: 0.02, critChance: 4 } },
    iceman: { name: 'Omega Iceman', color: '#93c5fd', stats: HIGH_POWER_STATS },
    iron_fist: { name: 'Immortal Iron Fist', color: '#ffd166', stats: HIGH_POWER_STATS },
    iron_man: { id: 'iron_man_extremis', name: 'Superior Iron Man', shortName: 'Superior', color: '#56e6ff', stats: { damage: 0.24, fireRate: 0.12, range: 0.04, critChance: 4 } },
    jean_grey: {
        id: 'phoenix', name: 'Phoenix', shortName: 'Phoenix', color: '#ff6b3d', stats: HIGH_POWER_STATS,
        transforms: [transform('formula_phoenix', 'dark_phoenix', 'Dark Phoenix', { stats: { damage: 0.2, fireRate: 0.08, range: 0.06, critChance: 4 } })]
    },
    jeff_the_land_shark: {
        transforms: [transform('simbionte', 'venom_jeff', 'Venom Jeff', { stats: { damage: 0.12, fireRate: 0.08, range: 0.04, critChance: 3 } })]
    },
    loki: { name: 'God of Stories', color: '#69e58c', stats: HIGH_POWER_STATS },
    magik: { name: 'Darkchylde', color: '#7c5cff', stats: HIGH_POWER_STATS },
    magneto: { name: 'Omega Magneto', color: '#ff3b5f', stats: HIGH_POWER_STATS },
    mister_fantastic: { name: 'The Maker', color: '#111827', stats: HIGH_POWER_STATS },
    moon_knight: { name: 'Fist of Khonshu', color: '#f8fafc', stats: HIGH_POWER_STATS },
    scarlet_witch: {
        stats: { damage: 0.22, fireRate: 0.06, range: 0.05, critChance: 4 },
        transforms: [transform('darkhold', 'chaos_goddess', 'Chaos Goddess', { rarity: 'Secret', stats: { damage: 0.26, fireRate: 0.08, range: 0.08, critChance: 4 }, canSeeStealth: true })]
    },
    shang_chi: {
        transforms: [transform('diez_anillos', 'shang_chi_diez_anillos', 'Shang-Chi Diez Anillos', { stats: { damage: 0.16, fireRate: 0.12, range: 0.06, critChance: 4 } })]
    },
    silver_surfer: {
        requiredLevel: 100, stats: HIGH_POWER_STATS,
        transforms: [transform('espada_infinito', 'dark_surfer', 'Dark Surfer', { requiredLevel: 100, rarity: 'Secret', stats: { damage: 0.24, fireRate: 0.08, range: 0.06, critChance: 4 } })]
    },
    spiderman: {
        id: 'iron_spider', name: 'Iron Spider', shortName: 'Iron Spider', color: '#f4c542', stats: { damage: 0.14, fireRate: 0.04, range: 0.16, critChance: 3 }, canSeeStealth: true,
        transforms: [transform('simbionte', 'spiderman_black_suit', 'Spider-Man Black Suit', { rarity: 'Legendary', stats: { damage: 0.16, fireRate: 0.08, range: 0.02, critChance: 4 }, canSeeStealth: true })]
    },
    star_lord: { name: 'Master of the Sun', rarity: 'Legendary', color: '#ffd166', stats: HIGH_POWER_STATS },
    thor: { name: 'King Thor', color: '#93c5fd', stats: HIGH_POWER_STATS },
    venom: {
        stats: HIGH_POWER_STATS,
        transforms: [transform('necroespada', 'king_in_black_venom', 'King in Black Venom', { rarity: 'Legendary', stats: { damage: 0.18, fireRate: 0.06, range: 0.04, critChance: 4 } })]
    },
    sentry: {
        requiredLevel: 100, stats: HIGH_POWER_STATS,
        transforms: [transform('el_vacio', 'the_void', 'The Void', { requiredLevel: 100, rarity: 'Secret', stats: { damage: 0.28, fireRate: 0.08, range: 0.06, critChance: 4 }, canSeeStealth: true })]
    }
};

export const EVOLUTION_CATALOG = Object.fromEntries(ROSTER_EVOLUTION_IDS.map((heroId) => {
    const override = OVERRIDES[heroId] || {};
    const id = override.id || `${heroId}_evolution`;
    return [id, createEvolution(heroId, id, override)];
}));

export function getEvolutionIdForHero(heroId) {
    return OVERRIDES[heroId]?.id || `${heroId}_evolution`;
}

export function getEvolutionForHero(hero, selectedEvolutions = {}, options = {}) {
    if (!hero?.id) return null;
    const catalogId = hero.evolutionId || selectedEvolutions[hero.id] || getEvolutionIdForHero(hero.id);
    const base = EVOLUTION_CATALOG[catalogId];
    if (!base || base.baseHeroId !== hero.id) return null;

    const level = Math.max(1, Math.floor(Number(options.level ?? hero.level ?? 1) || 1));
    if (level < (base.requiredLevel || DEFAULT_EVOLUTION_LEVEL)) return null;

    const equipped = new Set(options.equippedItemIds || []);
    const activeTransform = (base.itemTransforms || [])
        .filter((entry) => equipped.has(entry.itemId) && level >= (entry.requiredLevel || base.requiredLevel || DEFAULT_EVOLUTION_LEVEL))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0] || null;

    if (!activeTransform) return { ...base, level, levelEvolved: true };

    return {
        ...base,
        level,
        levelEvolved: true,
        name: activeTransform.name || base.name,
        shortName: activeTransform.shortName || activeTransform.name || base.shortName,
        description: activeTransform.description || base.description,
        color: activeTransform.color || base.color,
        rarity: activeTransform.rarity || base.rarity,
        stats: mergeStats(base.stats, activeTransform.stats),
        activeItemId: activeTransform.itemId,
        transformId: activeTransform.id,
        canSeeStealth: Boolean(activeTransform.canSeeStealth || base.canSeeStealth)
    };
}

export function applyEvolutionStats(stats, evolution) {
    if (!evolution?.stats) return stats;
    stats.damage *= 1 + (evolution.stats.damage || 0);
    stats.fireRate *= 1 + (evolution.stats.fireRate || 0);
    stats.range *= 1 + (evolution.stats.range || 0);
    stats.critChance += evolution.stats.critChance || 0;
    if (evolution.id === 'iron_spider' || evolution.canSeeStealth) stats.canSeeStealth = true;
    return stats;
}

function createEvolution(heroId, id, override = {}) {
    return {
        id,
        baseHeroId: heroId,
        name: override.name || `Evolucion ${formatHeroName(heroId)}`,
        shortName: override.shortName || 'Evolucion',
        description: override.description || (PURE_SUPPORT_IDS.has(heroId)
            ? 'Evolucion por nivel: +25% a la potencia del aura. No aumenta su radio ni acelera sus ciclos; sigue sin atacar.'
            : 'Evolucion por nivel: gran aumento de estadisticas base.'),
        color: override.color || '#40c9ff',
        requiredLevel: override.requiredLevel || DEFAULT_EVOLUTION_LEVEL,
        rarity: override.rarity || null,
        stats: override.stats || DEFAULT_STATS,
        supportAuraPower: PURE_SUPPORT_IDS.has(heroId) ? 0.25 : 0,
        itemTransforms: override.transforms || [],
        canSeeStealth: Boolean(override.canSeeStealth)
    };
}

function transform(itemId, id, name, options = {}) {
    return {
        itemId,
        id,
        name,
        shortName: options.shortName || name,
        description: options.description || `Transformacion especial con ${itemId}.`,
        requiredLevel: options.requiredLevel,
        rarity: options.rarity || null,
        color: options.color,
        stats: options.stats || {},
        canSeeStealth: Boolean(options.canSeeStealth),
        priority: options.priority || 0
    };
}

function mergeStats(base = {}, extra = {}) {
    return {
        damage: (base.damage || 0) + (extra.damage || 0),
        fireRate: (base.fireRate || 0) + (extra.fireRate || 0),
        range: (base.range || 0) + (extra.range || 0),
        critChance: (base.critChance || 0) + (extra.critChance || 0)
    };
}

function formatHeroName(heroId) {
    return String(heroId || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
