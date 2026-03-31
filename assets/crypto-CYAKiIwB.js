async function s(r){const t=new TextEncoder().encode(r),e=await crypto.subtle.digest("SHA-256",t);return Array.from(new Uint8Array(e)).map(a=>a.toString(16).padStart(2,"0")).join("")}export{s as g};
