/**
 * DbHealthBanner — el aviso global de "no pude leer la base".
 *
 * Contrato: aparece cuando dbHealth registra un error de lectura, se puede
 * descartar, un error NUEVO lo vuelve a mostrar, y una lectura exitosa lo
 * limpia solo.
 */
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { DbHealthBanner } from '../../components/ui/DbHealthBanner';
import { reportDbReadError, clearDbReadError } from '../../utils/dbHealth';

describe('DbHealthBanner', () => {
    beforeEach(() => {
        clearDbReadError();
    });

    afterEach(() => {
        clearDbReadError();
    });

    it('no muestra nada si no hay error', () => {
        render(<DbHealthBanner />);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('aparece cuando una lectura falla, con el detalle del error', () => {
        render(<DbHealthBanner />);
        act(() => {
            reportDbReadError('permission denied for table cp_documents');
        });
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain('No se pudo leer la base de datos');
        expect(alert.textContent).toContain('permission denied for table cp_documents');
    });

    it('se descarta con la X, pero un error nuevo lo vuelve a mostrar', () => {
        render(<DbHealthBanner />);
        act(() => {
            reportDbReadError('timeout');
        });
        fireEvent.click(screen.getByLabelText('Descartar aviso'));
        expect(screen.queryByRole('alert')).toBeNull();

        act(() => {
            reportDbReadError('otro error distinto');
        });
        expect(screen.getByRole('alert').textContent).toContain('otro error distinto');
    });

    it('desaparece solo cuando una lectura vuelve a andar', () => {
        render(<DbHealthBanner />);
        act(() => {
            reportDbReadError('timeout');
        });
        expect(screen.getByRole('alert')).toBeDefined();

        act(() => {
            clearDbReadError();
        });
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
