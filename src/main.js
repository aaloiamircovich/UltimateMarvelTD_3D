import "./style.css";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow/latin-800.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import {
  HEROES,
  HERO_BY_ID,
  ENEMIES,
  WAVE_COUNT,
  waveDefinition,
} from "./game/data.js";
import { Game, placementError } from "./game/simulation.js";
import { loadProfile, saveProfile } from "./game/profile.js";
import { World } from "./render/world.js";
import { makePortraits } from "./render/models.js";
import { AudioManager } from "./ui/audio.js";
import { icon } from "./ui/icons.js";
import { Vector3 } from "three";

const $ = (id) => document.getElementById(id);
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw Error("Storage unavailable");
    },
  };
}
const profile = loadProfile(storage),
  game = new Game(),
  audio = new AudioManager(profile.sound);
let selectedHero = null,
  selectedUnitId = null,
  hoverPoint = null,
  detailsSignature = "",
  ended = false,
  lastKills = 0;
let world,
  portraits = {},
  toastTimer;

$("app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Ultimate Marvel Tower Defense"><span class="marvel">MARVEL</span><span class="brand-name">ULTIMATE <b>TD</b><small>TOWER DEFENSE · 3D</small></span></a>
    <div class="operation-header"><span class="live-dot"></span> OPERACIÓN MANHATTAN <span class="alpha">ALPHA 0.1</span></div>
    <nav class="top-actions" aria-label="Menú"><button id="collection" class="nav-button">${icon("box")}<span>Héroes</span></button><button id="help" class="icon-button" aria-label="Cómo jugar" title="Cómo jugar">${icon("help")}</button><button id="settings" class="icon-button" aria-label="Ajustes" title="Ajustes">${icon("settings")}</button></nav>
  </header>
  <main>
    <div id="world"></div>
    <div class="vignette"></div>
    <section class="battle-stats" aria-label="Estado de la partida">
      <div class="stat base-stat">${icon("shield")}<div><span>INTEGRIDAD DE LA BASE</span><strong id="health">100 <small>/ 100</small></strong><div class="health-track"><i id="health-bar"></i></div></div></div>
      <div class="stat credits-stat">${icon("coin")}<div><span>CRÉDITOS</span><strong id="cash">1.000</strong></div></div>
      <div class="stat wave-stat">${icon("bolt")}<div><span>OLEADA</span><strong id="wave">00 <small>/ 12</small></strong></div></div>
    </section>
    <aside class="mission-panel glass">
      <div class="eyebrow"><span class="tiny-line"></span> MODO HISTORIA <span class="chapter">01</span></div>
      <h1>Invasión de<br><em>Manhattan</em></h1>
      <p class="mission-copy">La ciudad nos necesita.<br>Que nadie llegue a la Torre Stark.</p>
      <div class="mission-tags"><span>NUEVA YORK</span><span class="difficulty">NORMAL</span></div>
      <div class="divider"></div>
      <div class="objective">${icon("shield")}<div><strong>Defendé la ciudad</strong><span>Sobreviví a las 12 oleadas</span></div></div>
      <div class="progress-dots" id="wave-dots">${Array.from({ length: 12 }, (_, i) => `<i data-wave="${i + 1}"></i>`).join("")}</div>
      <div class="mission-progress"><span>PROGRESO</span><b id="progress">0 / 12</b></div>
      <div class="synergy" id="synergy">${icon("bolt")}<div><strong>Vengadores unidos <b id="synergy-count">0/3</b></strong><span id="synergy-info">3 distintos: +10% de daño Avenger</span></div></div>
      <div class="mission-footer"><span>MEJOR MARCA</span><b id="best-wave">${profile.bestWave} OLEADAS</b></div>
    </aside>
    <aside id="inspector" class="inspector glass"></aside>
    <div id="boss-hud" class="boss-hud" hidden><span>${icon("skull")} ULTRON <small>LA ERA DE LAS MÁQUINAS</small></span><div><i id="boss-bar"></i></div></div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <div id="placement-hint" class="placement-hint" hidden></div>
    <div class="camera-controls"><button id="camera-reset" class="icon-button" aria-label="Restablecer cámara" title="Restablecer cámara [R]">${icon("target")}</button><span>ARRASTRÁ CON CLIC DERECHO PARA ROTAR<br>RUEDA PARA ACERCAR</span></div>
    <div class="wave-controls glass">
      <div class="wave-controls-top"><span id="phase-label"><i class="live-dot"></i> PREPARACIÓN</span><span id="enemy-count">0 ENEMIGOS</span></div>
      <button id="start-wave" class="primary">INICIAR OLEADA ${icon("play")}</button>
      <div class="playback"><button id="pause" aria-label="Pausar partida" title="Pausa [Espacio]">${icon("pause")}</button><button id="speed" aria-label="Cambiar velocidad">1×</button><button id="auto" aria-pressed="false"><span class="toggle-dot"></span>AUTO</button><button id="sound" aria-label="Silenciar sonido">${icon("sound")}</button></div>
    </div>
    <footer class="hero-dock">
      <div class="dock-heading"><span>TU <strong>ESCUADRÓN</strong><span class="dock-divider">/</span><span id="deploy-count">0 DE 12 DESPLEGADOS</span></span><span class="dock-instruction">ELEGÍ UN HÉROE Y COLOCALO EN EL MAPA</span></div>
      <div id="roster" class="roster"></div>
      <div class="dock-footer"><span><kbd>1</kbd>–<kbd>6</kbd> Seleccionar <span>·</span> <kbd>Esc</kbd> Cancelar <span>·</span> <kbd>U</kbd> Mejorar</span><span class="connection"><i></i> SISTEMAS EN LÍNEA</span></div>
    </footer>
    <div id="paused-overlay" class="paused-overlay" hidden>PARTIDA EN PAUSA <small>Espacio para continuar</small></div>
  </main>
  <dialog id="modal"><button id="close-modal" class="icon-button dialog-close" aria-label="Cerrar">${icon("cross")}</button><div id="modal-content"></div></dialog>
`;

function toast(message, error = false) {
  $("toast").textContent = message;
  $("toast").className = `toast visible ${error ? "error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3500);
}
function persist() {
  if (!saveProfile(storage, profile))
    toast(
      "El navegador no permite guardar el progreso. La partida puede continuar.",
      true,
    );
}
function showModal(html, type = "info") {
  modalWasPaused = game.paused;
  game.paused = true;
  $("modal").dataset.type = type;
  $("modal-content").innerHTML = html;
  $("close-modal").hidden = type === "end";
  $("modal").showModal();
  updateUI();
}
let modalWasPaused = false;
function closeModal() {
  if ($("modal").dataset.type === "end") return;
  $("modal").close();
  game.paused = modalWasPaused;
  updateUI();
}
$("close-modal").onclick = closeModal;
$("modal").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});

function selectHero(id) {
  if (ended) return;
  selectedHero = selectedHero === id ? null : id;
  selectedUnitId = null;
  detailsSignature = "";
  updateUI();
}
function onPick(point) {
  audio.unlock();
  if (ended) return;
  if (selectedHero) {
    const result = game.deploy(selectedHero, point.x, point.z);
    if (result.error) {
      toast(result.error, true);
      return;
    }
    selectedUnitId = result.unit.id;
    selectedHero = null;
    toast(
      `${HERO_BY_ID[result.unit.heroId].name} desplegado. ¡Listo para defender!`,
    );
  } else
    selectedUnitId =
      point.unitId ||
      game.units.find((u) => Math.hypot(point.x - u.x, point.z - u.z) < 1)
        ?.id ||
      null;
  detailsSignature = "";
  updateUI();
}
function updateInspector() {
  const unit = game.units.find((u) => u.id === selectedUnitId),
    hero = HERO_BY_ID[selectedHero || unit?.heroId];
  $("inspector").classList.toggle("placing", !!selectedHero);
  const stats = unit ? game.stats(unit) : null;
  const signature = JSON.stringify([
    selectedHero,
    selectedUnitId,
    unit?.level,
    unit?.priority,
    stats,
    Math.floor(unit?.damageDealt || 0),
    game.cash,
    game.wave,
    game.phase,
  ]);
  if (detailsSignature === signature) return;
  detailsSignature = signature;
  if (!hero) {
    const next =
      Math.min(game.wave + (game.phase === "preparing" ? 1 : 0), 12) || 1;
    const wave = waveDefinition(next),
      counts = {};
    wave.enemies.forEach((kind) => (counts[kind] = (counts[kind] || 0) + 1));
    $("inspector").innerHTML =
      `<div class="eyebrow">${icon("target")} INTEL DE MISIÓN</div><h2>${game.phase === "combat" ? "Oleada en curso" : "La próxima amenaza"}</h2><div class="intel-wave"><span>OLEADA ${String(next).padStart(2, "0")}</span><b>${wave.enemies.length} enemigos</b></div><div class="enemy-list">${Object.entries(
        counts,
      )
        .map(
          ([kind, n]) =>
            `<div><span class="enemy-symbol" style="--enemy-color:${ENEMIES[kind].color}">${icon(kind === "boss" ? "skull" : "box")}</span><span>${ENEMIES[kind].name}<small>${kind === "runner" ? "RÁPIDO" : kind === "tank" ? "RESISTENTE" : kind === "boss" ? "JEFE" : "BÁSICO"}</small></span><b>×${n}</b></div>`,
        )
        .join(
          "",
        )}</div><div class="intel-tip">${icon("help")}<p>${next === 1 ? "Empezá con Iron Man y Spider-Man. Cubrí las curvas para atacar durante más tiempo." : next % 6 === 0 ? "Ultron se aproxima. Mejorá tu daño y usá telarañas para frenarlo." : "Seleccioná una unidad desplegada para mejorarla o cambiar su objetivo."}</p></div><div class="reward-line"><span>BONUS DE OLEADA</span><b>${icon("coin")} ${wave.bonus}</b></div>`;
    return;
  }
  const damage = stats?.damage ?? hero.damage,
    range = stats?.range ?? hero.range,
    interval = stats?.interval ?? hero.interval;
  $("inspector").innerHTML =
    `<div class="eyebrow"><span style="color:${hero.color}">${hero.rarity.toUpperCase()}</span><button id="clear-selection" class="small-close" aria-label="Cerrar selección">${icon("cross")}</button></div><div class="unit-preview" style="--hero-color:${hero.color}"><div class="portrait-orbit"></div><img src="${portraits[hero.id]}" alt="Modelo 3D de ${hero.name}"/><span>${unit ? `NIVEL ${unit.level} / 4` : "LISTO PARA DESPLEGAR"}</span></div><h2>${hero.name}</h2><p class="unit-role">${hero.role} ${hero.avenger ? "· Avengers" : ""}</p><div class="unit-stats"><div><span>DAÑO</span><b>${damage}</b></div><div><span>ALCANCE</span><b>${range.toFixed(1)}</b></div><div><span>CADENCIA</span><b>${hero.kind === "aura" ? "—" : interval.toFixed(2) + "s"}</b></div></div><div class="ability-title">${icon("bolt")} ${hero.ability}</div><p class="ability-copy">${hero.description}</p>${unit ? `<button id="priority" class="secondary priority">${icon("target")} Objetivo: ${unit.priority}</button><button id="upgrade" class="primary upgrade" ${stats.upgradeCost === null || game.cash < stats.upgradeCost ? "disabled" : ""}>${icon("up")} ${stats.upgradeCost === null ? "NIVEL MÁXIMO" : `MEJORAR <b>◈ ${stats.upgradeCost}</b>`}</button><p class="upgrade-preview">${unit.level < 4 ? `Próximo: ${hero.kind === "aura" ? "mayor cobertura" : "+58% daño"} · +0.4 alcance` : "Potencial máximo alcanzado"}</p><button id="sell" class="sell-button">Vender unidad <b>◈ ${stats.sellValue}</b></button><div class="unit-total">DAÑO TOTAL <b>${Math.round(unit.damageDealt).toLocaleString("es-AR")}</b></div>` : `<div class="deploy-instruction">${icon("target")} Hacé clic en una zona libre del mapa.</div><button id="cancel-placement" class="secondary">Cancelar despliegue <kbd>Esc</kbd></button>`}`;
  $("clear-selection").onclick = clearSelection;
  if (unit) {
    $("priority").onclick = () => {
      game.cyclePriority(unit.id);
      updateUI();
    };
    $("upgrade").onclick = () => upgradeSelected();
    $("sell").onclick = () => {
      game.sell(unit.id);
      selectedUnitId = null;
      toast("Unidad retirada. Créditos recuperados.");
      updateUI();
    };
  } else $("cancel-placement").onclick = clearSelection;
}
function clearSelection() {
  selectedHero = null;
  selectedUnitId = null;
  hoverPoint = null;
  detailsSignature = "";
  updateUI();
}
function upgradeSelected() {
  if (selectedUnitId && game.upgrade(selectedUnitId)) {
    toast("¡Mejora aplicada!");
    updateUI();
  } else toast("No se puede mejorar: verificá los créditos y el nivel.", true);
}
function updateUI() {
  $("cash").textContent = game.cash.toLocaleString("es-AR");
  $("health").innerHTML = `${game.health} <small>/ 100</small>`;
  $("health-bar").style.width = `${game.health}%`;
  $("wave").innerHTML =
    `${String(game.wave).padStart(2, "0")} <small>/ 12</small>`;
  const completed =
    game.wave - (game.phase === "combat" || game.phase === "defeat" ? 1 : 0);
  $("progress").textContent = `${Math.max(0, completed)} / 12`;
  document
    .querySelectorAll("#wave-dots i")
    .forEach(
      (dot, i) =>
        (dot.className =
          i < completed
            ? "done"
            : i === game.wave - 1 && game.phase === "combat"
              ? "current"
              : ""),
    );
  $("synergy-count").textContent = `${game.avengerCount}/3`;
  $("synergy").classList.toggle("active", game.avengerCount >= 3);
  $("synergy-info").textContent =
    game.avengerCount >= 3
      ? "+10% de daño Avenger activo"
      : "3 distintos: +10% de daño Avenger";
  $("deploy-count").textContent = `${game.units.length} DE 12 DESPLEGADOS`;
  $("phase-label").innerHTML =
    `<i class="live-dot"></i> ${game.paused ? "EN PAUSA" : game.phase === "combat" ? "EN COMBATE" : game.phase === "victory" ? "VICTORIA" : game.phase === "defeat" ? "DERROTA" : "PREPARACIÓN"}`;
  $("enemy-count").textContent =
    `${game.enemies.length + game.spawnQueue.length} ENEMIGOS`;
  $("start-wave").disabled = game.phase !== "preparing" || game.paused;
  $("start-wave").innerHTML =
    game.phase === "combat"
      ? `OLEADA EN CURSO ${icon("bolt")}`
      : game.wave === 0
        ? `INICIAR OLEADA ${icon("play")}`
        : game.phase === "preparing"
          ? `SIGUIENTE OLEADA ${icon("play")}`
          : `MISIÓN FINALIZADA ${icon("shield")}`;
  $("speed").textContent = `${game.speed}×`;
  $("pause").innerHTML = icon(game.paused ? "play" : "pause");
  $("pause").setAttribute(
    "aria-label",
    game.paused ? "Continuar partida" : "Pausar partida",
  );
  $("auto").setAttribute("aria-pressed", String(game.auto));
  $("sound").innerHTML = icon(audio.enabled ? "sound" : "mute");
  $("sound").setAttribute(
    "aria-label",
    audio.enabled ? "Silenciar sonido" : "Activar sonido",
  );
  $("paused-overlay").hidden = !game.paused || $("modal").open;
  const boss = game.enemies.find((e) => e.kind === "boss");
  $("boss-hud").hidden = !boss;
  if (boss) $("boss-bar").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  document.querySelectorAll(".hero-card").forEach((card) => {
    const h = HERO_BY_ID[card.dataset.hero];
    card.classList.toggle("selected", selectedHero === h.id);
    card.classList.toggle("unaffordable", game.cash < h.cost);
    card.setAttribute("aria-pressed", String(selectedHero === h.id));
  });
  $("placement-hint").hidden = !selectedHero;
  if (selectedHero) {
    const error = hoverPoint
      ? placementError(hoverPoint.x, hoverPoint.z, game.units)
      : null;
    $("placement-hint").innerHTML =
      `${icon("target")} ${error || `Desplegar ${HERO_BY_ID[selectedHero].name}`} <kbd>Esc</kbd>`;
    $("placement-hint").classList.toggle("invalid", !!error);
  }
  updateInspector();
}

$("start-wave").onclick = () => {
  audio.unlock();
  game.startWave();
  clearSelection();
};
$("pause").onclick = () => {
  if (!ended) game.paused = !game.paused;
  updateUI();
};
$("speed").onclick = () => {
  game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1;
  updateUI();
};
$("auto").onclick = () => {
  game.auto = !game.auto;
  updateUI();
};
$("sound").onclick = () => {
  audio.unlock();
  audio.enabled = !audio.enabled;
  profile.sound = audio.enabled;
  persist();
  updateUI();
};
$("camera-reset").onclick = () => world?.resetCamera();
$("help").onclick = () =>
  showModal(
    `<div class="eyebrow">PROTOCOLO DE DEFENSA</div><h2>La ciudad está en tus manos.</h2><div class="help-steps"><div><b>01</b><p><strong>Reuní a tu escuadrón</strong>Elegí un héroe abajo y hacé clic en una zona libre. El círculo muestra su alcance; el rojo indica una posición inválida.</p></div><div><b>02</b><p><strong>Frená la invasión</strong>Iniciá cada oleada cuando estés listo. Combiná el daño de Iron Man con el control de Spider-Man. El Capitán potencia a los aliados cercanos.</p></div><div><b>03</b><p><strong>Adaptá tu estrategia</strong>Los enemigos dan créditos. Seleccioná tus héroes para mejorarlos, venderlos o cambiar su prioridad. Tres Vengadores distintos activan una sinergia.</p></div></div><div class="shortcut-grid"><span><kbd>1–6</kbd> Seleccionar héroe</span><span><kbd>Esc</kbd> Cancelar</span><span><kbd>U</kbd> Mejorar unidad</span><span><kbd>Espacio</kbd> Pausa</span><span><kbd>R</kbd> Restablecer cámara</span><span><kbd>N</kbd> Siguiente oleada</span></div><p class="modal-note">Cámara: clic derecho y arrastrar para rotar, rueda para zoom y botón central para mover. En pantalla táctil: un dedo para mover y dos para acercar o rotar. Las mejores marcas se guardan en este navegador; las partidas en curso no se guardan.</p>`,
  );
$("collection").onclick = () =>
  showModal(
    `<div class="eyebrow">ARCHIVO S.H.I.E.L.D.</div><h2>Los héroes de esta misión</h2><p class="modal-note">6 héroes disponibles desde el inicio. Cada uno tiene un papel en tu estrategia.</p><div class="collection-grid">${HEROES.map((h) => `<article style="--hero-color:${h.color}"><img src="${portraits[h.id]}" alt="${h.name}"/><span>${h.rarity}</span><h3>${h.name}</h3><b>${h.role}</b><p>${h.description}</p></article>`).join("")}</div>`,
  );
$("settings").onclick = () => {
  showModal(
    `<div class="eyebrow">CENTRO DE CONTROL</div><h2>Ajustes de misión</h2><label class="setting-row">Sonidos de interfaz <input id="setting-audio" type="checkbox" ${audio.enabled ? "checked" : ""}></label><label class="setting-row">Sombras en tiempo real <input id="setting-shadows" type="checkbox" ${world?.renderer.shadowMap.enabled ? "checked" : ""}></label><div class="profile-stats"><span>Mejor oleada<b>${profile.bestWave}/12</b></span><span>Victorias<b>${profile.victories}</b></span><span>Enemigos vencidos<b>${profile.totalKills}</b></span></div><p class="modal-note">Desactivá las sombras para mejorar el rendimiento en equipos modestos.</p><button id="restart-request" class="secondary danger">${icon("reset")} Reiniciar misión</button><div id="restart-confirm" hidden><p>Se perderá el avance de esta partida.</p><button id="restart-confirm-button" class="primary">Confirmar reinicio</button></div>`,
  );
  $("setting-audio").onchange = (e) => {
    audio.unlock();
    audio.enabled = e.target.checked;
    profile.sound = audio.enabled;
    persist();
    updateUI();
  };
  $("setting-shadows").onchange = (e) => {
    if (world) {
      world.renderer.shadowMap.enabled = e.target.checked;
      world.scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    }
  };
  $("restart-request").onclick = () => ($("restart-confirm").hidden = false);
  $("restart-confirm-button").onclick = restart;
};
function restart() {
  $("modal").close();
  game.reset();
  world.clear();
  ended = false;
  lastKills = 0;
  clearSelection();
  world.resetCamera();
  toast("Nueva misión. Reuní a tu escuadrón.");
}
document.addEventListener("keydown", (e) => {
  if (
    $("modal").open ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (/^[1-6]$/.test(e.key)) selectHero(HEROES[Number(e.key) - 1].id);
  if (e.key === "Escape") clearSelection();
  if (e.code === "Space") {
    e.preventDefault();
    $("pause").click();
  }
  if (e.key.toLowerCase() === "u") upgradeSelected();
  if (e.key.toLowerCase() === "r") world?.resetCamera();
  if (e.key.toLowerCase() === "n") $("start-wave").click();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !ended) {
    game.paused = true;
    updateUI();
  }
});

function processEvents() {
  for (const event of game.drainEvents()) {
    audio.play(event.type);
    if (["attack", "deploy", "upgrade", "kill"].includes(event.type))
      world.addEffect(event);
    if (event.type === "wave")
      toast(
        `OLEADA ${event.wave} · ${event.wave % 6 === 0 ? "Se detectó una amenaza de nivel jefe" : "Enemigos aproximándose"}`,
      );
    if (event.type === "boss") toast("¡ULTRON EN EL CAMPO DE BATALLA!", true);
    if (event.type === "leak") toast("¡Un enemigo alcanzó la base!", true);
    if (event.type === "clear" || event.type === "end") {
      const cleared = game.phase === "defeat" ? game.wave - 1 : game.wave;
      profile.bestWave = Math.max(profile.bestWave, cleared);
      profile.totalKills += game.kills - lastKills;
      lastKills = game.kills;
      if (event.type === "clear")
        toast(`Oleada completada · +${event.bonus} créditos`);
      else if (!ended) {
        ended = true;
        const victory = game.phase === "victory";
        if (victory) profile.victories++;
        showModal(
          `<div class="end-emblem ${victory ? "" : "defeat"}">${icon(victory ? "trophy" : "shield")}</div><div class="eyebrow">${victory ? "MISIÓN CUMPLIDA" : "SEÑAL PERDIDA"}</div><h2>${victory ? "Manhattan está a salvo." : "La ciudad volverá a levantarse."}</h2><p class="modal-note">${victory ? "La invasión fue detenida. Los Vengadores siguen en pie." : "Mejorá tus unidades y combiná daño con control para detener la próxima invasión."}</p><div class="profile-stats"><span>Oleadas superadas<b>${cleared}/12</b></span><span>Eliminaciones<b>${game.kills}</b></span><span>Base restante<b>${game.health}%</b></span></div><button id="play-again" class="primary">${icon("reset")} VOLVER A JUGAR</button>`,
          "end",
        );
        $("play-again").onclick = restart;
      }
      persist();
      $("best-wave").textContent = `${profile.bestWave} OLEADAS`;
    }
  }
}

try {
  world = new World($("world"), onPick, (point) => {
    hoverPoint = point;
  });
  portraits = makePortraits(HEROES);
  $("roster").innerHTML = HEROES.map(
    (h, i) =>
      `<button class="hero-card" data-hero="${h.id}" style="--hero-color:${h.color}" aria-label="Desplegar ${h.name}, ${h.cost} créditos" aria-pressed="false"><span class="hero-hotkey">${i + 1}</span><span class="rarity-mark" title="${h.rarity}">${h.rarity === "Mythic" ? "✦✦✦" : h.rarity === "Legendary" ? "✦✦" : "✦"}</span><div class="hero-image"><img src="${portraits[h.id]}" alt="" draggable="false"/></div><span class="hero-name">${h.name}</span><span class="hero-bottom"><span>${h.role}</span><b>◈ ${h.cost}</b></span></button>`,
  ).join("");
  document.querySelectorAll(".hero-card").forEach(
    (button) =>
      (button.onclick = () => {
        audio.unlock();
        selectHero(button.dataset.hero);
      }),
  );
  let lastTime = performance.now(),
    lastUI = 0;
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    game.update(dt);
    processEvents();
    world.setPreview(
      selectedHero,
      hoverPoint,
      game,
      game.units.find((u) => u.id === selectedUnitId),
    );
    world.render(game, dt);
    if (now - lastUI > 100) {
      updateUI();
      lastUI = now;
    }
    requestAnimationFrame(frame);
  }
  updateUI();
  requestAnimationFrame(frame);
  // Development-only observability for deterministic browser verification.
  if (import.meta.env.DEV)
    window.__TD = {
      game,
      world,
      get selectedHero() {
        return selectedHero;
      },
      screenPoint(x, z) {
        const p = new Vector3(x, 0.2, z).project(world.camera),
          rect = world.renderer.domElement.getBoundingClientRect();
        return {
          x: rect.left + ((p.x + 1) * rect.width) / 2,
          y: rect.top + ((1 - p.y) * rect.height) / 2,
        };
      },
    };
} catch (error) {
  console.error(error);
  $("world").innerHTML =
    `<div class="webgl-error"><h2>No pudimos iniciar el renderizador 3D.</h2><p>Usá un navegador con WebGL 2 y aceleración gráfica habilitada.</p><button class="primary" onclick="location.reload()">Volver a intentar</button></div>`;
}
