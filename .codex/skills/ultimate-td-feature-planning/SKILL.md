---
name: ultimate-td-feature-planning
description: Planificar funcionalidades o migraciones de Ultimate Marvel TD 3D con contratos y tareas por archivo para JavaScript, Three.js y Vite. Usar cuando se solicite un plan de implementación para este juego.
---

# Planificación de funcionalidades

Adaptada de `feature-planning` del archivo `skills.7z` aportado por el usuario.
Las rutas siguientes son relativas a la raíz del repositorio del juego.

Leer `AGENTS.md`, `docs/MIGRACION_2D.md`, `docs/ROADMAP.md` y el código pertinente. Consultar planes previos sólo si están relacionados. Durante una solicitud de planificación, no implementar el juego salvo que el usuario también lo solicite.

Priorizar migrar todo lo aprovechable del 2D conservando reglas y contenido antes de ampliar sistemas propios del 3D. Distinguir contenido copiado, reglas verificadas y funciones jugables. Mantener el HUB en tercera persona como entrada; Manhattan es una actividad del HUB. Traits y grades requieren las reglas del usuario: no dar por aprobadas pasivas aleatorias, rangos C–S o rerolls.

Cuestionar contradicciones concretas con evidencia y proponer alternativas cuando aporten una mejora relevante. Resolver por inspección lo que el código ya conteste; preguntar por decisiones de diseño pendientes que afecten el plan. No convertir la planificación en una entrevista obligatoria sobre detalles rutinarios.

Si se solicita un documento y no se indica ubicación, guardarlo en `plan/<nombre-descriptivo>.md`, sin sobrescribir planes ajenos. Usar esta estructura proporcional al alcance:

1. **Objetivo y aceptación:** comportamiento observable, origen de las reglas y límites de la entrega.
2. **Contratos y datos:** módulos ES, exports, entradas/salidas, eventos, estado y persistencia. Referenciar las fórmulas originales y sus archivos; no inventar curvas de balance sustitutas. Aclarar conversiones entre coordenadas lógicas y visuales.
3. **Tareas por archivo:** funciones, responsabilidades, dependencias y orden de integración. Usar rutas verificadas. Separar `src/game/`, módulos de datos, `src/render/` y `src/ui/`; adaptar fuera de `src/legacy/` sin modificar el snapshot. Incluir fragmentos breves sólo para contratos delicados, no implementaciones completas.
4. **Presentación y recursos, si aplica:** controles, teclado, estados vacíos/de error y fallbacks. Para arte, seguir `docs/ARTE_3D.md`, Blender Store por su alias y el visor existente. Distinguir referencia, modelo terminado e integración jugable. Mantener secretos en `.env.local`, fuera del frontend y Git.
5. **Validación:** pruebas significativas para lógica o paridad modificada, `npm run check` al entregar y `npm run test:browser` para renderizado/interacción. Definir qué demuestra cada comprobación y qué queda pendiente.

Anotar dependencias e independencia real entre tareas si ayuda a implementarlas; el plan no autoriza ni exige subagentes. Los ajustes de escena se realizan en los módulos y recursos del proyecto, sin imponer trabajo manual en un editor de otro motor.
