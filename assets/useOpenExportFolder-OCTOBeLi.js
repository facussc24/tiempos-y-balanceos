import{c as p}from"./index-DgWvDWRX.js";import{r as i}from"./react-vendor-C1wPmWfT.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]],h=p("ellipsis",d);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]],f=p("history",u),b="Y:\\INGENIERIA";function m(r,t){switch(r){case"amfe":{const e=t;return{client:e.header?.client||"",piece:e.header?.partNumber||"",pieceName:e.header?.subject||e.header?.partNumber||""}}case"cp":{const e=t;return{client:e.header?.client||"",piece:e.header?.partNumber||"",pieceName:e.header?.partName||e.header?.partNumber||""}}case"ho":{const e=t;return{client:e.header?.client||"",piece:e.header?.partNumber||"",pieceName:e.header?.partDescription||e.header?.partNumber||""}}case"pfd":{const e=t;return{client:e.header?.customerName||"",piece:e.header?.partNumber||"",pieceName:e.header?.partName||e.header?.partNumber||""}}case"tiempos":{const e=t;return{client:e.meta?.client||"",piece:e.meta?.name||"",pieceName:e.meta?.name||""}}case"solicitud":{const e=t,n=e.tipo==="insumo"?"Insumos":"Productos",a=e.header?.solicitudNumber||"SIN-NUM";let c;if(e.tipo==="producto"&&e.producto){const o=e.producto.codigo||"SIN-COD",s=e.producto.cliente||"";c=s?`${a}_${o}_${s}`:`${a}_${o}`}else{const o=e.insumo?.codigo||"SIN-COD";c=`${a}_${o}`}return{client:n,piece:c,pieceName:e.header?.solicitudNumber||""}}default:return{client:"",piece:"",pieceName:""}}}function y(r,t){const[e,n]=i.useState(!1),a=i.useMemo(()=>m(r,t),[r,t]),c=!1;return{openFolder:i.useCallback(async()=>{},[c,e,r,a]),isOpening:e,canOpen:c}}export{b as D,h as E,f as H,y as u};
