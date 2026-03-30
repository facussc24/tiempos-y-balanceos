/**
 * Product catalog seed data.
 * Only includes products from the 8 active APQP families.
 * Cleaned: 2026-03-30
 */

export interface ProductSeed {
  codigo: string;
  descripcion: string;
  lineaCode: string;
  lineaName: string;
}

export interface CustomerLineSeed {
  code: string;
  name: string;
  productCount: number;
  isAutomotive: boolean;
}

export const CUSTOMER_LINES: CustomerLineSeed[] = [
  { code: "095", name: "VOLKSWAGEN", productCount: 15, isAutomotive: true },
  { code: "020", name: "PWA", productCount: 2, isAutomotive: true },
];

export const PRODUCTS: ProductSeed[] = [
  // ── Insert Patagonia ──────────────────────────────────────────────────────
  { codigo: "N 227", descripcion: "INSERT PTA. DEL. IZQ. TITAN BLACK", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 267", descripcion: "INSERT PTA. DEL. DER. TITAN BLACK", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 343", descripcion: "INSERT PTA. TRAS. IZQ. TITAN BLACK", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 403", descripcion: "INSERT PTA. TRAS. DER. TITAN BLACK", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Armrest Door Panel Patagonia ───────────────────────────────────────────
  { codigo: "N 231", descripcion: "ARMREST DOOR PANEL PATAGONIA", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Top Roll Patagonia ─────────────────────────────────────────────────────
  { codigo: "N 216", descripcion: "TOP ROLL PTA. DEL. IZQ.", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 256", descripcion: "TOP ROLL PTA. DEL. DER.", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 285", descripcion: "TOP ROLL PTA. TRAS. IZQ.", lineaCode: "095", lineaName: "VOLKSWAGEN" },
  { codigo: "N 315", descripcion: "TOP ROLL PTA. TRAS. DER.", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Headrest Front Patagonia ───────────────────────────────────────────────
  { codigo: "2GJ881901A-ICE", descripcion: "APC DELANTERO PATAGONIA", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Headrest Rear Center Patagonia ─────────────────────────────────────────
  { codigo: "2GJ885900A-ICE", descripcion: "APC TRASERO CENTRAL PATAGONIA", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Headrest Rear Outer Patagonia ──────────────────────────────────────────
  { codigo: "2GJ885901A-ICE", descripcion: "APC TRASERO LATERAL PATAGONIA", lineaCode: "095", lineaName: "VOLKSWAGEN" },

  // ── Telas Planas PWA (HILUX 581D) ─────────────────────────────────────────
  { codigo: "21-9463", descripcion: "TELA PLANA HILUX", lineaCode: "020", lineaName: "PWA" },

  // ── Telas Termoformadas PWA (HILUX 582D) ───────────────────────────────────
  { codigo: "21-9640", descripcion: "TELA TERMOFORMADA HILUX", lineaCode: "020", lineaName: "PWA" },
];
