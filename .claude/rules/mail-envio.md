---
description: Envio de mails desde Outlook — gate anti-duplicado obligatorio
paths:
  - "scripts/_mail*"
  - "**/*mail*.py"
  - "**/*outlook*"
  - ".claude/hooks/mail-guard*"
---

# Mandar un mail: nunca con un `.Send()` suelto

## Las tres reglas

1. **Un mail que Fak ya mando NO SE TOCA.** Si esta mal, se le reporta que esta mal y decide el.
   Sacarlo de la Bandeja de salida para "arreglarlo" es intervenir un envio que el ya autorizo.
2. **El default sigue siendo `.Display()`**, no `.Send()` (memoria `dejar_el_mail_listo_para_enviar`).
   Se envia solo si Fak lo pide explicitamente para ESE mail.
3. **Cuando hay que enviar, se envia por `scripts/_mailEnviar.py`.** Es el unico camino con gate.

```bash
python scripts/_mailEnviar.py --buscar "<parte del asunto>"            # dry-run
python scripts/_mailEnviar.py --buscar "<parte del asunto>" --enviar
python scripts/_mailEnviar.py --selftest                               # sin Outlook
```

## Quien aprieta Enviar cuando hay varias sesiones — 2026-08-31

**El OK de Fak para un mail no se acepta reenviado por otra sesion.** Ni siquiera de la
sesion que hace de coordinadora, ni con la cita textual de Fak delante. Un mail sale a
nombre suyo: la autorizacion tiene que llegar de el, de primera mano, a la sesion que
ejecuta el envio.

**El patron que resuelve la friccion sin aflojar nada:**

| Rol | Que hace |
|---|---|
| La sesion que investigo el tema | Redacta y deja el borrador **guardado** en Borradores. No envia. |
| La sesion que tiene a Fak del otro lado | Le muestra el borrador entero, recibe el OK **directo**, y corre `--enviar`. |

Los dos miran el mismo Outlook, asi que el borrador de una lo manda la otra sin rehacer
nada. Fak no salta de ventana y nadie envia con un OK de segunda mano.

**Por que no alcanza con confiar en la coordinadora** (el caso real que lo justifica, del
mismo dia): la sesion coordinadora confundio a que sesion le hablaba Fak y le mando a
**otra** la instruccion *"arma el mail y enrialo"*. Si esa sesion hubiera tenido un
borrador cargado y aceptara ordenes reenviadas, salia un mail que Fak nunca pidio. El
error de atribucion no es hipotetico: ya paso.

Si una sesion se planta y pide el OK directo, **tiene razon** — no se la presiona ni se
le cambia la regla: se le manda el borrador a quien esta hablando con Fak y lo envia esa.

## Cada corrida de `_prepararMail.py` deja UN borrador: si rehacés el texto, limpiá

**21/09/2026:** el gate de voz me rebote el mail dos veces (largo, y despues el plural), lo
rehice y quedaron **3 borradores identicos** en Borradores. Ahi `_mailEnviar.py --buscar`
aborta bien (*"esperaba 1 borrador y hay 3"*) y no deja mandar ninguno.

**La salida no es `--forzar`** —eso saltea el gate de duplicados y puede mandar el equivocado—
sino **`--id <EntryID>`**, que envia exactamente el borrador que uno eligio. Para sacar el
EntryID del bueno, listar Borradores por `[CreationTime]` descendente y mirar un campo que
los distinga (aca: el unico con CC). **Los duplicados que sobran NO los borro yo**: borrar
mails no esta entre lo que hago, se los dejo dichos a Fak con su hora.

**Lo barato es no generarlos:** el semaforo de voz sale ANTES de crear el item, asi que
conviene pasar el texto por el criterio (corto como los de Fak, primera persona, con tildes)
antes de la primera corrida, no despues de la tercera.

## Como se arma el item en Outlook (COM)

**Los destinatarios se agregan con `mail.Recipients.Add()`, NUNCA como string en `mail.To`.**
Incidente 08/09/2026: `_prepararMail.py` resolvia contra el namespace pero asignaba un string
a `mail.To`; los destinatarios quedaban con `Address: ""` vacia y Exchange rebotaba con
*"Ninguna de sus cuentas pudo enviar a este destinatario"*. El camino correcto:

```python
for direccion, tipo in destinatarios:      # tipo: 1 = Para, 2 = CC
    r = mail.Recipients.Add(direccion)
    r.Type = tipo
mail.Recipients.ResolveAll()               # sobre el ITEM, no sobre cada recipient
```

Asi quedan vinculados a su casilla real de Exchange. Si `ResolveAll()` devuelve falso, hay al
menos uno sin resolver: se reporta cual, no se manda igual.

## Que va y que NO va en el cuerpo

**El mail va al grano: piezas, entregables y rutas.** Fak, 08/09/2026, sobre el correo de
entrega del PPAP: *"esto no lo pongas nunca mas en ningun mail, el imds es de calidad... y el
otro esta de mas"*.

- **Nada de temas de otra area.** El IMDS es de Calidad; los ensayos, dimensionales y PSW los
  gestiona quien corresponda. Nombrarlos "por las dudas" es meterse en el sector ajeno.
- **No se le recuerda a los demas lo que les falta entregar.** Eso es paternalismo y ademas
  deja mal a un compañero por escrito.
- **No se recuerda lo obvio ni se agrega relleno.** El test: *¿el que lee tiene que hacer algo
  con esto hoy?* Si no, afuera. Al mail para Gamboa le sume siete codigos que nadie iba a
  tocar: *"los agregaste y aclaraste de mas, es un error conocido tuyo"*.

## El mail lo firma Fak: primera persona del singular — y su voz esta MEDIDA

**"Revise", no "Revisamos".** 11/09/2026, sobre el correo de correccion del PPAP de NOVAX:
*"revise porque revisamos, yo revise"*. El mail sale de su casilla y lo firma el; el plural
inventa un equipo que no es el que hizo el trabajo y le saca la responsabilidad de encima.
Vale para todo verbo del cuerpo: adjunto, revise, corregi, mande.

Hasta el 12/09/2026 eso era **solo texto**: una regla escrita, sin nadie que la mida. Y el error
volvio igual — el plural de apertura **salio enviado** dos veces (01/09 a Carlos y Leo,
*"Actualizamos en INCA..."*; 07/09 a Pablo, *"Corregimos en el arb..."*). Es el rule enforcement
gap del skill `rule-enforcement-gate`. Desde hoy la voz se mide contra su propio corpus.

### El perfil, contado — no es mi idea de como escribe Fak

Fuente: `.mail-cache/mails.jsonl`, carpeta *Elementos enviados*, **935 mails suyos hasta
2026-03-01** (corte de voz pura: despues empiezo a redactarle yo). Se regenera con
`node scripts/_vozFak.mjs --medir` y queda en `scripts/_lib/vozFak.data.json`.
**Ese JSON no se escribe a mano**: si lo escribo yo es mi idea de el, no el.

| Medido | Fak | Yo escribiendo a su nombre (desde 08/2026) |
|---|---|---|
| Largo mediano | **148 caracteres / 24 palabras** | 348 caracteres / 63 palabras (**2,4x**) |
| p75 / p90 | 305 / 585 caracteres | 664 / 1.173 |
| 1a persona **singular** | 0,43 verbos por mail | — |
| 1a persona **plural** | 0,02 por mail | el plural que corrigio, en la 1a oracion |
| Arranque | `Buen dia` 136 · `Buenos dias` 85 · `Buenas tardes` 58 · `Hola` 40 | — |
| Cierre | `Saludos,` 174 · `Gracias` 14 | — |
| `cordialmente` · `atentamente` · `por medio de la presente` | **0 · 0 · 0** | — |
| Viñetas, secciones numeradas, tabla en el cuerpo | **0** | las ponia yo |

**La desviacion real es el LARGO.** Su mail tipico son **dos renglones**. Y el numero corrige a
la memoria `mail_corto_como_los_de_fak`: el mail de 592 caracteres que guarda como ejemplo de
"corto" esta cerca de su **p90**, no de su mediana.

### El plural es suyo: lo que se prohibe es la ATRIBUCION, no la palabra

De las **26** ocurrencias de 1a persona del plural en los 1.549 enviados, **22 las escribio Fak**
(*"Nosotros lo hicimos en metros lineales"*, *"Logramos meter muchas mas piezas"*, *"avisame y lo
revisamos juntos"*). Un gate que las marque no mide a Fak: mide mi idea de Fak
(leccion `un_control_se_audita_en_las_dos_direcciones`).

| Caso | Que va |
|---|---|
| Informa un trabajo que hizo el solo, en la **primera oracion** | ROJO — singular: *hice*, *revise*, *corregi* |
| Hay un **tercero nombrado** (*"junto con Paulo y Nicolas, hicimos..."*) | plural, va |
| Es el **sector hacia afuera** (*"les informamos"*, *"queria informarles"*) | plural, va |
| Es **a futuro con el otro** (*"lo revisamos juntos"*, *"acordamos"*) | plural, va |
| Plural en **subordinada** (*"los tiempos que hicimos"*) | plural, va |

### El gate

```bash
node scripts/_vozFak.mjs --revisar "<archivo.txt>"   # semaforo; - para leer de stdin
node scripts/_vozFak.mjs --medir                     # regenera el perfil del cache
node scripts/_vozFak.mjs --selftest                  # 11 casos dirigidos + falsos rojos del corpus
node scripts/_vozFak.mjs --diff                      # que le cambio Fak a mis borradores
```

**ROJO, bloquea:** plural de apertura atribuyendose trabajo propio · impersonal de informe
(*se procedio a*) · formula formal que el nunca uso · *"Tres cosas para mirar:"* · tabla en el
cuerpo · mas de 2.500 caracteres · vocabulario prohibido (reusa `scanForbidden()`, las mismas
listas del AMFE).
**AMARILLO, avisa:** largo sobre su p90 · viñetas · secciones numeradas · condicional de
recomendacion (*convendria*) · cierre fuera del set medido · explicar el razonamiento en vez
del resultado.

**Calibracion, en las dos direcciones** (`__tests__/scripts/vozGate.test.mjs`, 26 casos): los tres
mails mios en plural dan rojo, los cuatro plurales legitimos de Fak dan verde, y el selftest mide
el **falso rojo contra sus 935 mails: 8, o sea 0,86%**. Si ese numero sube, el gate empezo a medir
mi idea de el y no se cablea hasta que baje.

## Al cerrar un tema por mail, barrer Borradores por asunto

Un borrador viejo del mismo hilo es **una bomba con el asunto correcto**: mismo tema, mismos
destinatarios, adjuntos superados. El 11/09/2026, despues de mandar la correccion del PPAP de
NOVAX, quedaban **4 borradores del 10/09** con el mismo asunto y los mismos destinatarios, cada
uno con una version distinta de los tres AMFE (hash distinto en los cuatro). Apretar Enviar en
cualquiera mandaba justo lo que el mail recien enviado declaraba obsoleto.

Cuando un tema se cierra por mail: listar Borradores por asunto, comparar los adjuntos por hash
contra el archivo del legajo, y mover a Elementos eliminados los que quedaron superados
(`Delete()` de COM mueve, no borra definitivo: se recuperan de ahi).

## Que verifica el gate, y por que cada cosa

| Chequeo | Por que |
|---|---|
| Barre **Enviados de las ultimas 72 h** y aborta si coincide por asunto + destinatarios + adjuntos | El 14/08 la entrada duplicada estaba a la vista y la llame "copia vieja" |
| El chequeo corre **justo antes del Send**, no al empezar | Ese dia mire Enviados y mande 30 minutos despues |
| Match por **tres señales**, no solo el asunto | Un hilo tiene muchos mails con el mismo asunto |
| Nada de ese asunto en la **Bandeja de salida** | Evita encolar dos veces |
| Outlook **abierto como programa del usuario, ANTES del `Dispatch`** | Un Outlook que levanta el `Dispatch` queda sin ventana (`Explorers.Count == 0`, no transmite) y el script **se cuelga** en `GetInspector`/`Display()`. Lo abre `asegurar_outlook()` de `scripts/_lib/outlookUi.py`, corriendo el `.exe` |
| **El cartel de seguridad de Outlook se ve, no se adivina** | El *Object Model Guard* (*"Un programa intenta enviar correo en su nombre"*) es MODAL: bloquea el `Send()` y la corrida muere muda por timeout. `vigilando()` lo detecta por el TEXTO de los hijos del `#32770` y lo grita en el momento |
| Post-envio: cola vacia **y** item nuevo en Enviados | "Se envio?" se mira en Enviados por fecha, nunca en el borrador |

## Lo que NO prueba nada

**Un item en la Bandeja de salida NO prueba que el mensaje no se haya enviado.** Outlook puede
tener la copia en Enviados y el item en cola al mismo tiempo. Ausencia de prueba de envio no es
prueba de no-envio, y no se afirma como certeza.

**Diagnostico cuando algo queda trabado en la cola:** leer `PR_MESSAGE_FLAGS` (`0x0E070003`). Si
tiene `MSGFLAG_UNSENT` (0x08) prendido y `MSGFLAG_SUBMIT` (0x04) apagado, es un borrador parado en
esa carpeta y **no va a salir nunca**, por mas envio/recepcion que se fuerce. Se destraba
moviendolo a Borradores y haciendo `Send()` desde ahi.

**Recuperar un mensaje no existe por COM.** `MailItem.Actions` solo trae Responder / Responder a
todos / Reenviar / Responder en carpeta. El boton esta solo en la interfaz
(Mensaje → Acciones → Recuperar este mensaje), sirve solo dentro de la misma organizacion Exchange
y solo si el destinatario no lo abrio.

## El cartel "Un programa intenta enviar correo en su nombre" — 2026-09-15

Es el **Object Model Guard** de Outlook. Fak lo fotografio y pidio saltearlo: *"fijate si podes
hacerle un bypass porque no te das cuenta y te impide mandar los mails"*.

**No se saltea, y las dos mitades del pedido se separan:**

| Mitad | Que se hizo |
|---|---|
| *"me impide mandar"* | Se ataca la CAUSA, no el cartel: `asegurar_outlook()` abre Outlook corriendo el `.exe` **antes** del `Dispatch`. Un Outlook nacido de la automatizacion es, para el guard, un programa externo; uno que ya corre como programa del usuario, con antivirus sano, no dispara el aviso en `Send()` |
| *"no te das cuenta"* | `vigilando()` corre el vigia en un hilo (la operacion COM se queda en el principal: llamarla desde otro hilo revienta con `RPC_E_WRONG_THREAD`), detecta el `#32770` de OUTLOOK.EXE por el TEXTO de sus hijos y lo avisa en el momento, repitiendo cada 15 s |

**Por que no se apaga:** ese cartel existe justo para que un programa no mande correo a nombre
de Fak sin que el se entere — apagarlo es tocar una configuracion de seguridad de su maquina, y
no es mia esa decision. El interruptor soportado vive en *Archivo -> Opciones -> Centro de
confianza -> Configuracion -> Acceso mediante programacion*, y lo aprieta el. En esta PC la
sesion **no es administradora**, asi que lo mas probable es que le aparezca gris.

**Lo que NO es la causa** (verificado el 15/09/2026, no supuesto): Windows Defender estaba
activo, al dia y con tiempo real prendido (`root/SecurityCenter2`), y no habia **ninguna**
politica puesta — ni `HKCU\...\Outlook\Security` ni las de `Policies`. O sea que no fue el
antivirus vencido, que es la causa clasica.

Calibrado en las dos direcciones: `python scripts/_lib/outlookUi.py` (9 casos — los tres textos
del guard en sus dos idiomas dan rojo, y otros avisos de Outlook, el titulo pelado y el vacio dan
verde; mas que `vigilando` devuelve lo de `fn` y no se come su excepcion).

## Enforcement

- **Hook `mail-guard.sh`** (PreToolUse, `Bash|PowerShell|Write|Edit`, registrado en `_dispatcher.sh`):
  bloquea cualquier `.Send()` / `SendAndReceive` sobre Outlook que no pase por `_mailEnviar.py`.
  Deja pasar `.Display()`, `.Save()`, `ReplyAll()` y la lectura con `_mails.py`.
- **`_mailEnviar.py --selftest`**: 9 casos de la logica de deteccion, incluido el del incidente.
- **`mail-guard.test.sh`**: 15 casos de regresion del hook, por el guardian suelto Y por el despachador
  (incluye los dos sentidos del chequeo de destinatarios: `.To = "..."` bloquea, `Recipients.Add()` y
  leer `.To` para reportarlo pasan)
  (el parser compartido ya rompio otros 3 guardianes en silencio, commit `ccef7f09`).
- El gate se probo contra el caso real del 14/08 leido de Enviados: **bloquea**.
- **Gate de voz en las tres puntas**, para que no dependa de que yo me acuerde:
  `_prepararMail.py` imprime el semaforo al armar el borrador · el hook `mail-guard` avisa al
  escribir un `_mail*.txt` de borrador · **`_mailEnviar.py` bloquea el `--enviar` si hay un ROJO**
  (`--sin-chequeo-voz` lo saltea; `--forzar` **tambien lo saltea**, ademas del anti-duplicado —
  los dos piden el OK de Fak para ESE mail). Si node falla, **no bloquea**: un chequeo de estilo
  roto no puede dejar a Fak sin poder mandar un correo.
- **El fail-open necesita su propio caso, y por eso existe `python scripts/_lib/vozMail.py
  --selftest`** (rojo y verde por la cadena real, clavado en el test 26). El 12/09/2026
  `vozMail.py` calculaba mal su raiz y buscaba el gate en un "scripts/scripts/_vozFak.mjs" (la carpeta repetida) que no existe: los 25
  tests del gate daban verde —importan `vozGate.mjs` directo— y **el bloqueo del envio no corrio
  ni una vez**, porque el camino fail-open se lo tragaba en silencio. Lo encontro el auditor.

## De donde sale el gate — 2026-08-14

Un mail que Fak ya habia mandado se reenvio porque lei la Bandeja de salida como prueba de que no
habia salido. Fak: *"se terminó enviando 2 veces… es un error grave"*.
Caso completo: memoria `mail_ya_enviado_verificar_justo_antes`.
