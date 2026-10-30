# Ultimate Marvel TD · 3D

Tower defense independiente de Roblox, con Three.js y JavaScript. El juego empieza en un HUB con personaje en tercera persona. **El combate ahora usa el núcleo original de [TowerDefense_Marvel](https://github.com/aaloiamircovich/TowerDefense_Marvel)** en un escenario 3D de la Base Avengers.

La prioridad es migrar reglas y contenido antes de producir nuevos modelos. Ver [MIGRACION_2D.md](docs/MIGRACION_2D.md) para el estado de cada sistema.

## Jugar

Requisitos: Node.js 22.12 o superior y navegador con WebGL 2.

```sh
npm ci
npm run dev
```

Abrir **http://127.0.0.1:5173/**. En Windows también se puede usar Jugar.cmd.

1. Abrir **COLECCIÓN** en el HUB y elegir Black Widow, Hawkeye o Korg como héroe inicial. El perfil empieza con 1.200 créditos.
2. Reclutar héroes, comprar objetos y equipar uno por héroe. Armar un equipo de uno a seis personajes desbloqueados.
3. Entrar a **HISTORIA** o **INFINITO**. Ambos usan por ahora la Base Avengers.
4. Colocar héroes en terrenos compatibles y dentro del alcance de la ruta; iniciar la oleada.
5. Mejorar, reposicionar o retirar unidades desde su panel.

La colección, el equipo, los niveles, las prioridades de ataque, los objetos y el saldo del perfil se guardan en este navegador. Las oleadas y posiciones de una partida en curso no se reanudan después de cerrar. El Archivo permite consultar y ensayar los 105 héroes sin alterar la colección.

En **Colección → Guardado y traslado de perfil** se puede exportar el perfil 3D o importar un respaldo 3D/2D (versión 9 del origen). La importación muestra un resumen antes de aplicarse y guarda una copia anterior descargable. No se toca la clave de guardado del 2D ni la del prototipo. Un guardado ilegible se conserva intacto y un error de almacenamiento se muestra en pantalla; el progreso temporal se puede exportar.

El reclutamiento original no da duplicados: cuesta 500 inicialmente, sube un 12% por compra y garantiza una rareza superior después de cuatro comunes consecutivos si quedan disponibles. La tienda muestra los tres objetos más accesibles que faltan.

## Combate integrado

- Kits originales de los 105 héroes: daño, proyectiles, auras, control, resistencias, tipos, sigilo, estados y sinergias. Las clases originales calculan las reglas; el renderizador sólo convierte coordenadas.
- Ruta y terrenos de Base Avengers. Despliegue gratuito, una unidad por héroe, movimiento gratuito y retiro sin reembolso.
- Mejoras 1–100 con costes y curvas originales, evoluciones por nivel y siete prioridades: Primero, Último, Fuerte, Débil, Rápido, Sigilo y Jefe.
- Campaña de 100 oleadas con composiciones originales, invocadores, modificadores, minibosses cada 25 y Thanos final. La base tiene 20 vidas; un jefe que llega al final causa derrota inmediata.
- Supervivencia original: sin límite, inicio con 750 créditos y bonus cada cinco rondas. Historia usa el saldo del perfil. Como en el 2D, ganar o gastar en Infinito sustituye el saldo del perfil por el de esa partida; salir antes de cualquier movimiento de créditos conserva el saldo previo. La entrada al modo explica esta regla.
- Recompensas, objetivos de Base Avengers y estadísticas de daño. Pausa, velocidades 1×/2×/3× y avance automático con tiempo simulado.
- Proyectiles 3D, cifras de daño, anillos de impacto/estado, aviso de preparación de jefes, barras de vida, vuelo y sigilo.
- **ARCHIVO 2D**: 105 héroes, 82 objetos, 49 enemigos y 11 mapas; vistas previas de niveles, objetos, evoluciones y sinergias.
- **Ensayo de combate**, dentro de cada ficha: laboratorio numérico de 15 segundos con héroe, nivel, objeto, compañeros y cualquiera de los 49 enemigos. Conserva el laboratorio incorporado en la otra computadora; no modifica perfiles ni partidas.

## Herramientas de arte 3D

Blender de Microsoft Store ya se puede automatizar mediante `npm run art -- doctor`, `fixture` e `inspect`. El conector de Meshy se configura con una clave local y permite generar desde imagen, consultar, descargar y crear el esqueleto. Instrucciones: [ARTE_3D.md](docs/ARTE_3D.md).

El [Estudio de modelos](http://127.0.0.1:5173/art-studio.html) permite revisar GLB, materiales y animaciones. Son herramientas de autoría; todavía no reemplazan los modelos provisionales de batalla. La conexión Meshy ya se validó con un primer Iron Man Mark VII; sus assets están en `art/models/iron-man-mark-vii-v1/`, todavía pendientes de integrar al combate.

## Pendiente de juego

Los otros diez mapas, los modos diaria/Boss Rush/draft, la extracción de supervivencia y los paneles de maestrías, códice, contratos y logros aún no tienen flujo jugable. Sus datos de perfil se conservan al importar, pero esto no implica que sus funciones estén integradas.

El combate conserva cámara táctica. Los modelos son provisionales: seis siluetas específicas y representaciones básicas para el resto. Faltan modelos y animaciones propios de todo el catálogo y la representación completa de dispositivos y zonas persistentes. Traits y grades esperan las reglas del usuario.

## Controles

| Acción | Control |
| --- | --- |
| Caminar en el HUB | WASD / flechas / botones táctiles |
| Saltar / interactuar en el HUB | Espacio / E |
| Elegir héroe o seleccionar el ya desplegado | Tarjeta / teclas 1–6 |
| Colocar, mover o seleccionar | Clic izquierdo en el mapa |
| Cancelar selección | Esc |
| Mejorar / pausar / iniciar oleada | U / Espacio / N |
| Girar / mover cámara de batalla | Arrastrar con clic derecho / central |
| Acercar / restaurar cámara | Rueda / R |
| Cámara táctil | Un dedo para mover; dos para zoom y rotación |

Los diálogos pausan el combate. Cambiar de pestaña también pausa; se reanuda manualmente.

## Validación

```sh
npm run check
npx playwright install chromium
npm run test:browser
```

Check ejecuta pruebas de simulación/adaptadores, integridad de archivos, las 2.526 pruebas heredadas y compilación. La comparación con un ejecutor independiente de las clases 2D verifica los 105 kits en niveles 1 y 50 y los 82 objetos sobre Spider-Man nivel 50. También se comprueban terreno, movimiento, economía, tiempos y estados finales.

Las pruebas de navegador recorren HUB, archivo, elección inicial, reclutamiento, compra, equipamiento, recarga persistente, exportación, importación validada con respaldo, selección de equipo, controles, primeras oleadas reales, móvil y recuperación de guardados dañados. Las pantallas de victoria/derrota usan escenarios preparados; no representan una prueba de balance de las 100 oleadas con todos los equipos. Las capturas quedan en artifacts/, fuera de Git.

```sh
npm run build
npm run preview
```

Dist funciona en servidor estático y en subdirectorios. Abrir el HTML por file:// no está soportado.

## Estructura

```text
src/legacy/              Origen 2D intacto, pruebas y manifiesto de integridad
src/game/combat.js       Adaptador original sin DOM ni Three.js
src/game/combat-data.js  Datos y conversión de coordenadas
src/game/progression.js  Perfil persistente, adaptador del ProgressionManager original
src/ui/collection.js     Colección, equipo, tienda y traslado de perfiles
src/render/world.js     Cámara, modelos, proyectiles, estados y efectos
src/render/battle-map.js Ruta y terrenos originales dibujados en 3D
src/ui/hub.js            HUB y selección del equipo
src/ui/legacy-catalog.js Archivo del contenido original
src/main.js             Interfaz y coordinación de partida
```

Simulation.js y sus pruebas conservan el prototipo como referencia histórica; la aplicación ya no lo ejecuta.
