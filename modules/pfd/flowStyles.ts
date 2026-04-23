/**
 * CSS for standalone PFD HTML export.
 * Provides all Tailwind utility classes used in the flow components
 * so the standalone HTML renders correctly without a Tailwind build step.
 */
export const FLOW_CSS = `
/* ─── Reset ─── */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Inter, Arial, Helvetica, sans-serif; background: white; }

/* ─── Layout: Flex ─── */
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-1 { flex: 1 1 0%; }
.items-center { align-items: center; }
.items-stretch { align-items: stretch; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.shrink-0 { flex-shrink: 0; }

/* ─── Layout: Grid ─── */
.inline-grid { display: inline-grid; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-cols-\\[1fr_2fr_1fr\\] { grid-template-columns: 1fr 2fr 1fr; }
.grid-rows-\\[repeat\\(11\\,1fr\\)\\] { grid-template-rows: repeat(11, 1fr); }
.col-span-1 { grid-column: span 1 / span 1; }
.col-span-2 { grid-column: span 2 / span 2; }

/* ─── Spacing: Padding ─── */
.p-1\\.5 { padding: 0.375rem; }
.p-2 { padding: 0.5rem; }
.p-2\\.5 { padding: 0.625rem; }
.p-3 { padding: 0.75rem; }
.p-4 { padding: 1rem; }
.px-1\\.5 { padding-left: 0.375rem; padding-right: 0.375rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
.px-8 { padding-left: 2rem; padding-right: 2rem; }
.px-12 { padding-left: 3rem; padding-right: 3rem; }
.py-\\[3px\\] { padding-top: 3px; padding-bottom: 3px; }
.py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
.py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.pt-8 { padding-top: 2rem; }
.pt-10 { padding-top: 2.5rem; }
.pb-1 { padding-bottom: 0.25rem; }
.pb-2 { padding-bottom: 0.5rem; }
.pb-4 { padding-bottom: 1rem; }
.pb-8 { padding-bottom: 2rem; }
.pb-16 { padding-bottom: 4rem; }
.pl-6 { padding-left: 1.5rem; }
.pr-6 { padding-right: 1.5rem; }

/* ─── Spacing: Margin ─── */
.mx-5 { margin-left: 1.25rem; margin-right: 1.25rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
.mb-0\\.5 { margin-bottom: 0.125rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-8 { margin-bottom: 2rem; }
.mb-10 { margin-bottom: 2.5rem; }
.mr-2 { margin-right: 0.5rem; }
.mr-8 { margin-right: 2rem; }
.mr-10 { margin-right: 2.5rem; }
.ml-1 { margin-left: 0.25rem; }
.ml-2 { margin-left: 0.5rem; }
.ml-10 { margin-left: 2.5rem; }
.ml-20 { margin-left: 5rem; }
.mt-0\\.5 { margin-top: 0.125rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-6 { margin-top: 1.5rem; }
.mt-8 { margin-top: 2rem; }
.mt-px { margin-top: 1px; }
.mt-\\[-2px\\] { margin-top: -2px; }
.-mb-6 { margin-bottom: -1.5rem; }
.-mt-5 { margin-top: -1.25rem; }
.-mt-6 { margin-top: -1.5rem; }
.-mt-\\[50px\\] { margin-top: -50px; }
.-mt-\\[70px\\] { margin-top: -70px; }
.-top-4 { top: -1rem; }
.-top-3\\.5 { top: -0.875rem; }
.-top-3 { top: -0.75rem; }
.-bottom-10 { bottom: -2.5rem; }
.p-1 { padding: 0.25rem; }
.px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
.left-2 { left: 0.5rem; }
.left-6 { left: 1.5rem; }
.left-\\[-4\\.5px\\] { left: -4.5px; }
.left-\\[-5px\\] { left: -5px; }
.left-\\[50\\%\\] { left: 50%; }
.translate-x-\\[1px\\] { --tw-translate-x: 1px; transform: translateX(1px); }
.top-\\[60\\%\\] { top: 60%; }
.-translate-x-1\\/2 { --tw-translate-x: -50%; transform: translateX(-50%); }
.-rotate-45 { --tw-rotate: -45deg; transform: rotate(-45deg); }
.-z-10 { z-index: -10; }

/* ─── Spacing: Gap ─── */
.gap-0\\.5 { gap: 0.125rem; }
.gap-1 { gap: 0.25rem; }
.gap-1\\.5 { gap: 0.375rem; }
.gap-2 { gap: 0.5rem; }
.gap-8 { gap: 2rem; }
.space-x-2 > * + * { margin-left: 0.5rem; }

/* ─── Sizing: Width ─── */
.w-7 { width: 1.75rem; }
.w-8 { width: 2rem; }
.w-10 { width: 2.5rem; }
.w-12 { width: 3rem; }
.w-14 { width: 3.5rem; }
.w-16 { width: 4rem; }
.w-20 { width: 5rem; }
.w-full { width: 100%; }
.w-\\[50px\\] { width: 50px; }
.w-\\[60px\\] { width: 60px; }
.w-\\[70px\\] { width: 70px; }
.w-\\[90px\\] { width: 90px; }
.w-\\[100px\\] { width: 100px; }
.w-\\[200px\\] { width: 200px; }
.w-\\[280px\\] { width: 280px; }
.w-\\[320px\\] { width: 320px; }
.w-\\[420px\\] { width: 420px; }
.w-\\[500px\\] { width: 500px; }
.w-\\[600px\\] { width: 600px; }
.w-\\[1\\.5px\\] { width: 1.5px; }
.w-1\\.5 { width: 0.375rem; }
.w-2 { width: 0.5rem; }
.w-32 { width: 8rem; }

/* ─── Sizing: Height ─── */
.h-4 { height: 1rem; }
.h-7 { height: 1.75rem; }
.h-8 { height: 2rem; }
.h-10 { height: 2.5rem; }
.h-12 { height: 3rem; }
.h-\\[1\\.5px\\] { height: 1.5px; }
.h-\\[2px\\] { height: 2px; }
.h-1\\.5 { height: 0.375rem; }
.h-2 { height: 0.5rem; }
.h-\\[100px\\] { height: 100px; }
.h-\\[140px\\] { height: 140px; }
.h-full { height: 100%; }

/* ─── Sizing: Min/Max ─── */
.min-h-screen { min-height: 100vh; }
.min-h-\\[42px\\] { min-height: 42px; }
.min-w-0 { min-width: 0px; }
.min-w-\\[140px\\] { min-width: 140px; }
.min-w-\\[180px\\] { min-width: 180px; }
.min-w-\\[400px\\] { min-width: 400px; }
.min-w-fit { min-width: fit-content; }
.max-w-4xl { max-width: 56rem; }
.max-w-\\[100px\\] { max-width: 100px; }
.max-w-\\[120px\\] { max-width: 120px; }
.max-w-\\[140px\\] { max-width: 140px; }
.max-w-\\[180px\\] { max-width: 180px; }
.max-w-\\[280px\\] { max-width: 280px; }
.max-w-\\[1400px\\] { max-width: 1400px; }
.max-h-\\[60px\\] { max-height: 60px; }
.max-h-\\[80px\\] { max-height: 80px; }

/* ─── Borders ─── */
.border { border-width: 1px; border-style: solid; }
.border-b { border-bottom-width: 1px; border-bottom-style: solid; }
.border-r-\\[1\\.5px\\] { border-right-width: 1.5px; border-right-style: solid; }
.border-t-\\[1\\.5px\\] { border-top-width: 1.5px; border-top-style: solid; }
.border-l-\\[1\\.5px\\] { border-left-width: 1.5px; border-left-style: solid; }
.border-b-\\[1\\.5px\\] { border-bottom-width: 1.5px; border-bottom-style: solid; }
.border-t-\\[2px\\] { border-top-width: 2px; border-top-style: solid; }
.border-l-\\[2px\\] { border-left-width: 2px; border-left-style: solid; }
.border-b-\\[2px\\] { border-bottom-width: 2px; border-bottom-style: solid; }
.border-r-\\[2px\\] { border-right-width: 2px; border-right-style: solid; }
.border-\\[1\\.5px\\] { border-width: 1.5px; border-style: solid; }
.border-\\[\\#60A5FA\\] { border-color: #60A5FA; }
.border-\\[\\#93C5FD\\] { border-color: #93C5FD; }
.border-red-200 { border-color: #FECACA; }
.border-red-400 { border-color: #F87171; }
.border-gray-200 { border-color: #E5E7EB; }

/* ─── Border Radius ─── */
.rounded { border-radius: 0.25rem; }
.rounded-sm { border-radius: 0.125rem; }
.rounded-md { border-radius: 0.375rem; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.rounded-full { border-radius: 9999px; }
.rounded-\\[50\\%\\] { border-radius: 50%; }
.rounded-bl-xl { border-bottom-left-radius: 0.75rem; }

/* ─── Background ─── */
.bg-white { background-color: white; }
.bg-white\\/80 { background-color: rgba(255, 255, 255, 0.8); }
.bg-white\\/90 { background-color: rgba(255, 255, 255, 0.9); }
.bg-gray-50 { background-color: #F9FAFB; }
.bg-red-50 { background-color: #FEF2F2; }
.bg-\\[\\#F3F4F6\\] { background-color: #F3F4F6; }
.bg-\\[\\#60A5FA\\] { background-color: #60A5FA; }
.bg-\\[\\#93C5FD\\] { background-color: #93C5FD; }

/* ─── Text Color ─── */
.text-gray-400 { color: #9CA3AF; }
.text-gray-500 { color: #6B7280; }
.text-gray-600 { color: #4B5563; }
.text-gray-900 { color: #111827; }
.text-red-600 { color: #DC2626; }
.text-\\[\\#1E3A8A\\] { color: #1E3A8A; }
.text-\\[\\#1E40AF\\] { color: #1E40AF; }
.text-\\[\\#60A5FA\\] { color: #60A5FA; }
.text-\\[\\#4b5563\\] { color: #4b5563; }

/* ─── Typography: Font Size ─── */
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-\\[6px\\] { font-size: 6px; }
.text-\\[7px\\] { font-size: 7px; }
.text-\\[8px\\] { font-size: 8px; }
.text-\\[8\\.5px\\] { font-size: 8.5px; }
.text-\\[9px\\] { font-size: 9px; }
.text-\\[10px\\] { font-size: 10px; }
.text-\\[11px\\] { font-size: 11px; }

/* ─── Typography: Font Weight ─── */
.font-light { font-weight: 300; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.font-black { font-weight: 900; }

/* ─── Typography: Font Family ─── */
.font-sans { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; }
.font-serif { font-family: ui-serif, Georgia, Cambria, serif; }

/* ─── Typography: Style & Transform ─── */
.uppercase { text-transform: uppercase; }
.italic { font-style: italic; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.whitespace-nowrap { white-space: nowrap; }
.text-center { text-align: center; }
.text-left { text-align: left; }
.leading-none { line-height: 1; }
.leading-snug { line-height: 1.375; }
.leading-tight { line-height: 1.25; }
.leading-relaxed { line-height: 1.625; }
.tracking-tighter { letter-spacing: -0.05em; }
.tracking-widest { letter-spacing: 0.1em; }

/* ─── Positioning ─── */
.relative { position: relative; }
.absolute { position: absolute; }
.top-0 { top: 0; }
.top-full { top: 100%; }
.top-1\\/2 { top: 50%; }
.top-4 { top: 1rem; }
.bottom-0 { bottom: 0; }
.left-0 { left: 0; }
.left-1 { left: 0.25rem; }
.left-full { left: 100%; }
.left-1\\/2 { left: 50%; }
.right-0 { right: 0; }
.right-full { right: 100%; }
.right-4 { right: 1rem; }
.right-1\\/2 { right: 50%; }

/* ─── Z-Index ─── */
.z-0 { z-index: 0; }
.z-10 { z-index: 10; }
.z-20 { z-index: 20; }

/* ─── Transform ─── */
.transform { transform: translateX(var(--tw-translate-x, 0)) translateY(var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1)); }
.rotate-45 { --tw-rotate: 45deg; transform: rotate(45deg); }
.-translate-x-1\\/2 { --tw-translate-x: -50%; transform: translateX(-50%); }
.-translate-y-1\\/2 { --tw-translate-y: -50%; transform: translateY(-50%); }

/* ─── Overflow ─── */
.overflow-x-auto { overflow-x: auto; }

/* ─── Shadow ─── */
.shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }

/* ─── Object Fit ─── */
.object-contain { object-fit: contain; }

/* ─── Responsive ─── */
@media (min-width: 768px) {
  .md\\:p-8 { padding: 2rem; }
}

/* ─── Print ─── */
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .min-h-screen { min-height: auto; }
  .shadow-sm { box-shadow: none; }
}
`;

export function wrapInStandaloneHtml(markup: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diagrama de Flujo de Proceso</title>
<style>${FLOW_CSS}</style>
</head>
<body>
${markup}
</body>
</html>`;
}
