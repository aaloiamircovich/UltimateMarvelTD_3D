# Ultimate Marvel TD 3D

- Este repositorio es el juego 3D independiente de Roblox. El origen principal de diseño es `aaloiamircovich/TowerDefense_Marvel`.
- El usuario autorizó hacer commit y push de los cambios terminados a `https://github.com/aaloiamircovich/UltimateMarvelTD_3D`. Conservar esta preferencia en futuras tareas; verificar el remoto antes del push.
- Mantener la simulación independiente de Three.js y del DOM. Definiciones de héroes, enemigos, mapas y oleadas van en módulos de datos.
- Interfaz y documentación en español. Mantener controles de teclado y estados de error visibles.
- Ejecutar `npm run check` antes de cada entrega; ejecutar `npm run test:browser` al cambiar renderizado o interacción.
- No incluir node_modules, dist, logs ni capturas temporales en Git.
- `.codex/skills/ultimate_hero_td_engine.md` contiene la guía de arquitectura y dirección visual del usuario.
- Dirección confirmada: personaje propio en tercera persona y HUB como inicio del juego; desde allí acceder a invocaciones, historia, infinito, traits y grades. Manhattan es una actividad del HUB.
- El usuario quiere describir sus propias reglas de traits y grades. No implementar la propuesta de traits pasivos aleatorios y grades C–S con rerolls como si estuviera aprobada. Ver `docs/ROADMAP.md`.
