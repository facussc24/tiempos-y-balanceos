import{P as q,S as nt}from"./pfdTypes-Ck1MTug8.js";import{sanitizeFilename as it}from"./filenameSanitization-D6J-gYyb.js";import{g as rt}from"./ppeBase64-BNITaAJg.js";const S=440,J=62,V=70,W=32,I=44,j=32,N=20,H=190,st=48,lt=H+32,Z=135,Q=75,c="Inter,Arial,Helvetica,sans-serif",x="#374151",u="#111827",O={border:x,bg:"#FFFFFF",bgDark:"#F3F4F6",text:u},at={operation:O,transport:O,inspection:O,storage:O,delay:O,decision:O,combined:O};function X(t){let e=t.stepType==="decision"?V:J;return t.productCharacteristic&&(e+=16),t.processCharacteristic&&(e+=12),t.rejectDisposition!=="none"&&(t.stepType==="inspection"||t.stepType==="combined"||t.stepType==="decision")&&(e+=18),e}function ct(){let t=`<defs>
    <filter id="dropShadow" x="-4%" y="-4%" width="108%" height="112%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000000" flood-opacity="0.08"/>
    </filter>`;return t+=`
    <marker id="arrowMarker" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
        <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="${x}"/>
    </marker>`,t+=`
    <marker id="reworkArrowMarker" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0.5 L 10 5 L 0 9.5 z" fill="${u}"/>
    </marker>`,t+=`
    </defs>`,t}function tt(t,e,o,n=W){const i=n/2,r="#1F2937",s="white";switch(t){case"operation":return`<circle cx="${e}" cy="${o}" r="${i}" fill="${s}" stroke="${r}" stroke-width="2"/>`;case"transport":return`<g>
                <line x1="${e-i}" y1="${o}" x2="${e+i-4}" y2="${o}" stroke="${r}" stroke-width="2.5" stroke-linecap="round"/>
                <polygon points="${e+i-6},${o-5} ${e+i},${o} ${e+i-6},${o+5}" fill="${r}"/>
            </g>`;case"inspection":return`<rect x="${e-i}" y="${o-i}" width="${n}" height="${n}" rx="2" fill="${s}" stroke="${r}" stroke-width="2"/>`;case"storage":return`<polygon points="${e},${o+i} ${e-i},${o-i+4} ${e+i},${o-i+4}" fill="${s}" stroke="${r}" stroke-width="2" stroke-linejoin="round"/>`;case"delay":return`<path d="M${e-i},${o-i} h${i} a${i},${i} 0 0,1 0,${n} h-${i} z" fill="${s}" stroke="${r}" stroke-width="2"/>`;case"decision":return`<polygon points="${e},${o-i} ${e+i},${o} ${e},${o+i} ${e-i},${o}" fill="${s}" stroke="${r}" stroke-width="2" stroke-linejoin="round"/>`;case"combined":return`<g>
                <rect x="${e-i}" y="${o-i}" width="${n}" height="${n}" rx="2" fill="${s}" stroke="${r}" stroke-width="2"/>
                <circle cx="${e}" cy="${o}" r="${i*.55}" fill="none" stroke="${r}" stroke-width="2"/>
            </g>`}}function h(t){return t?String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):""}function M(t,e){return t.length<=e?t:t.slice(0,e-1)+"…"}function $t(t){const e=[];let o=0;for(;o<t.length;)if(t[o].branchId){const n={},i=[];for(;o<t.length&&t[o].branchId;){const s=t[o].branchId;n[s]||(n[s]=[],i.push(s)),n[s].push(t[o]),o++}const r=i.map(s=>({branchId:s,label:n[s][0].branchLabel||`Línea ${s}`,steps:n[s]}));e.push({type:"parallel",steps:[],branches:r})}else{const n=[];for(;o<t.length&&!t[o].branchId;)n.push(t[o]),o++;e.push({type:"main",steps:n})}return e}function ft(t){let e=S;for(const o of t)if(o.type==="parallel"&&o.branches){const n=o.branches.length,i=S+N*2,r=n*i+(n-1)*j;r>e&&(e=r)}return e}function G(t,e,o){const n=at[t.stepType],i=X(t),r=t.stepType==="decision"?V:J,s=e+N+W/2,$=o+r/2,d=e+N+W+12,a=o+r/2,l=t.stepType==="decision",g=l?2.5:2,w="url(#dropShadow)",y=t.productSpecialChar==="CC"||t.processSpecialChar==="CC",A=!y&&(t.productSpecialChar==="SC"||t.processSpecialChar==="SC"),L=t.isExternalProcess;let p="",f=e+S-N;if(y&&(f-=28,p+=`<rect x="${f}" y="${o+10}" width="24" height="16" rx="8" fill="white" stroke="${x}" stroke-width="1.5"/>
            <text x="${f+12}" y="${o+22}" font-size="8" font-weight="bold" fill="${u}" text-anchor="middle" font-family="${c}" letter-spacing="0.3">CC</text>`),A&&(f-=28,p+=`<rect x="${f}" y="${o+10}" width="24" height="16" rx="8" fill="white" stroke="${x}" stroke-width="1"/>
            <text x="${f+12}" y="${o+22}" font-size="8" font-weight="bold" fill="${u}" text-anchor="middle" font-family="${c}" letter-spacing="0.3">SC</text>`),L&&(f-=30,p+=`<rect x="${f}" y="${o+10}" width="26" height="16" rx="8" fill="white" stroke="${x}" stroke-width="1"/>
            <text x="${f+13}" y="${o+22}" font-size="8" font-weight="bold" fill="${u}" text-anchor="middle" font-family="${c}" letter-spacing="0.3">EXT</text>`),t.cycleTimeMinutes!=null&&t.cycleTimeMinutes>0){const k=`${t.cycleTimeMinutes}min`,m=k.length*6+8;f-=m+4,p+=`<rect x="${f}" y="${o+10}" width="${m}" height="16" rx="8" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>
            <text x="${f+m/2}" y="${o+22}" font-size="8" font-weight="bold" fill="${x}" text-anchor="middle" font-family="${c}" letter-spacing="0.3">${k}</text>`}const b=[];t.machineDeviceTool&&b.push(t.machineDeviceTool),t.department&&b.push(t.department);const F=b.length>0?`<text x="${d}" y="${a+15}" font-size="9" fill="#9CA3AF" font-family="${c}">${h(M(b.join(" · "),50))}</text>`:"";let C="",T=b.length>0?a+28:a+16;t.productCharacteristic&&(C+=`<text x="${d}" y="${T}" font-size="8" fill="#6B7280" font-family="${c}"><tspan font-weight="600">Prod:</tspan> ${h(M(t.productCharacteristic,42))}</text>`,T+=12),t.processCharacteristic&&(C+=`<text x="${d}" y="${T}" font-size="8" fill="#6B7280" font-family="${c}"><tspan font-weight="600">Proc:</tspan> ${h(M(t.processCharacteristic,42))}</text>`);let z="";if(t.linkedAmfeOperationId||t.linkedCpItemIds&&t.linkedCpItemIds.length>0){let k=e+S-N;const m=o+i-18;t.linkedCpItemIds&&t.linkedCpItemIds.length>0&&(k-=30,z+=`<rect x="${k}" y="${m}" width="26" height="14" rx="7" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="0.75"/>
                <text x="${k+13}" y="${m+10}" font-size="7" font-weight="600" fill="${x}" text-anchor="middle" font-family="${c}">CP</text>`),t.linkedAmfeOperationId&&(k-=40,z+=`<rect x="${k}" y="${m}" width="36" height="14" rx="7" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="0.75"/>
                <text x="${k+18}" y="${m+10}" font-size="7" font-weight="600" fill="${x}" text-anchor="middle" font-family="${c}">AMFE</text>`)}const _=t.notes?`<text x="${e+S-8}" y="${o+14}" font-size="12" font-weight="bold" fill="${x}" text-anchor="end" font-family="${c}">*</text>`:"",v=y||A||L?40:52,E=y?`<rect x="${e}" y="${o+2}" width="3" height="${i-4}" rx="1.5" fill="${u}"/>`:"";let D="";if(t.rejectDisposition!=="none"&&(t.stepType==="inspection"||t.stepType==="combined"||t.stepType==="decision")){const k=o+i-16,m=e+N+W+12,P=l?"NOK → ":"",B=l?`<text x="${e+S-N-4}" y="${k}" font-size="8" font-weight="700" fill="#16A34A" font-family="${c}" text-anchor="end">OK ↓</text>`:"";t.rejectDisposition==="rework"?D=`<g class="pfd-disp-rework">
                <text x="${m}" y="${k}" font-size="8" font-weight="600" fill="#DC2626" font-family="${c}">${P}↻ Retrabajo</text>
                ${B}
            </g>`:t.rejectDisposition==="scrap"?D=`<g class="pfd-disp-scrap">
                <text x="${m}" y="${k}" font-size="8" font-weight="600" fill="#DC2626" font-family="${c}">${P}✕ Descarte</text>
                ${B}
            </g>`:t.rejectDisposition==="sort"&&(D=`<g class="pfd-disp-sort">
                <text x="${m}" y="${k}" font-size="8" font-weight="600" fill="#DC2626" font-family="${c}">${P}⊘ Selección</text>
                ${B}
            </g>`)}const R=[`${t.stepNumber} — ${t.description}`];t.machineDeviceTool&&R.push(`Equipo: ${t.machineDeviceTool}`),t.department&&R.push(`Área: ${t.department}`),t.productCharacteristic&&R.push(`Caract. Producto: ${t.productCharacteristic}`),t.processCharacteristic&&R.push(`Caract. Proceso: ${t.processCharacteristic}`),t.rejectDisposition!=="none"&&R.push(`Disposición: ${t.rejectDisposition}`),t.notes&&R.push(`Nota: ${t.notes}`);const Y=`<title>${h(R.join(`
`))}</title>`;return`<g class="pfd-node" data-step-id="${h(t.id)}" data-step-number="${h(t.stepNumber)}">
        ${Y}
        <rect x="${e}" y="${o}" width="${S}" height="${i}" rx="6" fill="white" stroke="${n.border}" stroke-width="${g}" filter="${w}"/>
        ${E}
        ${tt(t.stepType,s,$)}
        <text x="${d}" y="${a-4}" font-size="14" font-weight="700" fill="${n.text}" font-family="${c}">${h(t.stepNumber)}</text>
        <text x="${d+t.stepNumber.length*9+6}" y="${a-4}" font-size="11.5" font-weight="500" fill="#1E293B" font-family="${c}">${h(M(t.description,v))}</text>
        ${F}
        ${C}
        ${p}
        ${z}
        ${_}
        ${D}
    </g>`}function U(t,e,o){const i=(o-e)*.35;return`<g class="pfd-arrow">
        <path d="M ${t},${e} C ${t},${e+i} ${t},${o-i} ${t},${o-8}" stroke="${x}" stroke-width="2" fill="none" stroke-linecap="round" marker-end="url(#arrowMarker)"/>
    </g>`}function ht(t,e,o){const n=t.header,i=Math.floor(e*.18),r=Math.floor(e*.55),s=i+r,$=e-s,d=68,a=o?`<image x="8" y="6" width="${i-16}" height="${d-12}" href="${o}" preserveAspectRatio="xMidYMid meet"/>`:`<text x="${i/2}" y="30" font-size="16" font-weight="bold" fill="${u}" text-anchor="middle" font-family="${c}">BARACK</text>
           <text x="${i/2}" y="48" font-size="10" fill="${x}" text-anchor="middle" font-family="${c}">MERCOSUL</text>`,l=n.revisionLevel||"-",g=`<rect x="${s+$/2-16}" y="46" width="32" height="20" rx="10" fill="#F3F4F6" stroke="${x}" stroke-width="1"/>
        <text x="${s+$/2}" y="60" font-size="12" font-weight="700" fill="${u}" text-anchor="middle" font-family="${c}">${h(l)}</text>`,w=n.applicableParts?n.applicableParts.split(`
`)[0]:"",y=n.applicableParts?n.applicableParts.split(`
`).length:0,A=y>1?` (+${y-1} más)`:"",L=d+6,p=20,f="11.5";return`<g class="pfd-header">
        <!-- Header background -->
        <rect x="0" y="0" width="${e}" height="${H}" fill="white" stroke="${x}" stroke-width="1.5" rx="4"/>
        <!-- Bottom accent line -->
        <line x1="0" y1="${H}" x2="${e}" y2="${H}" stroke="${u}" stroke-width="2"/>

        <!-- Column dividers -->
        <line x1="${i}" y1="4" x2="${i}" y2="${d}" stroke="#D1D5DB" stroke-width="1"/>
        <line x1="${s}" y1="4" x2="${s}" y2="${d}" stroke="#D1D5DB" stroke-width="1"/>

        <!-- Logo column -->
        ${a}

        <!-- Title column -->
        <text x="${i+r/2}" y="26" font-size="18" font-weight="700" fill="${u}" text-anchor="middle" font-family="${c}" letter-spacing="1">DIAGRAMA DE FLUJO DEL PROCESO</text>
        <text x="${i+r/2}" y="44" font-size="12" fill="${x}" text-anchor="middle" font-family="${c}" font-weight="500">${h(n.partName||"Sin título")} — ${h(n.partNumber||"")}</text>
        ${n.processPhase?`<text x="${i+r/2}" y="58" font-size="10" fill="${x}" text-anchor="middle" font-family="${c}" font-weight="600">Fase: ${n.processPhase==="prototype"?"PROTOTIPO":n.processPhase==="pre-launch"?"PRE-LANZAMIENTO":"PRODUCCIÓN"}</text>`:""}

        <!-- Form number column -->
        <text x="${s+$/2}" y="20" font-size="9" fill="#6B7280" text-anchor="middle" font-family="${c}" font-weight="600">Formulario</text>
        <text x="${s+$/2}" y="38" font-size="14" font-weight="700" fill="${u}" text-anchor="middle" font-family="${c}">${nt}</text>
        ${g}

        <!-- Metadata separator -->
        <line x1="4" y1="${d}" x2="${e-4}" y2="${d}" stroke="#D1D5DB" stroke-width="1"/>

        <!-- Row 1: Empresa | Planta | Cliente | Modelo -->
        <text x="16" y="${L+12}" font-size="${f}" fill="${u}" font-family="${c}">
            <tspan font-weight="700">Empresa:</tspan> ${h(n.companyName)}  |  <tspan font-weight="700">Planta:</tspan> ${h(n.plantLocation)}  |  <tspan font-weight="700">Cliente:</tspan> ${h(n.customerName)}  |  <tspan font-weight="700">Modelo:</tspan> ${h(n.modelYear)}
        </text>
        <!-- Row 2: Elaboró | Aprobó | Equipo -->
        <text x="16" y="${L+12+p}" font-size="${f}" fill="${u}" font-family="${c}">
            <tspan font-weight="700">Elaboró:</tspan> ${h(n.preparedBy)}${n.preparedDate?` (${h(n.preparedDate)})`:""}  |  <tspan font-weight="700">Aprobó:</tspan> ${h(n.approvedBy)}${n.approvedDate?` (${h(n.approvedDate)})`:""}  |  <tspan font-weight="700">Cód. Prov.:</tspan> ${h(n.supplierCode)}  |  <tspan font-weight="700">Equipo:</tspan> ${h(M(n.coreTeam,200))}
        </text>
        <!-- Row 3: Fecha Rev. | Cambio Ing. | Contacto -->
        ${n.engineeringChangeLevel||n.revisionDate||n.keyContact?`<text x="16" y="${L+12+p*2}" font-size="${f}" fill="${u}" font-family="${c}">
            ${n.revisionDate?`<tspan font-weight="700">Fecha Rev.:</tspan> ${h(n.revisionDate)}  |  `:""}${n.engineeringChangeLevel?`<tspan font-weight="700">Niv. Cambio Ing.:</tspan> ${h(M(n.engineeringChangeLevel,40))}  |  `:""}${n.keyContact?`<tspan font-weight="700">Contacto:</tspan> ${h(M(n.keyContact,40))}`:""}
        </text>`:""}
        <!-- Row 4: Partes aplicables -->
        ${w?`<text x="16" y="${L+12+p*3}" font-size="${f}" fill="${u}" font-family="${c}">
            <tspan font-weight="700">Partes Aplic.:</tspan> ${h(M(w,100))}${A?h(A):""}
        </text>`:""}
        <!-- Exportado -->
        <text x="${e-16}" y="${H-6}" font-size="9.5" fill="#6B7280" text-anchor="end" font-family="${c}">Exportado: ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"})}</text>
    </g>`}function dt(t,e){const o=q,n=Z,i=Q,r=i+o.length*n,s=t-r/2,$=42,d=e-24;let a=`<g class="pfd-legend">
        <rect x="${s-14}" y="${d}" width="${r+28}" height="${$}" rx="4" fill="white" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${s+4}" y="${e+1}" font-size="10" font-weight="700" fill="#475569" font-family="${c}" letter-spacing="0.5">LEYENDA:</text>`,l=s+i;for(let g=0;g<o.length;g++){const w=o[g];a+=tt(w.value,l+12,e-3,22),a+=`<text x="${l+30}" y="${e+1}" font-size="10" fill="#1E293B" font-family="${c}" font-weight="500">${h(w.label)}</text>`,g<o.length-1&&(a+=`<circle cx="${l+n-8}" cy="${e-2}" r="2" fill="#94A3B8"/>`),l+=n}return a+="</g>",a}function pt(t,e,o){if(o.length<2)return"";const n=o[0].cx,i=o[o.length-1].cx,r=e+6;let s=`<g class="pfd-fork">
        <!-- Vertical stem -->
        <line x1="${t}" y1="${e-4}" x2="${t}" y2="${r}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>
        <!-- Horizontal connector -->
        <line x1="${n}" y1="${r}" x2="${i}" y2="${r}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>`;for(const $ of o)s+=`<line x1="${$.cx}" y1="${r}" x2="${$.cx}" y2="${r+10}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>
        <polygon points="${$.cx-4},${r+8} ${$.cx},${r+14} ${$.cx+4},${r+8}" fill="${x}"/>`;return s+="</g>",s}function xt(t,e,o){if(o.length<2)return"";const n=o[0].cx,i=o[o.length-1].cx,r=e;let s='<g class="pfd-join">';for(const $ of o)s+=`<line x1="${$.cx}" y1="${r-10}" x2="${$.cx}" y2="${r}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>`;return s+=`<line x1="${n}" y1="${r}" x2="${i}" y2="${r}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>`,s+=`<line x1="${t}" y1="${r}" x2="${t}" y2="${r+6}" stroke="${x}" stroke-width="2" stroke-linecap="round"/>
        <polygon points="${t-4},${r+4} ${t},${r+10} ${t+4},${r+4}" fill="${x}"/>`,s+="</g>",s}function gt(t,e,o){let n="";for(let i=0;i<t.length;i++){const r=t[i],s=r.rejectDisposition==="rework"&&!!r.reworkReturnStep,$=!!r.isRework&&!!r.reworkReturnStep;if(!s&&!$)continue;const d=r.stepNumber.trim()||`__idx_${i}`,a=e.get(d),l=e.get(r.reworkReturnStep.trim());if(!a||!l)continue;const g=a.nodeX+S+4,w=a.y+a.h/2,y=l.nodeX+S+4,A=l.y+l.h/2,L=Math.min(80,o*.08),p=Math.max(g,y)+L;n+=`<g class="pfd-rework-arrow">
            <path d="M ${g},${w} C ${p},${w} ${p},${A} ${y+8},${A}"
                  stroke="${u}" stroke-width="1.5" fill="none" stroke-dasharray="6,4"
                  stroke-linecap="round" marker-end="url(#reworkArrowMarker)"/>
            <text x="${p+4}" y="${(w+A)/2+4}" font-size="8" font-weight="700" fill="${u}" text-anchor="start" font-family="${c}">RETRABAJO</text>
        </g>`}return n}function mt(t,e,o,n){const i=n.header,r=[];if(i.linkedAmfeId&&r.push(`AMFE de Proceso: ${i.linkedAmfeId}`),i.linkedCpId&&r.push(`Plan de Control: ${i.linkedCpId}`),r.length===0)return"";const s=Math.min(o-48,600);return`<g class="pfd-traceability">
        <rect x="${t-s/2}" y="${e}" width="${s}" height="28" rx="4" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${t}" y="${e+11}" font-size="8" font-weight="700" fill="#6B7280" text-anchor="middle" font-family="${c}" letter-spacing="0.5">TRAZABILIDAD DOCUMENTAL</text>
        <text x="${t}" y="${e+22}" font-size="9" fill="${u}" text-anchor="middle" font-family="${c}">${h(r.join("  |  "))}</text>
    </g>`}function ut(t,e,o,n){if(n.length===0)return{svg:"",height:0};const i=14,r=20,$=r+n.length*i+10,d=Math.min(o-48,700),a=t-d/2;let l=`<g class="pfd-notes">
        <rect x="${a}" y="${e}" width="${d}" height="${$}" rx="4" fill="#FAFAFA" stroke="#E5E7EB" stroke-width="1"/>
        <text x="${a+12}" y="${e+15}" font-size="9" font-weight="700" fill="#475569" font-family="${c}" letter-spacing="0.3">NOTAS</text>`;for(let g=0;g<n.length;g++){const w=n[g],y=e+r+4+g*i;l+=`<text x="${a+12}" y="${y}" font-size="8" fill="#4B5563" font-family="${c}">
            <tspan font-weight="600">* ${h(w.stepNumber||"?")}:</tspan> ${h(M(w.notes,90))}
        </text>`}return l+="</g>",{svg:l,height:$}}function wt(t,e,o,n){return`<g class="pfd-footer">
        <line x1="24" y1="${e}" x2="${o-24}" y2="${e}" stroke="#D1D5DB" stroke-width="1"/>
        <text x="${t}" y="${e+16}" font-size="9" fill="#94A3B8" text-anchor="middle" font-family="${c}">
            BARACK MERCOSUL
        </text>
    </g>`}function kt(t,e){return`<g class="pfd-watermark" opacity="0.018">
        <text x="${t}" y="${e}" font-size="120" font-weight="900" fill="#9CA3AF" text-anchor="middle" font-family="${c}" letter-spacing="12" transform="rotate(-35, ${t}, ${e})">BARACK MERCOSUL</text>
    </g>`}function yt(t,e="",o){if(t.steps.length===0)return`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
            <rect width="400" height="200" fill="white"/>
            <text x="200" y="100" font-size="12" fill="#9CA3AF" text-anchor="middle" font-family="${c}">Sin pasos definidos</text>
        </svg>`;const n=$t(t.steps),i=Q+q.length*Z,s=Math.max(ft(n),i)+st*2,$=s/2,d=$-S/2,a=[];let l=lt;if(t.header.linkedAmfeId||t.header.linkedCpId){const p=mt($,l,s,t);p&&(a.push(p),l+=36)}const g=new Map,w=new Map;t.steps.forEach((p,f)=>w.set(p,f));for(let p=0;p<n.length;p++){const f=n[p];if(p>0&&(a.push(U($,l,l+I)),l+=I),f.type==="main")for(let b=0;b<f.steps.length;b++){b>0&&(a.push(U($,l,l+I)),l+=I);const F=f.steps[b];a.push(G(F,d,l));const C=F.stepNumber.trim()||`__idx_${w.get(F)}`;g.set(C,{stepNumber:F.stepNumber,x:$,y:l,h:X(F),nodeX:d}),l+=X(F)}else if(f.type==="parallel"&&f.branches){const b=f.branches,F=b.length,C=S+N*2,K=F*C+(F-1)*j,T=$-K/2;a.push(`<text x="${$}" y="${l+12}" font-size="10" font-weight="700" fill="${x}" text-anchor="middle" font-family="${c}">FLUJO PARALELO</text>`),l+=20;const z=[];for(let v=0;v<F;v++){const E=T+v*(C+j);z.push({cx:E+C/2})}a.push(pt($,l,z)),l+=20;let _=0;for(const v of b){let E=30;for(const D of v.steps)E+=X(D);E+=(v.steps.length-1)*I,E>_&&(_=E)}for(let v=0;v<b.length;v++){const E=b[v],D=T+v*(C+j);a.push(`<rect x="${D}" y="${l}" width="${C}" height="${_}" rx="4" fill="#F9FAFB" stroke="#D1D5DB" stroke-width="1"/>`);const R=h(E.label),Y=R.length*7+20,k=D+C/2-Y/2;a.push(`<rect x="${k}" y="${l+6}" width="${Y}" height="18" rx="9" fill="white" stroke="#9CA3AF" stroke-width="1"/>
                    <text x="${D+C/2}" y="${l+19}" font-size="10" font-weight="700" fill="${u}" text-anchor="middle" font-family="${c}">${R}</text>`);let m=l+30;for(let P=0;P<E.steps.length;P++){if(P>0){const ot=D+C/2;a.push(U(ot,m,m+I)),m+=I}const B=E.steps[P];a.push(G(B,D+N,m));const et=B.stepNumber.trim()||`__idx_${w.get(B)}`;g.set(et,{stepNumber:B.stepNumber,x:D+C/2,y:m,h:X(B),nodeX:D+N}),m+=X(B)}}l+=_,a.push(xt($,l+4,z)),l+=18,a.push(`<text x="${$}" y="${l+14}" font-size="10" font-weight="700" fill="${x}" text-anchor="middle" font-family="${c}">CONVERGENCIA</text>`),l+=22}}const y=gt(t.steps,g,s);if(y&&a.push(y),!o?.skipNotes){const p=t.steps.filter(f=>f.notes);if(p.length>0){l+=32;const f=ut($,l,s,p);f.svg&&(a.push(f.svg),l+=f.height)}}l+=48,a.push(dt($,l)),l+=36,l+=16,a.push(wt($,l,s)),l+=50;const A=l+20,L=ht(t,s,e);return`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="${A}" viewBox="0 0 ${s} ${A}" preserveAspectRatio="xMidYMin meet">
    <style>
        .pfd-node rect:first-child { cursor: pointer; }
        .pfd-node:hover rect:first-child { filter: brightness(0.96); }
        .pfd-arrow path { stroke-dasharray: 200; stroke-dashoffset: 200; animation: dashDraw 0.5s ease forwards; }
        @keyframes dashDraw { to { stroke-dashoffset: 0; } }
    </style>
    ${ct()}
    <!-- Background -->
    <rect width="100%" height="100%" fill="white"/>
    ${kt($,A/2)}
    ${L}
    ${a.join(`
    `)}
</svg>`}async function At(t){const e=await rt(),o=yt(t,e),n=t.header.partName||t.header.partNumber||t.header.documentNumber||"Documento",i=it(n,{allowSpaces:!0}),r=new Date().toISOString().split("T")[0],s=`PFD_${i}_${r}.svg`,$=new Blob([o],{type:"image/svg+xml;charset=utf-8"}),d=URL.createObjectURL($),a=document.createElement("a");a.href=d,a.download=s,a.style.display="none",document.body.appendChild(a),a.click(),document.body.removeChild(a),setTimeout(()=>URL.revokeObjectURL(d),5e3)}export{yt as b,At as e};
