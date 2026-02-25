/**
 * PFD Symbol Picker — Dropdown selector for step type symbols
 *
 * C3-U2: Added keyboard navigation (ArrowUp/Down, Enter, Escape)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PfdSymbol } from './PfdSymbols';
import { PFD_STEP_TYPES, PfdStepType } from './pfdTypes';

interface Props {
  value: PfdStepType;
  onChange: (value: PfdStepType) => void;
  disabled?: boolean;
}

const PfdSymbolPicker: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
    setFocusedIndex(PFD_STEP_TYPES.findIndex(t => t.value === value));
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, PFD_STEP_TYPES.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < PFD_STEP_TYPES.length) {
          onChange(PFD_STEP_TYPES[focusedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [disabled, isOpen, focusedIndex, onChange, openDropdown]);

  const currentType = PFD_STEP_TYPES.find(t => t.value === value);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="flex items-center justify-center w-10 h-8 rounded border border-gray-300 hover:border-cyan-400 hover:bg-cyan-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        title={currentType?.label || value}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <PfdSymbol type={value} size={20} />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
          aria-activedescendant={focusedIndex >= 0 ? `pfd-symbol-option-${focusedIndex}` : undefined}
        >
          {PFD_STEP_TYPES.map((st, idx) => (
            <li key={st.value}>
              <button
                type="button"
                id={`pfd-symbol-option-${idx}`}
                role="option"
                aria-selected={st.value === value}
                onClick={() => { onChange(st.value); setIsOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-cyan-50 transition ${
                  st.value === value ? 'bg-cyan-100 font-medium' : ''
                } ${idx === focusedIndex ? 'ring-2 ring-inset ring-cyan-400' : ''}`}
              >
                <PfdSymbol type={st.value} size={20} />
                <span>{st.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PfdSymbolPicker;
