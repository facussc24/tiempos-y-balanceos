import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Mock component to test the hook
const TestModal = ({ isOpen }: { isOpen: boolean }) => {
    const trapRef = useFocusTrap(isOpen);

    if (!isOpen) return null;

    return (
        <div ref={trapRef}>
            <button id="btn1">Button 1</button>
            <input id="input1" />
            <button id="btn2">Button 2</button>
        </div>
    );
};

describe('useFocusTrap', () => {
    let container: HTMLDivElement | null = null;
    let root: any = null;

    afterEach(() => {
        if (root) {
            // Unmount carefully
            flushSync(() => root.unmount());
        }
        if (container) {
            container.remove();
        }
        container = null;
        root = null;
    });

    it('should set initial focus to the first focusable element', async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        flushSync(() => {
            root.render(<TestModal isOpen={true} />);
        });

        // Wait for requestAnimationFrame in the hook
        await new Promise(resolve => setTimeout(resolve, 50));

        const btn1 = document.getElementById('btn1');
        expect(document.activeElement).toBe(btn1);
    });

    it('should cycle focus to start when tabbing from last element', async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        flushSync(() => {
            root.render(<TestModal isOpen={true} />);
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        const btn2 = document.getElementById('btn2');
        const btn1 = document.getElementById('btn1');

        // Set focus to last element
        btn2?.focus();
        expect(document.activeElement).toBe(btn2);

        // Simulate Tab keydown on the CONTAINER (since the listener is attached to the ref element)
        // The listener is attached to the div wrapper.
        const wrapper = container.firstChild as HTMLElement;

        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            shiftKey: false,
            bubbles: true,
            cancelable: true
        });

        wrapper.dispatchEvent(event);

        expect(document.activeElement).toBe(btn1);
    });

    it('should cycle focus to end when shift-tabbing from first element', async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        flushSync(() => {
            root.render(<TestModal isOpen={true} />);
        });
        await new Promise(resolve => setTimeout(resolve, 50));

        const btn1 = document.getElementById('btn1');
        const btn2 = document.getElementById('btn2');

        // Set focus to first element
        btn1?.focus();
        expect(document.activeElement).toBe(btn1);

        // Simulate Shift+Tab
        const wrapper = container.firstChild as HTMLElement;
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        });

        wrapper.dispatchEvent(event);

        expect(document.activeElement).toBe(btn2);
    });
});
