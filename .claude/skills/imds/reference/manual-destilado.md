# IMDS — manual oficial destilado, regla por regla con su pagina

Leido el 21/09/2026 de los manuales que tiene Barack en
`C:\Users\FacundoS-PC\BARACK ARGENTINA SRL\Ingeniería y Proyecto - General\INGENIERIA BARACK (NUNCA BORRAR)\4- MANUALES\IMDS\`:

| Archivo | Que es | Como se cita aca |
|---|---|---|
| `imds_usermanual_15.0_en.pdf` | Manual oficial de usuario, 258 pag., rev. 1.32 del 05/07/2025 | **(pag. N)** |
| `IMDS Create MDS tips_Material.pdf` | Instructivo de materiales, 75 slides, Release 13.0 | **(tips Material, pag. N)** |
| `IMDS Create MDS tips_Component.pdf` | Instructivo de componentes, 64 slides, Release 13.0 | **(tips Component, pag. N)** |
| `imds_efficiency_and_effectiveness_v_1_2.pdf` | Cuestionario de auditoria de proceso, 2007 | — casi nada util para cargar |

> **Todo lo que esta aca sale de esos PDFs.** Lo que no esta en ellos figura al final, en
> *"Lo que no esta en los manuales"* — y no se completa de memoria ni de internet.

---

## 1. Norms / Standards en un MDS de material

### Que es

*"Norms and standards refer to public norms in which material compositions are defined"*
(tips Material, pag. 37).

Ubicacion: **Ingredients → Material Information**, debajo de Std. Mat.-No., Symbol,
Classification, SCIP Material Category y Additional Material Characteristics (pag. 50 y 54).

### Estructura: tres columnas

| Columna | Tipo | Detalle |
|---|---|---|
| **Company** | desplegable | `public norms` o una empresa OEM (norma interna) |
| **Norm** | **desplegable cerrado** | lista predefinida del sistema |
| **Norm Code** | **texto libre, obligatorio** | *"After you select your norm, you return to the window where you can enter the specific code (mandatory)"* (pag. 55) |

Normas visibles en la captura del manual (pag. 55): `NS EN`, `NS EN ISO`, `PREN`, `QQ`,
`SAE`, `SAE AMS`, `SE`, `SEW`, `SIS`, `SS`, `SS EN`, `SS EN ISO`, `SS ENV`, `SS ISO`, `TLDB`,
`UIC`, `UNE`, `UNE-EN`, `UNE-EN ISO`, `UNI`, `UNI EN`, `UNI EN ISO`, `UNI ISO`, `UNS`, `VDA`,
`WL`, `WL2`, `WW`, `EN`.

### Paso a paso

1. Ingredients → bloque **Material Information** (pag. 50).
2. Fila **Norms / Standards**: iconos **`+`** (agregar), **`−`** (quitar), **lapiz** (editar).
3. `+` abre **Add Norm/Inhouse Norm** (pag. 55; tips Material, pag. 37-38).
4. **Company** → **Norm** (*"You need to select a Norm first"*) → **Norm Code**.
5. **Add**, despues **Save**. Se repite si hay mas de una (tips Material, pag. 41).

### Obligatoriedad — hay que separar tres cosas

1. **El manual NO declara el campo obligatorio para ninguna clasificacion.** Lo unico
   mandatory es el **Norm Code** una vez elegida la norma (pag. 55). La lista de campos
   obligatorios de un material (pag. 53) trae solo Name; *"The material classification is
   mandatory for material type datasheets"* (pag. 50).
2. **El instructivo pone la regla de criterio, en mayusculas**: *"NOT ALL MATERIALS ARE
   MANUFACTURED TO A NORM. IF MANUFACTURED TO A NORM, YOU MUST INCLUDE IT. IF THERE IS NO
   NORM, YOU CANNOT INCLUDE IT."* y *"For materials described in these norms an entry is
   mandatory"* (tips Material, pag. 37). Obligatorio **por el hecho**, no por clasificacion.
3. **Un solo check lo exige de verdad, y es de cliente — Toyota**: *"At least one standard or
   Toyota in-house norm must be selected for material MDSs (when sending to company 10674
   only)"* (pag. 239). Ademas hay un **WARNING** especifico que verifica si el Tier1 agrego
   la norma en el area recipient-specific (pag. 56).

### Normas internas de OEM: visibilidad limitada

*"Company norms are visible only for the company the norm belongs to and are not visible along
the supply chain"* (pag. 55). Solo las ven los usuarios de la empresa que creo el MDS y el OEM
dueño de la norma. Un proveedor que **copia** el MDS en vez de **referenciarlo** no se entera
de que el material se hizo a una norma de OEM (tips Material, pag. 38-39).

### Material ya released: la via recipient-specific

*"Under Recipient Data the originally selected norms for the Material MDS are listed. The
Tier1 supplier may overwrite the norms as recipient-specific data. These entries exist in
parallel to the original values which are part of the (referenced) Material MDS… For those
Material MDSs without norms assigned, norms can be added by the Tier1 supplier"* (pag. 55-56).

Se edita por pop-up; hay **reset** al valor original y **`Apply to all recipient OEMs`**. Con
mas de una norma de empresa, se listan separadas por coma en 'Norm/Norm Code' (pag. 56).

---

## 2. Estados y versionado

### Estados de VERSION (pag. 34)

| Estado | Se puede cambiar | Se puede usar en otro MDS | Se puede compartir |
|---|---|---|---|
| **editable** | si | no | normalmente no |
| **released** | **no** | si | si |
| **archived** | no (ver o copiar) | — | si (repuestos de modelos viejos) |

**Numeracion XX.YY** (pag. 34): XX = veces liberado, YY = ediciones desde la ultima.
`0.01` primer borrador · `1.0` primera liberada · `3.05` quinta edicion de la tercera.
**Decimal = editable; entero = no** (tips Material, pag. 65).

### No confundir con los estados de TRANSMISION

- **published** = accion de **visibilidad**: *"Published MDSs are accessible and completely
  visible to all IMDS users"* (pag. 90).
- **proposed / accepted / rejected** = estados del envio. Outbox: *not yet browsed, browsed,
  accepted, rejected, modified, cancelled by sender, in process at recipient* (pag. 109-110).
  Secuencia: **Not yet browsed → browsed → accepted o rejected** (pag. 82).

### Donde todavia se corrige sin versionar

- En **edit mode** (decimal): Ingredients y Supplier data (tips Material, pag. 65).
- **Excepcion handshake:** si mandaste con **Send**, queda en `.0x` y **no se puede editar**
  hasta que el cliente acepte o rechace (tips Component, pag. 54 y 56).
- Con **Propose** la version ya salto a entero: *"you can not make changes – though you can add
  more recipients"* (tips Component, pag. 56).
- **Lo unico editable en un MDS liberado son los datos recipient-specific** (part number,
  descripcion, supplier code, normas) (pag. 55-56; tips Component, pag. 52).
- **Aceptado = no se cambia sin re-versionar, y ya no se puede borrar** (pag. 80 y 253).

### Caducidad

- **10 años** desde la liberacion si no se extiende (pag. 54). Desde Release 14 los MDS
  viejos dan warnings y errores, y el error aparece al querer liberar (pag. 57).
- Un material propio de mas de 5 años se marca **'still valid'** y estira 5 años (pag. 38).
- **obsolete**: se puede marcar un MDS propio; usarlo en otro da Warning (pag. 38 y 89 pto. 10).

---

## 3. Estructura del arbol

### Jerarquia

*"Components may have components, semi-components, and materials as children. Semi-Components
may have other semi-components and materials as children. Materials may have other materials
or basic substances as children. Basic substances may not have children"* (pag. 44).

*"You can easily 'change' a material or semi-component into a component by attaching it to a
component 'parent'. You cannot change a component into anything lower"* (tips Component, pag. 15).

**El peso del componente se define al crearlo y no se puede reducir dentro de la estructura**
(pag. 43).

**Semicomponente**: obligatorio el tipo de peso de uso (kg/m, kg/m², kg/m³) desde IMDS 7.0.
*"An error… is generated if the weight type is missing or specific weight entered equals to
zero"* (pag. 85 pto. 7).

**Mismo tipo por nivel**: mezclar da **Warning** (pag. 85 pto. 5); la Recomendacion 001 pide
que todos los hijos de un padre sean del mismo tipo, y por eso a veces hay que meter un
componente de relleno que en la pieza real no existe (tips Component, pag. 15 y 45).
**Material + sustancia en el mismo nivel es ERROR** (pag. 85 pto. 4).

### La regla del 100 %

- *"MDSs require 100% of the materials in the final form, and do not include volatiles present
  in the raw form"* (pag. 33).
- Error tipico: *"all of our % don't sum to 100 (for the from-to %, **the midpoint is used**)"*
  (tips Material, pag. 58).
- **"Rest"** calcula el sobrante (pag. 59), pero *"It is highly recommended not to use 'Rest'
  on a joker/wildcard"*.
- *"Only substances present in the product when on a dealership showroom floor should be
  entered in an MDS. Processing chemicals should not be entered"* (pag. 84).

### Rangos permitidos

Materiales colgados de materiales/semicomponentes: **0 < LL ≤ 100 → M ≤ 20** (pag. 83).

Sustancias basicas colgadas de materiales (pag. 84):

| Rango LL | M maximo (UL − LL) |
|---|---|
| 0 ≤ LL ≤ 7,5 | 3 |
| 7,5 < LL ≤ 20 | 5 |
| 20 < LL ≤ 100 | 10 |

Pasarse es **Warning**: *"This is a warning and not an error and IMDS will allow you to send.
However your customer may choose not to accept"* (tips Material, pag. 51).

### Desvio de peso medido vs. calculado (pag. 89)

| Peso X | Desvio max. |
|---|---|
| X < 1 g | 100 % |
| 1 ≤ X < 100 g | 10 % |
| 100 g ≤ X < 1 kg | 5 % |
| 1 ≤ X < 10 kg | 2 % |
| 10 ≤ X < 100 kg | 1 % |
| X ≥ 100 kg | 0,5 % |

### Jokers / comodines — el limite es 10 %

> *"Recommendation 001 states all IMDS materials (except select IMDS Committee materials) must
> be ≥ 90% declared. In other words, says no material may contain more than 10% unspecified or
> confidential substances… If the portion of a substance is declared as a range, **the upper
> limit of the range is used**. The sum of the maximum portions shall not exceed 10% for each
> material in an MDS… If the sum exceeds this 10% limit, IMDS generates a warning."* (pag. 84)

Confirmado en el glosario (pag. 253) y en tips Material pag. 48.

**Son 9, todos con `system` como CAS** (tips Material, pag. 48): Flame Retardant · Further
Additives · Impact modifier · Inorganic Ingredient · Misc. · not yet specified · Organic
Ingredient · Pigment portion · Plasticizer — todos con sufijo *"not to declare"*.

Dos condiciones **a la vez** para usarlos: la sustancia no es declarable ni prohibida, **y**
el total no declarado no pasa de 10 %.

**El ejemplo del propio instructivo** (tips Material, pag. 70-71): plastificante joker 3-5 %
(media 4 %) + retardante joker "Rest" 6 %. Parece 10 %, pero el check usa el limite superior:
**5 + 6 = 11 %** → falla.

- **`not yet specified` solo en MDS preliminares.** *"not permitted in materials for final
  (PPAP/Initial Sample Report) MDSs"*; referenciar un preliminar dentro de un final es
  **Error** (pag. 84-85).
- **Confidencial ≠ joker pero suma al mismo 10 %.** Prohibido marcar confidencial una
  sustancia D/P, que requiera application code, que sea joker (tips Material, pag. 55) o
  SVHC (pag. 255). Sin CAS/EINECS valido es **Error** (pag. 87 pto. 8).
- **Pseudo-sustancias NO son comodines** y no consumen el 10 % (tips Material, pag. 45; pag. 39).
- La regla del 10 % se calcula **sobre el material de nivel superior para todas las 5.x**
  (pag. 87 pto. 9).

---

## 4. Clasificacion 5.5.2 Textiles (in polymeric compounds)

Es la de las telas de Barack. **5.5 = "Polymeric compounds (e.g. inseparable laminated trim
parts)"** (tips Material, pag. 30) — laminados inseparables.

| Regla | Detalle |
|---|---|
| **Check de composicion** | "Must contain": **nada**. "Must not contain": suma de sustancias de clases 1-4 **≥ 95 %** (tips Material, pag. 30) |
| **Parts Marking** | Aplica. **Error que impide liberar** si el componente padre pasa de **100 g** de materiales 5.1/5.1.a/5.1.b/5.4.x/**5.5.x** (pag. 67; tips Component, pag. 32) |
| **Recyclate** | Obligatorio contestar *"Does the material contain recyclate?"*. Sin contestar = **Error** (pag. 66 y 87 pto. 13) |
| **Nombre** | Descriptivo, en ingles, **nunca el nombre comercial**. Ejemplos del manual, justo de textiles: *"finish (e.g. for textiles)"*, *"lamination material (e.g. laminate for textiles)"* (tips Material, pag. 33) |
| **Normas** | **No hay regla especifica de normas para 5.5.2 en los manuales** |

(Comparar: la 5.5.1 Plastics **si** exige suma de sustancias con "…poly…" en el nombre ≥ 5 %.)

---

## 5. Envio al cliente

Del diagrama *"What to do with MDS in Edit Mode?"* (pag. 80):

| Accion | Texto del manual | Version |
|---|---|---|
| **Internally Release** | *"This is for your company's use only – a customer will not be able to see it unless attached to a tree structure that is Proposed or Sent"* | entero |
| **Propose** | *"you may propose an MDS to one or more recipients – but only one recipient per 'roof' company… After the recipient accepts, the MDS can no longer be deleted"* | entero al proponer |
| **Send** | *"The MDS remains in edit mode and 'handshake' mode until accepted. Once accepted, other recipients may be added… After acceptance, the MDS cannot be deleted"* | `.0x` hasta aceptar |

**Arbol de decision** (pag. 80): ¿interno? → Internally Release. ¿externo, un solo cliente? →
**Send**. ¿varias empresas, base limitada? → **Propose**.

*"**Send** – You send this MDS only to this customer… It is in 'handshake' mode. **Propose** –
You make this part for several customers under different customer part numbers"*
(tips Component, pag. 54). *"Send is a 1-to-1 relationship"* (tips Component, pag. 56).

### Publish: no

- *"never use 'publish' for an MDS containing proprietary information"* (pag. 90).
- Tres razones por las que los clientes no lo quieren: nadie lo "acepta" salvo el creador, el
  cliente no puede aceptar/rechazar, y a los sistemas offline les cuesta leerlos (pag. 90).
- *"99% of users NEVER Publish"* (tips Material, pag. 66).
- Cuatro precondiciones: habilitado a nivel empresa, privilegio de usuario, autocertificacion
  aceptada, y confirmacion del Company Administrator (pag. 91).
- Al publicar un MMDS, **cualquier Warning se convierte en Error** (pag. 87 pto. 11).

### Recipient Data (obligatoria antes de mandar)

Supplier Code (normalmente **DUNS** — es lo que pide VW, pag. 79), Name y **Part/Item No. del
cliente**: *"their Part number and Description must appear in the Recipient Data because they
see values from the Recipient Data in their view"* (tips Component, pag. 18 y 52-53).

⚠ *"Slight differences such as an extra dash or a missed space often result in rejection"*
(pag. 79).

**Send y Propose estan grises hasta que agregues un destinatario** (tips Component, pag. 40 y 49).

### Si rechazan

- **El motivo es obligatorio** (pag. 113) y llega por mail con los IDs de empresa y el supplier
  code. Se relee con boton derecho → *Show reject reason*.
- Despues: *"Save As/New Version and make changes – Version 1.01"* y *"Propose again –
  Version 2"* (pag. 82). Vuelve a **not yet browsed**.
- Si era **Send**, recien con el rechazo se puede editar el arbol (tips Component, pag. 56).
  Si era **Propose**, solo la Recipient data (tips Component, pag. 54).
- Si quedo en Edit Mode o Modified, **hay que reenviar o re-proponer**: no alcanza con
  corregir (tips Component, pag. 56).
- Del lado de la request: rechazada → vuelve a **working**; aceptada → **completed** (pag. 104).

### Forwarding (distribuidores)

El proveedor tilda *"Forwarding allowed"*; solo se reenvian MDS aceptados, una sola version;
se puede proponer e internally release **pero no Send**; no se edita salvo Supplier Data,
Recipient Data y SCIP (pag. 91). Warning si el flag esta en falso (pag. 88 pto. 15).

---

## 6. El checker

*"When MDS → Check is chosen… This compares the MDS against all the general and
recipient-specific rules and error messages. The results are displayed in the Check-Log"*
(pag. 82).

> *"**Errors must be corrected before the MDS can be internally released, sent, or proposed.
> Warnings do not prevent continued MDS transactions.** However… the customer may require the
> MDS creator to fix the warning before accepting. The customer may also run a check upon an
> MDS in the Inbox to see what warnings may have been ignored"* (pag. 82-83).

Doble clic sobre el error en el log → te lleva al campo (tips Material, pag. 58 y 60).

- Un MDS liberado hace años puede no cumplir las reglas de hoy: correrle el check antes de
  re-proponer (pag. 86).
- El cliente puede tener checks mas duros (IMDS-a2 / IMDS-AI) *"beyond those incorporated in
  the IMDS Online system"* (pag. 83). Los dos instructivos cierran igual: **"Ask your
  customer"** (tips Material, pag. 74; tips Component, pag. 62).

### ERRORES (frenan)

| Error | Fuente |
|---|---|
| Los porcentajes no suman 100 (en rangos, punto medio) | tips Material, pag. 58 |
| Sustancia sin porcion especificada | tips Material, pag. 58 |
| **Sin Contact Person** (esta en Supplier Data, no en Ingredients) | tips Material, pag. 58 y 60 |
| Componente sin peso / sin cantidad / sin materiales / con nombre por defecto | tips Component, pag. 47 |
| Sustancia basica al mismo nivel que un material | pag. 85 pto. 4 |
| Semicomponente sin weight type o con peso especifico 0 | pag. 85 pto. 7 |
| MDS propio borrado referenciado en el arbol | pag. 85 pto. 6 |
| Material propio con sustancias inactivas | pag. 87 pto. 6 |
| Confidencial sin CAS ni EINECS valido | pag. 87 pto. 8 |
| Sustancia GADSL / REACH-SVHC marcada confidencial | pag. 87 pto. 10 |
| Referenciar un MDS preliminar dentro de uno final | pag. 84-85 |
| Polimero 5.x: reciclado sin contestar | pag. 66 y 87 pto. 13 |
| Polimero: min-max de reciclado mecanico con > 20 % de diferencia | pag. 66 pto. 1 |
| Parts Marking sin contestar: > **100 g** de 5.1/5.1.a/5.1.b/5.4.x/**5.5.x**, o > **200 g** de 5.2/5.3 | pag. 67 |
| Multi-sourced: una sola alternativa; ninguna "preferred"; peso fuera de desvio | pag. 89-90 |
| Al **publicar** un MMDS: cualquier Warning pasa a Error | pag. 87 pto. 11 |

### WARNINGS (no frenan, el cliente puede rechazar igual)

| Warning | Fuente |
|---|---|
| Rango de porcion fuera de lo permitido | pag. 86; tips Material, pag. 51 |
| **Regla del 10 %** superada | pag. 84 y 86 |
| Tipos de nodo distintos en el mismo nivel | pag. 85 pto. 5 |
| El material no llega al contenido minimo de su clasificacion (checks SC90) | pag. 86 pto. 2 |
| El sistema sospecha que la clasificacion no corresponde a los ingredientes | pag. 87 pto. 7 |
| MMDS nuevo 5.x/6.x con **una sola sustancia al 100 %** | pag. 87 pto. 12 |
| Liquido o gas > 1 % sin clasificacion 9.x (el agua en 7.1 esta exenta) | pag. 86 pto. 4 |
| Uso de un MDS propio marcado **obsolete** | pag. 88 |
| Desvio peso medido vs. calculado | pag. 89 pto. 9 |
| *"Forwarding is not allowed for this recipient"* | pag. 88 pto. 15 |
| Recyclate post-consumo/post-industrial con rango > 20 % en el nodo top | pag. 88 pto. 14 |
| MDS ajeno borrado en el arbol | pag. 85 pto. 6 |
| Mismo recipient part number + supplier code ya enviado con otro MDS ID (Rec. 001 §3.2.2.B) | pag. 81-82 |
| Application Code *"Other application (Potentially prohibited)"* | pag. 90 pto. 14 |
| **Toyota: falta norma en el area recipient-specific** | pag. 56 |
| MDS referenciado con version mas nueva disponible | pag. 36 |

**Quedan fuera de los checks de material**: IMDS-Committee (423), IMDS-Committee/ILI Metals
(18986) y Stahl und Eisenliste (313) (pag. 86 pto. 1 y pag. 90). Los semicomponentes de
ZVEI-Rec019 (empresa 102677) tampoco pasan por la regla del 10 %, ni SC90, ni rangos (pag. 85).

---

## 7. Sueltos que importan

- **Todo en ingles**: *"all data entry must be performed in English only. IMDS does not
  translate user entries in text fields"* (pag. 248).
- **Logout a los 60 minutos** de inactividad; escribir sin guardar **no cuenta** (pag. 245).
- **Responsabilidad legal**: *"if you create the material MDS then you are considered legally
  responsible for the validity of the data. We recommend that if you don't manufacture the
  material, then you don't create the MDS"* (tips Material, pag. 8).
- **Tasa de error esperada de un proveedor**: maximo **2 %** de datasheets rechazadas sobre
  enviadas en 6 meses (IMDS Efficiency & Effectiveness v1.2, pag. 11).
- **Copias**: *"Material copies are only allowed for the owner/creator of a material. Accepted
  or published materials cannot be copied"* (pag. 93). `Copy/New Version` mantiene el IMDS ID;
  `Copy/New Datasheet` da ID nuevo (pag. 92).

---

## Lo que NO esta en los manuales

No se completa de memoria ni de internet. Si hace falta, se busca en las **IMDS Information
Pages** del propio sistema o se le pregunta al cliente.

1. **Una lista de clasificaciones de material que obliguen a cargar Norms/Standards.** Solo
   esta la regla de criterio (tips Material, pag. 37) y el check de Toyota (pag. 239).
2. **El listado de acronimos de normas publicas** → *Information Pages → FAQ → General Info →
   "What do the Norms/Standards acronyms mean?"* (tips Material, pag. 22).
3. **Reglas de normas especificas para 5.5.2 Textiles.**
4. **Extensiones de Volkswagen.** El manual v15.0 **no tiene capitulo VW** (los capitulos 13 a
   30 son Aston Martin, BMW, FCA, Daimler, Fiat, Ford, GM, JLR, Mazda, Next.e.GO, Nissan, PSA,
   Renault, Scania, Tesla, Toyota, Volvo Car, Volvo Group — pag. 9-10). Lo unico de VW: pide
   **DUNS** (pag. 79). Buscar en *Information Pages → Help → OEM Specific Info*.
5. **Nada de SMRC/Reydel ni Toyota Boshoku como empresas.** Ford tiene capitulo (pag. 224) y
   Toyota tambien (pag. 239), pero el requisito de norma de Toyota esta acotado a *"when
   sending to company 10674 only"* — **el manual no dice si Toyota Boshoku es esa company ID**.
6. **El texto completo de la Recommendation 001** → menu *Help → Recommendations* dentro de
   IMDS. *"Recommendations are frequently added and updated; it is a good idea to check for
   updates each time you login"* (pag. 94-95).
7. **En que estado debe estar el MDS referenciado para poder sobrescribir sus normas como dato
   recipient-specific.**
