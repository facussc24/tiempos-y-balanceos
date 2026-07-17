# Verificar antes de cerrar una tarea

Antes de decir "listo" / "hecho" / "terminado" en una tarea de implementacion:

1. **Build/typecheck pasan:** correr `npm run build`. Si rompe, arreglar antes de cerrar.
2. **No metiste cambios fuera de scope:** `git diff --stat` y confirmar que solo cambiaron archivos relevantes.
3. **Si la tarea es visual (PDF export, UI):** testear local con preview/browser ANTES del push. Evitar que Fak descubra el bug en produccion.
4. **Si la tarea toca Supabase/datos:** releer el modelo/schema real — NO inventar nombres de tablas/columnas.
5. **Si el entregable es un archivo (xlsx/pdf/pptx):** abrirlo y mirarlo antes de entregar (leccion 2026-07-15, "gravisimo").

**Why:** Fak reporto varias veces el "trust-then-verify gap" — codigo/entregables que parecen OK pero fallan en produccion.

**How to apply:** antes de la respuesta final que cierra la tarea, correr explicitamente el paso 1. Si algo falla, arreglarlo — no pasarselo a Fak para que pruebe. La regla `git-deploy.md` cubre el push; esta cubre la verificacion previa.
