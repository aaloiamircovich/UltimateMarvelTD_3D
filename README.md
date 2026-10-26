# Ultimate Marvel TD · 3D

Tower defense 3D independiente de Roblox, desarrollado con Three.js y JavaScript. **Alpha 0.1: una misión completa y jugable en Manhattan.**

El punto de partida de diseño es [TowerDefense_Marvel](https://github.com/aaloiamircovich/TowerDefense_Marvel). Se toman sus roles de héroes, el soporte de Capitán América, las prioridades de ataque y las sinergias, adaptados a un campo de batalla tridimensional. No es una migración completa de los 78 héroes del juego 2D.

## Jugar en tu computadora

Requisitos: Node.js 22.12 o superior, navegador moderno con WebGL 2 y aceleración gráfica.

```sh
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. En Windows también se puede usar `Jugar.cmd`.

## Qué incluye

- Manhattan en 3D con Torre Stark, portal enemigo, calles, edificios, parques, vehículos, sombras y cámara orbital.
- Seis héroes disponibles desde el inicio, con modelos geométricos originales: Iron Man, Spider-Man, Capitán América, Thor, Hulk y Doctor Strange.
- 12 oleadas; drones de Ultron, exploradores Chitauri, centinelas de Hydra y Ultron como jefe en las oleadas 6 y 12.
- Colocación en cuadrícula, previsualización de alcance y validación de caminos, edificios, objetos y unidades.
- Poderes diferenciados: sobrecarga ARC, telarañas, aura de apoyo, rayos encadenados, impacto gamma y área mística.
- Cuatro niveles por unidad, venta al 70% de lo invertido y prioridades Primero / Último / Fuerte.
- Sinergia: tres Vengadores **distintos** desplegados dan +10% de daño a los Vengadores. La aura del Capitán da +25% de daño a aliados cercanos y no se acumula con otras auras.
- Créditos por eliminaciones y oleadas, máximo de 12 unidades, pausa, velocidades 1×/2×/3× y avance automático opcional.
- Victoria, derrota, reinicio, colección informativa, ayuda, ajustes de sonido y sombras.
- Mejores marcas, victorias y eliminaciones guardadas localmente. Se maneja almacenamiento corrupto o no disponible.
- Interfaz en español adaptable a escritorio y móvil; tipografías empaquetadas localmente.

## Controles

| Acción | Control |
| --- | --- |
| Elegir héroe | Clic en su tarjeta o teclas 1–6 |
| Desplegar / seleccionar | Clic izquierdo en el mapa |
| Cancelar selección | Esc |
| Mejorar la unidad seleccionada | U |
| Pausar / continuar | Espacio |
| Iniciar siguiente oleada | N |
| Rotar cámara | Arrastrar con clic derecho |
| Mover cámara | Arrastrar con botón central |
| Acercar / alejar | Rueda del mouse |
| Restaurar cámara | R |
| Cámara táctil | Un dedo para mover; dos para zoom / rotación |

Los diálogos pausan la partida. Al cambiar de pestaña se pausa automáticamente; se reanuda manualmente.

## Validación y compilación

```sh
npm run check
npx playwright install chromium
npm run test:browser
```

`check` ejecuta las pruebas de simulación y genera `dist/`. Las pruebas de navegador inician su propio servidor en el puerto 5174 y guardan capturas locales en `artifacts/` (fuera de Git). En Linux, usar `npx playwright install --with-deps chromium`.

```sh
npm run build
npm run preview
```

`dist/` se puede servir como sitio estático; `base: './'` permite alojarlo en un subdirectorio. Abrir el HTML por `file://` no está soportado. El juego no necesita servicios externos durante una partida; no incluye todavía instalación PWA ni caché offline.

## Estructura

```text
src/game/data.js          Definiciones de héroes, enemigos, mapa y oleadas
src/game/simulation.js    Economía, colocación, ruta, combate y estados
src/game/profile.js       Perfil local versionado y validado
src/render/models.js      Modelos 3D y retratos generados con Three.js
src/render/world.js       Escenario, cámara, selección, efectos y pools
src/ui/                  Iconos y audio sintetizado
src/main.js              Interfaz, entrada y coordinación del juego
src/style.css            Dirección visual y diseño adaptable
test/                    Pruebas deterministas de la simulación
scripts/browser-smoke.mjs Validación de WebGL e interacción real
scripts/blender/          Generador de base chibi y materiales toon para Blender
```

La simulación no depende del DOM ni de Three.js. La escena agrupa geometría estática por material y reutiliza enemigos y efectos visuales. Los modelos actuales son una base low-poly; aún no son personajes finales con rig y animaciones de producción.

## Alcance y próximos pasos

Esta alpha es para un jugador, con un mapa y seis héroes. Todavía no incluye lobby explorable, gacha, inventario persistente de unidades, evolución, equipamiento, más mapas ni multijugador. La partida en curso no se guarda; al recargar comienza una misión nueva.

Ver [decisiones de diseño y referencias](docs/DESIGN.md), [roadmap](docs/ROADMAP.md) y [guía de la base chibi en Blender](docs/BLENDER.md).

El repositorio de trabajo es [UltimateMarvelTD_3D](https://github.com/aaloiamircovich/UltimateMarvelTD_3D). Los cambios terminados se entregan con commit y push, según la preferencia del usuario registrada en `AGENTS.md`.
