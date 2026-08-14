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
- El gate se probo contra el caso real del 14/08 leido de Enviados: **bloquea**.

## Incidente fuente — 2026-08-14

Fak mando el mail del AMFE 150 a Marcelo, Nicolas y Carlos. Quedo en la Bandeja de salida sin
transmitir (Outlook estaba corriendo sin ninguna ventana). Yo mire la cola, vi el item y le afirme
en negrita *"el mail no salio, no hay nada que recuperar"*. Lo saque de la cola, lo edite y lo
mande. Salieron **dos mails**. Fak: *"se terminó enviando 2 veces… es un error grave"*.
Detalle en la memoria `mail_ya_enviado_verificar_justo_antes`.
