# Guia de Referencia: Hoja de Operaciones (HO)

> **Proposito**: Este documento es la referencia obligatoria que Claude Code debe leer ANTES de editar,
> generar o auditar cualquier Hoja de Operaciones del proyecto Barack Mercosul.
> Todas las reglas provienen del analisis de HOs reales de la planta (tapiceria automotriz VWA/PWA).

---

## 1. Principio Fundamental

La Hoja de Operaciones es el documento que el operador tiene en su puesto de trabajo.
Debe decirle **como hacer el trabajo**, paso a paso, con sus propias palabras.

- La HO **NO es una copia del AMFE** — el AMFE analiza riesgos, la HO instruye al operador
- La HO **SI consume datos del Plan de Control** — los controles de calidad deben coincidir exactamente
- La HO tiene **descripcion propia** para cada paso — redactada como instruccion directa

---

## 2. Descripcion de Pasos

### Como redactar

Usar verbos imperativos en segunda persona. El operador lee la HO y sabe que hacer.

| Correcto | Incorrecto |
|---|---|
| "Verificar la documentacion del proveedor: remito, certificado de calidad" | "Recepcion de materia prima" (generico) |
| "Posicionar el material sobre la mesa de corte, alineando con las marcas" | "Cortar material" (sin detalle) |
| "Retirar las piezas cortadas. Verificar dimensiones contra plano" | "Control dimensional" (eso es del CP) |
| "Tomar la pieza y posicionarla sobre la mesa de trabajo" | "Realizar costura" (stub del generador) |

### Consistencia verbal

Los originales de la empresa mezclan infinitivo formal ("Verificar") con voseo rioplatense ("Presiona", "Dirigite"). Para la app, usar siempre **infinitivo instruccional** ("Verificar", "Posicionar") que es neutro y profesional.

### Verbos recomendados

Usar verbos que describan la accion fisica:

- **Verificar** — documentacion, dimensiones, estado
- **Posicionar** — material en mesa, pieza en molde
- **Tomar** — pieza, herramienta, muestra
- **Ejecutar** — programa CNC, ciclo de maquina
- **Retirar** — pieza del molde, material cortado
- **Inspeccionar** — visualmente, con calibre
- **Registrar** — en planilla, en sistema
- **Almacenar** — en zona WIP, en rack designado
- **Apilar** — piezas en contenedor
- **Seleccionar** — plantilla, programa, material

### Nivel de detalle

Cada paso debe responder: **que hace el operador fisicamente**

| Muy generico (mal) | Nivel correcto | Demasiado detalle (innecesario) |
|---|---|---|
| "Cortar" | "Ejecutar el programa de corte. Monitorear visualmente el proceso durante el ciclo completo." | "Presionar el boton verde de la maquina modelo XYZ serial 12345..." |
| "Coser" | "Verificar el estado de la cuchilla de refilado. Reemplazar si presenta desgaste o melladura." | "Tomar la llave allen de 4mm del cajon izquierdo..." |

### Cantidad de pasos por operacion

- **Minimo**: 3 pasos (regla de validacion en la app)
- **Tipico**: 4-7 pasos
- **Maximo recomendado**: 10 pasos (si son mas, considerar dividir en sub-operaciones)

---

## 3. Puntos Clave

Un punto clave es un paso donde hay riesgo real de calidad o seguridad.
No todos los pasos son puntos clave — marcar solo los que importan.

### Cuando marcar como punto clave

- El paso puede causar un defecto que el cliente ve
- El paso tiene un riesgo de seguridad para el operador
- El paso requiere una verificacion critica (ej: primera pieza)
- El paso afecta la trazabilidad del producto

### Razon del punto clave

Siempre incluir **por que** es un punto clave. El operador necesita entender la importancia.

| Paso | Razon |
|---|---|
| "Verificar certificados de calidad y lote del proveedor" | "Trazabilidad obligatoria" |
| "Inspeccionar embalaje: rechazar si presenta danos, humedad o contaminacion" | "Primera barrera de deteccion de danos" |
| "Almacenar respetando FIFO y condiciones de temperatura" | "Riesgo de mezclar lotes no conformes" |

### Distribucion tipica

- 40-60% de los pasos son puntos clave en operaciones criticas (recepcion, inspeccion)
- 20-40% en operaciones de produccion (corte, costura, inyeccion)
- No marcar TODOS los pasos como punto clave — pierde sentido

---

## 4. Ciclo de Control (Verificaciones de Calidad)

### Regla de oro

Los controles de la HO **DEBEN coincidir exactamente** con el Plan de Control.
No se inventan controles en la HO — se copian del CP.

| Campo HO | Campo CP origen |
|---|---|
| Caracteristica | productCharacteristic o processCharacteristic |
| Especificacion | specification |
| Metodo de control | controlMethod |
| Responsable | reactionPlanOwner |
| Frecuencia | sampleFrequency |
| CC/SC | specialCharClass |

### Si el CP dice...

| CP dice | La HO dice exactamente lo mismo |
|---|---|
| "Calibre pasa/no pasa, inicio y fin de turno" | "Calibre pasa/no pasa, inicio y fin de turno" |
| "Visual 100%" | "Visual 100%" |
| "Certificado del proveedor, por entrega" | "Certificado del proveedor, por entrega" |

### Si la HO tiene un control que el CP no tiene

Es un error. El control debe estar primero en el CP y luego se hereda a la HO.

### Si la HO le falta un control que el CP si tiene

Es un error de vinculacion. Regenerar la HO desde el CP o agregar manualmente.

---

## 5. EPP (Elementos de Proteccion Personal) por Tipo de Operacion

| Operacion | EPP tipicos |
|---|---|
| Recepcion | Anteojos, zapatos |
| Corte (mesa/CNC) | Anteojos, guantes, proteccion auditiva |
| Costura | Anteojos, zapatos |
| Inyeccion PU | Anteojos, guantes, delantal, proteccion auditiva, respirador |
| Adhesivado | Respirador, guantes, anteojos |
| Troquelado | Anteojos, guantes, proteccion auditiva |
| Tapizado | Anteojos, zapatos |
| Inspeccion final | Anteojos, zapatos |
| Embalaje | Anteojos, zapatos |

### Reglas

- En **inyeccion** se usan casi TODOS los EPP porque hay calor, ruido, gases
- En **adhesivado** siempre respirador porque hay vapores toxicos (Fenoclor, Primer)
- En procesos con maquinas ruidosas siempre proteccion auditiva
- Los zapatos de seguridad son obligatorios en toda la planta

### Catalogo disponible en la app

| ID | Etiqueta | Icono |
|---|---|---|
| anteojos | Anteojos de seguridad | anteojos.png |
| guantes | Guantes | guantes.png |
| zapatos | Zapatos de seguridad | zapatos.jpg |
| proteccionAuditiva | Proteccion auditiva | proteccionAuditiva.png |
| delantal | Ropa de proteccion | delantal.png |
| respirador | Respirador | respirador.jpg |

---

## 6. Ayudas Visuales

### Regla

Toda operacion que tenga un riesgo de calidad deberia tener una imagen o foto que muestre como se hace correctamente.

### Tipos de ayudas visuales

| Tipo | Uso |
|---|---|
| Foto del producto conforme | Referencia visual de como debe quedar |
| Foto del defecto | Muestra lo que NO debe pasar |
| Diagrama de posicionamiento | Como colocar la pieza en el molde/mesa |
| Foto de la maquina/puesto | Identificar controles y ajustes |
| Patron de aspecto (Mylar) | Referencia para control dimensional |

### Formato

- Preferir JPG o PNG
- Se almacenan como base64 en el documento HO (campo `visualAids`)
- La app soporta hasta 6 imagenes por hoja en el PDF
- Si no hay imagen disponible, dejar la seccion vacia (no poner "TBD")

### Imagenes disponibles en los originales

La carpeta `Documents/AMFES PC HO/VWA/INSERT/imagenes para HO/` tiene fotos organizadas por operacion:
- Subcarpeta `OP30` — fotos de almacenamiento WIP
- Subcarpeta `40` — fotos de refilado
- Subcarpeta `50` — fotos de costura
- Subcarpeta `60` — fotos de troquelado

Estas imagenes se pueden cargar en la app via el panel "Agregar imagen" de cada hoja.

---

## 7. Agrupacion de Operaciones

### Cuando agrupar

Operaciones que se hacen en la misma maquina, mesa o puesto se pueden agrupar en una sola HO si:
- El operador es el mismo
- La secuencia es continua (no hay transporte entre ellas)
- Los EPP son los mismos

### Ejemplo: Mesa de corte

Las operaciones de preparacion de corte + corte + control con mylar se pueden agrupar en una sola HO de "CORTE" si se hacen en la misma mesa y por el mismo operador.

### Cuando NO agrupar

- Si las operaciones tienen EPP diferentes (ej: corte vs inyeccion)
- Si hay un transporte o almacenamiento WIP entre ellas
- Si los operadores son distintos

---

## 8. Piezas Aplicables

Listar todas las variantes del producto que usan esta hoja de operaciones.
Ejemplo: Insert Patagonia tiene 16 variantes (N 227, N 392, N 389... N 403).

- Se muestran en horizontal en el PDF (separadas por " · ")
- Si son muchas, la app las trunca automaticamente

---

## 9. Idioma

- TODO en espanol
- CERO textos en ingles entre parentesis
- Excepciones: codigos de producto, nombres de maquina, marcas comerciales

---

## 10. Ejemplos Reales (formato correcto)

### Ejemplo 1: Recepcion de Materia Prima (Insert Patagonia)

| Campo | Valor |
|---|---|
| N de Operacion | 10 |
| Denominacion | RECEPCION DE MATERIA PRIMA |
| Modelo | PATAGONIA |

**Pasos:**
1. Verificar la documentacion del proveedor: remito, certificado de calidad y orden de compra correspondiente.
2. Inspeccionar visualmente el estado del embalaje de cada material. Rechazar si presenta danos, humedad o contaminacion.
3. Controlar la identificacion de cada material recibido (codigo, lote, fecha de vencimiento si aplica) vs. la orden de compra.
4. Verificar las cantidades recibidas vs. las cantidades indicadas en el remito y la orden de compra.
5. Almacenar los materiales aprobados en el sector designado, respetando las condiciones de almacenamiento y FIFO.
6. Identificar los materiales con la etiqueta de estado de inspeccion (Aprobado / Rechazado / En espera).
7. Registrar el ingreso en el sistema y archivar la documentacion respaldatoria.

**EPP:** Anteojos, zapatos

### Ejemplo 2: Corte CNC (Insert Patagonia)

| Campo | Valor |
|---|---|
| N de Operacion | 15 |
| Denominacion | CORTE DE COMPONENTES - Preparacion de corte |
| Modelo | PATAGONIA |

**Pasos:**
1. Verificar que el programa de corte CNC cargado corresponda al modelo y variante de la orden de produccion.
2. Posicionar el material sobre la mesa de corte, alineando con las marcas de referencia. Activar el sistema de aspiracion.
3. Ejecutar el programa de corte. Monitorear visualmente el proceso durante el ciclo completo.
4. Retirar las piezas cortadas. Verificar dimensiones de las primeras piezas contra plano o plantilla de control.
5. Inspeccionar visualmente cada pieza cortada: verificar ausencia de danos, rebabas y cortes incompletos.
6. Apilar piezas conformes en contenedor identificado con el codigo de producto y numero de lote.

**EPP:** Anteojos, guantes, proteccion auditiva

### Ejemplo 3: Control con Mylar

| Campo | Valor |
|---|---|
| N de Operacion | 25 |
| Denominacion | CORTE DE COMPONENTES - Control con mylar |
| Modelo | PATAGONIA |

**Pasos:**
1. Seleccionar la plantilla mylar correspondiente al modelo y variante segun la orden de produccion.
2. Tomar una muestra representativa del lote de piezas cortadas segun la frecuencia de muestreo definida.
3. Superponer la pieza sobre la plantilla mylar. Verificar que los bordes y contornos coincidan dentro de la tolerancia.
4. Registrar el resultado del control en la planilla de inspeccion. Si la pieza es NO CONFORME, segregar y notificar.

**EPP:** Anteojos, zapatos

---

## 11. Campos del Modelo de Datos (referencia rapida)

Los campos de `HojaOperacion` en `hojaOperacionesTypes.ts`:

| Campo codigo | Seccion HO | Notas |
|---|---|---|
| operationNumber | N de Operacion | Del AMFE |
| operationName | Denominacion | Del AMFE (MAYUSCULAS) |
| steps[] | Descripcion de la Operacion | Manual, NO del AMFE |
| qualityChecks[] | Ciclo de Control | Del Plan de Control |
| safetyElements[] | Elementos de Seguridad | PPE seleccionados |
| visualAids[] | Ayudas Visuales | Imagenes base64 |
| reactionPlanText | Plan de Reaccion | Texto de reaccion ante NC |
| reactionContact | Contacto | Lider/Supervisor |

---

## Checklist Rapido para Revision de HO

Antes de dar por terminada una HO, verificar:

- [ ] Los pasos describen lo que el operador hace fisicamente (no copian del AMFE)
- [ ] Cada paso usa verbo imperativo (Verificar, Tomar, Posicionar...)
- [ ] Minimo 3 pasos por hoja
- [ ] Los puntos clave tienen razon explicada
- [ ] Controles de calidad coinciden EXACTAMENTE con el Plan de Control
- [ ] EPP asignados corresponden al tipo de operacion
- [ ] Todo el texto esta en espanol
- [ ] Piezas aplicables listadas si hay variantes
