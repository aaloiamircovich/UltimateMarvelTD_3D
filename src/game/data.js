export const HEROES = [
  {
    id: "iron_man",
    name: "Iron Man",
    subtitle: "Arsenal ARC",
    role: "Daño preciso",
    rarity: "Legendary",
    color: "#ffc55b",
    body: "#b92433",
    accent: "#f5bd51",
    cost: 300,
    damage: 28,
    range: 5.8,
    interval: 0.72,
    kind: "beam",
    avenger: true,
    description:
      "Repulsores de largo alcance. Cada tercer disparo sobrecarga el reactor e inflige el doble de daño.",
    ability: "Sobrecarga ARC",
  },
  {
    id: "spiderman",
    name: "Spider-Man",
    subtitle: "Tu vecino y amigo",
    role: "Control",
    rarity: "Epic",
    color: "#ff6278",
    body: "#d63748",
    accent: "#254e9c",
    cost: 225,
    damage: 16,
    range: 4.7,
    interval: 0.65,
    kind: "web",
    avenger: false,
    description:
      "Sus telarañas reducen un 40% la velocidad del objetivo durante 2 segundos.",
    ability: "Telaraña",
  },
  {
    id: "capitan_america",
    name: "Capitán América",
    subtitle: "El primer Vengador",
    role: "Apoyo",
    rarity: "Epic",
    color: "#6dafff",
    body: "#27538d",
    accent: "#e6edf6",
    cost: 280,
    damage: 0,
    range: 5.8,
    interval: 1,
    kind: "aura",
    avenger: true,
    description:
      "Mando Avenger: aumenta un 25% el daño de los aliados a su alcance. No ataca. Las auras no se acumulan.",
    ability: "Mando Avenger",
  },
  {
    id: "thor",
    name: "Thor",
    subtitle: "Dios del trueno",
    role: "Daño en cadena",
    rarity: "Legendary",
    color: "#8cdaff",
    body: "#425269",
    accent: "#c8dfed",
    cost: 500,
    damage: 48,
    range: 5.2,
    interval: 1.5,
    kind: "chain",
    avenger: true,
    description:
      "Mjölnir invoca un rayo que salta a un máximo de 3 enemigos cercanos. Cada salto conserva el 70% del daño.",
    ability: "Tormenta divina",
  },
  {
    id: "hulk",
    name: "Hulk",
    subtitle: "Fuerza imparable",
    role: "Daño de área",
    rarity: "Legendary",
    color: "#a8e678",
    body: "#73af4c",
    accent: "#63508d",
    cost: 400,
    damage: 65,
    range: 3.4,
    interval: 1.65,
    kind: "slam",
    avenger: true,
    description:
      "Golpea el suelo y daña a todos los enemigos en un radio de 2.4 metros alrededor del objetivo.",
    ability: "Impacto gamma",
  },
  {
    id: "doctor_strange",
    name: "Doctor Strange",
    subtitle: "Hechicero Supremo",
    role: "Área y control",
    rarity: "Mythic",
    color: "#c89aff",
    body: "#245879",
    accent: "#ffaf52",
    cost: 450,
    damage: 30,
    range: 5,
    interval: 1.45,
    kind: "magic",
    avenger: false,
    description:
      "Una explosión mística afecta un radio de 2 metros y ralentiza un 30% a los enemigos durante 2 segundos.",
    ability: "Portal místico",
  },
];
export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));
export const PATH = [
  [-15, 5],
  [-9, 5],
  [-9, -4],
  [-2, -4],
  [-2, 4],
  [7, 4],
  [7, -5],
  [15, -5],
];
// Shared AABBs keep the visible scenery and placement collision in agreement.
export const BUILDINGS = [
  { x: -12, z: -7.8, w: 3.7, d: 3.1, h: 5.5, color: "#4b6071" },
  { x: -7, z: -8.2, w: 3.8, d: 2.8, h: 7.2, color: "#3c4f64" },
  { x: -1.8, z: -8.7, w: 3.2, d: 2, h: 4.5, color: "#546b77" },
  { x: 3, z: -8.5, w: 3.3, d: 2.4, h: 6.3, color: "#3b5b70" },
  { x: 12, z: -8.2, w: 3.5, d: 3.1, h: 9, color: "#376a85", stark: true },
  { x: -12.6, z: -0.4, w: 2.3, d: 3.4, h: 2.8, color: "#576878" },
  { x: 11.9, z: 1.2, w: 3.5, d: 4.5, h: 3.3, color: "#55616f" },
];
export const PARKS = [
  [-5.4, 0],
  [2.6, -1],
  [-5.5, 7.9],
  [2.8, 8.3],
];
export const LAMPS = [
  [-11, 7],
  [-6.8, -2.1],
  [0, 5.7],
  [9, -2],
];
export const CARS = [
  [-12.5, 8.5, "#dfac46"],
  [12, 6, "#b0394c"],
];
export const OBSTACLES = [
  ...PARKS.flatMap(([x, z]) =>
    [-1, 1].map((side) => ({ x: x + side, z: z + 0.5, w: 0.8, d: 0.8 })),
  ),
  ...LAMPS.map(([x, z]) => ({ x, z, w: 0.15, d: 0.15 })),
  ...CARS.map(([x, z]) => ({ x, z, w: 1.7, d: 0.9 })),
];
export const ENEMIES = {
  drone: {
    name: "Dron de Ultron",
    hp: 65,
    speed: 2.3,
    reward: 24,
    damage: 4,
    color: "#85929f",
    scale: 0.65,
  },
  runner: {
    name: "Explorador Chitauri",
    hp: 46,
    speed: 3.8,
    reward: 28,
    damage: 5,
    color: "#c3ad76",
    scale: 0.63,
  },
  tank: {
    name: "Centinela de Hydra",
    hp: 190,
    speed: 1.5,
    reward: 48,
    damage: 9,
    color: "#53795f",
    scale: 0.95,
  },
  boss: {
    name: "Ultron",
    hp: 1800,
    speed: 1.15,
    reward: 350,
    damage: 40,
    color: "#a9b1bc",
    scale: 1.65,
  },
};
export const WAVE_COUNT = 12;
export const MAX_UNITS = 12;
export const PRIORITIES = ["Primero", "Último", "Fuerte"];
export function waveDefinition(number) {
  const enemies = [];
  for (let i = 0; i < 5 + number; i++) {
    enemies.push(
      number >= 4 && i % 4 === 3
        ? "tank"
        : number >= 2 && i % 3 === 2
          ? "runner"
          : "drone",
    );
  }
  if (number === 6 || number === 12) enemies.splice(3, 0, "boss");
  return {
    enemies,
    interval: Math.max(0.5, 1.15 - number * 0.035),
    multiplier: 1.14 ** (number - 1),
    bonus: 110 + number * 22,
  };
}
