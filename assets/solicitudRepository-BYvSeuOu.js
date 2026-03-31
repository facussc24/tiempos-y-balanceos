import{n as l}from"./solicitudTypes-CpthhG1s.js";import{g as i,l as c,ad as d}from"./index-CG5qkp4C.js";import{g as m}from"./crypto-CYAKiIwB.js";import{e as p}from"./backupService-DhCAHhvK.js";import"./charts-DtjTm6NE.js";import"./supabase-hwi2RHdP.js";async function R(){try{return await(await i()).select(`SELECT id, solicitud_number, tipo, codigo, descripcion, solicitante,
                    area_departamento, status, fecha_solicitud, updated_at,
                    created_by, updated_by,
                    server_folder_path, attachment_count
             FROM solicitud_documents ORDER BY updated_at DESC`)}catch(e){return c.error("SolicitudRepo","Failed to list documents",{},e instanceof Error?e:void 0),[]}}async function g(e){try{const o=await(await i()).select("SELECT data FROM solicitud_documents WHERE id = ?",[e]);if(o.length===0)return null;const r=JSON.parse(o[0].data);return l(r)}catch(t){return c.error("SolicitudRepo",`Failed to load document ${e}`,{},t instanceof Error?t:void 0),null}}async function C(e,t){try{const o=await i(),r=JSON.stringify(t),n=await m(r),a=t.header,s=t.tipo==="producto"?t.producto?.codigo||"":t.insumo?.codigo||"",u=t.tipo==="producto"?t.producto?.descripcion||"":t.insumo?.descripcion||"";return await o.execute(`INSERT OR REPLACE INTO solicitud_documents
             (id, solicitud_number, tipo, codigo, descripcion, solicitante,
              area_departamento, status, fecha_solicitud, created_at, updated_at,
              created_by, updated_by, data, checksum,
              server_folder_path, attachment_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM solicitud_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM solicitud_documents WHERE id = ?), ?),
                     ?,
                     ?, ?, ?, ?)`,[e,a.solicitudNumber||"",t.tipo||"",s,u,a.solicitante||"",a.areaDepartamento||"",t.status||"",a.fechaSolicitud||"",e,e,d(),d(),r,n,t.serverFolderPath||"",t.attachments?.length||0]),p(),!0}catch(o){return c.error("SolicitudRepo",`Failed to save document ${e}`,{},o instanceof Error?o:void 0),!1}}async function w(e){try{return await(await i()).execute("DELETE FROM solicitud_documents WHERE id = ?",[e]),!0}catch(t){return c.error("SolicitudRepo",`Failed to delete document ${e}`,{},t instanceof Error?t:void 0),!1}}async function y(){try{const o=(await(await i()).select("SELECT MAX(solicitud_number) as max_num FROM solicitud_documents"))[0]?.max_num;if(!o)return"SGC-001";const r=o.match(/SGC-(\d+)/);if(!r)return"SGC-001";const n=parseInt(r[1],10)+1;return`SGC-${String(n).padStart(3,"0")}`}catch(e){return c.error("SolicitudRepo","Failed to get next solicitud number",{},e instanceof Error?e:void 0),"SGC-001"}}export{w as deleteSolicitud,y as getNextSolicitudNumber,R as listSolicitudes,g as loadSolicitud,C as saveSolicitud};
