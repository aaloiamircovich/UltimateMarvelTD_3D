# Herramientas para mejorar los personajes 3D

El usuario autorizó preparar Blender y las APIs necesarias para mejorar el modelado. Esta entrega configura la autoría y revisión de assets; los héroes de batalla todavía usan los modelos provisionales. El primer héroe terminado se incorporará después de revisar su malla, materiales, animaciones y rendimiento.

## Estado comprobado

- Blender **5.2.3 LTS de Microsoft Store**, instalado por el usuario: automatización, creación de `.blend`, exportación GLB con esqueleto y animación, importación y render CPU comprobados.
- Visor local: **http://127.0.0.1:5173/art-studio.html**. Abre GLB desde el equipo, muestra geometría, materiales y animaciones; permite girar, centrar, pausar, elegir clips y ver la malla. También se incluye en la compilación estática.
- Conector Meshy: creación desde imagen, consulta, descarga, rigging, animaciones básicas devueltas por rigging y consulta de saldo implementados. **Falta configurar y validar una clave real.** Las pruebas de contrato usan respuestas simuladas; todavía no se generó un personaje con esta API.
- Generación de referencias: la herramienta integrada de imágenes está disponible sin una clave OpenAI del proyecto. El intento de referencia de Iron Man fue rechazado por esa herramienta; no se produjo ni se guardó una imagen. Se puede usar una referencia elegida por el usuario para el flujo de autoría.
- No se instalaron conectores comunitarios ni se contrataron planes. Tripo queda como alternativa si se necesita comparar resultados; no es necesario configurar dos proveedores para comenzar.

## 1. Blender

```powershell
npm run art -- doctor
npm run art -- fixture
npm run art -- inspect artifacts/3d/pipeline-fixture/fixture.glb
```

`doctor` ejecuta Python dentro de Blender y verifica un acuse de finalización, no sólo que exista el programa. Se prioriza `BLENDER_PATH` si está configurado; después, el alias `blender-launcher.exe` de Microsoft Store. El launcher termina antes que Blender, por eso cada exportación/render deja un acuse y un log en `artifacts/3d/blender-jobs/`.

La prueba `fixture` crea una forma geométrica neutra con un hueso, material PBR y animación `Idle`: es una prueba de interoperabilidad, **no un modelo de calidad artística ni un héroe**. El inspector informa triángulos, huesos, materiales, dimensiones y texturas, y genera un render de 512 px. Excluye las mallas auxiliares que Blender crea para visualizar huesos. No modifica el archivo inspeccionado.

Los resultados van a `artifacts/3d/`, fuera de Git. La pequeña copia estable `test/fixtures/blender-probe.glb` se conserva intencionalmente como dato de pruebas de navegador, exportada por Blender 5.2.3 con `pipeline_fixture.py` (352 triángulos, un hueso, un material, un clip).

Si Blender está en otra ubicación, completar `BLENDER_PATH` en `.env.local`. Para Microsoft Store dejarlo vacío: no ejecutar directamente el binario protegido dentro de WindowsApps. En una computadora sin Blender, instalarlo desde Microsoft Store o usar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-blender.ps1
```

El instalador opcional detecta primero Microsoft Store; en otro caso descarga Blender 4.5 LTS portable desde blender.org y verifica el SHA-256 oficial antes de extraerlo. La copia portable inicial no pudo arrancar en esta computadora por un error SideBySide; la instalación de Store sí quedó verificada. No cambiar permisos de WindowsApps para resolverlo.

## 2. Conectar Meshy

1. Crear/iniciar sesión en [Meshy](https://www.meshy.ai/).
2. Entrar a [API Keys](https://www.meshy.ai/developers/keys), crear una clave para este proyecto y, si se desea, asignarle un límite mensual de créditos.
3. Revisar el acceso a API y los créditos en la cuenta. La creación de modelos y el rigging consumen créditos y pueden requerir un plan de pago; el juego no compra planes ni créditos automáticamente.
4. Copiar `.env.example` a `.env.local` si ese archivo aún no existe. Completar **localmente**:

```dotenv
MESHY_API_KEY=tu_clave_de_meshy
BLENDER_PATH=
```

5. Validar la conexión con:

```powershell
npm run art -- balance
```

Esta consulta de saldo es gratuita según la [documentación oficial](https://docs.meshy.ai/en/api/balance). `doctor` sólo comprueba presencia de la clave; `balance` comprueba la autenticación real.

La clave se lee únicamente desde Node para herramientas de desarrollo. No usar prefijo `VITE_`, no ponerla en `src/`, `public/`, el chat ni Git. `.env.local` está ignorado; `.env.example` tiene campos vacíos. El navegador no llama a Meshy ni recibe credenciales.

## 3. Generar y descargar un personaje

Preparar una imagen PNG/JPG/WebP de hasta 20 MB: un solo personaje completo, pose A, brazos separados del torso, pies visibles, fondo simple y materiales legibles. La calidad de esta referencia se revisa antes de gastar créditos.

```powershell
# Ver parámetros sin conexión ni gasto:
npm run art -- plan "C:/ruta/referencia.png"

# Envía la referencia a Meshy y crea UNA tarea que consume créditos:
npm run art -- generate iron-man-v1 "C:/ruta/referencia.png"

# Consultar el avance (no crea otra tarea):
npm run art -- status iron-man-v1

# Cuando figure SUCCEEDED, descargar el GLB:
npm run art -- download iron-man-v1
npm run art -- inspect artifacts/3d/iron-man-v1/model.glb
```

El contrato inicial pide Meshy 7.1, material PBR, pose A y un objetivo de 3.000 triángulos. Es un objetivo de generación, no una garantía: verificar el resultado real. No se usa el modo `lowpoly` obsoleto. La imagen se envía como datos, sin publicarla en un servidor propio.

Cada nombre queda reservado en `artifacts/3d/<nombre>/job.json` antes de enviar la solicitud. No hay reintentos automáticos de creación. Si se corta la conexión, el estado queda `UNKNOWN`: revisar el panel de Meshy para evitar crear dos compras. Si la tarea existe, recuperar su ID:

```powershell
npm run art -- adopt iron-man-v1 image-to-3d ID_EXISTENTE
npm run art -- status iron-man-v1
```

`adopt` sólo registra un ID, no crea tareas. Si un nombre ya tiene un ID, usar otro nombre. Las descargas se pueden reanudar: se validan y conservan los GLB ya descargados. Los modelos se guardan antes de que caduquen los enlaces del proveedor. No se imprimen claves, respuestas de error completas ni enlaces firmados.

## 4. Esqueleto y animaciones

Después de revisar el modelo texturizado y su pose:

```powershell
npm run art -- rig iron-man-rig-v1 ID_TAREA_MODELO
npm run art -- status iron-man-rig-v1
npm run art -- download iron-man-rig-v1
```

El rigging consume créditos. Se descarga `model.glb` y, cuando Meshy los devuelve, `walk.glb` y `run.glb`. El conector no promete animaciones de ataque: reposo, apuntado, disparo y habilidades deben producirse o ajustarse para cada personaje. Revisar manos, deformaciones, pies, orientación +Z y transiciones en Blender y en el visor. La animación de ataque deberá respetar el momento de daño de la simulación original.

## 5. Revisión e incorporación

Abrir el [Estudio de modelos](http://127.0.0.1:5173/art-studio.html) y elegir el GLB descargado. Los recursos deben estar embebidos; el visor rechaza referencias a archivos externos. El límite de carga/descarga del flujo es 100 MB.

La guía inicial del proyecto pide héroes de 1.500–3.000 triángulos y hasta 30 huesos. Revisar silueta desde la cámara de combate y de cerca, rostro/casco, manos, armadura, resolución de texturas, cantidad de materiales y coste de renderizado. Un contador dentro del presupuesto no demuestra calidad visual ni buen rendimiento.

El material de nodos `Shader to RGB` del generador chibi antiguo está pensado para EEVEE y no se traslada directamente a glTF. Para estos intercambios se usa material PBR compatible; el aspecto toon final puede implementarse en el renderizador del juego.

Los archivos `.blend` editables y variantes se conservan durante la autoría. Sólo los GLB seleccionados y sus metadatos pasarán a `public/models/`; todavía falta conectar ese catálogo al render de batalla. No sustituir las reglas de combate ni modificar `src/legacy/` al cambiar modelos.

## Fuentes y pruebas

- [Meshy: autenticación](https://docs.meshy.ai/en/api/authentication), [imagen a 3D](https://docs.meshy.ai/en/api/image-to-3d), [rigging](https://docs.meshy.ai/en/api/rigging).
- `npm run check`: contratos simulados de API, aislamiento de credenciales, validación GLB y pruebas del juego.
- `npm run test:browser`: juego completo y visor con el GLB exportado por Blender, carga errónea, controles y pantalla móvil.

Una prueba con respuestas simuladas no valida saldo, acceso ni resultados de una cuenta real. Esas comprobaciones quedan pendientes hasta configurar `MESHY_API_KEY`.
