# Roadmap

## Prioridad: migrar el juego 2D

Trasladar todo lo aprovechable de TowerDefense_Marvel antes de nuevas funciones 3D. [MIGRACION_2D.md](MIGRACION_2D.md) distingue datos conservados, reglas verificadas y funciones accesibles.

## Integrado

- HUB en tercera persona, salto, cámara, controles táctiles y estaciones.
- Archivo original: 105 héroes, 82 objetos, 49 enemigos y 11 mapas; consulta de niveles, objetos, evoluciones y sinergias.
- Colección real: elección inicial original, reclutamiento sin duplicados, tienda progresiva y un objeto por héroe. Equipo persistente de uno a seis personajes desbloqueados.
- Combate con clases originales, proyectiles, estados, auras, sinergias, mejoras 1–100, siete prioridades, terreno, movimiento y retiro.
- Base Avengers con ruta, objetivos y 100 oleadas. Supervivencia original sobre ese mapa.
- Perfil 3D aislado: niveles, equipo, prioridades, objetos, créditos y progreso generado por la misión. Exportación e importación explícita de respaldos 3D/2D v9 con validación y copia anterior. Las oleadas y posiciones en curso no se reanudan.

## Próximo: campaña y sistemas transversales

- Los otros diez mapas, terrenos, rutas, desbloqueos y mecánicas de misión.
- Operación diaria, Boss Rush, draft y extracción de supervivencia.
- Controles y persistencia de maestrías, códice, contratos, logros y replays.
- Completar visuales de dispositivos y zonas persistentes; ampliar pruebas de combinaciones.
- Validar balance de campañas completas con equipos legales y progreso persistente.

## Presentación y extensiones del HUB

- Modelos GLB chibi y animaciones propios de cada héroe/enemigo.
- Avatar y cámara de tercera persona en misiones; el combate actual es táctico.
- Más detalle de escenarios después de conservar sus rutas y reglas. Manhattan continúa siendo una actividad prevista del HUB.
- Traits y grades según las reglas que describa el usuario. No asumir pasivas aleatorias, rangos C/B/A/S ni rerolls.
- Medición de rendimiento en equipos reales y un móvil físico.

## Antecedentes y futuro

La alpha inicial tenía Manhattan, seis héroes simplificados y doce oleadas; luego incorporó el HUB. Ese combate ya no es el utilizado por la aplicación. Su simulación y pruebas se conservan como referencia histórica.

El cooperativo requiere servidor autoritativo, validación de economía/daño, sincronización y reconexión. Este roadmap no fija plazos ni presenta pendientes como funciones disponibles.