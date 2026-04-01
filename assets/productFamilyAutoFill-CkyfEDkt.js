import{aB as c,u as a,aA as o}from"./index-BVVYFCNh.js";const l=50,u=20;function f(i,e=u){if(!i)return i;const t=i.split(`
`).filter(n=>n.trim());if(t.length<=e)return t.join(`
`);const s=t.length-e;return[...t.slice(0,e),`... y ${s} más`].join(`
`)}async function g(i,e){try{const t=await c(i,e);if(t.length>0){const n=(await a(t[0].id)).map(r=>r.codigo??"").filter(r=>r&&r!==i);return n.length>0?n.join(`
`):null}}catch{}try{const s=(await o({lineaCode:e,activeOnly:!0,limit:l+1})).map(n=>n.codigo).filter(n=>n!==i).slice(0,l);return s.length>0?s.join(`
`):null}catch{return null}}export{g as r,f as t};
