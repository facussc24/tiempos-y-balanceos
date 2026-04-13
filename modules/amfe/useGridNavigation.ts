import { useEffect } from 'react';

/**
 * Hook para inyectar navegación de teclado tipo Excel (Flechas Direccionales)
 * en tablas de datos pesadas (AMFE, APQP, etc).
 * 
 * Permite moverse entre inputs y textareas usando ArrowUp, ArrowDown, 
 * y Shift+ArrowLeft, Shift+ArrowRight sin depender exclusivamente de Tab/Ratón.
 */
export function useGridNavigation(containerRef: React.RefObject<HTMLElement | null>) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Solo actuamos si el foco está en un input o textarea dentro de nuestra tabla
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
            
            const isTextarea = target.tagName === 'TEXTAREA';
            const valueLength = (target as HTMLInputElement | HTMLTextAreaElement).value.length;
            const cursorPosition = (target as HTMLInputElement | HTMLTextAreaElement).selectionStart ?? 0;
            const cursorEnd = (target as HTMLInputElement | HTMLTextAreaElement).selectionEnd ?? 0;

            const isArrowUp = e.key === 'ArrowUp';
            const isArrowDown = e.key === 'ArrowDown';
            const isArrowLeft = e.key === 'ArrowLeft';
            const isArrowRight = e.key === 'ArrowRight';

            // Navigation trigger logic
            let shouldNavigate = false;

            if (isArrowUp || isArrowDown) {
                // En inputs, siempre navegamos arriba/abajo
                // En textareas, evitamos navegar si el usuario usa flechas para moverse entre líneas de texto,
                // a menos que no haya texto, o mantenga presionado Shift.
                if (!isTextarea || e.shiftKey) {
                    shouldNavigate = true;
                }
            } else if (isArrowLeft || isArrowRight) {
                // Para izquierda/derecha, requerimos Shift+Flecha o que el cursor esté al extremo
                if (e.shiftKey) {
                    shouldNavigate = true;
                } else if (isArrowLeft && cursorPosition === 0 && cursorEnd === 0) {
                    shouldNavigate = true;
                } else if (isArrowRight && cursorPosition === valueLength && cursorEnd === valueLength) {
                    shouldNavigate = true;
                }
            }

            if (!shouldNavigate) return;

            // Recopilar todos las celdas interactivas
            const interactables = Array.from(
                container.querySelectorAll('input:not([type="hidden"]), textarea, select')
            ) as HTMLElement[];

            const currentIndex = interactables.indexOf(target);
            if (currentIndex === -1) return;

            e.preventDefault();

            let nextTarget: HTMLElement | undefined;

            if (isArrowLeft) {
                nextTarget = interactables[currentIndex - 1];
            } else if (isArrowRight) {
                nextTarget = interactables[currentIndex + 1];
            } else if (isArrowUp || isArrowDown) {
                // Navegación vertical: requiere matemática de cajas para encontrar la grilla más cercana
                const targetRect = target.getBoundingClientRect();
                const targetX = targetRect.left + (targetRect.width / 2);
                
                // Buscar candidatos en dirección vertical
                const candidates = interactables.filter(el => {
                    if (el === target) return false;
                    const elRect = el.getBoundingClientRect();
                    // Checking if they share roughly the same column horizontally
                    const isSameCol = Math.abs((elRect.left + elRect.width / 2) - targetX) < (targetRect.width / 2 + 20); // Tolerance 20px
                    
                    if (!isSameCol) return false;

                    if (isArrowUp) {
                        return elRect.bottom <= targetRect.top;
                    } else {
                        return elRect.top >= targetRect.bottom;
                    }
                });

                if (candidates.length > 0) {
                    // Ordenar por cercanía Y
                    candidates.sort((a, b) => {
                        const aRect = a.getBoundingClientRect();
                        const bRect = b.getBoundingClientRect();
                        if (isArrowUp) {
                            return bRect.bottom - aRect.bottom;
                        } else {
                            return aRect.top - bRect.top;
                        }
                    });
                    nextTarget = candidates[0];
                }
            }

            if (nextTarget) {
                nextTarget.focus();
                // Si es input/textarea, mover cursor al final para UX amigable
                if (nextTarget.tagName === 'INPUT' || nextTarget.tagName === 'TEXTAREA') {
                    const el = nextTarget as HTMLInputElement;
                    el.selectionStart = el.value.length;
                    el.selectionEnd = el.value.length;
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [containerRef]);
}
