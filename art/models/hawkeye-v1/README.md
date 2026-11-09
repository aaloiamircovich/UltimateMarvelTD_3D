# Hawkeye · traje negro y violeta

Cuerpo y carcaj generados con Meshy desde la referencia de la figura. Meshy excluyó los accesorios sueltos del producto. El arco recurvo, la cuerda y la empuñadura se construyeron en Blender; sus vértices siguen el hueso de la mano derecha. El clip `Disparo` representa apuntado, suelta y vuelta al reposo.

- Generación: `01a1c2b7-0df7-73a4-be05-6aae1075c09d` (`hawkeye-figure-v2`).
- Rig: `01a1c2b9-79ed-7450-9147-56892f235985` (`hawkeye-rig-v2`).
- Coste: 35 créditos; saldo posterior: 855.
- La primera imagen fue rechazada por Meshy. La limpieza con imagegen de la nueva referencia también fue rechazada y no produjo un archivo; se utilizó la imagen original de la figura.

La unidad original conserva Carcaj Táctico y sus tres municiones. La prueba comprueba las flechas, el refuerzo de 35 % y radio explosivo de 85 px del cuarto disparo, el origen junto al arco y la pausa. No se modificaron datos ni reglas originales.

Modelo final: 3.280 triángulos, 24 huesos, tres materiales. Pendientes: detalle del agarre y de los dedos, deformación de cuerda y flecha cargada antes del disparo, reducción del brillo de materiales y optimización de texturas. La cuerda actual mantiene su geometría durante el gesto; no se simula tensión física.

Autoría: `scripts/blender/hawkeye_loadout.py`; requiere `artifacts/3d/hawkeye-rig-v2/model.glb`. La conversión de la geometría del arco a la pose de enlace evita un desplazamiento incorrecto al abrir el GLB sin animación.

[Referencia de figura](../../references/hawkeye/reference-figure.jpg) · [Primera referencia](../../references/hawkeye/reference.jpg) · [Frente](frente.png) · [Espalda](espalda.png)
