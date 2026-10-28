# Ultimate Marvel TD · 3D

Tower defense 3D independiente de Roblox, desarrollado con Three.js y JavaScript. **Alpha 0.2: HUB recorrible en tercera persona con acceso a historia e infinito.**

La experiencia comienza en Avengers Campus: controlás a tu agente, recorrés la plaza y accedés a las actividades desde sus estaciones. Historia e infinito ya se pueden jugar; invocaciones, traits y grades tienen espacios reservados pero aún no implementan sus sistemas. Las reglas de traits y grades están pendientes de la descripción del usuario: no asumir pasivas aleatorias, rangos C–S ni rerolls.

La prioridad es migrar [TowerDefense_Marvel](https://github.com/aaloiamircovich/TowerDefense_Marvel) antes de añadir nuevas funciones exclusivas del 3D. Ya se incorporó su catálogo completo: **105 héroes, 82 objetos, 30 enemigos normales, 19 jefes y 11 mapas**, más el núcleo de reglas y sus pruebas. El botón **ARCHIVO 2D** del HUB permite buscar contenido, probar niveles y objetos en las fichas y consultar evoluciones y sinergias con el cálculo original.

Desde **ARCHIVO 2D → Héroes → Ensayo de combate** también se pueden ejecutar 15 segundos de las reglas originales: elegir héroe, nivel, objeto y enemigo, incluir compañeros de la prueba de sinergias y consultar daño, habilidades, bajas, fugas y créditos. Es una prueba numérica reproducible; no gasta recursos ni modifica perfiles.

**Esto todavía no es una migración completa del combate.** El adaptador ejecuta las entidades originales y sus resultados se comparan con el bucle 2D; las partidas 3D siguen usando los seis héroes y la misión del prototipo. El estado de cada sistema y el orden de integración están en [MIGRACION_2D.md](docs/MIGRACION_2D.md).

## Jugar en tu computadora

Requisitos: Node.js 22.12 o superior, navegador moderno con WebGL 2 y aceleración gráfica.

```sh
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. En Windows también se puede usar `Jugar.cmd`.

## Qué incluye

- HUB con avatar propio, cámara de seguimiento giratoria, movimiento relativo a cámara, salto, límites y colisión con las estaciones.
- Portales a historia (12 oleadas) e infinito (continúa después de la 12, jefes cada seis oleadas y récord independiente guardado).
- Interacción por proximidad con E, accesos equivalentes por botones y controles de movimiento táctiles.
- Retorno al HUB desde misiones y resultados; salir de una misión en curso requiere confirmación.
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
| Caminar en el HUB | WASD / flechas / botones táctiles |
| Cámara del HUB | Arrastrar para girar, rueda para acercar |
| Saltar en el HUB | Espacio |
| Usar estación cercana | E / botón Interactuar |
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

`check` ejecuta las pruebas de simulación, integridad del snapshot y adaptadores, las 2.526 pruebas originales seleccionadas y genera `dist/`. `npm run test:legacy` ejecuta sólo las pruebas heredadas. Las pruebas de navegador revisan el catálogo y el flujo de juego, inician su propio servidor en el puerto 5174 y guardan capturas locales en `artifacts/` (fuera de Git). En Linux, usar `npx playwright install --with-deps chromium`.

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
src/game/legacy-combat.js Puente de combate original, reloj fijo y eventos independientes del render
src/game/legacy-catalog.js Catálogo completo y estadísticas del juego original
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

Esta alpha es para un jugador, con un HUB, un mapa de combate y seis héroes. Todavía no incluye gacha funcional, inventario persistente de unidades, traits, grades, evolución, equipamiento, más mapas ni multijugador. El avatar y la cámara en tercera persona están implementados en el HUB; el combate conserva la cámara táctica. La partida en curso no se guarda; al recargar se vuelve al HUB. El infinito limita la cantidad de enemigos por oleada para mantener acotada la carga, y escala su vida.

Ver [decisiones de diseño y referencias](docs/DESIGN.md), [roadmap](docs/ROADMAP.md) y [guía de la base chibi en Blender](docs/BLENDER.md).

El repositorio de trabajo es [UltimateMarvelTD_3D](https://github.com/aaloiamircovich/UltimateMarvelTD_3D). Los cambios terminados se entregan con commit y push, según la preferencia del usuario registrada en `AGENTS.md`.
