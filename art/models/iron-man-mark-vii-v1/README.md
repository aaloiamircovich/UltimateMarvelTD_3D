# Iron Man Mark VII — primera versión

Referencia aportada por el usuario: `../../references/iron-man-mark-vii/reference.webp`.
Generado con Meshy desde esa imagen; rigging del mismo proveedor. Revisado con Blender 5.2.3 LTS y el visor Three.js del proyecto.

- 3.095 triángulos; un material; texturas 2048×2048.
- 24 huesos.
- `model.glb`: modelo con esqueleto (incluye clip base del proveedor, no se declara como reposo terminado).
- `walk.glb`: animación de caminar con malla.
- `run.glb`: animación de correr con malla.
- `preview.png`: render de la malla inicial antes del rigging.
- Coste observado: 30 créditos por generación + 5 por rigging. Saldo después: 1.065.

Estado: candidato de autoría, todavía no conectado al combate. La parte trasera fue inferida desde una referencia frontal. Revisar manos, espalda, hombros, rodillas y pies en movimiento. Faltan ataque, habilidades, integración con el tiempo de la simulación y pruebas de rendimiento con varias unidades. Supera por 95 triángulos la guía inicial de 3.000; no se degradó automáticamente la malla para alcanzar ese número.

Los tres GLB contienen texturas duplicadas para conservar las salidas originales del proveedor. Antes de distribuirlos en el juego conviene empaquetar los clips con una sola malla/material y optimizar texturas. No son tres descargas necesarias durante una partida.

No hubo retoque manual de la geometría ni validación exhaustiva de deformaciones. Las pruebas confirman apertura del GLB, materiales, esqueleto y disponibilidad de los clips en Blender/Three.js.
