# Migración de TowerDefense_Marvel

## Objetivo y fuente

Trasladar todo lo aprovechable del juego anterior antes de ampliar el HUB, inventar sistemas de progresión o producir nuevos modelos. Conservar IDs, contenido, reglas, costes, habilidades, curvas y contratos. La presentación 3D debe adaptarse a la simulación original.

Fuente publicada: [TowerDefense_Marvel, commit 84797a5a0c0f344145a7b3442b02e46f13ebdb8b](https://github.com/aaloiamircovich/TowerDefense_Marvel/tree/84797a5a0c0f344145a7b3442b02e46f13ebdb8b).

La carpeta local del 2D tiene cambios sin publicar, incluidos TargetFocusSystem y pruebas de transiciones. No se modificaron ni se incorporaron silenciosamente: el snapshot se lee desde blobs de Git del commit publicado. Evaluar esos cambios aparte si posteriormente se actualiza el origen.

Inventario verificado en código: 105 héroes, 105 evoluciones base, 82 objetos, 30 enemigos normales, 19 jefes, 11 mapas, 23 agrupaciones y 6 sinergias de pareja. La campaña original tiene 100 oleadas, minibosses cada 25 y desbloqueos de mapas por estrellas. No usar los conteos desactualizados del README del 2D.

## Estado real

| Área | Conservado | Integrado en la aplicación 3D | Pendiente |
| --- | --- | --- | --- |
| Héroes | 105 definiciones completas, habilidades, afinidades, retratos | Archivo buscable y fichas con cálculo original | Desplegar todos con sus kits reales |
| Objetos | 82 definiciones, firmas y efectos | Consulta y vista previa de un objeto por héroe | Inventario, compra y equipo en partida |
| Niveles y evoluciones | Curvas 1–100, costes, 105 evoluciones y transformaciones | Vista previa por nivel/objeto usando Hero y ProgressionManager originales | Persistencia y aplicación en combate |
| Agrupaciones | 23 familias, 6 parejas y efectos | Prueba de equipos de hasta 6 héroes distintos | Escuadrón persistente y efectos en partidas |
| Enemigos y jefes | 30 normales, 19 jefes, comportamientos y resistencias | Catálogo de valores base | Oleadas y representación en escenarios 3D |
| Mapas y misiones | 11 definiciones, rutas, terreno, objetivos y textos | Consulta de operaciones, requisitos y objetivos | Conversión geométrica y validación de ruta/terreno |
| Oleadas | Generador, escalado, facciones y director de encuentros | Núcleo con pruebas heredadas | Sustituir las 12 oleadas simplificadas del prototipo |
| Combate | Habilidades, proyectiles, tipos, estados, efectos de área, auras y apoyo | Adaptador independiente del render y ensayo numérico desde las fichas | Conectar entidades/eventos a la misión 3D y validar campaña |
| Progresión | Guardado versionado, economía, maestrías, códice, contratos y logros | Snapshot y pruebas | Guardado 3D aislado e importación explícita de partidas 2D |
| Tienda y modos | Reclutamiento, tienda progresiva, diaria, Boss Rush, supervivencia y draft | Catálogo informativo y pruebas | Flujo completo en el HUB y partidas |
| Arte | 245 retratos, iconos y miniaturas compartidos | Imágenes originales del catálogo | Animaciones, atlas y resto del arte; modelos 3D después de las reglas |
| Interfaz/accesibilidad | Reglas y datos consultables | Catálogo adaptable, búsqueda, filtros, teclado, cierre por Escape | Portar el resto de las funciones de los paneles originales |

Copiado, probado e integrado son estados distintos. La existencia del módulo original no implica que la misión 3D lo use. Los seis héroes, Manhattan, la economía y las sinergias simplificadas del prototipo se mantienen identificados como provisionales. El catálogo no gasta créditos, no modifica perfiles y no desbloquea unidades en esa misión.

## Arquitectura de esta entrega

- `src/legacy/`: snapshot sin modificaciones de 58 módulos y sus dependencias, seis JSON completos, tabla de tipos, aviso original y matriz de identidad. Contiene 89 archivos de pruebas seleccionados.
- `src/legacy/manifest.json`: commit, rutas y SHA-256 de cada archivo incorporado. `.gitattributes` evita normalizar sus bytes al cambiar de plataforma.
- `public/legacy/`: imágenes del catálogo conservadas; nueve miniaturas de mapas del original son identificadores simbólicos, no rutas de imagen. No se fabrican URLs para ellas.
- `src/game/legacy-catalog.js`: adaptador del núcleo original. Una subclase de Hero omite únicamente cargar imágenes de Canvas en la ficha; el cálculo de estadísticas usa las implementaciones originales, sin Three.js ni DOM.
- `src/ui/legacy-catalog.js`: catálogo accesible desde ARCHIVO 2D en el HUB. Se carga al abrirlo para no cargar todo el contenido al arrancar la plaza.
- `src/game/legacy-combat.js`: ejecuta Hero, Enemy, Projectile, ResourceManager y TeamSynergySystem originales. ProgressionManager usa almacenamiento nulo y estado transitorio. Reloj fijo de 60 pasos por segundo, RNG con semilla, pool original de proyectiles, snapshots y eventos desacoplados de la presentación.
- `test/fixtures/original-combat-loop.js`: extracto sin cambios de `GameLoop.update` y `handleEnemyReachedEnd` del mismo commit publicado, usado como referencia diferencial de pruebas. No forma parte del juego distribuido.

Algunos módulos heredados todavía contienen métodos de renderizado Canvas. Permanecen aislados en el snapshot; no deben ejecutarse como parte de la nueva simulación. Su separación o adaptación debe hacerse fuera del snapshot y verificarse contra los contratos originales.

### Puente de combate y laboratorio

En **ARCHIVO 2D → Héroes**, el ensayo ejecuta 15 segundos contra seis enemigos base, separados por un segundo. Permite seleccionar cualquiera de los 49 enemigos, incluyendo jefes. Usa el nivel y objeto de la ficha; añade hasta cinco compañeros distintos de la prueba de sinergias, en nivel 1 y sin objeto. El héroe de la ficha tiene prioridad si ya había seis seleccionados. Las posiciones son fijas sobre una ruta recta sin bonificaciones de terreno, con colocación libre: no es una misión ni una oleada del juego original. Las invocaciones de enemigos conservan sus reglas.

El resumen muestra daño del héroe/equipo, activaciones, derrotados, fugas, enemigos aún en ruta, vidas y créditos. Los héroes de apoyo no necesitan atacar para afectar al equipo. La fuga de un jefe termina el ensayo con derrota. Las recompensas quedan sólo en memoria y no tocan el guardado del prototipo ni del 2D.

Las coordenadas del adaptador son píxeles originales. `legacyToWorld` convierte únicamente la presentación a metros (40 px/m por defecto). `advance` acumula tiempo de presentación y ejecuta pasos fijos; `step` sirve para pruebas. El consumidor debe retirar los eventos con `drainEvents` después de cada actualización. Se entregan eventos de efectos, sonido, mensajes, aparición, bajas y fugas con datos separados de las entidades; no se ejecuta Canvas, Image, DOM ni Three.js. El tamaño visual del enemigo sí se conserva para calcular el tramo de salida original.

Validación añadida: comparación cada segundo de 105 escenarios de 20 segundos contra entidades originales y el extracto de GameLoop; comparación de 82 objetos a 30 y 144 actualizaciones por segundo; recompensas únicas, reutilización de proyectiles, fugas y derrota por jefe; ejecución de los 49 enemigos y 105 héroes sin acceso a imágenes, DOM o almacenamiento. Esto cubre esos escenarios, **no demuestra todas las combinaciones de kits, terrenos, objetos y misiones**. Las 2.526 pruebas heredadas siguen ejecutándose sin cambios.

El siguiente paso es conectar este puente a una escena de combate usando la ruta y terreno originales de Base Avengers, y después WaveManager y MissionSystem. Siguen pendientes compra/colocación, objetivos, escalado de oleadas, persistencia y visualización de habilidades. El ensayo no reemplaza silenciosamente la misión de seis héroes.

## Orden de continuación

1. **Adaptador de combate.** Usar Hero, Enemy y Projectile originales con coordenadas de simulación explícitas. Mantener píxeles/unidades de origen en reglas y convertir sólo al renderizar. Crear escenarios deterministas que comparen daño, objetivos, estados, tiempos, auras y recompensas. Evitar convertir 105 kits en variantes de los seis ataques actuales.
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

El navegador debe verificar búsqueda, rarezas, niveles, transformaciones por objeto, sinergias, las seis secciones, carga de imágenes, cierre de panel y disposición móvil, además de mantener la misión del prototipo funcional.
