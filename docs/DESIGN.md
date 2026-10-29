# Diseño vigente

La prioridad es migrar las reglas de TowerDefense_Marvel conservando identidades y contratos. El usuario quiere personaje propio en tercera persona y HUB para invocaciones, historia, infinito, traits y grades. La batalla conserva cámara táctica mientras se completa la migración.

## Simulación

CombatGame coordina Hero, Enemy, Projectile, WaveManager, ProgressionManager, ResourceManager, MissionSystem, GameModeSystem, TacticalActionSystem y TeamSynergySystem originales. El snapshot permanece intacto. La subclase de Hero omite imágenes Canvas; la fábrica de enemigos omite imágenes/animación 2D y conserva las dimensiones usadas por la ruta.

Las reglas trabajan en píxeles originales con pasos de 1/60 s. La ruta está normalizada para 800×600 px, en celdas de 32 px. El renderizador convierte 32 px en una unidad de Three.js. El modelo visual no decide daño, alcance, velocidad ni radio. Círculo, anillo, cruz y X conservan las geometrías originales al atacar y validar colocación.

El orden por paso reproduce GameLoop: oleadas, misión/modo, enemigos/fugas, héroes, proyectiles, recompensas y limpieza. Los temporizadores también avanzan entre oleadas. El avance automático usa tiempo simulado, sin setTimeout. Retirar un héroe aplica los resets originales y conserva sus proyectiles emitidos.

La colocación es gratis y admite una unidad por integrante del equipo. Se validan terreno, ocupación y cobertura de ruta. Reposicionar es gratuito, retirar no reembolsa y las mejoras llegan a 100. Las sinergias usan el equipo seleccionado.

Base Avengers es la primera actividad migrada: ruta original, 100 oleadas, 20 vidas, objetivos, minibosses y Thanos final. Supervivencia comparte escenario y usa reglas originales. Los demás mapas siguen en el catálogo.

## Presentación

Se reutilizan los modelos disponibles. El resto tiene cuerpos básicos, colores de categoría y nombres; los retratos originales identifican tarjetas. Los modelos definitivos quedan después de la migración de reglas.

Se dibujan proyectiles, impactos, daño flotante, vuelo, sigilo, vida, barreras, estados y preparación de jefes. Los efectos visuales no causan daño. Las zonas y dispositivos persistentes influyen en la simulación, pero necesitan representaciones específicas completas.

Los terrenos usan instancias por material. Proyectiles, textos y efectos visuales reutilizan objetos. Las reglas conservan el pool de proyectiles original. Agua, pasto, camino, zonas elevadas y celdas bloqueadas tienen colores distintos.

## Progresión temporal

Se pueden elegir seis de los 105 héroes para comprobar sus kits; esto no sustituye al reclutamiento. Niveles, créditos, equipo y progresión de la partida viven en memoria. La interfaz avisa que se reinician al salir.

Las marcas usan ultimate-marvel-td-combat-v2. No se importan ni sobrescriben perfiles 2D o del prototipo de doce oleadas. El traslado de partidas y el inventario se implementarán explícitamente con validación y respaldo.

Traits y grades esperan las reglas del usuario. No se aprobaron pasivas aleatorias ni rangos C–S con rerolls.

## Validación y límites

La matriz compara el adaptador con un ejecutor independiente del bucle y clases 2D: 105 kits en niveles 1 y 50, 82 objetos sobre Spider-Man nivel 50 y ciclo de partida. Comprueba contratos concretos; no demuestra que todo equipo gane ni cubre todas las combinaciones de héroes y objetos.

Playwright comprueba WebGL, controles, HUB, primeras oleadas reales, escritorio/móvil y resultados con escenarios preparados. No mide hardware físico. Window.__TD sólo se expone en desarrollo.

El prototipo de Manhattan y doce oleadas se conserva en simulation.js como referencia; la aplicación usa combat.js.