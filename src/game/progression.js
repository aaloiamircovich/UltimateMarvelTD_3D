import { ProgressionManager, SAVE_VERSION } from "../legacy/src/systems/ProgressionManager.js";
import { ShopSystem, HERO_RARITY_WEIGHTS, getHeroBoxCost } from "../legacy/src/systems/ShopSystem.js";
import { selectStarterHeroes } from "../legacy/src/utils/StarterSelection.js";
import { RandomSource } from "../legacy/src/utils/Random.js";
import { SOURCE } from "./combat-data.js";

export const COLLECTION_KEY = "ultimate-marvel-td-collection-v1";

// The imported manager owns all progression rules. This boundary only supplies
// isolated storage, atomic saves and a DOM-free context for the 3D application.
export class Collection extends ProgressionManager {
  constructor(storage, { random = new RandomSource() } = {}) {
    super(null);
    this.disk = storage;
    this.random = random;
    this.status = "";
    this.suspended = 1;
    this.blocked = false;
    this.rawBackup = null;
    this.attachHub();
    try {
      const raw = storage.getItem(COLLECTION_KEY);
      if (raw) {
        this.rawBackup = raw;
        this.state = this.readState(JSON.parse(raw));
      }
    } catch (error) {
      this.blocked = true;
      this.status = this.rawBackup
        ? "El guardado no se pudo leer. Se conserva intacto; descargá el respaldo desde Colección. Esta sesión no lo sobrescribirá."
        : "El navegador no permite leer el guardado. Esta sesión es temporal; exportá tu perfil antes de cerrar.";
    }
    this.suspended = 0;
    this.syncGame();
    if (!this.blocked) this.save();
  }
  applySettings() {
    // Rendering and audio settings belong to the 3D UI, never the simulation.
  }
  attach(game, data) {
    this.game = game;
    this.data = data;
    this.syncGame();
  }
  attachHub() {
    const data = structuredClone(SOURCE);
    this.attach({ heroes: [], projectiles: [], heroDatabase: data.heroes,
      itemDatabase: data.items, random: this.random }, data);
    this.shopSystem = new ShopSystem(this.game, this);
  }
  readState(raw) {
    if (!raw || Array.isArray(raw) || raw.version !== SAVE_VERSION) throw Error("Versión de perfil incompatible");
    const inspect = (value, depth = 0) => {
      if (depth > 30) throw Error("Perfil demasiado anidado");
      if (typeof value === "number" && !Number.isFinite(value)) throw Error("Número inválido");
      if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw Error("Clave de perfil inválida");
        inspect(child, depth + 1);
      }
    };
    inspect(raw);
    for (const key of ["unlockedHeroIds", "activeTeamIds", "ownedItemIds"]) {
      if (!Array.isArray(raw[key]) || !raw[key].every(id => typeof id === "string")) throw Error(`Lista inválida: ${key}`);
    }
    const defaults = new ProgressionManager(null).state;
    for (const [key, value] of Object.entries(defaults)) {
      const candidate = raw[key];
      if (candidate === undefined || value === null) continue;
      if (Array.isArray(value) ? !Array.isArray(candidate)
        : typeof value === "object" ? !candidate || typeof candidate !== "object" || Array.isArray(candidate)
          : typeof candidate !== typeof value) throw Error(`Campo de perfil inválido: ${key}`);
    }
    if (!Number.isFinite(raw.credits) || raw.credits < 0) throw Error("Saldo inválido");
    for (const key of ["heroPity", "heroBoxCost"]) {
      if (raw.shop?.[key] !== undefined && (!Number.isSafeInteger(raw.shop[key]) || raw.shop[key] < 0)) throw Error("Estado de tienda inválido");
    }
    const checker = new CollectionValidator();
    checker.data = structuredClone(SOURCE);
    checker.state = ProgressionManager.migrate(structuredClone(raw));
    checker.sanitize();
    return checker.state;
  }
  save() {
    if (this.suspended) return true;
    if (this.blocked) return false;
    try {
      this.disk.setItem(COLLECTION_KEY, JSON.stringify(this.state));
      this.status = "";
      this.onStatus?.(this.status);
      return true;
    } catch {
      this.status = "No se pudo guardar el perfil en este navegador. El progreso sigue en memoria; exportalo desde Colección antes de cerrar.";
      this.onStatus?.(this.status);
      return false;
    }
  }
  transaction(action) {
    this.suspended++;
    try { return action(); }
    finally { this.suspended--; this.save(); }
  }
  get starters() { return selectStarterHeroes(this.data.heroes); }
  chooseStarter(id) {
    if (this.state.unlockedHeroIds.length || !this.starters.some(h => h.id === id)) return false;
    return this.transaction(() => this.startProfile(id));
  }
  recruit() {
    if (!this.state.unlockedHeroIds.length) return { ok: false, reason: "Elegí tu héroe inicial primero." };
    return this.transaction(() => this.shopSystem.recruitHero());
  }
  purchase(id) { return this.transaction(() => this.shopSystem.purchaseItem(id)); }
  get recruitmentCost() { return getHeroBoxCost(this.state.shop); }
  recruitmentOdds() {
    let pool = Object.values(this.data.heroes).filter(h => h.visual && !this.state.unlockedHeroIds.includes(h.id));
    const guaranteed = pool.filter(h => h.rarity !== "Common");
    if (this.state.shop.heroPity >= 4 && guaranteed.length) pool = guaranteed;
    const weights = {};
    for (const h of pool) weights[h.rarity] = (weights[h.rarity] || 0) + (HERO_RARITY_WEIGHTS[h.rarity] || HERO_RARITY_WEIGHTS.Rare);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    return Object.entries(weights).map(([rarity, weight]) => ({ rarity, percent: weight / total * 100 }));
  }
  exportProfile() {
    return JSON.stringify({ format: "ultimate-marvel-td-3d-profile", version: 1, state: this.state }, null, 2);
  }
  prepareImport(text) {
    if (text.length > 2_000_000) throw Error("El archivo es demasiado grande.");
    const envelope = JSON.parse(text);
    if (!["ultimate-marvel-td-3d-profile", "tower-defense-marvel-save"].includes(envelope.format)) throw Error("El archivo no es un perfil de Marvel TD.");
    if (envelope.version !== (envelope.format === "tower-defense-marvel-save" ? SAVE_VERSION : 1)) throw Error("Versión de archivo incompatible.");
    const state = this.readState(envelope.state);
    return { state, heroes: state.unlockedHeroIds.length, credits: state.credits };
  }
  importProfile(prepared) {
    // No mutation until the previous bytes are backed up and the new save fits.
    const state = this.readState(prepared.state);
    const previous = this.disk.getItem(COLLECTION_KEY);
    if (previous) this.disk.setItem(`${COLLECTION_KEY}-backup`, previous);
    this.disk.setItem(COLLECTION_KEY, JSON.stringify(state));
    this.rawBackup = previous;
    this.state = state;
    this.blocked = false;
    this.status = "";
    this.onStatus?.("");
    this.attachHub();
  }
}

class CollectionValidator extends ProgressionManager {
  constructor() { super(null); }
  save() { return true; }
  applySettings() {}
}
