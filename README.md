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

1. Abrir **ESCUADRÓN** en el HUB y elegir seis héroes distintos entre los 105 originales.
2. Entrar a **HISTORIA** o **INFINITO**. Ambos usan por ahora la Base Avengers.
3. Colocar héroes en terrenos compatibles y dentro del alcance de la ruta; iniciar la oleada.
4. Mejorar, reposicionar o retirar unidades desde su panel.

Los 105 héroes están disponibles para probar el combate durante la migración; no representan una colección desbloqueada ni invocaciones. El equipo elegido dura mientras la página esté abierta. Niveles, créditos y progreso de la partida se reinician al salir. Las marcas de combate se guardan aparte del prototipo y del 2D.

## Combate integrado

- Kits originales de los 105 héroes: daño, proyectiles, auras, control, resistencias, tipos, sigilo, estados y sinergias. Las clases originales calculan las reglas; el renderizador sólo convierte coordenadas.
- Ruta y terrenos de Base Avengers. Despliegue gratuito, una unidad por héroe, movimiento gratuito y retiro sin reembolso.
- Mejoras 1–100 con costes y curvas originales, evoluciones por nivel y siete prioridades: Primero, Último, Fuerte, Débil, Rápido, Sigilo y Jefe.
- Campaña de 100 oleadas con composiciones originales, invocadores, modificadores, minibosses cada 25 y Thanos final. La base tiene 20 vidas; un jefe que llega al final causa derrota inmediata.
- Supervivencia original: sin límite, inicio con 750 créditos y bonus cada cinco rondas. Historia comienza con 650 créditos en esta sesión de combate.
- Recompensas, objetivos de Base Avengers y estadísticas de daño. Pausa, velocidades 1×/2×/3× y avance automático con tiempo simulado.
- Proyectiles 3D, cifras de daño, anillos de impacto/estado, aviso de preparación de jefes, barras de vida, vuelo y sigilo.
- **ARCHIVO 2D**: 105 héroes, 82 objetos, 49 enemigos y 11 mapas; vistas previas de niveles, objetos, evoluciones y sinergias.
- **Ensayo de combate**, dentro de cada ficha: laboratorio numérico de 15 segundos con héroe, nivel, objeto, compañeros y cualquiera de los 49 enemigos. Conserva el laboratorio incorporado en la otra computadora; no modifica perfiles ni partidas.

## Pendiente

El inventario y guardado completo del 2D, compra/equipamiento, los otros diez mapas y los modos diaria/Boss Rush/draft aún no tienen flujo jugable. Los efectos de objetos existen y se verifican en el adaptador, pero no hay interfaz para equiparlos en la partida.

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

Las pruebas de navegador recorren HUB, archivo, selección de equipo, controles, primeras oleadas reales, móvil y guardado aislado. Las pantallas de victoria/derrota usan escenarios preparados; no representan una prueba de balance de las 100 oleadas con todos los equipos. Las capturas quedan en artifacts/, fuera de Git.

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
src/render/world.js     Cámara, modelos, proyectiles, estados y efectos
src/render/battle-map.js Ruta y terrenos originales dibujados en 3D
src/ui/hub.js            HUB y selección del equipo
src/ui/legacy-catalog.js Archivo del contenido original
src/main.js             Interfaz y coordinación de partida
```

Simulation.js y sus pruebas conservan el prototipo como referencia histórica; la aplicación ya no lo ejecuta.
