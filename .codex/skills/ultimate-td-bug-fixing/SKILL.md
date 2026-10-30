---
name: ultimate-td-bug-fixing
description: Corregir errores en Ultimate Marvel TD 3D con diagnóstico de causa raíz, cambios acotados y verificación de las reglas originales del 2D. Aplicar a este juego, construido con JavaScript, Three.js y Vite.
---

# Corrección de errores

Adaptada de `bug-fixing` del archivo `skills.7z` aportado por el usuario.
Las rutas siguientes son relativas a la raíz del repositorio del juego.

1. Leer `AGENTS.md` y los módulos afectados. Consultar `docs/MIGRACION_2D.md` para distinguir comportamiento original, integración actual y pendientes. Aceptar una descripción informal; investigar primero y preguntar sólo si falta información que cambie la corrección.
2. Reproducir el fallo cuando sea viable y seguir llamadas, eventos y estado hasta una causa comprobable. Separar evidencia de hipótesis. Revisar `src/game/` para simulación/progresión, `src/render/` para presentación, `src/ui/` y `src/main.js` para interacción; confirmar los archivos actuales antes de editar.
3. Aplicar el cambio mínimo que resuelva la causa. Si hay varias causas, resolverlas por etapas coherentes dentro del alcance autorizado, sin pedir confirmación por cada archivo. Consultar si resolverlas exige una decisión de producto nueva. Evitar refactors ajenos al fallo.
4. Editar los JavaScript, CSS, HTML, datos o configuración realmente necesarios. Mantener simulación independiente de Three.js y del DOM y definiciones en módulos de datos. `src/legacy/` es un snapshot inmutable: implementar adaptadores fuera de él, conservando reglas, IDs y fórmulas. No cambiar expectativas de pruebas originales para ocultar divergencias.
5. Mantener mensajes en español, controles de teclado y errores visibles. Para recursos visuales opcionales, conservar un fallback y aviso visible siguiendo el patrón existente; no ocultar fallos de guardado o de combate detrás de advertencias genéricas. Leer `docs/ARTE_3D.md` cuando el fallo afecte GLB o herramientas de arte.
6. Añadir o ajustar una prueba de regresión si verifica un fallo de lógica relevante. Ejecutar `npm run check` antes de entregar; ejecutar también `npm run test:browser` si cambian renderizado o interacción. Registrar fallos y limitaciones reales, sin sustituir ejecución por lectura.

Entregar causa, cambio y resultado de verificación de forma breve. Respetar cambios ajenos y la autorización de commit/push de `AGENTS.md`, verificando el remoto antes de publicar. No incorporar logs, capturas temporales, `dist`, `node_modules` ni credenciales.
