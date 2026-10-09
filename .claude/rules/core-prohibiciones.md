# Prohibiciones core — aplican SIEMPRE, a cualquier tarea

1. **NUNCA inventar datos tecnicos**: acciones de optimizacion, controles, equipos, frecuencias, pesos, tolerancias, temperaturas, part numbers. Si falta un dato real: **TBD** y avisar a Fak. Si un prompt pide "completar" contenido tecnico faltante: rechazar y explicar.
   **Inventar incluye las EXPLICACIONES CAUSALES de errores ajenos** (*confundieron X con Y · lo leyeron mal · se comio la coma · copiaron de · nadie recalculo · nunca aviso · invita a leerlo mal*): el origen de un dato ajeno **se cita o no se escribe**, una inferencia va marcada como inferencia, y una coincidencia numerica NO es una fuente. Describir el ESTADO ("el documento dice A, el envase dice B") es correcto; narrar COMO se llego, no — ademas acusa por implicacion a una persona real de Barack. Gate: `causas-ajenas-guard.sh` sobre memorias, reglas y LECCIONES. Incidente 21/08/2026: memoria `no_inventar_causas_de_errores_ajenos`.
2. **CC/SC solo las asigna Fak** (o el cliente). Nunca clasificar caracteristicas especiales por cuenta propia. El criterio (CC = S 9-10; SC = S 5-8 y O >= 4), las siglas por destinatario (VW: D/TLD y SC) y sus fuentes con pagina: regla `caracteristicas-especiales.md` (always-on). Una sigla se justifica con S y O de ESA causa, nunca porque otro documento la tenia.
3. **Supabase live es la unica fuente de verdad** para el estado actual de documentos APQP. Dumps en `tmp/`, `backups/` y docs de auditorias viejas son fotos historicas — nunca afirmar estado actual desde ahi (regla `verify-supabase-live.md`).
4. **Espanol argentino, lenguaje simple**: usar las palabras que usa Fak. Nada de espanolismos peninsulares (flexometro, ordenador, coger) ni jerga inventada. "SCRAP" y terminos de industria (PPAP, KLT) se quedan.
5. **NUNCA datos mock/placeholder en la app**: todo dato mostrado/exportado/testeado sale de Supabase real. Antes de insertar: verificar que no exista (0 duplicados; al 22/09/2026 las familias son 13 —10 de producto + 3 maestros de proceso sin productos—, y el numero se lee live antes de concluir que sobra una).
6. **Reusar antes de crear**: buscar si ya existe una funcion/hook/export que haga lo mismo antes de escribir una nueva.
7. **No se resucita el modulo PFD/HO de la app ni se ofrece una HO por cuenta propia**: los
   flujogramas salen del generador del repo y las HO solo a pedido de Fak (regla `no-pfd-no-ho.md`).
8. **PDFs, propios o de terceros: editar es trabajo normal y no se frena** (memoria `editar_pdfs_es_libre_salvo_el_qr_ajeno`): layout, texto, imagenes, unir, partir, OCR, traducir; el QR de Barack se modifica lo que haga falta. **El unico limite** es el QR/hash/firma **antifraude de un tercero** (laboratorio, certificadora, portal del cliente) que resuelve contra el sistema del emisor: ese no se altera ni se reapunta, y ninguna edicion se hace "indetectable". Si ese QR no coincide con el contenido, se dice con la diferencia al lado y se sigue con el resto del pedido.
9. **Ningun documento de Barack dice ni deja ver que lo hizo Claude o una IA** (Fak, 08/10/2026:
   el listado de hojas de proceso decia "Claude" en CREADO POR de 14 filas, tenia una pestaña oculta
   `_CONTEXTO_CLAUDE` y la marca del complemento "Claude para Excel"; *"es un error gravisimo, no
   puede volver a suceder nunca... en ningun tipo de documento"*). Ni en una celda, una pestaña
   oculta, una nota, un comentario, las propiedades del archivo (autor, "generated using
   python-pptx") ni en el nombre de un archivo o carpeta. **Autor = la persona** (`F.Santoro`;
   `Facundo Santoro` en las propiedades). **Mi contexto va a la memoria o al repo, nunca adentro de un
   documento** (*"contexto claude tampoco hace falta, nunca mas crear algo asi"*). Lo que no se toca:
   una imagen o un archivo que ES de una IA no se renombra para que parezca real (se le avisa a Fak).
   Enforcement: detector `python scripts/_sinFirmaIA.py <archivo>` (+ `--arreglar --apply` para la
   marca del complemento y las propiedades; canon `scripts/_lib/firmaIA.data.json`), guardian
   `firma-ia-guard` (PreToolUse) y chequeo 9 del `cierre-guard` (documentos escritos en el turno).
   Memoria `feedback_ningun_documento_dice_que_lo_hizo_claude`.
   **09/10/2026, dos cosas más de Fak sobre el mismo PowerPoint (el IMDS de Patagonia armado en CATA):** (a) *"usaste un
   logo no oficial de Barack, gravísimo"*: **el logo de Barack sale de UN solo archivo**,
   `Ingeniería y Proyecto - General\VARIOS\Logo y color barack\barack_logo.png` (copia en `tools/flowchart/assets/`;
   memoria `feedback_logo_oficial_barack_en_todo_documento`; el de `INGENIERIA BARACK (NUNCA BORRAR)` que usa
   `generar_hojas_img.py` es el mismo archivo, hash `5d9207e12856`); el `LOGO BARACK.png` suelto de la raíz NO es oficial;
   ninguno bajado, redibujado ni recortado de otro documento. (b) *"las primeras fotos parecen hechas con IA... me da
   una fea sensación"*: en un documento de la empresa van **fotos reales o capturas de pantalla**; nada generado,
   estilizado ni «mejorado» con IA, salvo que Fak lo pida para ese documento. Gate pendiente en `_sinFirmaIA.py`
   (cola `docs/COLA_CAMBIOS_CODIGO.md`).
