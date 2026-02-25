# Ciclo de Mejora: Landing Page — 2026-02-22

## Estado ANTES

La landing page funcionaba correctamente pero presentaba 14 hallazgos en 6 categorias.

**Capturas ANTES:**
- Landing completa con subtitulo "Ingenieria" generico, tags de 10px ilegibles, footer casi invisible (slate-500 sobre fondo oscuro), sin animaciones de entrada
- Focus ring visible pero de bajo contraste (azul sobre slate-900)
- Hover funcional con borde naranja y flecha, pero sin indicadores de atajo de teclado

---

## Hallazgos Clasificados

### BUGS (3)
| # | Descripcion | Severidad |
|---|-------------|-----------|
| B1 | Background pattern `absolute inset-0` sin `pointer-events-none` — podia interceptar clicks | Media |
| B2 | Focus ring (`box-shadow` azul) poco contrastado sobre fondo slate-900 | Media |
| B3 | Cards sin `aria-label` — screen readers leen solo texto visible sin contexto de accion | Alta |

### NORMA (3)
| # | Descripcion | Fuente |
|---|-------------|--------|
| N1 | Subtitulo "Ingenieria" no comunica contexto IATF 16949 | NotebookLM + analisis |
| N2 | AMFE dice "norma AIAG-VDA" generico, sin edicion | NotebookLM: "AIAG-VDA 1a Edicion (2019)" |
| N3 | Plan de Control no menciona APQP | NotebookLM: CP es parte de APQP |

### UX (3)
| # | Descripcion |
|---|-------------|
| U1 | Tags con `text-[10px]` — por debajo del minimo legible |
| U2 | Cards sin animacion de entrada (el resto de la app usa stagger) |
| U3 | Sin atajos de teclado para acceso rapido a modulos |

### VISUAL (3)
| # | Descripcion |
|---|-------------|
| V1 | Footer `text-slate-500` sobre slate-900 = contraste ~3.2:1 (debajo de WCAG AA) |
| V2 | Logo sin glow — se pierde en el fondo oscuro |
| V3 | Linea separadora `w-24` demasiado corta |

### ACCESIBILIDAD (2)
| # | Descripcion |
|---|-------------|
| A1 | Grid de cards era `<div>` — deberia ser `<nav>` semantico |
| A2 | Footer era `<div>` — deberia ser `<footer role="contentinfo">` |

---

## Consulta NotebookLM

**Cuaderno:** AIAG-VDA FMEA Harmonization and Seven-Step Risk Methodology (132 fuentes)

**Hallazgos clave:**

1. **Nomenclatura AMFE confirmada:** "AMFE AIAG-VDA 1a Edicion (2019)" o "PFMEA AIAG & VDA 1a Edicion"
2. **Plan de Control + APQP:** Correcto asociar CP con APQP
3. **Falta modulo PFD (Diagrama de Flujo del Proceso):** NotebookLM lo marca como "absolutamente critico" — es la "columna vertebral" que alimenta AMFE y Plan de Control (Paso 2: Analisis de Estructura del AMFE AIAG-VDA)
4. **Orden recomendado (Golden Thread):** PFD -> AMFE -> CP -> HO -> Tiempos
5. **Integracion relacional:** Los modulos deben mostrar que son una "base de datos relacional", no documentos aislados

---

## Correcciones Aplicadas

### Archivo modificado: `modules/LandingPage.tsx`

| Fase | Item | Cambio |
|------|------|--------|
| BUGS | B1 | Agregado `pointer-events-none` al div del pattern |
| BUGS | B2 | Focus ring blanco con offset slate-900: `focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-slate-900` |
| BUGS | B3 | `aria-label="Abrir modulo ..."` en cada card |
| NORMA | N1 | Subtitulo: "Ingenieria" -> "Ingenieria de Calidad Automotriz" |
| NORMA | N2 | AMFE: "segun norma AIAG-VDA" -> "segun AIAG-VDA 1a Edicion" |
| NORMA | N3 | CP: "Plan de Control AIAG con" -> "Plan de Control AIAG (APQP) con" |
| A11Y | A1 | `<div>` grid -> `<nav aria-label="Modulos disponibles">` |
| A11Y | A2 | `<div>` footer -> `<footer role="contentinfo">` con texto actualizado |
| UX | U1 | 9 tags: `text-[10px]` -> `text-xs` (12px) |
| UX | U2 | Animaciones stagger: header, card 1/2/3, footer con `opacity-0 animate-fade-in-up stagger-N` |
| UX | U3 | `useEffect` con keydown listener (1/2/3) + badges `<kbd>` visibles en hover |
| VISUAL | V1 | Footer: `text-slate-500` -> `text-slate-400` |
| VISUAL | V2 | Logo: `drop-shadow(0 4px 12px rgba(59, 130, 246, 0.25))` |
| VISUAL | V3 | Separador: `w-24` -> `w-32` |

### Tests creados

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `__tests__/LandingPage.test.tsx` | 19 | Rendering, module selection, keyboard shortcuts, accessibility |
| `__tests__/AppRouter.test.tsx` | 5 | Default render, navigation to 3 modules, back to landing |
| **Total nuevos** | **24** | |

---

## Verificacion

- `npx tsc --noEmit`: Sin errores
- `npx vitest run`: 169 suites, 2388+ tests, 0 failures (24 tests nuevos)
- Verificacion visual en navegador:
  - Cards animan con stagger al cargar
  - Tab muestra focus ring blanco visible
  - Tecla "1" navega a Tiempos y Balanceos (verificado)
  - `<kbd>` badges visibles en hover
  - Footer legible con texto actualizado
  - Logo con glow azul sutil
  - Subtitulo y descripciones actualizados con nomenclatura AIAG-VDA correcta

**Capturas DESPUES:**
- Landing con subtitulo "Ingenieria de Calidad Automotriz", tags legibles, footer visible, logo con glow, animaciones stagger, badges de teclado
- AMFE card con "AIAG-VDA 1a Edicion", CP card con "AIAG (APQP)"
- Atajo "1" navego exitosamente a Tiempos y Balanceos

---

## Pendientes

| # | Descripcion | Prioridad | Fuente |
|---|-------------|-----------|--------|
| P1 | **Modulo Diagrama de Flujo del Proceso (PFD)** — NotebookLM lo marca como "absolutamente critico" para la cascada APQP. Es la columna vertebral que alimenta AMFE y CP. | Alta | NotebookLM |
| P2 | **Reordenar cards en la landing** segun Golden Thread: PFD -> AMFE -> CP -> Tiempos (cuando PFD exista) | Media | NotebookLM |
| P3 | **Indicador de ultimo modulo usado** — para que el usuario vuelva rapido a donde estaba | Baja | UX review |
