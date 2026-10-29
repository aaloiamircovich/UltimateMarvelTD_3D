# Migración de TowerDefense_Marvel

## Objetivo y fuente

Trasladar todo lo aprovechable del juego anterior antes de ampliar el HUB, inventar sistemas de progresión o producir nuevos modelos. Conservar IDs, contenido, reglas, costes, habilidades, curvas y contratos. La presentación 3D debe adaptarse a la simulación original.

Fuente publicada: [TowerDefense_Marvel, commit 84797a5a0c0f344145a7b3442b02e46f13ebdb8b](https://github.com/aaloiamircovich/TowerDefense_Marvel/tree/84797a5a0c0f344145a7b3442b02e46f13ebdb8b).

La carpeta local del 2D tiene cambios sin publicar, incluidos TargetFocusSystem y pruebas de transiciones. No se modificaron ni se incorporaron silenciosamente: el snapshot se lee desde blobs de Git del commit publicado. Evaluar esos cambios aparte si posteriormente se actualiza el origen.

Inventario verificado en código: 105 héroes, 105 evoluciones base, 82 objetos, 30 enemigos normales, 19 jefes, 11 mapas, 23 agrupaciones y 6 sinergias de pareja. La campaña original tiene 100 oleadas, minibosses cada 25 y desbloqueos de mapas por estrellas. No usar los conteos desactualizados del README del 2D.

## Estado real

| Área | Conservado | Integrado en la aplicación 3D | Pendiente |
| --- | --- | --- | --- |
| Héroes | 105 definiciones completas, habilidades, afinidades, retratos | Equipo de seis elegible entre los 105; kits originales ejecutados en combate | Colección real y modelos específicos completos |
| Objetos | 82 definiciones, firmas y efectos | Consulta y vista previa de un objeto por héroe | Inventario, compra y equipo en partida |
| Niveles y evoluciones | Curvas 1–100, costes, 105 evoluciones y transformaciones | Mejoras y evoluciones por nivel en combate; vista previa por objeto | Persistencia y equipamiento desde inventario |
| Agrupaciones | 23 familias, 6 parejas y efectos | Efectos originales del equipo en combate; consulta en Archivo | Escuadrón persistente |
| Enemigos y jefes | 30 normales, 19 jefes, comportamientos y resistencias | Spawn, invocaciones, barreras, estados y jefes del generador original | Resto de facciones/mapas y modelos propios |
| Mapas y misiones | 11 definiciones, rutas, terreno, objetivos y textos | Base Avengers: ruta, terreno, objetivos y recompensas originales | Los otros diez mapas y sus mecánicas |
| Oleadas | Generador, escalado, facciones y director de encuentros | 100 oleadas en historia; supervivencia original sin límite | Exponer elección de ramas tácticas y demás modos |
| Combate | Habilidades, proyectiles, tipos, estados, efectos de área, auras y apoyo | Adaptador sin DOM/Three.js, proyecciones 3D, prioridades y acciones tácticas originales | Representación completa de zonas/dispositivos persistentes y balance de campaña completa |
| Progresión | Guardado versionado, economía, maestrías, códice, contratos y logros | Snapshot y pruebas | Guardado 3D aislado e importación explícita de partidas 2D |
| Tienda y modos | Reclutamiento, tienda progresiva, diaria, Boss Rush, supervivencia y draft | Campaña y supervivencia en Base Avengers | Tienda, diaria, Boss Rush, draft y extracción |
| Arte | 245 retratos, iconos y miniaturas compartidos | Imágenes originales del catálogo | Animaciones, atlas y resto del arte; modelos 3D después de las reglas |
| Interfaz/accesibilidad | Reglas y datos consultables | Catálogo adaptable, búsqueda, filtros, teclado, cierre por Escape | Portar el resto de las funciones de los paneles originales |

Copiado, probado e integrado son estados distintos. La aplicación ejecuta ahora CombatGame, no el prototipo de seis ataques simplificados. La selección temporal permite probar seis de los 105 héroes y no representa desbloqueos permanentes. La sesión arranca con niveles 1 y créditos iniciales, y no guarda sus mejoras al salir. El catálogo sigue siendo una vista previa sin gasto ni escritura de perfiles.

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
- En el HUB se pueden elegir seis héroes distintos. El combate admite una copia de cada uno, despliegue y movimiento gratuitos, retiro sin reembolso y mejoras hasta 100.
- Historia usa 100 oleadas, 20 vidas y 650 créditos de sesión; supervivencia usa las reglas originales con 750 créditos y bonus cada cinco rondas.
- Las marcas usan `ultimate-marvel-td-combat-v2`, aisladas del perfil del prototipo y del 2D. Niveles, inventario y progreso completo siguen siendo temporales hasta integrar su guardado.

La validación compara 105 kits en niveles 1 y 50 contra un ejecutor independiente del bucle 2D, con las clases originales. Compara también los 82 objetos sobre Spider-Man nivel 50. Esto no cubre todas las combinaciones objeto/héroe ni demuestra balance de campaña completa. Las pruebas de navegador completan una oleada real, arrancan la siguiente y usan escenarios preparados para las pantallas finales.

## Orden de continuación

### Laboratorio conservado

Se conserva el avance publicado en `f6ebe13`: `src/game/legacy-combat.js`, el ensayo del Archivo y sus pruebas diferenciales. El ensayo ejecuta 15 segundos contra seis enemigos base espaciados por un segundo; permite elegir cualquiera de los 49 enemigos y usar el nivel/objeto de la ficha, con hasta cinco compañeros de la prueba de sinergias. Usa posiciones fijas sobre una ruta recta y colocación libre, sin terrenos de misión. No modifica guardados.

El laboratorio informa daño, activaciones, bajas, fugas, enemigos pendientes, vidas y créditos. Una fuga de jefe causa derrota. Su conversión `legacyToWorld` es configurable; no debe confundirse con la escala de 32 píxeles/unidad de Base Avengers. El laboratorio y la misión comparten las entidades originales adaptadas sin Canvas; tienen coordinadores diferentes porque sólo la misión aplica oleadas, terreno, objetivos y acciones tácticas.

`test/fixtures/original-combat-loop.js` conserva el extracto original de GameLoop del commit de referencia. Sus pruebas comparan 105 escenarios durante 20 segundos y 82 objetos a distintas frecuencias, además de fugas, recompensas, pool y ejecución sin DOM/almacenamiento. Estas pruebas se mantienen junto a las de la misión 3D. Las antiguas indicaciones de que sólo existía el laboratorio quedan reemplazadas por la integración de Base Avengers descrita arriba.

### Próximos pasos

1. **Ampliar cobertura de combate.** El adaptador y las comparaciones básicas están integrados. Ampliar escenarios de combinaciones, transiciones de objetos, balance sostenido y visuales de zonas/dispositivos, manteniendo la referencia original.
2. **Colección y progresión.** Conectar ProgressionManager, ResourceManager y ShopSystem. Mantener un único objeto por héroe, costes y garantías originales. Importar guardados de forma explícita, validada y con copia recuperable; no escribir sobre el guardado 2D ni reinterpretar el perfil mínimo del prototipo como una colección completa.
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

El navegador verifica archivo, imágenes, cierre de panel, disposición móvil, equipo de 105 héroes, colocación, movimiento, mejora, retiro, primeras oleadas originales, jefes y resultados. El prototipo ya no se usa en la aplicación; sus pruebas se conservan como referencia.
