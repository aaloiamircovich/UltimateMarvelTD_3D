# Diseño de la primera versión

## Dirección

La dirección actual del usuario sitúa un personaje controlable en tercera persona dentro de un HUB como punto de entrada, siguiendo el flujo de los tower defense de Roblox. La implementación inicial del HUB ofrece historia e infinito; los lugares de invocaciones, traits y grades están reservados mientras se definen sus reglas. El texto siguiente documenta las decisiones de la primera misión, que ahora se accede desde ese HUB.

La prioridad es una experiencia de tower defense 3D independiente de Roblox: personajes reconocibles, una ruta clara, colocación rápida y decisiones de equipo que importen. La estética combina un diorama de Manhattan con una interfaz tecnológica S.H.I.E.L.D., acentos cian y cartas por rareza.

Three.js se eligió porque el usuario no tiene preferencia de motor, el juego anterior está escrito en JavaScript y una primera versión web se prueba sin instalar un editor. Los datos y la simulación están separados del renderizador para facilitar futuras expansiones o una adaptación a otro motor.

## Referencia principal: el juego 2D

Se inspeccionaron estos archivos de [TowerDefense_Marvel](https://github.com/aaloiamircovich/TowerDefense_Marvel) el 26 de octubre de 2026:

| Fuente | Idea trasladada | Adaptación de esta alpha |
| --- | --- | --- |
| `data/heroes.json` | Iron Man con carga ARC | Un disparo doble cada tres ataques |
| `data/heroes.json` | Spider-Man como control | Ralentización del 40% durante 2 s |
| `data/heroes.json` | Capitán como soporte sin ataque | Aura de +25% de daño, sin acumulación |
| `data/heroes.json` | Thor contra grupos | Cadena de hasta tres enemigos |
| `data/heroes.json` | Hulk de corto alcance | Daño en área de 2.4 m |
| `data/heroes.json` | Strange con control místico | Área de 2 m y ralentización del 30% |
| `data/levels.json` | Invasión urbana rumbo a Torre Stark | Mapa 3D original con ruta serpenteante |
| `src/utils/TargetingPriority.js` | Prioridades elegibles | Primero, Último y Fuerte |
| `src/systems/TeamSynergySystem.js` | Bonificaciones por composición | Tres Avengers distintos: +10% de daño |

Los costes, distancias y curvas de dificultad fueron rebalanceados para este mapa. Los kits están simplificados: no se afirma equivalencia completa con la versión 2D.

## Referencias de Roblox

El usuario indicó Anime Vanguards, ASTD, Anime Reborn, TTD, TDS, Anime Adventures, AWTD, Multiverse Tower Defense y Ultimate Tower Defense como dirección general. Se toma el formato de escuadrón de unidades, mejoras en combate, oleadas con jefes y lectura rápida de rarezas. No se copian sus assets ni sus implementaciones.

Para contrastar el formato se consultaron la [página de Paradoxum Games](https://paradoxum.gg/) y la [documentación comunitaria oficial de oleadas de TDS](https://tds.wiki/w/Waves). Las referencias de progresión y colección de Anime Vanguards orientan el roadmap; esos sistemas no se presentan como implementados en esta alpha.

## Reglas técnicas

- El avance de enemigos se mide en distancia recorrida sobre segmentos. La prioridad Primero usa esa distancia, no cercanía euclidiana a la base.
- La colocación usa coordenadas enteras, distancia al camino y AABB para edificios, decoración y unidades.
- La simulación integra pasos máximos de 1/30 s. La velocidad multiplica tiempo simulado; un frame lento no permite saltar la ruta ni los ataques.
- Las auras no se acumulan; los efectos de ralentización conservan el más fuerte y expiran con tiempo simulado.
- Matar un enemigo otorga su recompensa una sola vez. Vender recupera el 70% del total invertido.
- Los enemigos y efectos se reciclan; las geometrías de escenario se agrupan por material para reducir draw calls.
- La exportación de observabilidad `window.__TD` existe solo en desarrollo, para que las pruebas puedan inspeccionar la simulación y proyectar coordenadas del mapa.
- No hay backend, compras ni servicios multijugador. El perfil de navegador es local y no se considera autoritativo para una futura economía online.

## Límites de la validación

Se comprueba una estrategia ganadora con fondos reales de la partida y una derrota sin defensores. Esto verifica que la misión se puede completar, no que todas las combinaciones sean igualmente viables. Playwright valida WebGL y controles con renderizado por software; no representa una medición de FPS en todos los dispositivos. El diseño móvil se revisa con viewports de navegador, no con un teléfono físico.
