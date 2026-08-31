---
description: Envio de mails desde Outlook — gate anti-duplicado obligatorio
paths:
  - "scripts/_mail*"
  - "**/*.py"
---

# Mandar un mail: nunca con un `.Send()` suelto

> ENFORCEMENT YA CARGADO (misma sesion, 2026-08-14): hook `mail-guard.sh` registrado en
> `_dispatcher.sh` + `scripts/_mailEnviar.py` con gate y `--selftest` (9 casos, verde),
> probado contra el caso real del incidente: bloquea.

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

## Que verifica el gate, y por que cada cosa

| Chequeo | Por que |
|---|---|
| Barre **Enviados de las ultimas 72 h** y aborta si coincide por asunto + destinatarios + adjuntos | El 14/08 la entrada duplicada estaba a la vista y la llame "copia vieja" |
| El chequeo corre **justo antes del Send**, no al empezar | Ese dia mire Enviados y mande 30 minutos despues |
| Match por **tres señales**, no solo el asunto | Un hilo tiene muchos mails con el mismo asunto |
| Nada de ese asunto en la **Bandeja de salida** | Evita encolar dos veces |
| Outlook con **al menos una ventana abierta** | Sin ventana (`Explorers.Count == 0`) no ejecuta envio/recepcion |
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

## Enforcement

- **Hook `mail-guard.sh`** (PreToolUse, `Bash|PowerShell|Write|Edit`, registrado en `_dispatcher.sh`):
  bloquea cualquier `.Send()` / `SendAndReceive` sobre Outlook que no pase por `_mailEnviar.py`.
  Deja pasar `.Display()`, `.Save()`, `ReplyAll()` y la lectura con `_mails.py`.
- **`_mailEnviar.py --selftest`**: 9 casos de la logica de deteccion, incluido el del incidente.
- **`mail-guard.test.sh`**: 11 casos de regresion del hook, por el guardian suelto Y por el despachador
  (el parser compartido ya rompio otros 3 guardianes en silencio, commit `ccef7f09`).
- El gate se probo contra el caso real del 14/08 leido de Enviados: **bloquea**.

## Incidente fuente — 2026-08-14

Fak mando el mail del AMFE 150 a Marcelo, Nicolas y Carlos. Quedo en la Bandeja de salida sin
transmitir (Outlook estaba corriendo sin ninguna ventana). Yo mire la cola, vi el item y le afirme
en negrita *"el mail no salio, no hay nada que recuperar"*. Lo saque de la cola, lo edite y lo
mande. Salieron **dos mails**. Fak: *"se terminó enviando 2 veces… es un error grave"*.
Detalle en la memoria `mail_ya_enviado_verificar_justo_antes`.
