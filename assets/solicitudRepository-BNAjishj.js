import{n as l}from"./solicitudTypes-CpthhG1s.js";import{g as i,l as c,q as m,aU as d,aJ as p}from"./index-DTG1FwU1.js";import"./charts-DtjTm6NE.js";import"./supabase-hwi2RHdP.js";async function f(){try{return await(await i()).select(`SELECT id, solicitud_number, tipo, codigo, descripcion, solicitante,
                    area_departamento, status, fecha_solicitud, updated_at,
                    created_by, updated_by,
                    server_folder_path, attachment_count
             FROM solicitud_documents ORDER BY updated_at DESC`)}catch(e){return c.error("SolicitudRepo","Failed to list documents",{},e instanceof Error?e:void 0),[]}}async function b(e){try{const o=await(await i()).select("SELECT data FROM solicitud_documents WHERE id = ?",[e]);if(o.length===0)return null;const a=JSON.parse(o[0].data);return l(a)}catch(t){return c.error("SolicitudRepo",`Failed to load document ${e}`,{},t instanceof Error?t:void 0),null}}async function R(e,t){try{const o=await i(),a=JSON.stringify(t),n=await m(a),r=t.header,s=t.tipo==="producto"?t.producto?.codigo||"":t.insumo?.codigo||"",u=t.tipo==="producto"?t.producto?.descripcion||"":t.insumo?.descripcion||"";return await o.execute(`INSERT OR REPLACE INTO solicitud_documents
             (id, solicitud_number, tipo, codigo, descripcion, solicitante,
              area_departamento, status, fecha_solicitud, created_at, updated_at,
              created_by, updated_by, data, checksum,
              server_folder_path, attachment_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                     COALESCE((SELECT created_at FROM solicitud_documents WHERE id = ?), datetime('now')),
                     datetime('now'),
                     COALESCE((SELECT created_by FROM solicitud_documents WHERE id = ?), ?),
                     ?,
                     ?, ?, ?, ?)`,[e,r.solicitudNumber||"",t.tipo||"",s,u,r.solicitante||"",r.areaDepartamento||"",t.status||"",r.fechaSolicitud||"",e,e,d(),d(),a,n,t.serverFolderPath||"",t.attachments?.length||0]),p(),!0}catch(o){return c.error("SolicitudRepo",`Failed to save document ${e}`,{},o instanceof Error?o:void 0),!1}}async function C(e){try{return await(await i()).execute("DELETE FROM solicitud_documents WHERE id = ?",[e]),!0}catch(t){return c.error("SolicitudRepo",`Failed to delete document ${e}`,{},t instanceof Error?t:void 0),!1}}async function g(){try{const o=(await(await i()).select("SELECT MAX(solicitud_number) as max_num FROM solicitud_documents"))[0]?.max_num;if(!o)return"SGC-001";const a=o.match(/SGC-(\d+)/);if(!a)return"SGC-001";const n=parseInt(a[1],10)+1;return`SGC-${String(n).padStart(3,"0")}`}catch(e){return c.error("SolicitudRepo","Failed to get next solicitud number",{},e instanceof Error?e:void 0),"SGC-001"}}export{C as deleteSolicitud,g as getNextSolicitudNumber,f as listSolicitudes,b as loadSolicitud,R as saveSolicitud};
