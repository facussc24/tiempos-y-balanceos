/**
 * `_abrir.mjs` da OK solo si una ventana nombra al archivo. Casos de titulos reales de Windows:
 * el visor de fotos pone el nombre con extension, Excel sin extension, y los titulos largos se
 * cortan con "...".
 */
import { describe, it, expect } from 'vitest';
import { tituloCoincide, esCarpetaTemporal } from '../../scripts/_abrir.mjs';

describe('tituloCoincide', () => {
    it.each([
        ['prueba_abrir_claude.png', 'C:/x/prueba_abrir_claude.png'],          // Photos (22/09/2026, en vivo)
        ['Listado hojas de proceso - Excel', 'Y:/3- LISTADO/Listado hojas de proceso.xlsx'],
        ['AMFE 173 P21 hilo naranja MY2026 Rev.A.pdf - Adobe Acrobat', 'C:/x/AMFE 173 P21 hilo naranja MY2026 Rev.A.pdf'],
        ['Flujograma 159 APB P21 hilo naranja MY20... - Word', 'C:/x/Flujograma 159 APB P21 hilo naranja MY2026 Rev.A.docx'],
    ])('VERDE: "%s" nombra a %s', (titulo, ruta) => {
        expect(tituloCoincide(titulo, ruta)).toBe(true);
    });

    it.each([
        ['Bandeja de entrada - Outlook', 'C:/x/informe.pdf'],
        ['', 'C:/x/informe.pdf'],
        ['informe_viejo.pdf - Adobe Acrobat', 'C:/x/informe_nuevo.pdf'],
    ])('ROJO: "%s" no es %s', (titulo, ruta) => {
        expect(tituloCoincide(titulo, ruta)).toBe(false);
    });
});

describe('esCarpetaTemporal', () => {
    it('el scratchpad y Temp son temporales; la carpeta de trabajo no', () => {
        expect(esCarpetaTemporal('C:\\Users\\FACUND~1\\AppData\\Local\\Temp\\claude\\x\\scratchpad\\a.pdf')).toBe(true);
        expect(esCarpetaTemporal('C:/Users/F/AppData/Local/Temp/a.pdf')).toBe(true);
        expect(esCarpetaTemporal('C:\\Users\\F\\BARACK ARGENTINA SRL\\Ingenieria\\a.pdf')).toBe(false);
    });
});
