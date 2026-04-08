import{c as f}from"./index-iJCB9uch.js";import{b as c}from"./charts-DtjTm6NE.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],m=f("info",i);function h(t,r=200){const[n,e]=c.useState(t),[o,s]=c.useState(!1);return c.useEffect(()=>{if(t)e(!0),s(!1);else{s(!0);const u=setTimeout(()=>{e(!1),s(!1)},r);return()=>clearTimeout(u)}},[t,r]),{shouldRender:n,isClosing:o}}const y=t=>{const r=c.useRef(null);return c.useEffect(()=>{if(!t)return;const n=r.current;if(!n)return;const e=n.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');if(e.length===0)return;const o=e[0],s=e[e.length-1],u=a=>{a.key==="Tab"&&(a.shiftKey?document.activeElement===o&&(s.focus(),a.preventDefault()):document.activeElement===s&&(o.focus(),a.preventDefault()))};return n.addEventListener("keydown",u),requestAnimationFrame(()=>{o.focus()}),()=>n.removeEventListener("keydown",u)},[t]),r};export{m as I,h as a,y as u};
