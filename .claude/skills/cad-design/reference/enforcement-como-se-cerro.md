# Como se cerraron los agujeros del enforcement

Dos episodios del mismo tipo: un control propio que daba verde por la razon equivocada, encontrado
por una auditoria independiente y no por mi. Se leen antes de escribir un gate nuevo
([[feedback_un_control_se_audita_en_las_dos_direcciones]]). Los gates vigentes estan en
`../SKILL.md`.

**Los 3 agujeros que tenía ese enforcement, cerrados el 2026-08-24** (auditoría independiente;
los tres se demostraron EN CORRIDA antes de arreglarlos — regresión: `test_gates_entrega.py`):

- **La evidencia se buscaba por NOMBRE de archivo.** Verificar la pieza, retocarla y entregarla
  daba **“ENTREGA OK” con 653 puntos DENTRO**, sin `--skip-gate` y sin huella. Ahora
  `check_collision` y `gate_ensamble` graban `file_signature()` (tamaño + sha1) del STEP y el
  export la compara contra el archivo que va a entregar. La regla ya estaba escrita para el
  caché de mallas (“un caché sin la firma del archivo miente”) y el almacén de evidencia —que es
  lo que decide la entrega— no la tenía.
- **El gate de ensamble se disparaba por el NOMBRE** (`"ENSAMBLE" in base.upper()`): un ensamble
  entregado como `conjunto.step` no lo disparaba. Ahora cuenta sólidos con OCC sin mallar
  (`_contar_solidos`). Es “el nombre no es el contenido” aplicada al gate que la violaba.
- **La confirmación de zona era autofirmable**: `--quien` venía con default `"Fak"` y
  `--evidencia` con default `""`. Ahora las dos son obligatorias y `--evidencia` tiene que
  apuntar a un **archivo que exista** (el render que Fak devolvió circulado, una foto, un mail);
  se copia a `renders/confirmacion_*` y se firma en el manifest. No es infalsificable: convierte
  una mentira cómoda (un flag) en una laboriosa, que es todo lo que un gate puede hacer acá.

> **DOS hipótesis mías que los datos refutaron el mismo día, para que nadie las reinvente.**
> 1. El primer G-E3b medía el **histograma de luminancia**: sin sombras la imagen colapsaría a
>    pocos tonos. Calibrado contra los renders reales **dio al revés** — el malo daba **70**
>    tonos para cubrir el 90 % de los píxeles y los buenos **26-28**, porque el malo eran líneas
>    finas con antialias y los buenos superficies grandes de color plano. Tirada.
> 2. Después la **saturación**, que con dos muestras malas (0,293 y 0,29) contra cuatro buenas
>    (0,42-0,76) parecía separar limpio, y salió **bloqueante** con umbral 0,35. Una auditoría
>    independiente la tumbó por los dos lados en el mismo día: la tercera muestra mala real
>    —`caballete_TODAS.png`, matplotlib, la misma masa ilegible— da **0,353 y pasaba por 0,003**;
>    y un render legítimo de foto3d de un dispositivo **de un solo material** (un caballete de
>    tubo pintado de un color, que es lo que Barack fabrica) da **0,000 y quedaba rechazado**.
>
> Dejaba pasar lo malo **y** frenaba lo bueno, que es la peor de las dos combinaciones: un control
> que molesta se termina desactivando entero. Quedó como medición informada. **Lo que aprendí de
> las dos: con n=2 en una clase no hay umbral, hay coincidencia** — y lo escribí como límite
> conocido en el canon *antes* de que el auditor lo probara, lo cual no me salvó de haberlo puesto
> a bloquear igual.
