---
name: ultimate-td-grill-me
description: Entrevistar al usuario para resolver decisiones de diseño de Ultimate Marvel TD 3D cuando pida una entrevista, grill-me o que se cuestione su plan. Útil para definir reglas todavía abiertas, como traits y grades.
---

# Entrevista de diseño

Adaptada de `grill-me` del archivo `skills.7z` aportado por el usuario.

Aplicar cuando la solicitud realmente pida una entrevista. Leer `AGENTS.md`, `docs/MIGRACION_2D.md`, `docs/ROADMAP.md` y el código relacionado desde la raíz del juego antes de preguntar por información disponible allí.

- Recorrer las decisiones de mayor impacto primero y resolver sus dependencias una por una. Hacer una pregunta por vez, con una recomendación razonada y alternativas claras cuando corresponda.
- Usar `request_user_input_async` si está disponible; en caso contrario, preguntar directamente. Esperar una respuesta para decisiones necesarias y avanzar sólo en investigación independiente mientras tanto. No asumir que el silencio acepta una propuesta.
- Diferenciar reglas originales verificadas, preferencias confirmadas y propuestas nuevas. Conservar la prioridad de migración del 2D y la arquitectura JavaScript/Three.js/Vite. No reabrir elecciones ya confirmadas sin una contradicción concreta.
- Para traits y grades, permitir que el usuario describa sus reglas. No presentar pasivas aleatorias, grades C–S ni rerolls como decisiones tomadas. Una recomendación sigue siendo una propuesta hasta que el usuario la acepte.
- Detener la entrevista cuando las decisiones necesarias para el alcance estén resueltas o el usuario pida avanzar. No exigir agotar ramas irrelevantes.

Cerrar con acuerdos, preguntas pendientes y criterios de aceptación en español. Si se pide un plan escrito, organizarlo por contratos, archivos, dependencias y validación; no implementar funcionalidades como efecto automático de la entrevista.
