import { HubWorld } from "../render/hub.js";
import { HUB_STATIONS } from "../game/hub.js";
import { HEROES } from "../game/data.js";
import "./hub.css";

export class Hub {
  constructor(profile, startMission, portraits) {
    this.profile = profile;
    this.startMission = startMission;
    this.portraits = portraits;
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
      panel.innerHTML = `<div class="hub-kicker">${infinite ? "MODO INFINITO" : "HISTORIA · CAPÍTULO 01"}</div><h2>${infinite ? "Sin retirada." : "Invasión de Manhattan"}</h2><p>${infinite ? "La invasión no termina. Resistís hasta que caiga la base, con enemigos cada vez más fuertes y un jefe cada seis oleadas." : "Ultron ataca Nueva York. Defendé la Torre Stark durante 12 oleadas con tu escuadrón."}</p><div class="hub-mission-details"><span>ESCENARIO<strong>Manhattan</strong></span><span>OLEADAS<strong>${infinite ? "Sin límite" : "12"}</strong></span><span>ESCUADRÓN<strong>6 héroes</strong></span></div><p class="hub-note">En esta primera versión, la misión usa cámara táctica y los seis héroes iniciales. La partida en curso no se guarda.</p><button id="hub-launch" class="primary">${infinite ? "ENTRAR A INFINITO" : "INICIAR HISTORIA"} →</button>`;
      panel.querySelector("#hub-launch").onclick = () => this.startMission(infinite ? "infinite" : "story");
    } else if (id === "squad") {
      panel.innerHTML = `<div class="hub-kicker">TU ESCUADRÓN</div><h2>Los primeros Vengadores</h2><p>Escuadrón inicial de la alpha. La colección y el reclutamiento se incorporarán con las reglas de progresión.</p><div class="collection-grid">${HEROES.map(h => `<article style="--hero-color:${h.color}"><img src="${this.portraits[h.id]}" alt="${h.name}"><h3>${h.name}</h3><p>${h.role}</p></article>`).join("")}</div>`;
    } else {
      panel.innerHTML = `<div class="hub-kicker">${station.name}</div><h2>${station.subtitle}</h2><p>${id === "summon" ? "Este será el lugar para invocar personajes y ampliar tu colección." : id === "traits" ? "Este laboratorio estará dedicado a los traits de tus unidades." : "Acá vas a gestionar los grades de tus unidades."}</p><div class="hub-pending">ZONA EN PREPARACIÓN</div><p class="hub-note">El espacio ya está ubicado en el HUB. Este sistema todavía no está implementado; sus reglas de progresión están pendientes de definición.</p>`;
    }
    this.world.blocked = true;
    this.world.releaseInput();
    this.dialog.showModal();
  }
  render(dt) {
    this.world.render(dt);
    const station = this.world.nearby;
    this.element.querySelector(".hub-interact").hidden = !station;
    this.element.querySelector("#hub-nearby").textContent = station?.name || "";
  }
}
