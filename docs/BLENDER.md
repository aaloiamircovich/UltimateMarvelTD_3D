# Base chibi y material toon en Blender

La automatización actual usa Blender 5.2.3 LTS de Microsoft Store. Ver [ARTE_3D.md](ARTE_3D.md) para comprobar instalación, exportar/inspeccionar GLB y conectar Meshy. El script descrito a continuación se conserva como base histórica de autoría.

El generador [chibi_toon.py](../scripts/blender/chibi_toon.py) adapta el script aportado por el usuario. Crea un maniquí modular de seis piezas, un material rojo de tres tonos, contorno negro mediante Solidify invertido, una luz solar y una cámara ortográfica. Requiere Blender 4.2 o posterior con EEVEE; la ejecución y el aspecto deben verificarse en la versión instalada.

## Ejecutar

1. Abrir Blender y cambiar a **Object Mode**.
2. En **Scripting**, elegir **Open** en el editor de texto y abrir `scripts/blender/chibi_toon.py`.
3. Pulsar **Run Script**. Se activa la escena `TD_Chibi_Preview`.
4. Pulsar **Numpad 0** para mirar por la cámara y **Z → Rendered** para ver el material. **F12** genera la imagen. El modo Solid no muestra los nodos toon.
5. Guardar el proyecto como `.blend` manualmente. Los renders y archivos de prueba pueden ir en `artifacts/`, excluido de Git.

Al repetir la ejecución se regeneran los objetos creados por el script: se pierden las modificaciones manuales realizadas sobre esas piezas. Las otras escenas y los objetos añadidos manualmente se conservan. Para conservar una variante, duplicar las piezas con datos y materiales independientes y quitar su propiedad personalizada `td_chibi_generator`. No mover las piezas generadas a otras colecciones antes de regenerar.

También se puede ejecutar desde PowerShell, ajustando la ruta de Blender:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.2\blender.exe' --background --python-exit-code 1 --python scripts/blender/chibi_toon.py --render-output '//artifacts/chibi-' --render-frame 1
```

## Parámetros y correcciones

Los colores, el ancho de contorno, la escala ortográfica y los ángulos están al inicio del script. Los colores se expresan en RGBA lineal. La cámara usa 55° de inclinación en X y 45° de azimut; son parámetros artísticos ajustables, no una medición verificada de la cámara de ASTD. Su posición se calcula para apuntar al centro del maniquí.

- Se corrige el bucle inválido `for obj in bpyr = ...` del original.
- Se asigna la cámara activa y se añade iluminación para alimentar el material.
- Se usa sombreado plano, coherente con la intención low-poly del original.
- Se definen explícitamente sombra, base y luz; la rampa se conecta a un shader Emission antes de Surface.
- Se elimina `blend_method`, innecesario para el material opaco.
- Se informa por consola el conteo de caras y triángulos antes y después de los modificadores. El contorno también consume geometría; no se promete un presupuesto fijo de menos de 600 polígonos.

El nodo **Shader to RGB sólo funciona en EEVEE**, según la [documentación de Blender](https://docs.blender.org/UATEST/manual/en/dev/render/shader_nodes/color/shader_to_rgb.html). No se ofrece compatibilidad con Cycles para este material.

## Comprobación visual en Blender

Tras ejecutar, confirmar que el personaje completo entra en cámara, que se distinguen las bandas de luz y que el contorno aparece en la silueta sin cubrir las caras. Volver a ejecutar y comprobar que siguen existiendo seis piezas generadas, una cámara y una luz, sin duplicados. El informe de geometría debe mantenerse estable. Revisar la escena original para confirmar que conserva sus objetos.

## Relación con el juego

Este script es una herramienta de autoría; los modelos actuales siguen definidos en `src/render/models.js`. El maniquí no tiene rig, manos, rostro ni animaciones, y todavía no es un héroe terminado. La dirección de arte contempla 1500–3000 polígonos por héroe final y 500–1000 por enemigo; al producirlos hay que distinguir caras de autoría, triángulos exportados y geometría adicional del contorno.

Exportar una malla a glTF no reproduce automáticamente este árbol de nodos. Para integrarla al juego hay que preparar materiales compatibles y recrear el sombreado toon y el contorno en Three.js, además de definir escala, pivotes y animaciones. Esa integración debe mantenerse en el renderizador, sin introducir Blender, Three.js ni DOM en la simulación.
