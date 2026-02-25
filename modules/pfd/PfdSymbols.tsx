/**
 * PFD Process Flow Symbols — ASME/AIAG standard symbology
 * Inline SVG components for the 7 step types.
 * Outlined style with light fill per ASME convention.
 */

import React from 'react';

interface SymbolProps {
  size?: number;
  className?: string;
}

/** Operation — Circle (adds value) */
export const OperationSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Operación">
    <circle cx="12" cy="12" r="10" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
  </svg>
);

/** Transport — Arrow (movement) */
export const TransportSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Transporte">
    <path d="M4 12h14M14 6l6 6-6 6" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Inspection — Square (verification) */
export const InspectionSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Inspección">
    <rect x="2" y="2" width="20" height="20" rx="1" fill="#ECFDF5" stroke="#10B981" strokeWidth="2" />
  </svg>
);

/** Storage — Inverted triangle (stored material) */
export const StorageSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Almacenamiento">
    <polygon points="12,22 2,4 22,4" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** Delay — D-shape (wait) */
export const DelaySymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Demora">
    <path d="M4 2h8a10 10 0 0 1 0 20H4V2z" fill="#FEF2F2" stroke="#EF4444" strokeWidth="2" />
  </svg>
);

/** Decision — Diamond (decision gate) */
export const DecisionSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Decisión">
    <polygon points="12,1 23,12 12,23 1,12" fill="#FAF5FF" stroke="#A855F7" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** Combined — Square with inner circle (operation + inspection) */
export const CombinedSymbol: React.FC<SymbolProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Op. + Inspección">
    <rect x="2" y="2" width="20" height="20" rx="1" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#10B981" strokeWidth="2" />
  </svg>
);

/** Symbol map for dynamic rendering */
const SYMBOL_MAP: Record<string, React.FC<SymbolProps>> = {
  operation: OperationSymbol,
  transport: TransportSymbol,
  inspection: InspectionSymbol,
  storage: StorageSymbol,
  delay: DelaySymbol,
  decision: DecisionSymbol,
  combined: CombinedSymbol,
};

/** Render the correct symbol for a given step type */
export const PfdSymbol: React.FC<SymbolProps & { type: string }> = ({ type, ...props }) => {
  const Component = SYMBOL_MAP[type];
  if (!Component) return null;
  return <Component {...props} />;
};
