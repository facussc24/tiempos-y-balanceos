import React, { useState, useRef, useEffect } from 'react';
import { toPng, toSvg } from 'html-to-image';
import { Image as ImageIcon, FileCode2, Printer, Code2, Save, X, FileJson } from 'lucide-react';
import { flowchartHeaderData as defaultHeader, flowchartProductCodes as defaultProductCodes, flowchartData as defaultFlowData } from '../../src/data/flowchartKnowledge';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { FlowchartDocument } from './flowchartTypes';
import barackLogo from '../../src/assets/barack_logo.png';
import { toast } from '../../components/ui/Toast';

// ==========================================
// 1. COMPONENTES DE SIMBOLOGÍA 
// ==========================================

const ShapeOperation = ({ id }: { id?: string }) => (
  <div className="w-16 h-10 rounded-[50%] border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
    {id}
  </div>
);

// Óvalo dentro de rectángulo
const ShapeOpIns = ({ id }: { id?: string }) => (
  <div className="w-16 h-12 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center z-10 relative shadow-sm">
     <div className="w-12 h-8 rounded-[50%] border-[1.5px] border-[#60A5FA] flex items-center justify-center text-[#1E40AF] text-[11px] font-bold">
        {id}
     </div>
  </div>
);

const ShapeTransfer = () => (
  <div className="w-7 h-7 rounded-full border-[1.5px] border-[#60A5FA] bg-white z-10 relative shadow-sm"></div>
);

const ShapeStorage = () => (
  <div className="w-12 h-12 z-10 relative flex items-center justify-center bg-white shadow-sm">
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  </div>
);

const ShapeInspection = ({ id }: { id?: string }) => (
  <div className="w-14 h-10 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
    {id}
  </div>
);

const ShapeCondition = () => (
  <div className="w-10 h-10 z-10 relative flex items-center justify-center bg-white shadow-sm">
     <div className="w-8 h-8 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45"></div>
  </div>
);

const ShapeTerminalSide = ({ text }: { text: string }) => (
  <div className="px-3 py-1.5 border-[1.5px] border-[#f87171] bg-white flex items-center justify-center text-[#dc2626] text-[8.5px] font-bold z-10 relative uppercase shadow-sm rounded-sm max-w-[120px] text-center leading-tight">
    {text}
  </div>
);

// Conector de Salto (Bypass)
const ShapeConnector = ({ id, isOut = true }: { id: string, isOut?: boolean }) => (
  <div className={`w-7 h-7 rounded-full border-[2px] flex items-center justify-center text-[10px] font-black z-10 relative shadow-sm ${isOut ? 'border-[#fb923c] bg-[#fff7ed] text-[#ea580c]' : 'border-[#22c55e] bg-[#f0fdf4] text-[#15803d]'}`}>
    {id}
  </div>
);

// ==========================================
// 2. MOTOR DEL FLUJO (ARQUITECTURA V4 ESTABLE)
// ==========================================

const FlowNode = ({ node, isLast, hasBranches, converges }: any) => {
  return (
    <div className="relative flex flex-col items-center w-full mb-10 z-10">
      
      {/* LA LÍNEA CONTINUA (Spine) - Va por detrás asegurando continuidad */}
      {(converges || !isLast || hasBranches) && (
         <div className="absolute top-1/2 -bottom-10 left-1/2 w-[1.5px] bg-[#93C5FD] -translate-x-1/2 z-0">
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
             <div className="absolute -top-3 left-2 text-[8.5px] font-bold text-[#60A5FA] whitespace-nowrap bg-white/90 px-1 border border-[#93C5FD] rounded-md shadow-sm z-10">
               RETRABAJO (A OP. {node.rework.targetId})
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
           {node.critical && (
             <span className="text-[10px] font-black text-black bg-white/80 px-1 rounded">{node.criticalType}</span>
           )}
           {node.type === 'condition' && (
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
          {node.type === 'storage' && <ShapeStorage />}
          {node.type === 'inspection' && <ShapeInspection id={node.stepId} />}
          {node.type === 'condition' && <ShapeCondition />}
          {node.type === 'terminal' && <ShapeTerminalSide text={node.text} />}
        </div>

        {/* DERECHA: Descripción Principal */}
        <div className="flex-1 text-left pl-6 relative z-10">
          {node.description && (
            <div className="text-[10px] font-bold text-[#1f2937] uppercase max-w-[280px] leading-snug bg-white/80 p-1 rounded inline-block">
              {node.description}
            </div>
          )}
        </div>

        {/* RAMA LATERAL (Descartes, Ramas o Conectores de Salida) */}
        {node.branchSide && (
          <div className="absolute left-[50%] ml-10 top-1/2 h-[1.5px] bg-[#93C5FD] -translate-y-1/2 -z-10 flex items-center" style={{ width: node.branchSide.sequence ? '500px' : '320px' }}>
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[1px]"></div>
             
             {/* Destino de la rama lateral */}
             <div className={`absolute left-full flex flex-col ${node.branchSide.sequence ? 'top-0 items-center -translate-x-1/2' : 'top-1/2 -translate-y-1/2 items-start ml-2'}`}>
                {node.branchSide.sequence ? (
                   <div className="relative -mt-5 w-[600px]">
                     <FlowSequence sequence={node.branchSide.sequence} converges={false} />
                   </div>
                ) : (
                  <>
                    {node.branchSide.type === 'terminal' && <ShapeTerminalSide text={node.branchSide.text} />}
                    {node.branchSide.type === 'operation' && <ShapeOperation id={node.branchSide.stepId} />}
                    {node.branchSide.type === 'connector' && <ShapeConnector id={node.branchSide.text} isOut={true} />}
                    {node.branchSide.type === 'inspection' && <ShapeInspection id={node.branchSide.stepId} />}
                    
                    {node.branchSide.description && (
                      <div className="absolute top-full mt-2 w-32 text-left text-[8px] font-bold text-[#4b5563] uppercase leading-snug bg-white/90 p-1 rounded z-10">
                        {node.branchSide.description}
                      </div>
                    )}
                  </>
                )}
             </div>

             {/* Etiqueta NO sobre la línea */}
             {node.branchSide.labelNode && (
                <span className="absolute left-6 -top-3.5 text-[9px] font-bold text-[#60A5FA] bg-white px-1 rounded">
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
const BranchSplit = ({ branches, labelDown, converges }: any) => {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative z-0 flex mt-[-2px] items-stretch justify-center"> 
         {/* Etiqueta opcional "SI" o "NO" entrando a la rama */}
         {labelDown && (
            <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
              {labelDown}
            </div>
         )}
         {branches.map((branch: any, idx: number) => (
            <div key={idx} className="flex-1 flex flex-col items-center relative min-w-[500px] px-4">
               
               {/* Línea horizontal continua superior */}
               {branches.length > 1 && idx === 0 && <div className="absolute top-0 right-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {branches.length > 1 && idx === branches.length - 1 && <div className="absolute top-0 left-0 w-1/2 h-[1.5px] bg-[#93C5FD]"></div>}
               {branches.length > 1 && idx > 0 && idx < branches.length - 1 && <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#93C5FD]"></div>}

               {/* Línea vertical hacia el primer nodo de la sub-rama */}
               <div className="w-[1.5px] h-12 bg-[#93C5FD] relative z-0 -mb-6 shrink-0"></div>
               
               <div className="w-full relative z-10 flex flex-col flex-1">
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
const FlowSequence = ({ sequence, converges = false }: any) => {
  return (
    <div className="flex flex-col items-center w-full h-full">
      {sequence.map((node: any, index: number) => {
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

// ==========================================
// 3. DATOS MASIVOS Y APP PRINCIPAL
// ==========================================

const HeaderCell = ({ label, value, colSpan = "col-span-1" }: any) => (
  <div className={`border border-[#60A5FA] p-1.5 flex flex-col justify-center min-h-[42px] ${colSpan}`}>
    <span className="text-[7px] text-[#1E40AF] font-bold uppercase mb-0.5 leading-none">{label}</span>
    <span className="text-[10px] text-[#111827] font-bold uppercase truncate">{value}</span>
  </div>
);

interface FlowchartAppProps {
   amfeData?: AmfeDocument; 
   flowchartData?: FlowchartDocument | null;
   onSaveFlowchart?: (doc: FlowchartDocument) => void;
   projectPath?: string | null;
}

export default function FlowchartApp({ amfeData, flowchartData, onSaveFlowchart, projectPath }: FlowchartAppProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(barackLogo);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentHeader = flowchartData?.header || defaultHeader;
  const currentProductCodes = flowchartData?.productCodes || defaultProductCodes;
  const currentNodes = flowchartData?.nodes || defaultFlowData;

  const [draftJson, setDraftJson] = useState('');

  useEffect(() => {
     setDraftJson(JSON.stringify({
         header: currentHeader,
         productCodes: currentProductCodes,
         nodes: currentNodes
     }, null, 2));
  }, [currentHeader, currentProductCodes, currentNodes]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportPNG = async () => {
    setIsExporting(true);
    setTimeout(async () => {
      const element = document.getElementById('pdf-content');
      if (!element) {
        setIsExporting(false);
        return;
      }
      try {
        const dataUrl = await toPng(element, { backgroundColor: '#F3F4F6', pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `Flujograma_${(projectPath || amfeData?.header.subject || 'Flujo').replace(/[/\s]+/g, '_')}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Error exporting PNG:', error);
        toast.error('No se pudo generar el PNG', error instanceof Error ? error.message : 'Error desconocido al exportar la imagen.');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const handleExportSVG = async () => {
    setIsExporting(true);
    setTimeout(async () => {
      const element = document.getElementById('pdf-content');
      if (!element) {
        setIsExporting(false);
        return;
      }
      try {
        const dataUrl = await toSvg(element, { backgroundColor: '#F3F4F6' });
        const link = document.createElement('a');
        link.download = `Flujograma_${(projectPath || amfeData?.header.subject || 'Flujo').replace(/[/\s]+/g, '_')}.svg`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Error exporting SVG:', error);
        toast.error('No se pudo generar el SVG', error instanceof Error ? error.message : 'Error desconocido al exportar el archivo.');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  const handlePrint = () => {
    window.print();
  };

  const displayHeader = {
     ...currentHeader,
     title: currentHeader.title,
     project: amfeData?.header.subject ?? currentHeader.project,
     client: amfeData?.header.client ?? currentHeader.client,
  };

  const handleSaveJson = () => {
     try {
        const parsed = JSON.parse(draftJson);
        const linkedAmfeProject = projectPath || amfeData?.header.subject || 'unknown_project';
        const docToSave: FlowchartDocument = {
            id: flowchartData?.id || crypto.randomUUID(),
            linkedAmfeProject,
            header: parsed.header || currentHeader,
            productCodes: parsed.productCodes || currentProductCodes,
            nodes: parsed.nodes || currentNodes,
            createdAt: flowchartData?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        onSaveFlowchart?.(docToSave);
        setShowJsonEditor(false);
        setJsonError(null);
     } catch (_err) {
        setJsonError('Formato JSON inválido. Revisa la sintaxis.');
     }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans relative">
      
      {/* Botones flotantes para exportar */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50 no-print">
        <button 
          onClick={() => setShowJsonEditor(true)}
          className="bg-[#8b5cf6] text-white p-3 rounded-full shadow-lg hover:bg-violet-700 transition-colors flex items-center justify-center group"
          title="Editar Datos (JSON Técnico)"
        >
          <FileJson size={22} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-bold text-sm">
            Editar Base
          </span>
        </button>

        <button 
          onClick={handlePrint}
          className="bg-[#1F2937] text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors flex items-center justify-center group"
          title="Imprimir / Guardar como PDF (Nativo)"
        >
          <Printer size={22} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-bold text-sm">
            Imprimir / PDF
          </span>
        </button>

        <button 
          onClick={handleExportSVG}
          className="bg-[#059669] text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center group"
          title="Exportar como Vector (SVG)"
        >
          <FileCode2 size={22} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-bold text-sm">
            Exportar SVG
          </span>
        </button>

        <button 
          onClick={handleExportPNG}
          className="bg-[#1E40AF] text-white p-3 rounded-full shadow-lg hover:bg-[#1e40af] transition-colors flex items-center justify-center group"
          title="Exportar como Imagen (PNG)"
        >
          <ImageIcon size={22} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-bold text-sm">
            Exportar PNG
          </span>
        </button>
      </div>

      {/* Contenedor que será capturado para el PDF */}
      <div id="pdf-content" className={`p-4 md:p-8 print:p-0 print:bg-[#F3F4F6] print:w-fit print:min-w-full ${isExporting ? 'w-fit min-w-full bg-[#F3F4F6]' : ''}`}>
        
        {/* ENCABEZADO TÉCNICO */}
      <div className={`w-full mx-auto bg-white border-[1.5px] border-[#60A5FA] mb-8 shadow-sm print:max-w-none ${isExporting ? 'max-w-none' : 'max-w-[1400px]'}`}>
        <div className="grid grid-cols-4">
          <div 
            className="col-span-1 border-r-[1.5px] border-[#60A5FA] p-3 flex flex-col items-center justify-center bg-[#f9fafb] cursor-pointer relative group"
            onClick={() => fileInputRef.current?.click()}
            title="Clic para cambiar logo"
          >
             <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
             {logoUrl ? (
               <img src={logoUrl} alt="Logo" className="max-h-16 object-contain" />
             ) : (
               <>
                 <div className="text-[#1E3A8A] font-serif font-black text-2xl tracking-tighter group-hover:opacity-50 transition-opacity">BARACK</div>
                 <div className="text-[#9ca3af] text-[10px] tracking-widest font-light group-hover:opacity-50 transition-opacity">MERCOSUL</div>
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5">
                   <span className="text-[10px] font-bold text-gray-600 bg-white/90 px-2 py-1 rounded shadow-sm">Subir Logo</span>
                 </div>
               </>
             )}
          </div>
          <div className="col-span-2 border-r-[1.5px] border-[#60A5FA] flex items-center justify-center p-4 text-center">
             <h1 className="text-xl font-black text-[#1E3A8A] uppercase italic leading-tight">
               {displayHeader.title}
             </h1>
          </div>
          <div className="col-span-1 grid grid-rows-4">
             <HeaderCell label="Código del Documento" value={displayHeader.documentCode} />
             <div className="grid grid-cols-2">
                <HeaderCell label="Revisión" value={displayHeader.revision} />
                <HeaderCell label="Fecha Emisión" value={displayHeader.date} />
             </div>
             <div className="grid grid-cols-2">
                <HeaderCell label="Elaborado por" value={displayHeader.preparedBy} />
                <HeaderCell label="Revisado por" value={displayHeader.reviewedBy} />
             </div>
             <div className="grid grid-cols-2">
                <HeaderCell label="Proyecto" value={displayHeader.project} />
                <HeaderCell label="Cliente" value={displayHeader.client} />
             </div>
          </div>
        </div>
      </div>

      <div className={`mx-auto flex flex-col gap-8 items-center relative print:max-w-none print:w-full ${isExporting ? 'max-w-none w-full' : 'max-w-[1400px]'}`}>
         
         {/* COLUMNA IZQUIERDA: EL DIAGRAMA MASIVO */}
         <main className={`w-full bg-white border-[1.5px] border-[#e5e7eb] shadow-sm pt-10 pb-16 rounded-lg print:overflow-visible ${isExporting ? 'overflow-visible' : 'overflow-x-auto'}`}>
           <div className="min-w-fit px-12 mx-auto">
             <FlowSequence sequence={currentNodes} />
           </div>
         </main>

         {/* COLUMNA DERECHA: PANEL LATERAL COMPACTO Y DIVIDIDO -> AHORA ABAJO */}
         <aside className="w-full max-w-4xl shrink-0 z-20">
            <div className="border-[1.5px] border-[#60A5FA] bg-white shadow-md rounded-lg overflow-hidden flex flex-col">
              
              <div className="flex flex-row divide-x-[1.5px] divide-[#60A5FA]">
                
                {/* MITAD IZQUIERDA: REFERENCIAS */}
                <div className="w-[55%] p-4 space-y-3 bg-[#f9fafb]">
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
                <div className="w-[45%] p-4 bg-white overflow-x-auto">
                  <h4 className="text-[9px] font-black text-[#1E3A8A] border-b border-[#e5e7eb] pb-1 mb-3">CÓDIGOS PROD. TERMINADO</h4>
                  
                  <table className="w-full text-[8.5px] font-bold text-[#374151]">
                    <thead>
                      <tr className="text-[#9ca3af] border-b border-[#e5e7eb] text-left">
                        <th className="pb-1 font-black whitespace-nowrap">Part Number VW</th>
                        <th className="pb-1 font-black whitespace-nowrap">Nivel</th>
                        <th className="pb-1 font-black whitespace-nowrap">Descripción oficial</th>
                        <th className="pb-1 font-black whitespace-nowrap text-right">Versión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f3f4f6]">
                      {currentProductCodes.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 text-[#60A5FA] whitespace-nowrap">{item.code}</td>
                          <td className="py-1.5 whitespace-nowrap">{item.level}</td>
                          <td className="py-1.5 whitespace-nowrap">{item.description}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">{item.version}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
         </aside>

      </div>
      </div>
      
      {/* MODAL EDITOR JSON */}
      {showJsonEditor && (
         <div className="fixed inset-0 z-modal-backdrop bg-gray-900/50 flex justify-end">
            <div className="w-[800px] h-full bg-white shadow-2xl flex flex-col font-mono text-xs animate-in slide-in-from-right-full">
               <div className="p-4 bg-[#1E3A8A] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold">
                     <Code2 size={18} /> Base de Conocimiento Central (JSON)
                  </div>
                  <button onClick={() => setShowJsonEditor(false)} className="hover:text-blue-200">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="p-3 bg-blue-50 border-b border-blue-100 text-[#1e40af] text-xs">
                  Pega aquí el código que te arme Claude y luego pulsa &ldquo;Guardar&rdquo;. Modificará automáticamente toda la lógica UI visual y la anexará al proyecto <b>{projectPath || amfeData?.header.subject || 'actual'}</b>.
               </div>
               
               <div className="flex-1 p-0 relative">
                  <textarea 
                     value={draftJson}
                     onChange={(e) => setDraftJson(e.target.value)}
                     className="absolute inset-0 w-full h-full p-4 bg-[#1e1e1e] text-[#d4d4d4] resize-none outline-none whitespace-pre"
                     spellCheck="false"
                  ></textarea>
               </div>
               
               <div className="p-4 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
                  {jsonError ? <p className="text-red-500 font-bold text-xs">{jsonError}</p> : <div></div>}
                  <button 
                     onClick={handleSaveJson}
                     className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold rounded flex items-center gap-2 focus:ring-4 focus:ring-blue-300"
                  >
                     <Save size={16} /> GUARDAR FLujo EN PROYECTO
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
