---
name: ultimate-td-version-release
description: Preparar changelog y cerrar versiones de Ultimate Marvel TD 3D usando package.json, historial Git y pruebas del proyecto. Crear tags sólo cuando el usuario solicite cerrar o etiquetar una versión; una petición de changelog por sí sola no autoriza un release.
---

# Cierre de versión

Adaptada de `version-release` del archivo `skills.7z` aportado por el usuario.
Ejecutar desde la raíz del repositorio. Leer `AGENTS.md` y `package.json`.

## Preparación

- Verificar rama, estado de trabajo y remotos. No exigir que la rama tenga nombre de versión ni asumir hooks del repositorio de origen. Si HEAD está desconectado, resolver la rama de destino antes de publicar.
- No incluir cambios ajenos ni descartarlos. Identificar cambios propios pendientes; completar su revisión antes del cierre. Si el estado impide saber qué se publica, explicar el bloqueo concreto.
- Usar la versión explícita del usuario. Si no la dio, revisar `package.json`, tags e historial: usar la versión del paquete cuando corresponda claramente a la entrega todavía no etiquetada; preguntar si hay ambigüedad o hace falta decidir un nuevo número. No deducir versiones de nombres arbitrarios de rama.
- Comprobar que `vX.Y.Z` no existe localmente ni en el remoto de destino. No mover ni reemplazar tags existentes. Si no se puede consultar el remoto, informar que falta esa verificación antes de publicar el tag.

## Contenido y verificación

1. Obtener el último tag de versión alcanzable y revisar los commits desde él con `git log --no-merges`. Si no hay tag previo, usar el historial disponible. Confirmar que no se está usando como base un tag ajeno a versiones. Si no hay cambios nuevos, informar y no crear un cierre vacío.
2. Leer asuntos y estadísticas; abrir diffs cuando sean necesarios para describir lo entregado. Redactar viñetas en español agrupando cambios relacionados. Distinguir datos copiados, reglas verificadas y funcionalidades jugables; no anunciar pendientes de `docs/MIGRACION_2D.md` como terminados.
3. Leer `CHANGELOG.md` si existe para respetar formato y evitar versiones duplicadas. Crear el archivo si falta. Agregar la entrada sin alterar versiones anteriores, con encabezado `## vX.Y.Z — AAAA-MM-DD` y fecha local del usuario (America/Buenos_Aires). Una solicitud de sólo changelog termina en ese alcance.
4. Para un cierre, mantener `package.json` y `package-lock.json` coherentes con la versión elegida; no actualizar dependencias incidentalmente. Ejecutar `npm run check`; ejecutar `npm run test:browser` si la entrega incluye renderizado o interacción y no hay una ejecución válida que cubra el estado a publicar. No etiquetar una entrega con comprobaciones requeridas fallidas.

## Commit, tag y publicación

- Revisar el diff y stagear sólo archivos de la entrega. Crear el commit con un mensaje claro, sin asumir prefijos automáticos. Crear el tag `vX.Y.Z` una vez verificadas las precondiciones; seguir la convención existente, o usar tag liviano si no hay ninguna.
- `AGENTS.md` conserva autorización de commit y push de cambios terminados. Verificar que el remoto corresponde a `https://github.com/aaloiamircovich/UltimateMarvelTD_3D` antes del push de la rama. Publicar únicamente el tag de esta versión cuando el usuario haya solicitado su publicación; la autorización general de commits no implica publicar todos los tags ni crear un GitHub Release.
- No usar force push, reemplazar tags, hacer merges ni crear releases externos por efecto de esta skill. Si falla una publicación, conservar commit/tag locales e informar exactamente qué quedó pendiente.
- Verificar el resultado y entregar versión, cambios destacados, comprobaciones y estado local/remoto. No afirmar que se publicó lo que sólo está preparado localmente.
