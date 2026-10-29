import { HERO_BY_ID } from "../game/combat-data.js";
import { COLLECTION_KEY } from "../game/progression.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const number = value => Math.floor(value).toLocaleString("es-AR");
const asset = path => `${import.meta.env.BASE_URL}legacy/${path}`;
const rarityNames = { Common: "Común", Rare: "Raro", Epic: "Épico", Legendary: "Legendario", Mythic: "Mítico", Secret: "Secreto" };

export class CollectionPanel {
  constructor(element, collection, refresh) {
    this.element = element;
    this.collection = collection;
    this.refresh = refresh;
    this.notice = "";
  }
  render(tab = this.tab || "squad") {
    const p = this.collection, state = p.state;
    this.tab = state.unlockedHeroIds.length ? tab : "starter";
    const title = this.tab === "starter" ? "Tu primer héroe" : this.tab === "summon" ? "Centro de reclutamiento" : "Tu colección";
    this.element.innerHTML = `<div class="hub-kicker">${number(p.getCredits())} CRÉDITOS · ${state.unlockedHeroIds.length}/105 HÉROES</div><h2>${title}</h2>
      <p id="collection-notice" role="status">${escape(this.notice)}</p>${p.status ? `<p role="alert" class="collection-error">${escape(p.status)}</p>` : ""}
      ${this.tab === "starter" ? this.starters() : `<nav class="collection-tabs" aria-label="Colección"><button data-collection-tab="squad" aria-pressed="${this.tab === "squad"}">Equipo e inventario</button><button data-collection-tab="summon" aria-pressed="${this.tab === "summon"}">Reclutamiento y tienda</button></nav>${this.tab === "summon" ? this.shop() : this.squad()}`}
      <details class="collection-save"><summary>Guardado y traslado de perfil</summary><p>El perfil se guarda en este navegador. Exportalo para llevarlo a otra computadora. Se puede importar también un respaldo del juego 2D con versión 9.</p><button id="export-collection" class="hub-button">EXPORTAR PERFIL</button><label class="collection-import">Importar perfil <input id="import-collection" type="file" accept=".json,application/json"></label><div id="import-preview" role="status"></div><button id="export-backup" class="hub-button">DESCARGAR RESPALDO ANTERIOR</button><p id="save-feedback" role="status"></p></details>`;
    this.element.querySelectorAll("[data-collection-tab]").forEach(b => b.onclick = () => { this.notice = ""; this.render(b.dataset.collectionTab); });
    this.element.querySelectorAll("[data-starter]").forEach(b => b.onclick = () => {
      if (p.chooseStarter(b.dataset.starter)) this.result("Tu primer héroe está listo. Armá tu equipo o entrá a Historia.", "squad");
    });
    const saveTeam = this.element.querySelector("#save-team");
    if (saveTeam) saveTeam.onclick = () => {
      const ids = [...this.element.querySelectorAll("[data-team-slot]")].map(s => s.value).filter(Boolean);
      const error = this.element.querySelector("#team-error");
      if (!ids.length || new Set(ids).size !== ids.length) { error.textContent = "Elegí entre uno y seis héroes diferentes."; return; }
      p.setActiveTeam(ids);
      this.refresh();
      error.textContent = "Escuadrón listo para la próxima misión.";
    };
    this.element.querySelectorAll("[data-equip]").forEach(b => b.onclick = () => {
      const id = b.dataset.equip, item = this.element.querySelector(`[data-item-for="${id}"]`).value;
      const ok = item ? p.equipItem(id, item) : p.unequipItem(id);
      this.result(ok ? "Equipo actualizado. El objeto se aplicará en combate." : "No se cambió el equipo.", "squad");
    });
    const recruit = this.element.querySelector("#recruit-hero");
    if (recruit) recruit.onclick = () => {
      const result = p.recruit();
      this.result(result.ok ? `¡${result.hero.name} se une a tu colección! ${rarityNames[result.hero.rarity]}. Próximo reclutamiento: ${number(result.nextCost)} créditos.` : result.reason);
      if (result.ok) {
        const reveal = document.createElement("div");
        reveal.className = "recruit-reveal";
        reveal.innerHTML = `<img src="${HERO_BY_ID[result.hero.id].portrait}" alt=""><strong>${escape(result.hero.name)}</strong><span>${rarityNames[result.hero.rarity]}</span>`;
        this.element.querySelector("#collection-notice").after(reveal);
      }
    };
    this.element.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
      const result = p.purchase(b.dataset.buy);
      this.result(result.ok ? `${result.item.name} agregado al inventario. Equipalo en la pestaña Equipo e inventario.` : result.reason);
    });
    this.element.querySelector("#export-collection").onclick = () => this.download(p.exportProfile(), "marvel-td-perfil.json");
    this.element.querySelector("#export-backup").onclick = () => {
      try {
        const raw = p.rawBackup || p.disk.getItem(`${COLLECTION_KEY}-backup`);
        if (!raw) throw Error("No hay un respaldo anterior en este navegador.");
        let text = raw;
        try { text = JSON.stringify({ format: "ultimate-marvel-td-3d-profile", version: 1, state: JSON.parse(raw) }, null, 2); } catch { /* Preserve damaged bytes for recovery. */ }
        this.download(text, "marvel-td-respaldo.json");
      } catch (error) { this.element.querySelector("#save-feedback").textContent = error.message; }
    };
    this.element.querySelector("#import-collection").onchange = async e => {
      const preview = this.element.querySelector("#import-preview");
      try {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2_000_000) throw Error("El archivo es demasiado grande.");
        const prepared = p.prepareImport(await file.text());
        preview.textContent = `${prepared.heroes} héroes · ${number(prepared.credits)} créditos. Reemplazará el perfil actual; se conservará una copia anterior en este navegador. `;
        const apply = document.createElement("button");
        apply.id = "confirm-import"; apply.className = "hub-button"; apply.textContent = "APLICAR PERFIL";
        apply.onclick = () => {
          try { p.importProfile(prepared); this.result("Perfil importado. Tu colección está lista.", "squad"); }
          catch { preview.textContent = "No se pudo guardar el perfil importado. El perfil actual se conserva."; }
        };
        preview.append(apply);
      } catch (error) { preview.textContent = `No se pudo importar: ${error.message}`; }
    };
  }
  result(message, tab = this.tab) {
    this.notice = message;
    this.refresh();
    this.render(tab);
  }
  starters() {
    return `<p>Elegí uno de los tres héroes iniciales originales. Comenzás con 1.200 créditos para reclutar, comprar objetos o mejorar en combate.</p><div class="hub-collection-grid">${this.collection.starters.map(h => `<article class="collection-card"><img src="${HERO_BY_ID[h.id].portrait}" alt=""><h3>${escape(h.name)}</h3><span>${escape(h.category)} · Común</span><p>${escape(h.abilityDesc)}</p><button class="hub-button" data-starter="${h.id}">ELEGIR ${escape(h.name)}</button></article>`).join("")}</div>`;
  }
  squad() {
    const p = this.collection, s = p.state;
    const heroes = s.unlockedHeroIds.map(id => p.data.heroes[id]);
    const items = Object.values(p.data.items).filter(item => p.hasItem(item.id));
    return `<p>Elegí hasta seis héroes de tu colección. Niveles, prioridades y objetos se conservan entre partidas. Cada héroe admite un objeto; al transferirlo, se retira de su portador anterior.</p><div class="hub-team-slots">${Array.from({ length: 6 }, (_, i) => `<label>Posición ${i + 1}<select data-team-slot="${i}"><option value="">Vacía</option>${heroes.map(h => `<option value="${h.id}" ${s.activeTeamIds[i] === h.id ? "selected" : ""}>${escape(h.name)} · Nv. ${p.getHeroLevel(h.id)}</option>`).join("")}</select></label>`).join("")}</div><p id="team-error" role="status"></p><button id="save-team" class="primary">APLICAR ESCUADRÓN</button>
      <h3 class="collection-heading">Héroes y equipamiento · ${heroes.length}</h3><div class="hub-collection-grid">${heroes.map(h => {
        const equipped = Object.values(s.equippedItems[h.id] || {})[0];
        return `<article class="collection-card"><img src="${HERO_BY_ID[h.id].portrait}" alt=""><h3>${escape(p.getHeroEvolution(h.id)?.name || h.name)}</h3><span>Nv. ${p.getHeroLevel(h.id)} · ${rarityNames[h.rarity]}</span><details><summary>Habilidad</summary><p>${escape(h.abilityDesc)}</p></details><label>Objeto<select data-item-for="${h.id}"><option value="">Sin objeto</option>${items.map(item => {
          const owner = Object.entries(s.equippedItems).find(([, slots]) => Object.values(slots).includes(item.id))?.[0];
          return `<option value="${item.id}" ${equipped === item.id ? "selected" : ""}>${escape(item.name)}${owner ? ` · ${escape(p.data.heroes[owner].name)}` : " · libre"}</option>`;
        }).join("")}</select></label><button class="hub-button" data-equip="${h.id}">APLICAR OBJETO</button></article>`;
      }).join("")}</div><h3 class="collection-heading">Inventario · ${items.length}/82</h3><div class="hub-collection-grid">${items.map(item => this.itemCard(item)).join("") || "<p>Todavía no tenés objetos. Visitá la tienda para conseguir los primeros.</p>"}</div>`;
  }
  itemCard(item, buy = false) {
    const p = this.collection;
    return `<article class="collection-card item-card"><img src="${asset(item.icon)}" alt=""><h3>${escape(item.name)}</h3><span>${rarityNames[item.rarity]} · Nivel de tienda ${item.tier}</span><p>${escape(item.desc)}</p>${buy ? `<button data-buy="${item.id}" class="hub-button" ${p.getCredits() < item.price ? "disabled" : ""}>COMPRAR · ${number(item.price)}</button>` : `<span>${p.getOwnedQuantity(item.id)} libres</span>`}</article>`;
  }
  shop() {
    const p = this.collection, cost = p.recruitmentCost;
    const odds = p.recruitmentOdds();
    return `<p>Reclutá un héroe que todavía no tengas. El coste sube un 12% después de cada compra. Tras cuatro comunes consecutivos, el siguiente será de una rareza superior si quedan disponibles.</p><div class="recruit-box"><strong>${number(cost)} <small>CRÉDITOS</small></strong><span>Comunes consecutivos: ${p.state.shop.heroPity}/4</span><button id="recruit-hero" class="primary" ${p.getCredits() < cost || !odds.length ? "disabled" : ""}>${odds.length ? "RECLUTAR HÉROE" : "COLECCIÓN COMPLETA"}</button></div><details><summary>Probabilidades de esta compra</summary><p>${odds.map(o => `${rarityNames[o.rarity]}: ${o.percent.toFixed(2)}%`).join(" · ")}</p><p class="hub-note">Se calculan con los pesos originales por héroe, los personajes restantes y la garantía vigente.</p></details><h3 class="collection-heading">Tienda progresiva · objetos</h3><p>Los tres objetos más accesibles que te faltan. Cada compra habilita el siguiente del catálogo original.</p><div class="hub-collection-grid">${p.shopSystem.getShowcase().map(({ item }) => this.itemCard(item, true)).join("") || "<p>Ya tenés todos los objetos.</p>"}</div>`;
  }
  download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
