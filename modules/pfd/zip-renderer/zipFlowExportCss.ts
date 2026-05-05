/**
 * Additional CSS classes used by ZipFlowRenderer that aren't present in
 * flowStyles.ts. We keep this module separate so the export can wrap with
 * FLOW_CSS + ZIP_FLOW_EXPORT_CSS without polluting the legacy lanes-style
 * exports.
 *
 * No arbitrary Tailwind values reach html2canvas because every utility class
 * the zip renderer uses is hand-compiled here.
 */
export const ZIP_FLOW_EXPORT_CSS = `
/* ─── Layout helpers (zip-renderer specific) ─── */
.flex-wrap { flex-wrap: wrap; }
.h-full { height: 100%; }
.w-full { width: 100%; }
.h-12 { height: 3rem; }
.h-10 { height: 2.5rem; }
.h-8 { height: 2rem; }
.h-7 { height: 1.75rem; }
.w-7 { width: 1.75rem; }
.w-8 { width: 2rem; }
.w-10 { width: 2.5rem; }
.w-12 { width: 3rem; }
.w-14 { width: 3.5rem; }
.w-16 { width: 4rem; }
.w-20 { width: 5rem; }
.w-32 { width: 8rem; }
.h-3 { height: 0.75rem; }
.h-4 { height: 1rem; }
.h-2 { height: 0.5rem; }
.w-2 { width: 0.5rem; }
.w-1\\.5 { width: 0.375rem; }
.h-1\\.5 { height: 0.375rem; }
.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.space-x-2 > * + * { margin-left: 0.5rem; }
.min-w-fit { min-width: fit-content; }
.max-w-4xl { max-width: 56rem; }
.max-w-md { max-width: 28rem; }
.max-w-xs { max-width: 20rem; }
.max-w-\\[100px\\] { max-width: 100px; }
.max-w-\\[120px\\] { max-width: 120px; }
.max-w-\\[200px\\] { max-width: 200px; }
.max-w-\\[280px\\] { max-width: 280px; }
.min-w-\\[180px\\] { min-width: 180px; }
.min-w-\\[800px\\] { min-width: 800px; }

/* ─── Sizes (arbitrary px) ─── */
.w-\\[1\\.5px\\] { width: 1.5px; }
.h-\\[1\\.5px\\] { height: 1.5px; }
.w-\\[16px\\] { width: 16px; }
.w-\\[90px\\] { width: 90px; }
.w-\\[600px\\] { width: 600px; }
.w-\\[800px\\] { width: 800px; }
.h-\\[100px\\] { height: 100px; }

/* ─── Borders width (1.5px and 2px arbitrary) ─── */
.border-\\[1\\.5px\\] { border-width: 1.5px; border-style: solid; }
.border-\\[2px\\] { border-width: 2px; border-style: solid; }
.border-l-\\[1\\.5px\\] { border-left-width: 1.5px; border-left-style: solid; }
.border-r-\\[1\\.5px\\] { border-right-width: 1.5px; border-right-style: solid; }
.border-t-\\[1\\.5px\\] { border-top-width: 1.5px; border-top-style: solid; }
.border-b-\\[1\\.5px\\] { border-bottom-width: 1.5px; border-bottom-style: solid; }

/* ─── Border colors (zip palette) ─── */
.border-\\[\\#60A5FA\\] { border-color: #60A5FA; }
.border-\\[\\#93C5FD\\] { border-color: #93C5FD; }
.border-\\[\\#f87171\\] { border-color: #f87171; }
.border-\\[\\#fb923c\\] { border-color: #fb923c; }
.border-\\[\\#22c55e\\] { border-color: #22c55e; }
.border-\\[\\#f3f4f6\\] { border-color: #f3f4f6; }

/* ─── Background colors (zip palette) ─── */
.bg-\\[\\#fff7ed\\] { background-color: #fff7ed; }
.bg-\\[\\#f0fdf4\\] { background-color: #f0fdf4; }
.bg-\\[\\#f9fafb\\] { background-color: #f9fafb; }

/* ─── Text colors (zip palette) ─── */
.text-\\[\\#dc2626\\] { color: #dc2626; }
.text-\\[\\#ea580c\\] { color: #ea580c; }
.text-\\[\\#15803d\\] { color: #15803d; }
.text-\\[\\#9ca3af\\] { color: #9ca3af; }
.text-\\[\\#1f2937\\] { color: #1f2937; }

/* ─── Rounded ─── */
.rounded-\\[50\\%\\] { border-radius: 50%; }
.rounded-md { border-radius: 0.375rem; }
.rounded-sm { border-radius: 0.125rem; }
.rounded-bl-xl { border-bottom-left-radius: 0.75rem; }
.rounded-full { border-radius: 9999px; }
.rounded-lg { border-radius: 0.5rem; }
.rounded { border-radius: 0.25rem; }

/* ─── Positioning extras ─── */
.top-\\[60\\%\\] { top: 60%; }
.-top-3\\.5 { top: -0.875rem; }
.-top-6 { top: -1.5rem; }
.-bottom-10 { bottom: -2.5rem; }
.-bottom-1 { bottom: -0.25rem; }
.bottom-\\[-10px\\] { bottom: -10px; }
.left-\\[-4\\.5px\\] { left: -4.5px; }
.left-2 { left: 0.5rem; }
.left-6 { left: 1.5rem; }
.right-2 { right: 0.5rem; }
.right-6 { right: 1.5rem; }
.right-1\\/2 { right: 50%; }
.left-1\\/2 { left: 50%; }
.mr-1\\.5 { margin-right: 0.375rem; }
.ml-auto { margin-left: auto; }

/* ─── Margins (negative) ─── */
.-mt-\\[50px\\] { margin-top: -50px; }
.mt-\\[-50px\\] { margin-top: -50px; }
.-mt-2 { margin-top: -0.5rem; }
.-mt-3\\.5 { margin-top: -0.875rem; }
.-mt-5 { margin-top: -1.25rem; }
.-mb-6 { margin-bottom: -1.5rem; }

/* ─── Transform extras ─── */
.-rotate-45 { transform: rotate(-45deg); }
.translate-x-\\[1px\\] { transform: translateX(1px); }
.translate-x-\\[-1px\\] { transform: translateX(-1px); }
.translate-x-1\\/2 { transform: translateX(50%); }
.-translate-x-1\\/2 { transform: translateX(-50%); }
.-translate-y-1\\/2 { transform: translateY(-50%); }

/* Compose translate + rotate combos exactly as Tailwind would */
.transform.-translate-x-1\\/2 { transform: translateX(-50%); }
.transform.-translate-y-1\\/2 { transform: translateY(-50%); }

/* ─── Overflow ─── */
.overflow-hidden { overflow: hidden; }
.overflow-visible { overflow: visible; }

/* ─── Z-index extras ─── */
.-z-10 { z-index: -10; }

/* ─── Border style ─── */
.border-dashed { border-style: dashed; }

/* ─── Display ─── */
.block { display: block; }
.inline-block { display: inline-block; }
.hidden { display: none; }
@media (min-width: 768px) { .md\\:inline { display: inline; } }
.shrink-0 { flex-shrink: 0; }

/* ─── Justify ─── */
.justify-between { justify-content: space-between; }

/* ─── Text alignment ─── */
.text-right { text-align: right; }

/* ─── Spacing additions ─── */
.gap-1\\.5 { gap: 0.375rem; }
.gap-1 { gap: 0.25rem; }
.gap-0\\.5 { gap: 0.125rem; }
.gap-0 { gap: 0; }
.p-0\\.5 { padding: 0.125rem; }
.p-1 { padding: 0.25rem; }
.px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
.px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.pt-6 { padding-top: 1.5rem; }
.pb-12 { padding-bottom: 3rem; }
`;
