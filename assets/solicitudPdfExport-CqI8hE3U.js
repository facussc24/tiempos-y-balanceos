import{S as w}from"./solicitudTypes-CpthhG1s.js";import{sanitizeFilename as S}from"./filenameSanitization-D6J-gYyb.js";import{g as b}from"./ppeBase64-Ckcn7BeD.js";import{r as A,a as E}from"./pdfRenderer-7NaqanA7.js";import"./index-iJCB9uch.js";import"./charts-DtjTm6NE.js";import"./supabase-hwi2RHdP.js";const n="#D97706",c="#92400E";function e(t){return t==null||t===""?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function O(t){if(!t)return"";const o=t.split("-");return o.length!==3?t:`${o[2]}/${o[1]}/${o[0]}`}function r(t,o){return`
        <tr>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px; font-weight:bold; color:#374151; background:#F9FAFB; width:35%;">${e(t)}</td>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;">${e(o)||'<span style="color:#9CA3AF;">—</span>'}</td>
        </tr>`}function x(t,o){const i=t.header,d=t.tipo==="producto",a=d?"PRODUCTO":"INSUMO",p=o?`<img src="${o}" style="max-width:100px; max-height:60px;" />`:`<div style="font-size:12px; font-weight:bold; color:${n}; font-family:Arial,sans-serif;">BARACK MERCOSUL</div>`,s=`
        <table style="width:100%; border-collapse:collapse; border:2px solid ${n}; margin-bottom:20px;">
            <tr>
                <td style="width:120px; padding:10px; border-right:1px solid ${n}; vertical-align:middle; text-align:center;">
                    ${p}
                </td>
                <td style="text-align:center; padding:10px; font-size:16px; font-weight:bold; color:${c};">
                    SOLICITUD DE GENERACIÓN<br/>DE CÓDIGO
                </td>
                <td style="width:120px; padding:10px; border-left:1px solid ${n}; text-align:center; font-size:10px;">
                    <div style="font-weight:bold;">${e(i.formNumber||w)}</div>
                    <div>Rev. ${e(i.revision||"A")}</div>
                    <div style="margin-top:4px; font-size:9px; color:#666;">DOCUMENTO INTERNO</div>
                </td>
            </tr>
        </table>`,m=`
        <table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Nro Solicitud:</b> ${e(i.solicitudNumber||"—")}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Fecha:</b> ${e(O(i.fechaSolicitud))}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Solicitante:</b> ${e(i.solicitante)}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Area:</b> ${e(i.areaDepartamento)}</td>
            </tr>
        </table>`,g=`
        <div style="background:#FFFBEB; border:1px solid #F59E0B; border-radius:4px; padding:8px 12px; margin-bottom:15px; font-size:11px;">
            <b>Tipo de solicitud:</b> &#10003; ${a}
        </div>`;let l="";if(d&&t.producto)l=r("Codigo",t.producto.codigo)+r("Descripción",t.producto.descripcion)+r("Cliente",t.producto.cliente);else if(!d&&t.insumo){const y=t.insumo.unidadMedida||"un";l=r("Codigo",t.insumo.codigo)+r("Descripción",t.insumo.descripcion)+r("Unidad de Medida",y)+r("Requiere generacion interna",t.insumo.requiereGeneracionInterna?"Si":"No")}const u=`
        <table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr style="background:#FEF3C7;">
                <td colspan="2" style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; font-weight:bold; color:${c};">
                    ${d?"DATOS DEL PRODUCTO":"DATOS DEL INSUMO"}
                </td>
            </tr>
            ${l}
        </table>`,f=d?"":`<div style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:4px; padding:10px; margin-bottom:15px; font-size:10px;">
            <b>&#9888; AVISO CALIDAD:</b> Notificar al departamento de Calidad para aprobacion de PPAP antes de activar el codigo del insumo en el sistema.
        </div>`,h=t.observaciones?`<table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr style="background:#FEF3C7;">
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:11px; font-weight:bold; color:${c};">
                    OBSERVACIONES
                </td>
            </tr>
            <tr>
                <td style="border:1px solid #d1d5db; padding:8px 10px; font-size:11px; white-space:pre-wrap;">${e(t.observaciones)}</td>
            </tr>
        </table>`:"",$=`
        <div style="text-align:center; margin-top:20px; padding-top:10px; border-top:2px solid ${n}; font-size:9px; color:#666;">
            DOCUMENTO INTERNO &mdash; BARACK MERCOSUL &mdash; No reproducir sin autorizacion
        </div>`;return`
        <div style="font-family:Arial,sans-serif; max-width:700px; margin:0 auto; padding:20px;">
            ${s}
            ${m}
            ${g}
            ${u}
            ${f}
            ${h}
            ${$}
        </div>`}async function B(t){const o=await b();return x(t,o)}async function H(t){const o=await b(),i=x(t,o);return E(i,{paperSize:"a4",orientation:"portrait",margin:[15,15,15,15]})}async function I(t){const o=await b(),i=x(t,o),d=t.header.solicitudNumber||t.producto?.codigo||t.insumo?.codigo||"Solicitud",a=S(d,{allowSpaces:!0}),p=new Date().toISOString().split("T")[0],s=`Solicitud_${a}_${p}.pdf`;await A(i,{filename:s,paperSize:"a4",orientation:"portrait",margin:[15,15,15,15]})}export{I as exportSolicitudPdf,H as generateSolicitudPdfBuffer,B as getSolicitudPdfPreviewHtml};
