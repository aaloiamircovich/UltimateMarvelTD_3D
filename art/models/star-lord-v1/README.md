# Star-Lord · primer modelo equipado

El cuerpo se generó desde la [referencia del usuario](../../references/star-lord/reference.webp) con Meshy. Generación `01a1a95a-fea5-7086-b346-6276398f9222`, rig `01a1a95d-7767-7156-8290-5a1ac6b8ec4a`. Coste conjunto observado: 35 créditos.

[Vista frontal](frente.png) · [Vista posterior](espalda.png)

El GLB incluye el cuerpo y dos blásters construidos en Blender, cada uno pesado a su mano. Se reunieron los clips Caminar y Correr en un archivo con 24 huesos, cuatro materiales y 3.869 triángulos. Abrir el GLB desde el Estudio 3D para rotarlo y probar los clips. En combate, el modelo equipado usa una pose de tiro por brazo. El derecho apunta al blanco principal y el izquierdo al blanco secundario que elige el kit original. Las manos mantienen un agarre fijo, ajustado sobre la geometría con el rig de 24 huesos. Las bocas de ambas armas acompañan al esqueleto y fijan el origen visual de los proyectiles.

Para reconstruir el equipo, descargar los GLB del rig en `artifacts/3d/star-lord-rig-v1/` y ejecutar desde la raíz `blender-launcher.exe -b --factory-startup --python scripts/blender/star_lord_loadout.py`.
