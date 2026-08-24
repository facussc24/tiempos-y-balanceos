import React from 'react';

// ==========================================
// 1. COMPONENTES DE SIMBOLOGÍA
// ==========================================

const ShapeOperation = ({ id }) => (
  <div className="w-16 h-10 rounded-[50%] border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
    {id}
  </div>
);

// Óvalo dentro de rectángulo
const ShapeOpIns = ({ id }) => (
  <div className="w-16 h-12 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center z-10 relative shadow-sm">
     <div className="w-12 h-8 rounded-[50%] border-[1.5px] border-[#60A5FA] flex items-center justify-center text-[#1E40AF] text-[11px] font-bold">
        {id}
     </div>
  </div>
);

const ShapeTransfer = () => (
  <div className="w-7 h-7 rounded-full border-[1.5px] border-[#60A5FA] bg-white z-10 relative shadow-sm"></div>
);

// El almacenado normalmente NO lleva numero de operacion. Pero cuando el Plan de Control
// SI lo numera —el 11 ALMACENAMIENTO EN MEDIOS WIP del Top Roll— el flujograma tiene que
// mostrarlo, o vuelve la ruptura de trazabilidad: un paso numerado en un documento y anonimo
// en el otro es exactamente lo que freno la carga en BeOn el 02/07/2026.
const ShapeStorage = ({ id }) => (
  <div className="w-12 h-12 z-10 relative flex items-center justify-center bg-white shadow-sm">
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
    {id && (
      <span className="absolute top-[7px] left-1/2 -translate-x-1/2 text-[#1E40AF] text-[10px] font-bold">{id}</span>
    )}
  </div>
);

const ShapeInspection = ({ id }) => (
  <div className="w-14 h-10 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
    {id}
  </div>
);

const ShapeCondition = () => (
  <div className="w-10 h-10 z-10 relative flex items-center justify-center bg-white shadow-sm">
     <div className="w-8 h-8 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45"></div>
  </div>
);

const ShapeTerminalSide = ({ text }) => (
  <div className="px-3 py-1.5 border-[1.5px] border-[#f87171] bg-white flex items-center justify-center text-[#dc2626] text-[8.5px] font-bold z-10 relative uppercase shadow-sm rounded-sm max-w-[120px] text-center leading-tight">
    {text}
  </div>
);

// Conector de Salto (Bypass)
const ShapeConnector = ({ id, isOut = true }) => (
  <div className={`w-7 h-7 rounded-full border-[2px] flex items-center justify-center text-[10px] font-black z-10 relative shadow-sm ${isOut ? 'border-[#fb923c] bg-[#fff7ed] text-[#ea580c]' : 'border-[#22c55e] bg-[#f0fdf4] text-[#15803d]'}`}>
    {id}
  </div>
);

// ==========================================
// 2. MOTOR DEL FLUJO (ARQUITECTURA V4 ESTABLE)
// ==========================================

const FlowNode = ({ node, isLast, hasBranches, converges }) => {
  return (
    <div className="relative flex flex-col items-center w-full mb-10 z-10">

      {/* LA LÍNEA CONTINUA (Spine) - Va por detrás asegurando continuidad */}
      {(converges || !isLast || hasBranches || node.mergeDown) && (
         <div className={`absolute top-1/2 left-1/2 w-[1.5px] bg-[#93C5FD] -translate-x-1/2 z-0 -bottom-10`}>
            {node.labelDown && !hasBranches && (
               <div className="absolute top-[60%] -translate-y-1/2 left-2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
                 {node.labelDown}
               </div>
            )}
         </div>
      )}

      {/* CONTENEDOR PRINCIPAL DEL NODO */}
      <div className="flex items-center w-full max-w-4xl relative z-10">

        {/* RETRABAJO (Anclado matemáticamente a la izquierda de la figura) */}
        {node.rework && (
          <div className="absolute right-1/2 mr-10 top-1/2 -translate-y-1/2 w-[90px] h-[100px] -mt-[50px] -z-10 border-l-[1.5px] border-b-[1.5px] border-[#93C5FD] rounded-bl-xl">
             <div className="absolute top-0 left-[-4.5px] w-2 h-2 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform -rotate-45"></div>
             <div className="absolute bottom-[-10px] right-2 text-[8.5px] font-bold text-[#60A5FA] whitespace-nowrap bg-white/90 px-1 border border-[#93C5FD] rounded-md shadow-sm z-10">
               {node.rework.label || `RETRABAJO (A OP. ${node.rework.targetId})`}
             </div>
          </div>
        )}

        {/* CONECTOR DE ENTRADA ("VIENE DE A") */}
        {node.incomingConnector && (
          <div className="absolute right-1/2 mr-10 top-1/2 -translate-y-1/2 flex items-center z-10">
             <span className="mr-1.5 text-[8px] font-bold text-[#15803d] bg-white/90 px-1 rounded shadow-sm border border-[#f3f4f6]">VIENE DE</span>
             <ShapeConnector id={node.incomingConnector} isOut={false} />
             <div className="w-[16px] h-[1.5px] bg-[#f0fdf4]0 relative -z-10">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#22c55e] transform rotate-45 translate-x-[1px]"></div>
             </div>
          </div>
        )}

        {/* IZQUIERDA: Críticos y Condiciones */}
        <div className="flex-1 flex justify-end items-center pr-6 space-x-2 relative z-10">
           {/* Caracteristica especial. La "D" de VDA va en ROJO por requisito del cliente:
               Cristian Anel (Cozzuol) 09/06/2026 — piezas de seguridad y reglamentacion,
               "toda la documentacion (diagrama de flujo, AMFE, plan de control, etc.) debe
               estar identificada segun la norma VDA con una letra 'D' de color rojo".
               `criticalColor` permite otro color si algun cliente pide una marca distinta. */}
           {node.critical && (
             <span className={`text-[11px] font-black bg-white/80 px-1 rounded border ${node.criticalColor === 'black' ? 'text-black border-black' : 'text-[#DC2626] border-[#DC2626]'}`}>{node.criticalType}</span>
           )}
           {node.type === 'condition' && node.branchSide?.direction !== 'left' && (
             <span className="text-[9px] font-bold text-[#60A5FA] italic uppercase text-right leading-tight max-w-[100px] bg-white/80 px-1 rounded">
               {node.labelCondition}
             </span>
           )}
        </div>

        {/* CENTRO: La Figura (Ancho fijo de control) */}
        <div className="flex flex-col items-center justify-center relative w-20 shrink-0">
          {node.type === 'operation' && <ShapeOperation id={node.stepId} />}
          {node.type === 'op-ins' && <ShapeOpIns id={node.stepId} />}
          {node.type === 'transfer' && <ShapeTransfer />}
          {node.type === 'storage' && <ShapeStorage id={node.stepId} />}
          {node.type === 'inspection' && <ShapeInspection id={node.stepId} />}
          {node.type === 'condition' && <ShapeCondition />}
          {node.type === 'terminal' && <ShapeTerminalSide text={node.text} />}
        </div>

        {/* DERECHA: Descripción Principal y Condición si rama es izquierda */}
        <div className="flex-1 text-left pl-6 relative z-10 flex flex-col justify-center items-start">
          {node.description && (
            <div className="text-[10px] font-bold text-[#1f2937] uppercase max-w-[280px] leading-snug bg-white/80 p-1 rounded inline-block">
              {node.description}
            </div>
          )}
          {node.type === 'condition' && node.branchSide?.direction === 'left' && (
             <span className="text-[9px] font-bold text-[#60A5FA] italic uppercase text-left leading-tight max-w-[100px] bg-white/80 px-1 rounded">
               {node.labelCondition}
             </span>
          )}
        </div>

        {/* RAMA LATERAL (Descartes, Ramas o Conectores de Salida) */}
        {node.branchSide && (
          <div
            className={`absolute top-1/2 h-[1.5px] bg-[#93C5FD] -translate-y-1/2 -z-10 flex items-center ${
              node.branchSide.direction === 'left' ? 'right-[50%] mr-10' : 'left-[50%] ml-10'
            }`}
            style={{ width: node.branchSide.lineWidth ? `${node.branchSide.lineWidth}px` : (node.branchSide.sequence ? '550px' : (node.description && node.branchSide.direction !== 'left' ? '280px' : '120px')) }}
          >
             {node.branchSide.direction === 'left' ? (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-b-[1.5px] border-l-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[-1px]"></div>
             ) : (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[1px]"></div>
             )}

             {/* Destino de la rama lateral */}
             <div className={`absolute flex flex-col ${
                 node.branchSide.direction === 'left' ? 'right-full' : 'left-full'
               } ${
                 node.branchSide.sequence
                   ? (node.branchSide.direction === 'left' ? 'top-0 items-center translate-x-1/2' : 'top-0 items-center -translate-x-1/2')
                   : `top-1/2 -translate-y-1/2 ${node.branchSide.direction === 'left' ? 'items-end mr-2 text-right' : 'items-start ml-2 text-left'}`
             }`}>
                {node.branchSide.sequence ? (
                   <div className="relative -mt-5 w-[500px]">
                     <FlowSequence sequence={node.branchSide.sequence} converges={false} />
                   </div>
                ) : (
                  <>
                    {node.branchSide.type === 'terminal' && <ShapeTerminalSide text={node.branchSide.text} />}
                    {node.branchSide.type === 'operation' && <ShapeOperation id={node.branchSide.stepId} />}
                    {node.branchSide.type === 'connector' && <ShapeConnector id={node.branchSide.text} isOut={true} />}
                    {node.branchSide.type === 'inspection' && <ShapeInspection id={node.branchSide.stepId} />}

                    {node.branchSide.description && (
                      <div className={`absolute top-full mt-2 w-32 ${node.branchSide.direction === 'left' ? 'text-right right-0' : 'text-left left-0'} text-[8px] font-bold text-[#4b5563] uppercase leading-snug bg-white/90 p-1 rounded z-10`}>
                        {node.branchSide.description}
                      </div>
                    )}
                  </>
                )}
             </div>

             {/* Etiqueta NO sobre la línea */}
             {node.branchSide.labelNode && (
                <span className={`absolute ${node.branchSide.direction === 'left' ? 'right-6' : 'left-6'} -top-3.5 text-[9px] font-bold text-[#60A5FA] bg-white px-1 rounded`}>
                  {node.branchSide.labelNode}
                </span>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

// COMPONENTE: División de Ramas (Múltiples columnas - Lógica V4 indestructible)
const BranchSplit = ({ branches, labelDown, converges }) => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative z-0 flex mt-[-2px] items-stretch justify-center">
         {/* Etiqueta opcional "SI" o "NO" entrando a la rama */}
         {labelDown && (
            <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
              {labelDown}
            </div>
         )}
         {branches.map((branch, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center relative min-w-[900px] px-4">

               {/* Línea horizontal continua superior */}
               {branches.length > 1 && idx === 0 && <div className="absolute top-0 right-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {branches.length > 1 && idx === branches.length - 1 && <div className="absolute top-0 left-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {branches.length > 1 && idx > 0 && idx < branches.length - 1 && <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#93C5FD]"></div>}

               {/* Línea vertical hacia el primer nodo de la sub-rama */}
               <div className="w-[1.5px] h-12 bg-[#93C5FD] relative z-0 -mb-6 shrink-0"></div>

               <div className="w-full relative z-10 flex flex-col pt-0">
                 <FlowSequence sequence={branch} converges={converges} />
               </div>

               {/* Línea vertical que se estira para igualar alturas si converge */}
               {converges && (
                  <div className="w-[1.5px] flex-1 bg-[#93C5FD] relative z-0"></div>
               )}

               {/* Línea horizontal continua inferior para convergencia */}
               {converges && branches.length > 1 && idx === 0 && <div className="absolute bottom-0 right-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {converges && branches.length > 1 && idx === branches.length - 1 && <div className="absolute bottom-0 left-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {converges && branches.length > 1 && idx > 0 && idx < branches.length - 1 && <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#93C5FD]"></div>}
            </div>
         ))}
      </div>
      {/* Línea vertical que baja después de la convergencia */}
      {converges && (
        <div className="w-[1.5px] h-12 bg-[#93C5FD] relative z-0"></div>
      )}
    </div>
  );
};

// Iterador Recursivo
const FlowSequence = ({ sequence, converges = false }) => {
  return (
    <div className="flex flex-col items-center w-full h-full">
      {sequence.map((node, index) => {
         const hasBranches = node.branches && node.branches.length > 0;
         const isLast = index === sequence.length - 1;
         const nodeConverges = isLast ? converges : true;

         return (
           <React.Fragment key={index}>
              <FlowNode node={node} isLast={isLast} hasBranches={hasBranches} converges={nodeConverges} />
              {hasBranches && <BranchSplit branches={node.branches} labelDown={node.labelDown} converges={nodeConverges} />}
           </React.Fragment>
         );
      })}
    </div>
  );
};

const HeaderCell = ({ label, value, colSpan = "col-span-1" }) => (
  <div className={`border border-[#60A5FA] p-1.5 flex flex-col justify-center min-h-[42px] ${colSpan}`}>
    <span className="text-[7px] text-[#1E40AF] font-bold uppercase mb-0.5 leading-none">{label}</span>
    <span className="text-[10px] text-[#111827] font-bold uppercase truncate">{value}</span>
  </div>
);

// ==========================================
// 3. CÁLCULO DE PADDINGS (evita que se corten las ramas laterales)
// ==========================================

// Calcula el padding derecho necesario basado en el tamaño de las ramas laterales
const getRightPadding = (sequence) => {
  let maxPadding = 48; // px-12 = 3rem = 48px
  const checkNodes = (seq) => {
    if (!seq || !Array.isArray(seq)) return;
    for (const node of seq) {
      if (node.branchSide) {
        if (node.branchSide.sequence) {
           maxPadding = Math.max(maxPadding, 750); // 750px para secuencia paralela
        } else {
           const baseW = (node.description && node.branchSide.direction !== 'left') ? 300 : 150;
           maxPadding = Math.max(maxPadding, baseW); // ajustado según el contenido
        }
      }
      if (node.branches) {
        for (const b of node.branches) {
           const branchSeq = Array.isArray(b) ? b : b.sequence;
           checkNodes(branchSeq);
        }
      }
    }
  };
  checkNodes(sequence);
  return maxPadding;
};

// Calcula el padding inferior basado si es que las ramas paralelas (absolute) son más largas que la rama principal
const getBottomPadding = (sequence) => {
  const getSequenceDepth = (seq) => {
    if (!seq || !Array.isArray(seq)) return 0;
    let maxDepth = seq.length;
    for (let i = 0; i < seq.length; i++) {
      const node = seq[i];
      if (node.branchSide && node.branchSide.sequence) {
        maxDepth = Math.max(maxDepth, i + getSequenceDepth(node.branchSide.sequence));
      }
      if (node.branches) {
        let maxBranchDepth = 0;
        for (const b of node.branches) {
          const branchSeq = Array.isArray(b) ? b : b.sequence;
          if (branchSeq) {
            maxBranchDepth = Math.max(maxBranchDepth, getSequenceDepth(branchSeq));
          }
        }
        maxDepth = Math.max(maxDepth, i + 1 + maxBranchDepth);
      }
    }
    return maxDepth;
  };

  const depth = getSequenceDepth(sequence);
  const extraSlots = depth - (sequence ? sequence.length : 0);
  return Math.max(0, extraSlots * 80 + 20); // Ajuste preciso: 48px (shape) + 32px (margin). Menos espacio vacío.
};

// ==========================================
// 4. DOCUMENTO (motor de render puro, sin UI de edición)
// ==========================================

export default function Flowchart({ header, products, flow, revisions = [], showLegend = true, logoUrl = null }) {
  const rightPaddingStr = `${getRightPadding(flow)}px`;
  const bottomPaddingStr = `${getBottomPadding(flow)}px`;

  return (
      <div id="pdf-content" className={`p-4 md:p-8 print:p-0 print:bg-white print:w-fit print:min-w-full w-fit min-w-full`}>

        {/* ENCABEZADO TÉCNICO */}
      <div className={`w-full mx-auto bg-white border-[1.5px] border-[#60A5FA] mb-8 shadow-sm print:max-w-none max-w-none`}>
        <div className="grid grid-cols-4">
          <div className="col-span-1 border-r-[1.5px] border-[#60A5FA] p-3 flex flex-col items-center justify-center bg-[#f9fafb] relative">
             {logoUrl ? (
               <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" />
             ) : (
               <>
                 <div className="text-[#1E3A8A] font-serif font-black text-2xl tracking-tighter">BARACK</div>
                 <div className="text-[#9ca3af] text-[10px] tracking-widest font-light">MERCOSUL</div>
               </>
             )}
          </div>
          <div className="col-span-2 border-r-[1.5px] border-[#60A5FA] flex items-center justify-center p-4 text-center">
             <h1 className="text-xl font-black text-[#1E3A8A] uppercase italic leading-tight">
               {header.title}
             </h1>
          </div>
          {/* El formulario oficial I-IN-002/III tiene FECHA DE EMISION y FECHA DE REVISION
              como campos SEPARADOS: los .vsdx del servidor los traen, y el generador de
              Claude Design los habia colapsado en uno solo, con lo cual la fecha original
              se perdia en cada revision. Se recupera la separacion. */}
          <div className="col-span-1 grid grid-rows-4">
             <HeaderCell label="Código del Documento" value={header.documentCode} />
             <div className="grid grid-cols-3">
                <HeaderCell label="Revisión" value={header.revision} />
                <HeaderCell label="Fecha Emisión" value={header.date} />
                <HeaderCell label="Fecha Revisión" value={header.revisionDate || '—'} />
             </div>
             <div className="grid grid-cols-2">
                <HeaderCell label="Elaborado por" value={header.preparedBy} />
                <HeaderCell label="Revisado por" value={header.reviewedBy} />
             </div>
             <div className="grid grid-cols-2">
                <HeaderCell label="Proyecto" value={header.project} />
                <HeaderCell label="Cliente" value={header.client} />
             </div>
          </div>
        </div>
      </div>

      <div className={`mx-auto flex flex-col gap-8 items-center relative print:max-w-none print:w-full max-w-none w-full`}>

         {/* COLUMNA IZQUIERDA: EL DIAGRAMA MASIVO */}
         <main className={`w-full bg-white border-[1.5px] border-[#e5e7eb] shadow-sm pt-10 pb-16 rounded-lg print:overflow-visible overflow-visible`}>
           {/* pl-32 asegura margen durante el scroll horizontal para ramas laterales a la izquierda */}
           <div className="min-w-fit pl-40 mx-auto" style={{ paddingRight: rightPaddingStr, paddingBottom: bottomPaddingStr }}>
             <FlowSequence sequence={flow} />
           </div>
         </main>

         {/* COLUMNA DERECHA: PANEL LATERAL COMPACTO Y DIVIDIDO -> AHORA ABAJO */}
         {showLegend && (
         <aside className="w-full max-w-[1500px] shrink-0 z-20">
            <div className="border-[1.5px] border-[#60A5FA] bg-white shadow-md rounded-lg overflow-hidden flex flex-col">

              <div className="flex flex-row divide-x-[1.5px] divide-[#60A5FA]">

                {/* MITAD IZQUIERDA: REFERENCIAS */}
                <div className="w-[24%] p-4 space-y-3 bg-[#f9fafb]">
                  <h4 className="text-[9px] font-black text-[#1E3A8A] border-b border-[#e5e7eb] pb-1 mb-3">SÍMBOLOS Y REFERENCIAS</h4>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <div className="w-7 h-4 rounded-[50%] border-[1.5px] border-[#60A5FA] bg-white"></div>
                    </div>
                    <span>OPERACIÓN</span>
                  </div>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <div className="w-7 h-5 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center">
                         <div className="w-5 h-3 rounded-[50%] border-[1.5px] border-[#60A5FA]"></div>
                      </div>
                    </div>
                    <span>OP. + INSPECCIÓN</span>
                  </div>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <div className="w-4 h-4 rounded-full border-[1.5px] border-[#60A5FA] bg-white"></div>
                    </div>
                    <span>TRASLADO</span>
                  </div>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                        <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke="#60A5FA" strokeWidth="3" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span>ALMACENADO</span>
                  </div>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <div className="w-6 h-4 border-[1.5px] border-[#60A5FA] bg-white"></div>
                    </div>
                    <span>INSPECCIÓN</span>
                  </div>

                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151]">
                    <div className="w-8 flex justify-center shrink-0">
                      <div className="w-4 h-4 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45"></div>
                    </div>
                    <span>CONDICIÓN</span>
                  </div>

                  {/* Icono de Conector de Salto */}
                  <div className="flex items-center gap-3 text-[9px] font-bold text-[#374151] mt-2 pt-2 border-t border-[#e5e7eb]">
                    <div className="w-8 flex justify-center shrink-0">
                       <div className="w-5 h-5 rounded-full border-[2px] border-[#fb923c] bg-[#fff7ed] flex items-center justify-center text-[#ea580c] text-[7px] font-black">X</div>
                    </div>
                    <span>CONECTOR</span>
                  </div>

                </div>

                {/* MITAD DERECHA: CÓDIGOS DE PRODUCTO */}
                <div className="w-[30%] p-4 bg-white overflow-x-auto">
                  <h4 className="text-[9px] font-black text-[#1E3A8A] border-b border-[#e5e7eb] pb-1 mb-3">CÓDIGOS PROD. TERMINADO</h4>

                  {/* La columna OPERACIONES es opcional y aparece sola cuando algun producto
                      la trae. Nace de un pedido explicito del cliente interno: Carlos Baptista,
                      20/08/2026 — "Necesito la planilla de codigos indicando que pieza aplica a
                      cada operacion, hay algunas que no van remachadas" y "en el proceso de mesa
                      de corte hay muchos codigos que solo se cortan y se envian". Sin esto, un
                      flujograma de familia no dice que pieza recorre que camino.
                      Los 5 flujogramas ya emitidos no traen `operations`: para ellos la tabla
                      queda exactamente igual que antes. */}
                  {(() => {
                    const conOps = products.some(p => p.operations);
                    const encabezados = header.productsColumns || {};
                    return (
                  <table className="w-full text-[8.5px] font-bold text-[#374151]">
                    <thead>
                      <tr className="text-[#9ca3af] border-b border-[#e5e7eb] text-left">
                        <th className="pb-1 font-black whitespace-nowrap">{encabezados.code || 'Part Number VW'}</th>
                        <th className="pb-1 font-black whitespace-nowrap">{encabezados.level || 'Nivel'}</th>
                        <th className="pb-1 font-black">{encabezados.description || 'Descripción / Componente'}</th>
                        {conOps && <th className="pb-1 font-black whitespace-nowrap">{encabezados.operations || 'Operaciones'}</th>}
                        <th className="pb-1 font-black whitespace-nowrap text-right">{encabezados.version || 'Color/Versión'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {products.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 text-[#60A5FA] whitespace-nowrap">{item.code}</td>
                          <td className="py-1.5 whitespace-nowrap">{item.level}</td>
                          <td className="py-1.5 pr-2 leading-tight">{item.description}</td>
                          {conOps && <td className="py-1.5 whitespace-nowrap">{item.operations}</td>}
                          <td className="py-1.5 text-right leading-tight">{item.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    );
                  })()}
                </div>

                {/* TERCER BLOQUE: HISTORIAL DE REVISIONES.
                    Lo exige APQP 3ra ed. §1.15 ("every APQP output document must have a
                    change log") y lo pide IATF 16949 8.5.6.1. Las 6 columnas NO son
                    inventadas: son las mismas que ya usan el AMFE (I-AC-005.3) y el Plan
                    de Control (I-AC-005.2) de Barack, para que los tres documentos
                    registren los cambios igual. El motor de Claude Design no lo tenia:
                    `revision` era un escalar y no habia donde decir QUE cambio. */}
                <div className="w-[46%] p-4 bg-white overflow-x-auto">
                  <h4 className="text-[9px] font-black text-[#1E3A8A] border-b border-[#e5e7eb] pb-1 mb-3">HISTORIAL DE REVISIONES</h4>

                  <table className="w-full text-[8.5px] font-bold text-[#374151] table-fixed">
                    <thead>
                      <tr className="text-[#9ca3af] border-b border-[#e5e7eb] text-left">
                        <th className="pb-1 font-black w-[7%]">Rev.</th>
                        <th className="pb-1 font-black w-[15%]">Fecha</th>
                        <th className="pb-1 font-black w-[16%]">Ítem cambiado</th>
                        <th className="pb-1 font-black w-[44%]">Detalles</th>
                        <th className="pb-1 font-black w-[10%]">Fecha PSW</th>
                        <th className="pb-1 font-black w-[8%] text-right">Modificó</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {revisions.map((r, idx) => {
                        // La letra VIGENTE en rojo, igual que en la caratula del AMFE.
                        const vigente = idx === revisions.length - 1;
                        return (
                          <tr key={idx} className="align-top">
                            <td className={`py-1.5 ${vigente ? 'text-[#DC2626] font-black' : ''}`}>{r.rev}</td>
                            <td className="py-1.5 whitespace-nowrap">{r.date}</td>
                            <td className="py-1.5 break-words">{r.item}</td>
                            <td className="py-1.5 font-semibold leading-snug break-words">{r.details}</td>
                            <td className="py-1.5 whitespace-nowrap">{r.pswDate}</td>
                            <td className="py-1.5 text-right">{r.modifiedBy}</td>
                          </tr>
                        );
                      })}
                      {/* Renglones libres para las revisiones que vengan. El AMFE deja 12. */}
                      {Array.from({ length: Math.max(0, 6 - revisions.length) }).map((_, i) => (
                        <tr key={`libre-${i}`}><td className="py-1.5">&nbsp;</td><td /><td /><td /><td /><td /></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
         </aside>
         )}

      </div>
      </div>
  );
}
