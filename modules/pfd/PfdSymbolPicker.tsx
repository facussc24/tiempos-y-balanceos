/**
 * PFD Symbol Picker — Dropdown selector for step type symbols
 *
 * C3-U2: Added keyboard navigation (ArrowUp/Down, Enter, Escape)
 * C8-B4: Portal-based dropdown to escape sticky column stacking context
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // C8-B4: Click outside must check both the trigger and the portal dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current && !ref.current.contains(target) &&
        (!listRef.current || !listRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on scroll of any scrollable ancestor (dropdown position would be stale)
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);
    // Capture phase to catch scroll on any ancestor
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      item?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isOpen, focusedIndex]);

  const openDropdown = useCallback(() => {
    setFocusedIndex(PFD_STEP_TYPES.findIndex(t => t.value === value));
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // Check if dropdown would go off bottom of viewport
      const dropdownHeight = PFD_STEP_TYPES.length * 32 + 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= dropdownHeight
        ? rect.bottom + 2
        : rect.top - dropdownHeight - 2;
      setDropdownPos({ top: Math.max(4, top), left: rect.left });
    }
    setIsOpen(true);
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
        className={`flex items-center justify-center w-10 h-8 rounded border border-gray-300 transition ${disabled ? 'cursor-default' : 'hover:border-cyan-400 hover:bg-cyan-50'}`}
        title={currentType?.label || value}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <PfdSymbol type={value} size={20} />
      </button>

      {/* C8-B4: Render in portal to escape sticky column stacking context */}
      {isOpen && dropdownPos && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
          }}
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
        </ul>,
        document.body
      )}
    </div>
  );
};

export default PfdSymbolPicker;
