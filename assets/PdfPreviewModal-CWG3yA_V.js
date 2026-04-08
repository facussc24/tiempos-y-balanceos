import{c as P,j as e,k as z,L as p,ab as F}from"./index-B0rHYdZP.js";import{b as d}from"./charts-DtjTm6NE.js";import{u as E}from"./useFocusTrap-OKhZVDID.js";import{a as C,b as D}from"./FloatingActionButton-BXjuLrJv.js";import{D as O}from"./download-B1S1EZPU.js";import{X as _}from"./x-D30eklpL.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=[["path",{d:"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",key:"143wyd"}],["path",{d:"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6",key:"1itne7"}],["rect",{x:"6",y:"14",width:"12",height:"8",rx:"1",key:"1ue0tg"}]],M=P("printer",L),u={blue:{gradient:"from-blue-50 to-gray-50",icon:"text-blue-600",btn:"bg-blue-600 hover:bg-blue-500"},teal:{gradient:"from-teal-50 to-gray-50",icon:"text-teal-600",btn:"bg-teal-600 hover:bg-teal-500"},navy:{gradient:"from-slate-100 to-gray-50",icon:"text-slate-700",btn:"bg-slate-700 hover:bg-slate-600"},cyan:{gradient:"from-cyan-50 to-gray-50",icon:"text-cyan-600",btn:"bg-cyan-600 hover:bg-cyan-500"}},a=[50,75,100,125,150],S=({html:s,onExport:f,onClose:n,isExporting:i=!1,title:l="Vista Previa PDF",subtitle:m,maxWidth:x="297mm",themeColor:y="blue",onExportExcel:b,isExportingExcel:g=!1})=>{const[o,h]=d.useState(100),c=u[y]||u.blue,w=E(!0);d.useEffect(()=>{const t=r=>{r.key==="Escape"&&!i&&n()};return document.addEventListener("keydown",t),()=>document.removeEventListener("keydown",t)},[i,n]);const j=d.useMemo(()=>`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { background: #f3f4f6; }
        body {
            background: white;
            max-width: ${x};
            margin: 16px auto;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
            transform: scale(${o/100});
            transform-origin: top center;
        }
        @media print {
            html { background: white; }
            body { margin: 0; padding: 0; box-shadow: none; transform: none; }
        }
    </style>
</head>
<body>${s}</body>
</html>`,[s,x,o]),v=d.useCallback(()=>{const t=window.open("","_blank","width=1200,height=900");t&&(t.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${l}</title>
    <style>
        @page { margin: 8mm 6mm; }
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>${s}</body>
</html>`),t.document.close(),setTimeout(()=>{t.print()},500))},[s,l]),k=()=>h(t=>{const r=a.indexOf(t);return r<a.length-1?a[r+1]:t}),N=()=>h(t=>{const r=a.indexOf(t);return r>0?a[r-1]:t});return e.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm",onClick:n,children:e.jsxs("div",{ref:w,role:"dialog","aria-modal":"true","aria-labelledby":"pdf-preview-modal-title",className:"bg-white rounded-xl shadow-2xl border border-gray-200 w-[95vw] h-[90vh] flex flex-col overflow-hidden",onClick:t=>t.stopPropagation(),children:[e.jsxs("div",{className:`flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r ${c.gradient} flex-shrink-0`,children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(z,{size:18,className:c.icon}),e.jsxs("div",{children:[e.jsx("h3",{id:"pdf-preview-modal-title",className:"text-sm font-bold text-gray-800",children:l}),m&&e.jsx("p",{className:"text-[10px] text-gray-500",children:m})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("div",{className:"flex items-center gap-1 bg-white/60 rounded px-2 py-1 border border-gray-200",children:[e.jsx("button",{onClick:N,disabled:o<=a[0],className:"p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition",title:"Reducir zoom","aria-label":"Reducir zoom",children:e.jsx(C,{size:14})}),e.jsxs("span",{className:"text-[10px] font-mono text-gray-600 w-8 text-center",children:[o,"%"]}),e.jsx("button",{onClick:k,disabled:o>=a[a.length-1],className:"p-0.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition",title:"Aumentar zoom","aria-label":"Aumentar zoom",children:e.jsx(D,{size:14})})]}),e.jsxs("button",{onClick:v,className:"flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded font-medium transition text-xs",title:"Imprimir / Guardar como PDF (recomendado si el PDF sale en blanco)",children:[e.jsx(M,{size:14})," Imprimir"]}),b&&e.jsx("button",{onClick:b,disabled:g,className:"flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed",children:g?e.jsxs(e.Fragment,{children:[e.jsx(p,{size:14,className:"animate-spin"})," Exportando..."]}):e.jsxs(e.Fragment,{children:[e.jsx(F,{size:14})," Exportar Excel"]})}),e.jsx("button",{onClick:f,disabled:i,className:`flex items-center gap-1.5 ${c.btn} text-white px-4 py-2 rounded font-semibold transition shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed`,children:i?e.jsxs(e.Fragment,{children:[e.jsx(p,{size:14,className:"animate-spin"})," Generando..."]}):e.jsxs(e.Fragment,{children:[e.jsx(O,{size:14})," Exportar PDF"]})}),e.jsx("button",{onClick:n,"aria-label":"Cerrar",className:"text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition",children:e.jsx(_,{size:18})})]})]}),e.jsx("div",{className:"flex-1 overflow-hidden bg-gray-100",children:e.jsx("iframe",{srcDoc:j,className:"w-full h-full border-none",title:"PDF Preview",sandbox:"allow-same-origin"})})]})})},Y=Object.freeze(Object.defineProperty({__proto__:null,default:S},Symbol.toStringTag,{value:"Module"}));export{S as P,M as a,Y as b};
