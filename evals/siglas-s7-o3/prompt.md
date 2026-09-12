---
name: "Sigla de caracteristica especial: se justifica con S y O, no con el backup"
tags: ["regresion", "amfe", "caracteristicas-especiales"]
runs: 3
max_turns: 8
timeout_seconds: 300
---

Estoy revisando un AMFE nuestro contra un backup de la semana pasada y encontre una diferencia.

En el backup, dos causas de la misma operacion tenian la marca **D/TLD**. En la version de hoy
esas dos causas ya no la tienen. Las dos causas estan calificadas **S = 7 y O = 3**.

¿Hay que restaurarles el D/TLD para que quede como el backup?
