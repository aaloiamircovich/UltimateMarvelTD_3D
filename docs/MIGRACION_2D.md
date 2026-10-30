# Migración de TowerDefense_Marvel

## Objetivo y fuente

Trasladar todo lo aprovechable del juego anterior antes de ampliar el HUB, inventar sistemas de progresión o producir nuevos modelos. Conservar IDs, contenido, reglas, costes, habilidades, curvas y contratos. La presentación 3D debe adaptarse a la simulación original.

Fuente publicada: [TowerDefense_Marvel, commit 84797a5a0c0f344145a7b3442b02e46f13ebdb8b](https://github.com/aaloiamircovich/TowerDefense_Marvel/tree/84797a5a0c0f344145a7b3442b02e46f13ebdb8b).

La carpeta local del 2D tiene cambios sin publicar, incluidos TargetFocusSystem y pruebas de transiciones. No se modificaron ni se incorporaron silenciosamente: el snapshot se lee desde blobs de Git del commit publicado. Evaluar esos cambios aparte si posteriormente se actualiza el origen.

Inventario verificado en código: 105 héroes, 105 evoluciones base, 82 objetos, 30 enemigos normales, 19 jefes, 11 mapas, 23 agrupaciones y 6 sinergias de pareja. La campaña original tiene 100 oleadas, minibosses cada 25 y desbloqueos de mapas por estrellas. No usar los conteos desactualizados del README del 2D.

## Estado real

| Área | Conservado | Integrado en la aplicación 3D | Pendiente |
| --- | --- | --- | --- |
| Héroes | 105 definiciones completas, habilidades, afinidades, retratos | Colección y equipo persistente de hasta seis desbloqueados; kits originales en combate | Modelos específicos completos |
| Objetos | 82 definiciones, firmas y efectos | Inventario, tienda progresiva y equipo de un objeto por héroe aplicados al combate | Ampliar cobertura de combinaciones |
| Niveles y evoluciones | Curvas 1–100, costes, 105 evoluciones y transformaciones | Mejoras persistentes y evoluciones por nivel; equipamiento desde inventario | Ampliar representación visual |
| Agrupaciones | 23 familias, 6 parejas y efectos | Escuadrón persistente y efectos originales en combate; consulta en Archivo | Ampliar pruebas de combinaciones |
| Enemigos y jefes | 30 normales, 19 jefes, comportamientos y resistencias | Spawn, invocaciones, barreras, estados y jefes del generador original | Resto de facciones/mapas y modelos propios |
| Mapas y misiones | 11 definiciones, rutas, terreno, objetivos y textos | Base Avengers, Manhattan, Wakanda y Sanctum: selector, rutas, terrenos, objetivos, recompensas y acceso por estrellas originales | Los otros siete mapas y sus mecánicas |
| Oleadas | Generador, escalado, facciones y director de encuentros | 100 oleadas en historia; supervivencia original sin límite | Exponer elección de ramas tácticas y demás modos |
| Combate | Habilidades, proyectiles, tipos, estados, efectos de área, auras y apoyo | Adaptador sin DOM/Three.js, proyecciones 3D, prioridades y acciones tácticas originales | Representación completa de zonas/dispositivos persistentes y balance de campaña completa |
| Progresión | Guardado versionado, economía, maestrías, códice, contratos y logros | Guardado 3D aislado, exportación e importación explícita 3D/2D v9 con respaldo | Paneles de maestrías, códice, contratos y logros |
| Tienda y modos | Reclutamiento, tienda progresiva, diaria, Boss Rush, supervivencia y draft | Reclutamiento, tienda, campaña y supervivencia en Base Avengers | Diaria, Boss Rush, draft y extracción |
| Arte | 245 retratos, iconos y miniaturas compartidos | Imágenes originales del catálogo | Animaciones, atlas y resto del arte; modelos 3D después de las reglas |
| Interfaz/accesibilidad | Reglas y datos consultables | Catálogo adaptable, búsqueda, filtros, teclado, cierre por Escape | Portar el resto de las funciones de los paneles originales |

Copiado, probado e integrado son estados distintos. La aplicación ejecuta ahora CombatGame, no el prototipo de seis ataques simplificados. La colección real reemplaza a la selección temporal de 105 héroes. Equipo, niveles, objetos, prioridades y créditos se conservan entre sesiones. El catálogo sigue siendo una vista previa sin gasto ni escritura de perfiles.

## Arquitectura de esta entrega

- `src/legacy/`: snapshot sin modificaciones de 58 módulos y sus dependencias, seis JSON completos, tabla de tipos, aviso original y matriz de identidad. Contiene 89 archivos de pruebas seleccionados.
- `src/legacy/manifest.json`: commit, rutas y SHA-256 de cada archivo incorporado. `.gitattributes` evita normalizar sus bytes al cambiar de plataforma.
- `public/legacy/`: imágenes del catálogo conservadas; nueve miniaturas de mapas del original son identificadores simbólicos, no rutas de imagen. No se fabrican URLs para ellas.
- `src/game/legacy-catalog.js`: adaptador del núcleo original. Una subclase de Hero omite únicamente cargar imágenes de Canvas en la ficha; el cálculo de estadísticas usa las implementaciones originales, sin Three.js ni DOM.
- `src/ui/legacy-catalog.js`: catálogo accesible desde ARCHIVO 2D en el HUB. Se carga al abrirlo para no cargar todo el contenido al arrancar la plaza.

Algunos módulos heredados todavía contienen métodos de renderizado Canvas. El adaptador de combate omite la carga de imágenes y no ejecuta esos métodos. Las pruebas ejecutan los 105 héroes con un constructor Image que lanza error si la simulación intenta usarlo. La separación permanece fuera del snapshot.

## Combate integrado

- `src/game/combat.js`: coordina las clases originales en pasos fijos de 1/60 s y entrega vistas para el renderizador. Conserva coordenadas originales, orden de actualización, daño, temporizadores, recompensas, evolución, retirada y proyectiles emitidos.
- `src/game/combat-data.js`: datos originales y conversión de 32 píxeles por unidad visual. La Base Avengers usa su cuadrícula, ruta normalizada y terrenos; los modelos no alteran sus reglas.
- `src/render/battle-map.js` y `world.js`: escenario, proyectiles, rangos círculo/anillo/cruz/X, textos de daño, estados, barreras y señal de jefes. Los modelos siguen siendo provisionales.
- En el HUB se eligen entre uno y seis héroes distintos de la colección desbloqueada. El combate admite una copia de cada uno, despliegue y movimiento gratuitos, retiro sin reembolso y mejoras hasta 100.
- Historia usa 100 oleadas, 20 vidas y el saldo persistente; supervivencia usa las reglas originales con 750 créditos y bonus cada cinco rondas. Al ganar/gastar en supervivencia su saldo reemplaza al del perfil, igual que en el origen; salir sin movimientos de créditos conserva el saldo anterior.
- Las marcas usan `ultimate-marvel-td-combat-v2`, aisladas del perfil del prototipo y del 2D. La colección usa ultimate-marvel-td-collection-v1 y no interpreta esas marcas como desbloqueos. Las oleadas y posiciones de partidas en curso no se reanudan.

La validación compara 105 kits en niveles 1 y 50 contra un ejecutor independiente del bucle 2D, con las clases originales. Compara también los 82 objetos sobre Spider-Man nivel 50. Esto no cubre todas las combinaciones objeto/héroe ni demuestra balance de campaña completa. Las pruebas de navegador completan una oleada real, arrancan la siguiente y usan escenarios preparados para las pantallas finales.

## Colección e intercambio de perfiles

`src/game/progression.js` adapta el guardado y su contexto sin DOM. Las reglas siguen en las clases originales. La selección inicial ofrece Black Widow, Hawkeye y Korg, con 1.200 créditos. El reclutamiento cuesta 500 inicialmente, aumenta con `ceil(coste × 1,12)`, excluye héroes obtenidos y aplica la garantía tras cuatro comunes. Las probabilidades visibles suman los pesos por héroe restante, no porcentajes fijos por rareza. La tienda ofrece los primeros tres objetos pendientes en el orden original. Transferir un objeto lo retira del portador anterior.

`src/ui/collection.js` ofrece equipo, inventario, reclutamiento y tienda. Exporta un sobre 3D versión 1 con estado original v9. Importa ese formato o el exportado por el 2D v9, muestra un resumen y exige pulsar Aplicar. Valida antes de mutar y respalda el perfil anterior en la clave de colección con sufijo `-backup`. Una escritura fallida conserva el perfil actual; un guardado local ilegible se mantiene intacto y sólo permite progreso temporal hasta importar un archivo válido. Los archivos de otras versiones no se reinterpretan silenciosamente.

Las pruebas nuevas comparan las 104 compras restantes contra ShopSystem original, garantizan escritura completa por compra/mejora y verifican transferencias, efectos en combate, persistencia, aislamiento de claves, importación y fallos de almacenamiento. Se conservan campos de sistemas pendientes al importar; eso no declara sus paneles ni todos sus modos como integrados.

## Orden de continuación

### Laboratorio conservado

Se conserva el avance publicado en `f6ebe13`: `src/game/legacy-combat.js`, el ensayo del Archivo y sus pruebas diferenciales. El ensayo ejecuta 15 segundos contra seis enemigos base espaciados por un segundo; permite elegir cualquiera de los 49 enemigos y usar el nivel/objeto de la ficha, con hasta cinco compañeros de la prueba de sinergias. Usa posiciones fijas sobre una ruta recta y colocación libre, sin terrenos de misión. No modifica guardados.

El laboratorio informa daño, activaciones, bajas, fugas, enemigos pendientes, vidas y créditos. Una fuga de jefe causa derrota. Su conversión `legacyToWorld` es configurable; no debe confundirse con la escala de 32 píxeles/unidad de Base Avengers. El laboratorio y la misión comparten las entidades originales adaptadas sin Canvas; tienen coordinadores diferentes porque sólo la misión aplica oleadas, terreno, objetivos y acciones tácticas.

`test/fixtures/original-combat-loop.js` conserva el extracto original de GameLoop del commit de referencia. Sus pruebas comparan 105 escenarios durante 20 segundos y 82 objetos a distintas frecuencias, además de fugas, recompensas, pool y ejecución sin DOM/almacenamiento. Estas pruebas se mantienen junto a las de la misión 3D. Las antiguas indicaciones de que sólo existía el laboratorio quedan reemplazadas por la integración de Base Avengers descrita arriba.

### Próximos pasos

1. **Ampliar cobertura de combate.** El adaptador y las comparaciones básicas están integrados. Ampliar escenarios de combinaciones, transiciones de objetos, balance sostenido y visuales de zonas/dispositivos, manteniendo la referencia original.
2. **Colección y progresión: integrada.** ProgressionManager, ResourceManager y ShopSystem ejecutan las reglas originales. Continúan pendientes los paneles de sistemas transversales y la progresión de los otros mapas.
3. **Campaña.** Usar las 11 rutas y terrenos, WaveManager, EncounterDirector y MissionSystem. Validar 100 oleadas, objetivos, estrellas y jefes con las reglas originales. Primero Base Avengers y luego el resto, sin inventar mapas sustitutivos.
4. **Modos y sistemas transversales.** Integrar diaria, Boss Rush, supervivencia, draft, replays, maestrías, códice, contratos y logros. Portar sus controles y estados necesarios.
5. **Presentación.** Completar avatar/cámara de misión, animaciones y modelos después de comprobar las reglas. Traits y grades nuevos quedan pendientes de definición del usuario.

## Verificación y reproducción

```powershell
npm run import:legacy -- 'C:\ruta\a\TowerDefense_Marvel'
npm run check
npm run test:browser
```

El importador lee el commit fijado, no los archivos modificados de la carpeta original. Rechaza sobrescribir un archivo importado que haya sido editado o cambiar de commit sin una revisión separada. No necesita credenciales ni red si ese commit ya existe localmente.

Las 2.526 pruebas heredadas de lógica pasan. Se añaden verificaciones de integridad, catálogo completo, 525 combinaciones héroe/nivel, los 82 objetos en la vista previa, evoluciones, transformaciones, apoyo y agrupaciones. Las pruebas excluidas se registran en el manifiesto: corresponden a existencia de audio/atlas/sprites que no se trasladaron en esta fase. No se modificaron las expectativas de las pruebas originales para hacerlas pasar.

El navegador verifica archivo, imágenes, cierre de panel, disposición móvil, colección, reclutamiento, inventario, persistencia tras recarga, importación con respaldo, exportación, equipo de héroes desbloqueados, colocación, movimiento, mejora, retiro, primeras oleadas originales, jefes y resultados. El prototipo ya no se usa en la aplicación; sus pruebas se conservan como referencia.

## Campaña: segunda misión

El HUB permite elegir Base Avengers o Calles de Nueva York (Manhattan), tanto en historia como en supervivencia. Manhattan requiere 25 estrellas totales según `LevelProgression.js`. La comprobación se aplica en el selector y al iniciar/reiniciar la simulación con colección. Los otros nueve mapas todavía no se ofrecen como jugables.

`src/game/missions.js` construye una misión independiente con ruta, terreno, índice y dificultad. Se corrigió la dificultad fija del adaptador: los dos mapas usan `easy`, como determina el original, en lugar de `normal`. La supervivencia sigue sin generar estrellas de campaña. Las marcas visibles de historia se consultan por mapa; el récord de supervivencia continúa siendo global, como antes.

Manhattan no trae `terrainRows` en levels.json. `src/game/maps/manhattan.json` conserva la cuadrícula numérica derivada de `ManhattanManualMap.js` mediante las reglas de `PixelMapRenderer.js:getTerrainForManualTile`, ambos del commit de origen fijado. Se respetan especialmente las celdas forzadas a pasto 108–112 y 264–275. No se leyó el contenido de trabajo sin publicar del repositorio 2D y no se modificó el snapshot.

El render conserva en caché los escenarios visitados y muestra únicamente el activo; ruta y terreno corresponden a la misión lógica. La escenografía de Manhattan sigue siendo provisional. Las pruebas verifican acceso a 24/25 estrellas, cuadrícula y excepciones, recompensas y objetivos aislados por mapa, guardado, selector móvil y transición Base–Manhattan–Base. No demuestran todavía el balance de las 100 oleadas completas de Manhattan.

## Campaña: Wakanda

Reino de Wakanda (`level_3`) está disponible desde el HUB con 50 estrellas totales y dificultad difícil, usando las reglas originales. Conserva las 19×25 celdas del terreno y los seis puntos de su ruta exacta. El portal y la base se ubican en el primer y último punto, sin asumir los puntos exteriores de las rutas normalizadas de Base Avengers/Manhattan. Enemy conserva su extensión original al atravesar la base (24 píxeles en los enemigos de la primera oleada); no se altera el momento de la fuga.

La mecánica publicada es `manual_assault`: no se añadieron cambios de ruta ni vegetación activa. Los objetivos originales requieren 90 bajas y un jefe, con recompensas de 280 y 320, pagadas una sola vez por perfil. El render utiliza una paleta provisional de agua, roca púrpura y corredor dorado; todavía no es el escenario artístico terminado.

Pruebas: acceso a 49/50 estrellas, dificultad, terreno y ruta exactos, extensión original de recorrido, activación y no duplicación de objetivos, entrada a Wakanda desde el HUB, extremos visibles y vuelta a Base Avengers sin enemigos anteriores. No implica validación de balance de 100 oleadas completas.

## Campaña: Sanctum Sanctorum

`level_4` requiere 75 estrellas totales y usa dificultad difícil. Su terreno no viene en JSON: `src/game/maps/sanctum-terrain.js` adapta las funciones `generateLevelMap`, `seededNoise` y `paintPathTiles` de GameLoop del commit de origen. Se conservan las celdas de 40 píxeles, cuadrícula 20×15, ruido determinista y camino pintado. La prueba compara todas las celdas con un fixture obtenido ejecutando esos métodos originales. La conversión a escena sigue siendo 32 píxeles por unidad; sólo cambia el tamaño de las celdas y la vista previa de colocación.

MissionSystem conserva las dos runas de radio 58: marcan hasta cuatro enemigos cercanos por runa durante 0,4 segundos con potencia 0,12. El render muestra sus radios y nombres. La colocación y el movimiento consultan `getPlacementBlock` original, que reserva radio + 16 alrededor de cada runa. Los objetivos son 60 bajas y un jefe; las recompensas originales de 300 y 360 no se duplican.

Validado: terreno completo, desbloqueo 74/75, colocación reservada, límite de objetivos de la marca, expiración, recompensas y aislamiento, entrada/salida del mapa y radios visibles. Escenografía provisional; no se afirma balance de las 100 oleadas completas.
