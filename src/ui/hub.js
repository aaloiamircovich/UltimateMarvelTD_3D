import { HubWorld } from "../render/hub.js";
import { HUB_STATIONS } from "../game/hub.js";
import { HEROES, DEFAULT_TEAM, HERO_BY_ID } from "../game/combat-data.js";
import "./hub.css";

export class Hub {
  constructor(profile, startMission, portraits) {
    this.profile = profile;
    this.startMission = startMission;
    this.portraits = portraits;
    this.teamIds = [...DEFAULT_TEAM];
    this.element = document.createElement("section");
    this.element.id = "hub";
    this.element.innerHTML = `
      <div id="hub-world"></div>
      <header class="hub-top"><div class="hub-brand"><span>MARVEL</span><strong>ULTIMATE TD<small>AVENGERS CAMPUS</small></strong></div><div class="hub-status"><i></i> HUB PERSONAL <span>ALPHA 0.2</span></div><button id="hub-squad" class="hub-button">ESCUADRÓN · 6</button></header>
      <aside class="hub-intro"><span class="hub-kicker">TU PRÓXIMA MISIÓN EMPIEZA ACÁ</span><h1>Bienvenido,<br><em>agente.</em></h1><p>Recorré el campus, reuní a tus héroes<br>y entrá al próximo desafío.</p><div class="hub-record"><span>RÉCORD INFINITO</span><strong id="hub-best">0 <small>OLEADAS</small></strong></div></aside>
      <nav class="hub-destinations" aria-label="Destinos del HUB">${HUB_STATIONS.map(s => `<button class="hub-destination" data-station="${s.id}" style="--station:${s.color}"><span>${s.number}</span><div><strong>${s.name}</strong><small>${s.subtitle}</small></div><b>↗</b></button>`).join("")}</nav>
      <div class="hub-interact" hidden><span id="hub-nearby"></span><button id="hub-interact-button" class="hub-button"><kbd>E</kbd> INTERACTUAR</button></div>
      <footer class="hub-bottom"><span><kbd>W A S D</kbd> Caminar <b>·</b> Arrastrar para girar <b>·</b> <kbd>Espacio</kbd> Saltar</span><span>MANHATTAN · CAMPUS 01</span></footer>
      <div class="hub-touch" aria-label="Controles de movimiento"><button data-move="KeyW" aria-label="Caminar adelante">↑</button><div><button data-move="KeyA" aria-label="Caminar izquierda">←</button><button data-move="KeyS" aria-label="Caminar atrás">↓</button><button data-move="KeyD" aria-label="Caminar derecha">→</button></div></div>
      <dialog id="hub-dialog"><button id="hub-close" class="hub-close" aria-label="Cerrar panel">×</button><div id="hub-panel"></div></dialog>`;
    document.body.append(this.element);
    this.dialog = this.element.querySelector("dialog");
    this.world = new HubWorld(this.element.querySelector("#hub-world"), id => this.open(id));
    this.element.querySelectorAll("[data-station]").forEach(b => b.onclick = () => this.open(b.dataset.station));
    this.element.querySelector("#hub-close").onclick = () => this.dialog.close();
    this.dialog.addEventListener("close", () => { this.world.blocked = false; this.world.releaseInput(); });
    this.dialog.addEventListener("click", e => { if (e.target === this.dialog) this.dialog.close(); });
    this.element.querySelector("#hub-squad").onclick = () => this.open("squad");
    const archiveButton = document.createElement("button");
    archiveButton.id = "hub-archive";
    archiveButton.className = "hub-button";
    archiveButton.textContent = "ARCHIVO 2D";
    archiveButton.onclick = () => this.openArchive();
    const actions = document.createElement("div");
    actions.className = "hub-header-actions";
    const squadButton = this.element.querySelector("#hub-squad");
    squadButton.replaceWith(actions);
    actions.append(archiveButton, squadButton);
    this.element.querySelector("#hub-interact-button").onclick = () => {
      if (this.world.nearby) this.open(this.world.nearby.id);
    };
    this.element.querySelectorAll("[data-move]").forEach(b => {
      b.onpointerdown = e => {
        e.preventDefault(); b.setPointerCapture(e.pointerId);
        this.world.keys.add(b.dataset.move);
      };
      b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => this.world.keys.delete(b.dataset.move);
    });
    this.show();
  }
  show() {
    this.element.hidden = false;
    this.world.active = true;
    this.world.releaseInput();
    this.world.resize();
    this.element.querySelector("#hub-best").innerHTML = `${this.profile.bestInfinite || 0} <small>OLEADAS</small>`;
  }
  hide() {
    this.dialog.close();
    this.element.hidden = true;
    this.world.active = false;
    this.world.releaseInput();
  }
  open(id) {
    const station = HUB_STATIONS.find(s => s.id === id);
    const panel = this.element.querySelector("#hub-panel");
    const mission = id === "story" || id === "infinite";
    if (mission) {
      const infinite = id === "infinite";
      panel.innerHTML = `<div class="hub-kicker">${infinite ? "SUPERVIVENCIA ORIGINAL" : "HISTORIA · CAPÍTULO 01"}</div><h2>${infinite ? "Sin retirada." : "Defensa de la Base Avengers"}</h2><p>${infinite ? "Resistí con las reglas de supervivencia originales: oleadas sin límite y bonus cada cinco rondas." : "Defendé la base frente a la legión de Ultrón. Las 100 oleadas, los jefes y las habilidades usan las reglas del juego anterior."}</p><div class="hub-mission-details"><span>ESCENARIO<strong>Base Avengers</strong></span><span>OLEADAS<strong>${infinite ? "Sin límite" : "100"}</strong></span><span>ESCUADRÓN<strong>6 héroes</strong></span></div><p>${this.teamIds.map(id => HERO_BY_ID[id].name).join(" · ")}</p><p class="hub-note">Despliegue gratis, una unidad por héroe, mejoras hasta nivel 100. Cambiá el equipo desde ESCUADRÓN. Los 105 héroes están disponibles para probar el combate durante la migración; la colección y el inventario persistentes siguen pendientes. Los niveles y créditos de esta partida se reinician al salir.</p><button id="hub-launch" class="primary">${infinite ? "ENTRAR A INFINITO" : "INICIAR HISTORIA"} →</button>`;
      panel.querySelector("#hub-launch").onclick = () => this.startMission(infinite ? "infinite" : "story", this.teamIds);
    } else if (id === "squad") {
      panel.innerHTML = `<div class="hub-kicker">TU ESCUADRÓN</div><h2>Preparación de combate</h2><p>Elegí seis héroes distintos entre los 105 originales. Sus habilidades y sinergias se aplican en batalla. La selección está disponible durante la migración; todavía no representa una colección desbloqueada.</p><div class="hub-team-slots">${this.teamIds.map((id, i) => `<label>Posición ${i + 1}<select data-team-slot="${i}">${HEROES.map(h => `<option value="${h.id}" ${h.id === id ? "selected" : ""}>${h.name} · ${h.category}</option>`).join("")}</select></label>`).join("")}</div><p id="team-error" role="status"></p><button id="save-team" class="primary">APLICAR ESCUADRÓN</button><p class="hub-note">La elección se conserva mientras esta página esté abierta. Cada héroe puede desplegarse una vez; podés moverlo o retirarlo sin coste.</p>`;
      panel.querySelector("#save-team").onclick = () => {
        const ids = [...panel.querySelectorAll("[data-team-slot]")].map(select => select.value);
        if (new Set(ids).size !== 6) { panel.querySelector("#team-error").textContent = "Elegí seis héroes diferentes."; return; }
        this.teamIds = ids;
        panel.querySelector("#team-error").textContent = "Escuadrón listo para la próxima misión.";
      };
    } else {
      panel.innerHTML = `<div class="hub-kicker">${station.name}</div><h2>${station.subtitle}</h2><p>${id === "summon" ? "Este será el lugar para invocar personajes y ampliar tu colección." : id === "traits" ? "Este laboratorio estará dedicado a los traits de tus unidades." : "Acá vas a gestionar los grades de tus unidades."}</p><div class="hub-pending">ZONA EN PREPARACIÓN</div><p class="hub-note">El espacio ya está ubicado en el HUB. Este sistema todavía no está implementado; sus reglas de progresión están pendientes de definición.</p>`;
    }
    this.world.blocked = true;
    this.world.releaseInput();
    this.dialog.showModal();
  }
  async openArchive() {
    const panel = this.element.querySelector("#hub-panel");
    panel.innerHTML = '<p role="status">Cargando el archivo del juego original…</p>';
    this.world.blocked = true;
    this.world.releaseInput();
    this.dialog.showModal();
    const request = Symbol();
    this.archiveRequest = request;
    try {
      const { LegacyCatalog } = await import("./legacy-catalog.js");
      if (!this.dialog.open || this.archiveRequest !== request || !panel.querySelector('[role="status"]')) return;
      if (this.catalog) this.catalog.render();
      else this.catalog = new LegacyCatalog(panel);
    } catch (error) {
      console.error(error);
      if (this.dialog.open && this.archiveRequest === request)
        panel.innerHTML = '<h2>No se pudo abrir el archivo.</h2><p>Cerrá este panel y volvé a intentarlo.</p>';
    }
  }
  render(dt) {
    this.world.render(dt);
    const station = this.world.nearby;
    this.element.querySelector(".hub-interact").hidden = !station;
    this.element.querySelector("#hub-nearby").textContent = station?.name || "";
  }
}
