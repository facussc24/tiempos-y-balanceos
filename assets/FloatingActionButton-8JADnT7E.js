import{c as u,j as r}from"./index-CaDaVIBl.js";import{b as s,c as v}from"./charts-DtjTm6NE.js";import{K as b}from"./ProductSelector-De9o50i5.js";import{a as k}from"./chevron-up-CBXmJ1mE.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",key:"hh9hay"}],["path",{d:"m3.3 7 8.7 5 8.7-5",key:"g66t2b"}],["path",{d:"M12 22V12",key:"d0xqtd"}]],M=u("box",w);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]],S=u("chart-column",j);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}],["path",{d:"M14 4h7",key:"3xa0d5"}],["path",{d:"M14 9h7",key:"1icrd9"}],["path",{d:"M14 15h7",key:"1mj8o2"}],["path",{d:"M14 20h7",key:"11slyb"}]],T=u("layout-list",N);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]],H=u("zap",E);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],I=u("zoom-in",A);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],R=u("zoom-out",z);function B(o=800){const[c,n]=s.useState(!1),[l,t]=s.useState(!1),e=s.useRef(null),i=s.useCallback(a=>{const d=a.target;d&&(d.tagName==="INPUT"||d.tagName==="TEXTAREA"||d.tagName==="SELECT"||d.isContentEditable)||a.key==="Alt"&&!a.repeat&&(n(!0),e.current=setTimeout(()=>{t(!0)},o))},[o]),m=s.useCallback(a=>{a.key==="Alt"&&(a.preventDefault(),n(!1),t(!1),e.current&&(clearTimeout(e.current),e.current=null))},[]),h=s.useCallback(()=>{n(!1),t(!1),e.current&&(clearTimeout(e.current),e.current=null)},[]);return s.useEffect(()=>(window.addEventListener("keydown",i),window.addEventListener("keyup",m),window.addEventListener("blur",h),()=>{window.removeEventListener("keydown",i),window.removeEventListener("keyup",m),window.removeEventListener("blur",h),e.current&&clearTimeout(e.current)}),[i,m,h]),{isAltHeld:c,hintsVisible:l}}function x(){const o=document.querySelectorAll("[data-shortcut]"),c=[];return o.forEach((n,l)=>{const t=n.getAttribute("data-shortcut");if(!t)return;const e=n.getBoundingClientRect();if(e.width===0||e.height===0)return;const i=e.top>40;c.push({id:`hint-${l}`,shortcut:t,x:e.left+e.width/2,y:i?e.top-8:e.bottom+8,width:e.width,placement:i?"top":"bottom"})}),c}const D=({isVisible:o})=>{const[c,n]=s.useState([]),l=s.useRef(null);return s.useEffect(()=>{if(o){n(x());const t=()=>{l.current=requestAnimationFrame(()=>{n(x())})};return window.addEventListener("scroll",t,!0),window.addEventListener("resize",t),()=>{window.removeEventListener("scroll",t,!0),window.removeEventListener("resize",t),l.current&&cancelAnimationFrame(l.current)}}else n([])},[o]),!o||c.length===0?null:v.createPortal(r.jsxs(r.Fragment,{children:[r.jsx("div",{className:"fixed inset-0 bg-black/5 backdrop-blur-[1px] pointer-events-none z-[9998] animate-in fade-in duration-150","aria-hidden":"true"}),c.map(t=>r.jsxs("div",{className:"fixed z-[9995] pointer-events-none animate-in zoom-in-95 fade-in duration-200",style:{left:t.x,top:t.y,transform:t.placement==="top"?"translate(-50%, -100%)":"translate(-50%, 0%)"},children:[r.jsxs("div",{className:"flex items-center gap-1 px-2 py-1 bg-slate-900 text-white text-xs font-mono font-bold rounded-md shadow-lg border border-slate-700",children:[r.jsx(b,{size:12,className:"opacity-70"}),r.jsx("span",{children:t.shortcut})]}),r.jsx("div",{className:`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent border-slate-900 ${t.placement==="top"?"border-t-4 border-b-0 top-full":"border-b-4 border-t-0 bottom-full"}`})]},t.id)),r.jsx("div",{className:"fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300",children:r.jsxs("div",{className:"flex items-center gap-2 px-4 py-2 bg-slate-900/90 text-white text-sm rounded-full shadow-xl backdrop-blur-sm border border-slate-700",children:[r.jsx(b,{size:16,className:"text-blue-400"}),r.jsxs("span",{children:["Suelta ",r.jsx("kbd",{className:"px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono",children:"Alt"})," para cerrar"]})]})})]}),document.body)},f={blue:{bg:"bg-blue-600",hover:"hover:bg-blue-700",ring:"ring-blue-200"},emerald:{bg:"bg-emerald-600",hover:"hover:bg-emerald-700",ring:"ring-emerald-200"},purple:{bg:"bg-purple-600",hover:"hover:bg-purple-700",ring:"ring-purple-200"},amber:{bg:"bg-amber-500",hover:"hover:bg-amber-600",ring:"ring-amber-200"},rose:{bg:"bg-rose-600",hover:"hover:bg-rose-700",ring:"ring-rose-200"}},F=({config:o,hidden:c=!1})=>{const[n,l]=s.useState(!1);if(!o||c)return null;const{primary:t,secondary:e}=o,i=f[t.color||"blue"],m=t.icon,h=()=>{e&&e.length>0?l(!n):t.onClick()};return r.jsxs("div",{className:"fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 print:hidden",children:[n&&e&&r.jsx("div",{className:"flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-4 fade-in duration-200",children:e.map((a,d)=>{const y=a.icon,p=f[a.color||"blue"],g=d*50;return r.jsxs("button",{onClick:()=>{a.onClick(),l(!1)},"aria-label":a.label,style:{animationDelay:`${g}ms`},className:`
                                    flex items-center gap-2 px-4 py-2.5 rounded-full
                                    ${p.bg} ${p.hover}
                                    text-white font-medium text-sm shadow-lg
                                    transition-all duration-200 transform hover:scale-105 active:scale-95
                                    animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards
                                `,children:[r.jsx(y,{size:18}),r.jsx("span",{children:a.label})]},d)})}),r.jsxs("button",{onClick:h,className:`
                    group flex items-center gap-3
                    ${i.bg} ${i.hover}
                    text-white font-bold
                    px-5 py-4 rounded-full
                    shadow-xl hover:shadow-2xl
                    transition-all duration-300 transform hover:scale-105 active:scale-95
                    ring-4 ${i.ring} ring-opacity-30
                `,title:t.label,"aria-label":t.label,...e&&e.length>0?{"aria-haspopup":"menu","aria-expanded":n}:{},children:[r.jsx(m,{size:22,className:`transition-transform duration-200 ${n?"rotate-45":""}`}),r.jsx("span",{className:"hidden sm:inline pr-1",children:t.label}),e&&e.length>0&&r.jsx(k,{size:16,className:`transition-transform duration-200 ${n?"rotate-180":""}`})]})]})};export{M as B,S as C,F,T as L,D as S,H as Z,R as a,I as b,B as u};
