# -*- coding: utf-8 -*-
"""Criterios de diseno: un numero que DECIDE no existe sin su procedencia.

POR QUE EXISTE (fallos reales, sesion 2026-08).

  * Un tope de precarga de 0,90 mm, escrito en dos archivos distintos, rechazo las 87
    geometrias de una busqueda porque la carrera pedida era 0,92. No tenia nada fisico
    detras: el limite real de cuanto puede flexionar una lamina lo pone la FATIGA, que ya
    se media aparte y daba verde.
  * Un piso de presion de 40 kPa rechazaba la grilla entera cuando el diseno pedia un
    resorte blando.
  * Un criterio "SF fatiga >= 1,5" que, traducido, le pedia 1,6e7 ciclos a un utillaje
    impreso de 28 g cuya vida especificada era 1e5. Nadie lo habia traducido nunca.
  * Una tolerancia de 2 % en auditorias de valores que tapaba errores de tipeo reales.

El patron es siempre el mismo: **una constante sin procedencia se vuelve una decision de
diseno que nadie tomo**. Un comentario al lado no alcanza, porque se puede ignorar y porque
nadie lo relee cuando el numero rechaza algo.

QUE IMPONE ESTE MODULO (lo impone el codigo, no la buena voluntad)

  1. `fuente` es keyword-only y NO tiene default: declarar un Criterio sin fuente es un
     TypeError en la linea donde se declara.
  2. Una fuente vacia, "TBD", "-", "a ojo" o cualquier texto que no cite un numero deja el
     Criterio ENVENENADO: se construye, pero cualquier uso (`.valor`, `float()`,
     `.evaluar()`) revienta con SinProcedencia. El veneno viaja hasta donde se usa, que es
     donde hace falta que se vea.
  3. **Solo un criterio con procedencia real puede RECHAZAR.** `nivel=DURO` exige
     `origen` en {FORMULA, NORMA, MEDICION, ENSAYO, CATALOGO, FAK}. Un numero puesto a ojo
     se declara igual -es honesto- pero con `Origen.A_OJO`, y entonces solo puede AVISAR.
     Ese solo mecanismo desactiva los tres incidentes de arriba: el tope de 0,90, el piso
     de 40 kPa y el SF 1,5 no tenian procedencia, asi que no habrian podido rechazar nada.
  4. **Un criterio que rechaza tiene que poder traducirse a la unidad que juzga un humano.**
     `nivel=DURO` sin `a_humano` es SinTraduccion. Ese fue el error del SF 1,5: el numero
     era correcto como numero y absurdo como vida util, y nadie hizo la cuenta.
  5. Un parametro `Origen.HEREDADO` (copiado de otro informe) nunca es DURO hasta que se
     recalcula contra la geometria propia: `.recalculado(nuevo, fuente=...)`.

USO

    from cadlib.criterios import Criterio, Nivel, Origen, kpa_a_gramos

    ESPESOR_MIN = Criterio(
        "espesor_min_imprimible", 1.2, "mm", sentido="min",
        decide="por debajo de esto la lamina no se puede imprimir con paredes solidas",
        origen=Origen.CATALOGO, nivel=Nivel.DURO,
        fuente="3 perimetros de boquilla 0,40 mm = 1,20 (boquilla real de la impresora)",
        a_humano=lambda v, ctx: "%.1f perimetros de boquilla 0,40" % (v / 0.40),
        ref="viga_voladizo.py:63")

    v = ESPESOR_MIN.evaluar(1.05)
    print(v.texto)          # RECHAZA ... y por que, en perimetros

Correr `python -m cadlib.criterios` imprime la tabla del registro.
Prueba: `scripts/test_criterios.py` (incluye los casos que TIENEN que fallar).
"""
from __future__ import annotations

import math

__all__ = [
    "Criterio", "Veredicto", "Nivel", "Origen",
    "SinProcedencia", "ProcedenciaInsuficiente", "SinTraduccion", "FaltaContexto",
    "REGISTRO", "tabla", "los_que_rechazan",
    "basquin_b", "ciclos_para_sigma", "sf_a_ciclos", "kpa_a_gramos", "ctx_req",
]


# --------------------------------------------------------------------------- errores
class SinProcedencia(Exception):
    """Se intento USAR un criterio cuya fuente esta vacia o es un placeholder."""


class ProcedenciaInsuficiente(Exception):
    """Se declaro un criterio DURO (puede rechazar) con un origen que no lo habilita."""


class SinTraduccion(Exception):
    """Se declaro un criterio DURO sin forma de traducirlo a unidades humanas."""


class FaltaContexto(Exception):
    """La traduccion a unidades humanas necesita un dato que no se paso."""


# --------------------------------------------------------------------------- enums
class Origen:
    """De donde sale el numero. No es decorativo: decide si puede rechazar."""
    FORMULA = "formula"      # sale de una cuenta que esta escrita y se puede rehacer
    NORMA = "norma"          # ISO/VDA/IATF/norma de cliente, con su codigo
    MEDICION = "medicion"    # medido sobre el STEP/la pieza/el instrumento
    ENSAYO = "ensayo"        # curva S-N, probeta, ensayo propio o publicado
    CATALOGO = "catalogo"    # hoja de datos: boquilla, material, inserto
    FAK = "fak"              # se lo dijo Fak (o el cliente). Es dato duro.
    HEREDADO = "heredado"    # copiado de otro informe: NO vale hasta recalcularlo
    A_OJO = "a_ojo"          # honesto: no hay respaldo. Solo puede avisar.


HABILITAN_RECHAZO = frozenset({
    Origen.FORMULA, Origen.NORMA, Origen.MEDICION,
    Origen.ENSAYO, Origen.CATALOGO, Origen.FAK,
})


class Nivel:
    DURO = "duro"    # puede RECHAZAR un diseno
    AVISO = "aviso"  # solo imprime y sigue


SENTIDOS = ("max", "min")

# Textos que la gente escribe cuando no tiene la fuente. La lista es corta a proposito:
# el filtro que hace el trabajo es el de abajo (una procedencia real cita un numero).
_PLACEHOLDERS = frozenset({
    "", "-", "--", "?", "??", "tbd", "n/a", "na", "none", "ver", "xxx", "todo",
    "a ojo", "por ahora", "provisorio", "asumido", "estimado", "tipico", "default",
    "criterio de diseno", "buena practica", "experiencia",
})


def _procedencia_valida(fuente, origen):
    """(ok, motivo). Una procedencia real cita un NUMERO, una NORMA o a una PERSONA.

    El chequeo es deliberadamente crudo: su trabajo es cazar el campo vacio y el "TBD",
    no juzgar la prosa. Lo que de verdad frena el numero puesto a ojo es la regla de que
    solo ciertos `origen` habilitan el rechazo.
    """
    if fuente is None:
        return False, "fuente es None"
    t = str(fuente).strip()
    if t.lower() in _PLACEHOLDERS:
        return False, "fuente placeholder (%r): eso no es una procedencia" % t
    if origen in (Origen.FAK, Origen.A_OJO):
        # "me lo dijo Fak" es dato duro y no necesita traer numeros. Y A_OJO ya declara
        # que NO hay respaldo: lo que se le exige es que diga por que, no que invente una
        # cita. Igual pasa por el filtro de placeholders: "a ojo" a secas no alcanza.
        return True, ""
    if not any(c.isdigit() for c in t):
        return False, ("la fuente no cita ningun numero, norma ni medicion: %r. "
                       "Una procedencia real dice CUANTO y DE DONDE (si genuinamente no "
                       "hay respaldo, va Origen.A_OJO)." % t)
    return True, ""


# --------------------------------------------------------------------------- veredicto
class Veredicto(object):
    """Resultado de evaluar un criterio contra un valor medido."""

    __slots__ = ("criterio", "medido", "cumple", "rechaza", "texto", "en_humano")

    def __init__(self, criterio, medido, cumple, rechaza, texto, en_humano):
        self.criterio = criterio
        self.medido = medido
        self.cumple = cumple
        self.rechaza = rechaza
        self.texto = texto
        self.en_humano = en_humano

    def __bool__(self):
        """bool(veredicto) = "se puede seguir". Un AVISO no frena nada."""
        return not self.rechaza

    def __repr__(self):
        return "<Veredicto %s %s>" % (self.criterio.nombre,
                                      "RECHAZA" if self.rechaza else
                                      ("OK" if self.cumple else "AVISO"))


# --------------------------------------------------------------------------- criterio
REGISTRO = {}


class Criterio(object):
    """Una constante que participa de una decision, con su procedencia obligatoria."""

    def __init__(self, nombre, valor, unidad, decide, origen, *,
                 fuente, sentido="max", nivel=Nivel.AVISO, a_humano=None,
                 ref=None, recalcular=None):
        if sentido not in SENTIDOS:
            raise ValueError("sentido tiene que ser uno de %s (recibio %r)"
                             % (SENTIDOS, sentido))
        if nivel not in (Nivel.DURO, Nivel.AVISO):
            raise ValueError("nivel invalido: %r" % (nivel,))
        if not decide or not str(decide).strip():
            raise ValueError("'%s': falta `decide` - que decision toma este numero" % nombre)

        self.nombre = nombre
        self._valor = float(valor)
        self.unidad = unidad
        self.decide = str(decide).strip()
        self.origen = origen
        self.fuente = fuente
        self.sentido = sentido
        self.a_humano = a_humano
        self.ref = ref
        self.recalcular = recalcular

        ok, motivo = _procedencia_valida(fuente, origen)
        self._veneno = None if ok else motivo

        # --- las dos reglas que desactivan los incidentes reales ---
        if nivel == Nivel.DURO:
            if origen not in HABILITAN_RECHAZO:
                raise ProcedenciaInsuficiente(
                    "'%s' se declara DURO (puede RECHAZAR un diseno) con origen '%s'.\n"
                    "  Un numero sin respaldo no rechaza nada: el tope de precarga 0,90 mm "
                    "tiro 87 geometrias\n"
                    "  y no tenia nada fisico detras. Opciones: (a) conseguir la procedencia "
                    "y poner el origen\n"
                    "  que corresponda, o (b) dejarlo en Nivel.AVISO con Origen.A_OJO, que es "
                    "honesto y no frena." % (nombre, origen))
            if a_humano is None:
                raise SinTraduccion(
                    "'%s' se declara DURO sin `a_humano`.\n"
                    "  Un criterio que rechaza tiene que poder decirse en la unidad que juzga "
                    "un humano.\n"
                    "  'SF fatiga >= 1,5' era correcto como numero y le pedia 163 veces la vida "
                    "especificada\n"
                    "  a un utillaje impreso - y eso no lo vio nadie porque nunca se tradujo."
                    % nombre)
            if self._veneno:
                raise SinProcedencia("'%s' se declara DURO pero %s" % (nombre, self._veneno))
        if origen == Origen.HEREDADO and recalcular is None:
            raise ValueError(
                "'%s' viene HEREDADO de otro informe: hace falta `recalcular` (como se "
                "rehace la cuenta contra la geometria propia).\n"
                "  Un parametro heredado que gobierna el tamano y no se recalcula es el "
                "fallo del 2026-08-07 (k=7,5 N/mm que la formula daba 2,49)." % nombre)

        self.nivel = nivel
        REGISTRO[nombre] = self

    # ---- acceso al numero: aca revienta el criterio sin procedencia ----
    def _exigir_procedencia(self):
        if self._veneno:
            raise SinProcedencia(
                "El criterio '%s' (%s %s) no se puede usar: %s\n"
                "  Decide: %s\n"
                "  Escribi de donde sale el numero (formula, norma, medicion, ensayo, "
                "catalogo o 'me lo dijo Fak'),\n"
                "  o declaralo con Origen.A_OJO y Nivel.AVISO si genuinamente no hay "
                "respaldo." % (self.nombre, self._valor, self.unidad, self._veneno,
                               self.decide))

    @property
    def valor(self):
        self._exigir_procedencia()
        return self._valor

    def __float__(self):
        return self.valor

    @property
    def envenenado(self):
        return self._veneno is not None

    @property
    def puede_rechazar(self):
        return self.nivel == Nivel.DURO and not self.envenenado

    # ---- traduccion a la unidad que juzga un humano ----
    def en_humano(self, **ctx):
        if self.a_humano is None:
            return "(sin traduccion humana)"
        return self.a_humano(self._valor, ctx)

    # ---- evaluar ----
    def evaluar(self, medido, **ctx):
        v = self.valor          # revienta si no tiene procedencia
        medido = float(medido)
        cumple = medido <= v if self.sentido == "max" else medido >= v
        rechaza = (not cumple) and self.puede_rechazar
        cmp_ = "<=" if self.sentido == "max" else ">="
        if cumple:
            cab = "OK"
        elif rechaza:
            cab = "RECHAZA"
        else:
            cab = "AVISO (origen '%s': no habilita rechazo)" % self.origen
        hum = self.en_humano(**ctx)
        texto = ("[%s] %s: medido %g %s, criterio %s %g %s\n"
                 "        decide  : %s\n"
                 "        fuente  : %s (%s%s)\n"
                 "        en humano: %s"
                 % (cab, self.nombre, medido, self.unidad, cmp_, v, self.unidad,
                    self.decide, self.fuente, self.origen,
                    ", %s" % self.ref if self.ref else "", hum))
        return Veredicto(self, medido, cumple, rechaza, texto, hum)

    # ---- parametro heredado: no vale hasta rehacer la cuenta ----
    def recalculado(self, valor, *, fuente, origen=Origen.FORMULA, nivel=None,
                    nombre=None):
        """Devuelve un criterio NUEVO con el valor rehecho contra la geometria propia."""
        return Criterio(nombre or (self.nombre + "_recalc"), valor, self.unidad,
                        self.decide, origen, fuente=fuente, sentido=self.sentido,
                        nivel=nivel or self.nivel, a_humano=self.a_humano,
                        ref=self.ref, recalcular=None)

    def explicar(self, **ctx):
        return ("%-26s %10.4f %-8s  %-5s  %s\n"
                "    decide   : %s\n"
                "    fuente   : %s\n"
                "    en humano: %s%s"
                % (self.nombre, self._valor, self.unidad, self.nivel,
                   "PUEDE RECHAZAR" if self.puede_rechazar else "solo avisa",
                   self.decide, self.fuente,
                   "SIN PROCEDENCIA -> %s" % self._veneno if self.envenenado
                   else self.en_humano(**ctx),
                   "\n    ref      : %s" % self.ref if self.ref else ""))


# --------------------------------------------------------------------------- registro
def los_que_rechazan():
    """Los criterios que hoy pueden tirar un diseno. Es la lista corta que hay que mirar."""
    return [c for c in REGISTRO.values() if c.puede_rechazar]


def tabla(**ctx):
    out = ["%-26s %10s %-8s %-6s %-9s %s"
           % ("criterio", "valor", "unidad", "nivel", "origen", "puede rechazar"),
           "-" * 88]
    for c in sorted(REGISTRO.values(), key=lambda x: (not x.puede_rechazar, x.nombre)):
        out.append("%-26s %10.4f %-8s %-6s %-9s %s"
                   % (c.nombre, c._valor, c.unidad, c.nivel, c.origen,
                      "SI" if c.puede_rechazar else
                      ("no (SIN PROCEDENCIA)" if c.envenenado else "no")))
    return "\n".join(out)


# --------------------------------------------------------------------------- traductores
def ctx_req(ctx, clave, para):
    """Saca un dato del contexto o explica que falta. NUNCA inventa un default."""
    if clave not in ctx or ctx[clave] is None:
        raise FaltaContexto(
            "para traducir %s hace falta '%s', y no se paso.\n"
            "  No hay default: poner un numero inventado aca es exactamente el error que "
            "este modulo evita." % (para, clave))
    return ctx[clave]


def basquin_b(s_1ciclo, s_ref, n_ref):
    """Exponente b de la curva S = A.N^-b a partir de dos puntos (N=1 y N=n_ref)."""
    if not (s_1ciclo > 0 and s_ref > 0 and n_ref > 1):
        raise ValueError("curva S-N invalida: s1=%s sref=%s nref=%s"
                         % (s_1ciclo, s_ref, n_ref))
    return math.log(s_1ciclo / s_ref) / math.log(n_ref)


def ciclos_para_sigma(sigma, s_1ciclo, s_ref, n_ref):
    """Ciclos de vida a la tension `sigma`, con la S-N que pasa por (1, s_1ciclo) y
    (n_ref, s_ref)."""
    b = basquin_b(s_1ciclo, s_ref, n_ref)
    return (s_1ciclo / float(sigma)) ** (1.0 / b)


def sf_a_ciclos(sf, s_1ciclo, s_ref, n_ref):
    """Un factor de seguridad contra el limite de fatiga -> cuantos ciclos esta pidiendo.

    Es la cuenta que no se hizo nunca con el 'SF >= 1,5'.
    """
    if sf <= 0:
        raise ValueError("SF tiene que ser > 0")
    return ciclos_para_sigma(s_ref / float(sf), s_1ciclo, s_ref, n_ref)


def kpa_a_gramos(p_kpa, area_mm2):
    """Presion [kPa] sobre un area [mm2] -> fuerza en gramos-fuerza (lo que se pesa)."""
    newtons = float(p_kpa) * 1e-3 * float(area_mm2)   # 1 kPa = 1e-3 N/mm2
    return newtons / 9.80665 * 1000.0


if __name__ == "__main__":       # pragma: no cover
    print(tabla())
