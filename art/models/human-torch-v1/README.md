# Human Torch · traje azul y blanco

El usuario eligió la primera referencia para combinar con Reed y Sue. Meshy rechazó esa imagen en su control de contenido (tarea `01a1b6dc-6b51-736d-b7e6-e18fa70d8962`); el saldo permaneció en 960 créditos. Este modelo es una alternativa estilizada construida en Blender, no un resultado de Meshy.

Traje azul y blanco, emblema geométrico, rostro descubierto, cabello rubio y clip `Lanzamiento`. La mano derecha emite el proyectil original. Cinco emisores de llamas en manos, pies y cabeza usan el tiempo de simulación: se congelan al pausar y reducen su intensidad durante el aturdimiento. Son efectos de presentación sin daño adicional.

La prueba de navegador verifica origen del proyectil, movimiento del brazo, pausa y Nova Flame original: zona de 3 segundos y daño de ignición para hasta cuatro objetivos que permanecieron dentro. Cuenta tanto el daño absorbido por barreras como el recibido en vida. Se conserva splash y quemadura del kit original; no se modificó `src/legacy/`.

Reproducir: `blender-launcher.exe -b --factory-startup --python-exit-code 1 --python scripts/blender/human_torch_cast.py`.

Pendientes: anatomía y rostro más finos, deformación suave de articulaciones y una versión de mayor fidelidad. El modelo actual usa volúmenes estilizados y asignación rígida de huesos. Las llamas se añaden en el juego; no están embebidas en el GLB ni en los renders de Blender. No se añadió todavía una visualización persistente de la zona de Nova Flame.

[Referencia elegida](../../references/human-torch/reference-classic.jpg) · [Referencia secundaria](../../references/human-torch/reference-rivals.jpg) · [Frente](frente.png) · [Espalda](espalda.png)
