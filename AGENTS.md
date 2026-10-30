# Ultimate Marvel TD 3D

- Este repositorio es el juego 3D independiente de Roblox. El origen principal de diseño es `aaloiamircovich/TowerDefense_Marvel`.
- Prioridad actual del usuario: migrar todo lo aprovechable del juego 2D antes de ampliar funciones exclusivas del 3D o producir más modelos. Seguir `docs/MIGRACION_2D.md` y conservar reglas y contenido originales; no reemplazarlos por versiones simplificadas.
- `src/legacy/` conserva un snapshot verificable del origen. No editar sus archivos importados: construir adaptadores fuera de esa carpeta. Distinguir contenido copiado, reglas verificadas y funcionalidades integradas en partidas 3D; la copia de un módulo no implica paridad jugable.
- El usuario autorizó hacer commit y push de los cambios terminados a `https://github.com/aaloiamircovich/UltimateMarvelTD_3D`. Conservar esta preferencia en futuras tareas; verificar el remoto antes del push.
- Mantener la simulación independiente de Three.js y del DOM. Definiciones de héroes, enemigos, mapas y oleadas van en módulos de datos.
- Interfaz y documentación en español. Mantener controles de teclado y estados de error visibles.
- Ejecutar `npm run check` antes de cada entrega; ejecutar `npm run test:browser` al cambiar renderizado o interacción.
- No incluir node_modules, dist, logs ni capturas temporales en Git.
- `.codex/skills/ultimate_hero_td_engine.md` contiene la guía de arquitectura y dirección visual del usuario.
- Skills de flujo adaptadas al juego en `.codex/skills/`: `ultimate-td-bug-fixing` (correcciones), `ultimate-td-feature-planning` (planes), `ultimate-td-grill-me` (entrevista solicitada) y `ultimate-td-version-release` (changelog/cierre de versión). Leer el `SKILL.md` correspondiente cuando aplique; no ejecutar sus flujos por el solo hecho de revisar o editar las skills. Las copias instaladas en `~/.codex/skills/` deben mantenerse sincronizadas con estas fuentes.
- Dirección confirmada: personaje propio en tercera persona y HUB como inicio del juego; desde allí acceder a invocaciones, historia, infinito, traits y grades. Manhattan es una actividad del HUB.
- El usuario quiere describir sus propias reglas de traits y grades. No implementar la propuesta de traits pasivos aleatorios y grades C–S con rerolls como si estuviera aprobada. Ver `docs/ROADMAP.md`.
- El usuario pidió mejorar sustancialmente el modelado y autorizó preparar herramientas/APIs y operar la computadora. Usar Blender de Microsoft Store por su alias, comprobado con `npm run art -- doctor`. Ver `docs/ARTE_3D.md`; credenciales sólo en `.env.local`, nunca en el frontend o Git. Distinguir pruebas de herramientas, referencias, modelos terminados e integración jugable.
