import { LEGACY, LEGACY_COUNTS, previewLegacyHero, legacyAsset, findLegacyEntries,
  SYNERGY_DEFINITIONS, EVOLUTION_CATALOG, GAME_MODES, CAMPAIGN_MAX_WAVES,
  getLevelUnlockRequirement, getAllowedTerrainLabels, analyzeTeam } from "../game/legacy-catalog.js";
import { formatEffectSummary } from "../legacy/src/systems/TeamSynergySystem.js";
import { runLegacyTrial } from "../game/legacy-combat.js";
import "./legacy-catalog.css";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const number = value => Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const image = (path, name) => legacyAsset(path) ? `<img src="${esc(legacyAsset(path))}" alt="${esc(name)}" loading="lazy">` : "";
const stat = (label, value) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
const tabs = { heroes: "Héroes", items: "Objetos", enemies: "Enemigos", levels: "Mapas", synergies: "Agrupaciones", migration: "Migración" };

export class LegacyCatalog {
  constructor(container) {
    this.container = container;
    this.section = "heroes";
    this.teamIds = [];
    this.query = "";
    this.rarity = "";
    this.limit = 24;
    this.heroId = "iron_man";
    this.level = 1;
    this.itemId = "";
    this.enemyId = "hydra_soldier";
    this.render();
  }
  render() {
    this.container.innerHTML = `<div class="hub-kicker">ARCHIVO DEL JUEGO ORIGINAL</div><h2>Archivo Marvel</h2><p class="legacy-intro">${LEGACY_COUNTS.heroes} héroes · ${LEGACY_COUNTS.items} objetos · ${LEGACY_COUNTS.enemies + LEGACY_COUNTS.bosses} enemigos · ${LEGACY_COUNTS.levels} mapas</p><p class="legacy-state">Las reglas originales ya se usan en la batalla de Base Avengers. Elegí tu equipo en ESCUADRÓN del HUB; esta pantalla permite consultar y probar estadísticas.</p><nav class="legacy-tabs" aria-label="Catálogo del juego 2D">${Object.entries(tabs).map(([key, name]) => `<button data-tab="${key}" aria-pressed="${key === this.section}">${name}</button>`).join("")}</nav><div id="legacy-body"></div>`;
    this.container.querySelectorAll("[data-tab]").forEach(button => button.onclick = () => {
      this.section = button.dataset.tab; this.query = ""; this.rarity = ""; this.limit = 24; this.render();
    });
    if (this.section === "migration") this.renderMigration();
    else if (this.section === "synergies") this.renderSynergies();
    else this.renderList();
    this.container.querySelectorAll("img").forEach(img => img.onerror = () => { img.hidden = true; });
  }
  get body() { return this.container.querySelector("#legacy-body"); }
  renderList() {
    this.body.innerHTML = `<div class="legacy-filters"><label>Buscar<input id="legacy-search" type="search" placeholder="Nombre, categoría o agrupación" value="${esc(this.query)}"></label>${["heroes", "items"].includes(this.section) ? `<label>Rareza<select id="legacy-rarity"><option value="">Todas</option>${["Common", "Rare", "Epic", "Legendary", "Mythic", "Secret"].map(r => `<option ${this.rarity === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>` : ""}</div><div id="legacy-results" role="status"></div><div class="legacy-layout"><div><div id="legacy-cards" class="legacy-cards"></div><button id="legacy-more" class="secondary">Mostrar más</button></div><aside id="legacy-detail"></aside></div>`;
    this.body.querySelector("#legacy-search").oninput = e => { this.query = e.target.value; this.limit = 24; this.updateCards(); };
    const rarity = this.body.querySelector("#legacy-rarity");
    if (rarity) rarity.onchange = e => { this.rarity = e.target.value; this.limit = 24; this.updateCards(); };
    this.body.querySelector("#legacy-more").onclick = () => { this.limit += 24; this.updateCards(); };
    this.updateCards();
    if (this.section === "heroes") this.showHero(this.heroId);
    else this.showEntry(findLegacyEntries(this.section)[0]);
  }
  updateCards() {
    const entries = findLegacyEntries(this.section, this.query, this.rarity);
    this.body.querySelector("#legacy-results").textContent = `${entries.length} resultados`;
    this.body.querySelector("#legacy-more").hidden = entries.length <= this.limit;
    const cards = this.body.querySelector("#legacy-cards");
    cards.innerHTML = entries.slice(0, this.limit).map(entry => `<button class="legacy-card" data-entry="${esc(entry.id)}">${image(entry.visual?.portrait || entry.sprite || entry.icon || entry.thumbnail, entry.name)}<span><small>${esc(entry.rarity || entry.difficulty || (LEGACY.enemies.bosses[entry.id] ? "JEFE" : entry.category))}</small><strong>${esc(entry.name)}</strong><em>${esc(entry.niche || entry.category || entry.slot || entry.theme?.label || "")}</em></span></button>`).join("");
    cards.querySelectorAll("[data-entry]").forEach(button => button.onclick = () => {
      if (this.section === "heroes") this.showHero(button.dataset.entry);
      else this.showEntry(entries.find(entry => entry.id === button.dataset.entry));
      if (window.innerWidth <= 800) this.body.querySelector("#legacy-detail").scrollIntoView({ block: "start" });
    });
    cards.querySelectorAll("img").forEach(img => img.onerror = () => { img.hidden = true; });
  }
  showHero(id) {
    this.heroId = id;
    const hero = LEGACY.heroes[id];
    const preview = previewLegacyHero(id, { level: this.level, itemId: this.itemId, teamIds: this.teamIds });
    const visual = LEGACY.evolutionVisuals[preview.evolution?.transformId] || LEGACY.evolutionVisuals[preview.evolution?.id];
    const portrait = visual?.visual?.portrait || visual?.sprite || hero.visual?.portrait || hero.sprite;
    const evolution = Object.values(EVOLUTION_CATALOG).find(e => e.baseHeroId === id);
    const detail = this.body.querySelector("#legacy-detail");
    detail.innerHTML = `<div class="legacy-detail-heading">${image(portrait, preview.evolution?.name || hero.name)}<div><span>${esc(hero.rarity)} · ${esc(hero.category)}</span><h3>${esc(preview.evolution?.name || hero.name)}</h3></div></div><p>${esc(hero.niche)}</p><h4>${esc(hero.ability)}</h4><p>${esc(hero.abilityDesc)}</p><div class="legacy-numbers">${stat("Costo original", number(hero.cost))}${stat("Daño", preview.support ? "Apoyo" : number(preview.stats.damage))}${stat("Ataques / s", preview.support ? "No ataca" : number(preview.stats.fireRate))}${stat("Alcance 2D (px)", number(preview.stats.range))}${stat("Crítico", `${number(preview.stats.critChance)}%`)}${stat("Detecta sigilo", preview.stats.canSeeStealth ? "Sí" : "No")}</div><label class="legacy-label">Probar nivel <output>${preview.level}</output><input id="legacy-level" type="range" min="1" max="100" value="${preview.level}"></label><label class="legacy-label">Probar un objeto<select id="legacy-item"><option value="">Sin objeto</option>${Object.values(LEGACY.items).map(i => `<option value="${esc(i.id)}" ${i.id === this.itemId ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select></label><p class="legacy-small">Vista previa con el cálculo original, sin gasto ni cambios de guardado. Las cargas temporales de combate comienzan vacías.</p><h4>Evolución por nivel</h4><p>${esc(evolution?.name || "Sin evolución")}${evolution ? ` · nivel ${evolution.requiredLevel}` : ""}</p>${evolution?.itemTransforms?.length ? `<p class="legacy-small">Con objeto: ${evolution.itemTransforms.map(t => `${esc(t.name)} (${esc(LEGACY.items[t.itemId]?.name || t.itemId)})`).join(" · ")}</p>` : ""}<p class="legacy-small">Siguiente nivel: ${Number.isFinite(preview.upgradeCost) ? `${number(preview.upgradeCost)} créditos` : "Máximo"}</p><h4>Terrenos</h4><p>${esc(getAllowedTerrainLabels(preview.hero.allowedTerrains))}</p><h4>Agrupaciones</h4><p>${esc((hero.tags || []).join(" · "))}</p><button id="legacy-team-toggle" class="secondary">${this.teamIds.includes(id) ? "Quitar de la prueba" : "Añadir a prueba de sinergias"} (${this.teamIds.length}/6)</button><p id="legacy-team-message" role="status"></p>`;
    this.renderCombatTrial(detail);
    detail.querySelector("#legacy-level").onchange = e => { this.level = Number(e.target.value); this.showHero(id); };
    detail.querySelector("#legacy-level").oninput = e => { detail.querySelector("output").textContent = e.target.value; };
    detail.querySelector("#legacy-item").onchange = e => { this.itemId = e.target.value; this.showHero(id); };
    detail.querySelector("#legacy-team-toggle").onclick = () => {
      if (this.teamIds.includes(id)) this.teamIds = this.teamIds.filter(value => value !== id);
      else if (this.teamIds.length < 6) this.teamIds.push(id);
      else { detail.querySelector("#legacy-team-message").textContent = "La prueba admite hasta seis héroes distintos."; return; }
      this.showHero(id);
    };
  }
  renderCombatTrial(detail) {
    detail.insertAdjacentHTML("beforeend", `<section class="legacy-trial" aria-labelledby="legacy-trial-title"><div class="hub-kicker">LABORATORIO · REGLAS ORIGINALES</div><h4 id="legacy-trial-title">Ensayo de combate</h4><p class="legacy-small">15 segundos, semilla fija y seis enemigos base, uno por segundo. Se usa el nivel y objeto de esta ficha. Incluye hasta cinco compañeros de la prueba de sinergias, en nivel 1 y sin objeto. Ruta recta sin bonificaciones de terreno; colocación libre de laboratorio.</p><label class="legacy-label">Enemigo de prueba<select id="legacy-trial-enemy">${Object.entries({ Normales: LEGACY.enemies.normal, Jefes: LEGACY.enemies.bosses }).map(([label, entries]) => `<optgroup label="${label}">${Object.values(entries).map(e => `<option value="${esc(e.id)}" ${this.enemyId === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</optgroup>`).join("")}</select></label><button id="legacy-trial-run" class="secondary">Simular 15 segundos</button><div id="legacy-trial-result" role="status" aria-live="polite"><p class="legacy-small">Prueba numérica del núcleo 2D. No modifica tu colección ni la misión 3D actual.</p></div></section>`);
    detail.querySelector("#legacy-trial-enemy").onchange = e => {
      this.enemyId = e.target.value;
      detail.querySelector("#legacy-trial-result").textContent = "Enemigo cambiado. Ejecutá el ensayo para ver el resultado.";
    };
    detail.querySelector("#legacy-trial-run").onclick = () => {
      const output = detail.querySelector("#legacy-trial-result");
      try {
        const result = runLegacyTrial({ heroId: this.heroId, level: this.level, itemId: this.itemId, enemyId: this.enemyId, teamIds: this.teamIds });
        const selected = result.heroes[0];
        output.innerHTML = `<p class="legacy-trial-summary">${result.defeated ? "Derrota en el ensayo" : "Ensayo completado"} · ${number(result.seconds)} s</p><div class="legacy-numbers">${stat("Daño del héroe", number(selected.combat.damageDealt))}${stat("Daño del equipo", number(result.heroes.reduce((sum, h) => sum + h.combat.damageDealt, 0)))}${stat("Habilidades del héroe", number(selected.combat.abilityActivations))}${stat("Enemigos derrotados", result.totals.defeated)}${stat("Fugas", result.totals.leaked)}${stat("Enemigos en ruta", result.enemies.length)}${stat("Vidas restantes", result.lives)}${stat("Créditos obtenidos", number(result.credits - 650))}</div><p class="legacy-small">Equipo: ${result.heroes.map(h => esc(LEGACY.heroes[h.id].name)).join(" · ")}. Los héroes de apoyo pueden mejorar al equipo sin infligir daño. Un jefe que llega al final provoca derrota inmediata.</p>`;
      } catch (error) {
        output.textContent = `No se pudo completar el ensayo: ${error.message}`;
      }
    };
  }
  showEntry(entry) {
    if (!entry) return;
    const detail = this.body.querySelector("#legacy-detail");
    let contents = "";
    if (this.section === "items") {
      contents = `<p>${esc(entry.desc)}</p><div class="legacy-numbers">${stat("Precio", number(entry.price))}${stat("Rareza", entry.rarity)}${stat("Tipo", entry.slot)}${stat("Nivel", entry.tier)}</div><p class="legacy-small">Regla original: un objeto equipado por héroe. Las firmas especiales y transformaciones se conservan en el núcleo importado.</p>`;
    } else if (this.section === "enemies") {
      contents = `<div class="legacy-numbers">${stat("Vida", number(entry.hp))}${stat("Velocidad (px/s)", number(entry.speed))}${stat("Recompensa", number(entry.reward))}${stat("Armadura", `${number((entry.armor || 0) * 100)}%`)}</div><p>${esc(entry.faction || "")} · ${esc(entry.category || "")}</p><p>${entry.stealth ? "Enemigo con sigilo." : "Sin sigilo inicial."} ${entry.flying ? "Unidad voladora." : ""}</p><h4>Comportamiento</h4><p>${esc(entry.archetype || (LEGACY.enemies.bosses[entry.id] ? "Jefe" : "Normal"))}</p><p class="legacy-small">Vida y recompensas base; el sistema original escala por mapa, dificultad y oleada.</p>`;
    } else {
      const index = LEGACY.levels.findIndex(l => l.id === entry.id);
      contents = `<p>${esc(entry.description)}</p><div class="legacy-numbers">${stat("Oleadas de campaña", CAMPAIGN_MAX_WAVES)}${stat("Estrellas para acceso", getLevelUnlockRequirement(index))}${stat("Dificultad", entry.difficulty)}${stat("Ruta", `${entry.path?.length || 0} nodos`)}</div><h4>${esc(entry.mission?.operation || "Misión")}</h4><p>${esc(entry.mission?.briefing || "")}</p><h4>${esc(entry.mission?.mechanic?.label || "Objetivos")}</h4><p>${esc(entry.mission?.mechanic?.description || "")}</p>${(entry.mission?.objectives || []).map(o => `<p class="legacy-objective"><strong>${esc(o.label)}</strong><br>${esc(o.description)}<br><small>Recompensa: ${number(o.reward)}</small></p>`).join("")}<p class="legacy-small">Definición y ruta recuperadas. Este mapa todavía no está convertido a escenario 3D jugable.</p>`;
    }
    detail.innerHTML = `<div class="legacy-detail-heading">${image(entry.sprite || entry.icon || entry.thumbnail, entry.name)}<h3>${esc(entry.name)}</h3></div>${contents}`;
    detail.querySelectorAll("img").forEach(img => img.onerror = () => { img.hidden = true; });
  }
  renderSynergies() {
    const snapshot = analyzeTeam(this.teamIds.map(id => LEGACY.heroes[id]));
    this.body.innerHTML = `<p class="legacy-small">Agregá hasta seis personajes desde Héroes para comprobar los umbrales y bonificaciones del juego anterior.</p><div class="legacy-team">${this.teamIds.length ? this.teamIds.map(id => `<button data-remove="${esc(id)}">${esc(LEGACY.heroes[id].name)} ×</button>`).join("") : "Sin equipo de prueba"}</div><div class="legacy-groups">${snapshot.families.map(f => `<article><h3>${esc(f.tag)} <small>${f.count} héroes</small></h3><p>${esc(f.definition.description || "")}</p>${f.definition.tiers.map(t => `<p class="${f.activeTier === t ? "legacy-active" : ""}">${t.count} héroes · ${esc(t.label || t.name || "")}<br><small>${esc(formatEffectSummary(t.effects))}</small></p>`).join("")}</article>`).join("")}</div><h3 class="legacy-pair-title">Sinergias de pareja</h3><div class="legacy-groups">${snapshot.pairs.map(p => `<article class="${p.active ? "legacy-active" : ""}"><h3>${esc(p.name || p.label)}</h3><p>${p.heroIds.map(id => esc(LEGACY.heroes[id]?.name || id)).join(" + ")}</p><small>${esc(formatEffectSummary(p.effects))}</small></article>`).join("")}</div>`;
    this.body.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => { this.teamIds = this.teamIds.filter(id => id !== b.dataset.remove); this.renderSynergies(); });
  }
  renderMigration() {
    this.body.innerHTML = `<div class="legacy-groups"><article><h3>Recuperado y verificable</h3><p>Datos completos, retratos e iconos. Núcleo original de habilidades, daño, estados, objetos, firmas, evoluciones, sinergias, economía, progresión y generación de oleadas.</p></article><article><h3>Integrado en esta pantalla</h3><p>Catálogo completo, búsqueda, rarezas, simulador de estadísticas por nivel y objeto, evoluciones y prueba de agrupaciones con las reglas originales.</p></article><article><h3>Próximas integraciones</h3><p>El combate ya usa los 105 kits, enemigos, jefes, sinergias, niveles y 100 oleadas en Base Avengers. Faltan inventario y guardado completo, los otros diez mapas y los modos diaria, Boss Rush y draft.</p></article></div><h3 class="legacy-pair-title">Modos que ya existen en el original</h3><div class="legacy-groups"><article><h3>Campaña</h3><p>11 mapas · 100 oleadas por misión · desbloqueos por estrellas.</p></article>${Object.values(GAME_MODES).map(mode => `<article><h3>${esc(mode.name)}</h3><p>${esc(mode.description)}</p></article>`).join("")}</div><p class="legacy-small">Fuente: TowerDefense_Marvel · commit 84797a5. Prioridad: completar esta migración antes de nuevas funciones exclusivas del 3D. Traits y grades mantienen sus reglas pendientes.</p>`;
  }
}
