# Capitán América · traje de la referencia

Modelo y rig de Meshy con casco, estrella, correas y escudo en el brazo izquierdo. Blender adapta el brazo libre y añade un ciclo suave `Guardia`; el escudo conserva su posición. El render mide la pose inicial animada antes de normalizar la altura.

- Imagen: `01a1bff5-6fde-7606-8861-d30d6363b453`.
- Rig: `01a1bff8-1ceb-7094-8ae7-a31781d19d95`.
- Coste observado: 35 créditos; saldo posterior: 890.

Se integra en `capitan_america`, que en el juego original es apoyo puro. Mantiene Mando Avenger: +10 % de daño para aliados dentro del aura de 255 px a nivel base, con progresión original. Aturdirlo suspende el efecto. No se añadió lanzamiento de escudo ni un ataque que cambie sus reglas. La prueba de navegador verifica la carga, altura estable, bonificación, pérdida fuera del radio y suspensión durante el aturdimiento.

Pendientes de pulido: mano y sujeción trasera del escudo, optimización de las texturas y variantes de evolución. El modelo base no representa todavía la variante con Mjölnir.

Autoría: `scripts/blender/captain_america_guard.py`; requiere el rig descargado en `artifacts/3d/captain-america-rig-v1/model.glb`.

[Referencia](../../references/captain-america/reference.jpg) · [Frente](frente.png) · [Espalda](espalda.png)
