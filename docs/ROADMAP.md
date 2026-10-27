# Roadmap

## Prioridad vigente — Migrar el juego 2D

El usuario pidió pasar todo lo aprovechable de `TowerDefense_Marvel` antes de nuevas funciones 3D. Esta prioridad reemplaza el orden previo de expansión del HUB. La referencia de ejecución es [MIGRACION_2D.md](MIGRACION_2D.md): primero datos y núcleo verificable, después combate completo, progresión e inventario, mapas y modos, y por último presentación 3D.

Ya se incorporaron los datos de 105 héroes, 82 objetos, 49 enemigos y 11 mapas; 58 módulos heredados y 89 archivos de pruebas. El archivo del HUB utiliza los cálculos originales para consultar niveles, objetos, evoluciones y sinergias. La integración de ese núcleo en partidas 3D sigue pendiente.

## Dirección confirmada por el usuario

El objetivo es el ciclo de los tower defense de Roblox: personaje propio en tercera persona → HUB recorrible → invocaciones, historia, infinito, traits y grades → mejora del escuadrón → nuevas misiones. La misión de Manhattan es una actividad dentro de esa experiencia. Priorizar este flujo antes de dedicar la siguiente fase exclusivamente a producir modelos.

## 0.2 — Primera base del HUB (implementada)

- Plaza Avengers Campus, avatar con movimiento y salto, cámara en tercera persona y controles táctiles.
- Estaciones de historia e infinito conectadas a Manhattan. Infinito continúa después de la oleada 12 y guarda una marca separada.
- Estaciones de invocaciones, traits y grades ubicadas, con indicación explícita de que aún no son funcionales.
- Volver al HUB desde la misión y desde resultados.

## Después de la migración — Extensiones del HUB

- El usuario indicó que describirá otras reglas para traits y grades. No usar como decisión aprobada la propuesta de traits pasivos aleatorios y grades C/B/A/S con rerolls.
- Reutilizar primero colección, inventario, reclutamiento y selección de escuadrón del 2D. Definir cambios únicamente después de comprobar su migración.
- Integrar traits y grades con las reglas que aporte el usuario y verificar su efecto en las misiones.
- Extender el avatar y la cámara de tercera persona a las misiones; actualmente el combate mantiene cámara táctica.

## 0.1 — Base jugable (implementada)

Manhattan 3D, seis héroes, doce oleadas, Ultron, economía, mejoras, sinergia, prioridades, perfil local, cámara y controles, pruebas de simulación y navegador.

## Posterior — Identidad visual y contenido

- Sustituir modelos geométricos por modelos GLB chibi con rigs y animaciones de idle, ataque e impacto.
- Sincronizar daño y efectos con los momentos de impacto de las animaciones.
- Refinar Manhattan, añadir destrucción visual y variar enemigos con siluetas más claras.
- Añadir Base Avengers y un segundo jefe con mecánicas propias.
- Medir y optimizar en hardware real, incluyendo un dispositivo móvil.

## 0.3 — Colección y progresión

- Ampliar la navegación del HUB y convertir el escuadrón informativo en una colección configurable.
- Guardado versionado de colección, experiencia, misiones y recompensas.
- Invocaciones con rarezas, probabilidades visibles y protección contra duplicados frustrantes.
- Primeras evoluciones: Extremis, Iron Spider y variantes coherentes con el juego 2D.
- Separar poder permanente y mejoras de partida para no romper la campaña inicial.

## 0.4 — Profundidad táctica

- Más héroes del repositorio 2D, equipo de seis configurable y familias de sinergias.
- Reglas de terreno, enemigos especiales, counters y habilidades activas.
- Expandir historia e infinito con recompensas y añadir desafío.
- Persistencia de una partida en curso y tutorial interactivo.

## Futuro — Cooperativo

El multijugador requiere una arquitectura autoritativa de servidor: economía, colocación y daño validados, salas, sincronización y reconexión. No debe construirse como un intercambio de perfiles locales manipulables.

Este roadmap expresa dirección de producto; no fija plazos ni presenta funciones futuras como disponibles.
