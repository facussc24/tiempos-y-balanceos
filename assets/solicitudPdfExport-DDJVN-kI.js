import{S as w}from"./SolicitudApp-Cut9hClN.js";import{sanitizeFilename as S}from"./filenameSanitization-D6J-gYyb.js";import{g as m}from"./ppeBase64-DErS0Q4b.js";import{r as A,a as E}from"./pdfRenderer-C8XklbwE.js";import"./index-DgWvDWRX.js";import"./react-vendor-C1wPmWfT.js";import"./supabase-hwi2RHdP.js";import"./useRevisionControl-B8e46pZZ.js";import"./useFocusTrap-Cmu5ZR7L.js";import"./git-branch-Dy-py4g9.js";import"./useOpenExportFolder-OCTOBeLi.js";import"./chevron-up-ClyBmQWF.js";import"./chevron-down-ECzmeYvt.js";import"./eye-BMwZR4sn.js";import"./ConfirmModal-eTS5ctJ-.js";import"./info-Cs-4idza.js";import"./trash-2-D3TtXOv9.js";import"./plus-DA2oqDi1.js";import"./wifi-Qb42qYwA.js";import"./wifi-off-Cpduvx-Z.js";import"./arrow-left-B490ARhb.js";import"./save-6yebYc_F.js";import"./folder-output-Zsp1Lp94.js";import"./shield-check-Dkh-8XEa.js";import"./circle-alert-B5Ya6swM.js";import"./image-DpdkZ_nn.js";import"./file-Hd_r2n9-.js";import"./Breadcrumb-Cqf2mrt5.js";const p="#D97706",c="#92400E";function e(t){return t==null||t===""?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function O(t){if(!t)return"";const o=t.split("-");return o.length!==3?t:`${o[2]}/${o[1]}/${o[0]}`}function r(t,o){return`
        <tr>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px; font-weight:bold; color:#374151; background:#F9FAFB; width:35%;">${e(t)}</td>
            <td style="border:1px solid #d1d5db; padding:6px 10px; font-size:11px;">${e(o)||'<span style="color:#9CA3AF;">—</span>'}</td>
        </tr>`}function b(t,o){const i=t.header,d=t.tipo==="producto",n=d?"PRODUCTO":"INSUMO",a=o?`<img src="${o}" style="max-width:100px; max-height:60px;" />`:`<div style="font-size:12px; font-weight:bold; color:${p}; font-family:Arial,sans-serif;">BARACK MERCOSUL</div>`,s=`
        <table style="width:100%; border-collapse:collapse; border:2px solid ${p}; margin-bottom:20px;">
            <tr>
                <td style="width:120px; padding:10px; border-right:1px solid ${p}; vertical-align:middle; text-align:center;">
                    ${a}
                </td>
                <td style="text-align:center; padding:10px; font-size:16px; font-weight:bold; color:${c};">
                    SOLICITUD DE GENERACIÓN<br/>DE CÓDIGO
                </td>
                <td style="width:120px; padding:10px; border-left:1px solid ${p}; text-align:center; font-size:10px;">
                    <div style="font-weight:bold;">${e(i.formNumber||w)}</div>
                    <div>Rev. ${e(i.revision||"A")}</div>
                    <div style="margin-top:4px; font-size:9px; color:#666;">DOCUMENTO INTERNO</div>
                </td>
            </tr>
        </table>`,x=`
        <table style="width:100%; border-collapse:collapse; border:1px solid #d1d5db; margin-bottom:15px;">
            <tr>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Nro Solicitud:</b> ${e(i.solicitudNumber||"—")}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Fecha:</b> ${e(O(i.fechaSolicitud))}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Solicitante:</b> ${e(i.solicitante)}</td>
                <td style="border:1px solid #d1d5db; padding:6px 8px; font-size:10px; width:25%;"><b>Area:</b> ${e(i.areaDepartamento)}</td>
            </tr>
        </table>`,g=`
        <div style="background:#FFFBEB; border:1px solid #F59E0B; border-radius:4px; padding:8px 12px; margin-bottom:15px; font-size:11px;">
            <b>Tipo de solicitud:</b> &#10003; ${n}
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
        <div style="text-align:center; margin-top:20px; padding-top:10px; border-top:2px solid ${p}; font-size:9px; color:#666;">
            DOCUMENTO INTERNO &mdash; BARACK MERCOSUL &mdash; No reproducir sin autorizacion
        </div>`;return`
        <div style="font-family:Arial,sans-serif; max-width:700px; margin:0 auto; padding:20px;">
            ${s}
            ${x}
            ${g}
            ${u}
            ${f}
            ${h}
            ${$}
        </div>`}async function ot(t){const o=await m();return b(t,o)}async function it(t){const o=await m(),i=b(t,o);return E(i,{paperSize:"a4",orientation:"portrait",margin:[15,15,15,15]})}async function et(t){const o=await m(),i=b(t,o),d=t.header.solicitudNumber||t.producto?.codigo||t.insumo?.codigo||"Solicitud",n=S(d,{allowSpaces:!0}),a=new Date().toISOString().split("T")[0],s=`Solicitud_${n}_${a}.pdf`;await A(i,{filename:s,paperSize:"a4",orientation:"portrait",margin:[15,15,15,15]})}export{et as exportSolicitudPdf,it as generateSolicitudPdfBuffer,ot as getSolicitudPdfPreviewHtml};
