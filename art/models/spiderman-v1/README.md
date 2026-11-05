# Spider-Man clásico

Modelo creado en Blender a partir de la [ilustración aportada](../../references/spiderman/reference.jpg). El intento de Meshy terminó en un rechazo del control de contenido (tarea `01a1a967-6c41-779f-9e1a-88807de15b96`). El saldo consultado fue de 1.030 créditos.

[Ver el traje desde el frente](frente.png). El GLB contiene una malla, cuatro materiales y un esqueleto de 16 huesos. La red del traje, los lentes y el emblema son geometría. El resultado tiene 4.892 triángulos, por encima de la guía inicial de 3.000. La mano derecha tiene un gesto fijo de lanzamiento; la pose del brazo y el disparo se animan en el juego con el reloj de combate. El origen visual está en la muñeca. Los impactos y la inmovilización siguen el kit de Spider-Man del juego 2D.

Reproducir desde la raíz con `blender-launcher.exe -b --factory-startup --python-exit-code 1 --python scripts/blender/spiderman_classic.py`.
