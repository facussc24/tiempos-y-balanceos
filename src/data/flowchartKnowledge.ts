/**
 * Base de Conocimiento para Flujogramas Estáticos
 * Aquí Claude puede editar, añadir o quitar operaciones y el árbol de nodos
 * se generará automáticamente en la UI del módulo FlujogramaApp.
 */

export const flowchartHeaderData = {
   title: "FLUJOGRAMA PRELIMINAR IP PAD",
   documentCode: "P-IP-001/PRE",
   revision: "PRELIMINAR",
   date: "08/04/2026",
   preparedBy: "F. SANTORO",
   reviewedBy: "LEONARDO LATTANZI",
   project: "PATAGONIA",
   client: "VW"
};

export const flowchartProductCodes = [
   { code: "2HC.858.417.B FAM", level: "L1", description: "PLATE ASM-I/P CTR OTLT AIR", version: "IP PAD - LOW VERSION" },
   { code: "2HC.858.417.C GKK", level: "L2", description: "PLATE ASM-I/P CTR OTLT AIR", version: "IP PAD - HIGH VERSION" },
   { code: "2HC.858.417.C GKN", level: "L3", description: "PLATE ASM-I/P CTR OTLT AIR", version: "IP PAD - HIGH VERSION" }
];

export const flowchartData = [
   { stepId: "10", type: "operation", description: "RECEPCION DE MATERIA PRIMA" },
   { type: "inspection", description: "CONTROL DE MATERIA PRIMA" },
   { 
     type: "condition", 
     labelCondition: "¿MATERIAL OK?", 
     labelDown: 'SI',
     branchSide: { type: 'terminal', text: 'RECLAMO A PROVEEDOR', labelNode: 'NO' } 
   },
   { 
     type: "storage", 
     description: "WIP - MATERIA PRIMA APROBADA"
   },
   {
     type: "transfer",
     description: "TRASLADO DE ADHESIVO A LÍNEA",
     branchSide: { type: 'connector', text: 'A', description: 'ADHESIVO' }
   },
   {
     type: "transfer",
     description: "TRASLADO DE COMPONENTES A LÍNEA",
     branchSide: { type: 'connector', text: 'B', description: 'CLIPS, LOGO, TORNILLOS, DIFUSOR' }
   },
   
   // 3-Way Split (Corte, Inyección, Troquelado)
   {
     branches: [
       // RAMA 1: Corte -> Costura
       [
         { type: "transfer", description: "TRASLADO A CORTE" },
         { stepId: "30", type: "operation", description: "CORTE" },
         { type: "storage", description: "WIP - VINILO CORTADO" },
         { type: "transfer", description: "TRASLADO A COSTURA" },
         { stepId: "40", type: "operation", description: "COSTURA" },
         { type: "storage", description: "WIP - FUNDA COSIDA" }
       ],
       // RAMA 2 y 3: Inyección y Troquelado -> Ensamble
       [
         {
           branches: [
             [
               { type: "transfer", description: "TRASLADO A INYECCIÓN" },
               { stepId: "20", type: "operation", description: "INYECCION" },
               { type: "storage", description: "WIP - SUSTRATO INYECTADO" }
             ],
             [
               { type: "transfer", description: "TRASLADO A TROQUELADO" },
               { stepId: "50", type: "operation", description: "TROQUELADO DE ESPUMAS" },
               { type: "storage", description: "WIP - ESPUMA TROQUELADA" }
             ]
           ]
         },
         { type: "transfer", description: "TRASLADO A ENSAMBLE" },
         { stepId: "60", type: "operation", description: "ENSAMBLE SUSTRATO + ESPUMA" },
         { type: "storage", description: "WIP - SUSTRATO ENSAMBLADO" }
       ]
     ]
   },

   // Convergencia Principal
   { type: "transfer", description: "TRASLADO DE FUNDA COSIDA Y SUSTRATO ENSAMBLADO A SECTOR DE ADHESIVADO" },
   { stepId: "70", type: "operation", description: "ADHESIVADO", incomingConnector: 'A' },
   { type: "storage", description: "WIP - PIEZA ADHESIVADA" },
   
   { stepId: "80", type: "inspection", description: "CONTROL DE CALIDAD ADHESIVADO" },
   { 
     type: "condition", 
     labelCondition: "¿ADHESIVADO OK?", 
     labelDown: 'SI',
     branchSide: { 
       labelNode: 'NO', 
       sequence: [
         {
           type: "condition",
           labelCondition: "¿SE PUEDE RETRABAJAR?",
           labelDown: 'SI',
           branchSide: { type: "terminal", text: "SCRAP", labelNode: 'NO' }
         },
         { stepId: "81", type: "op-ins", description: "RETRABAJO DE ADHESIVADO" },
         { type: "transfer", description: "TRASLADO A OP 80", rework: { targetId: "80" } }
       ]
     } 
   },
   
   { type: "transfer", description: "TRASLADO A SECTOR DE TAPIZADO" },
   { stepId: "90", type: "operation", description: "ALINEACION DE COSTURA (PRE-FIXING)" },
   { stepId: "100", type: "operation", description: "WRAPPING + EDGE FOLDING" },
   { stepId: "110", type: "operation", description: "SOLDADURA CON ULTRASONIDO Y ENSAMBLE", incomingConnector: 'B' },
   { stepId: "120", type: "operation", description: "TERMINACION" },
   { type: "storage", description: "WIP - PIEZA TERMINADA" },
   
   { stepId: "130", type: "inspection", description: "CONTROL FINAL DE CALIDAD" },
   { 
     type: "condition", 
     labelCondition: "¿PRODUCTO OK?", 
     labelDown: 'SI',
     branchSide: { 
       labelNode: 'NO',
       sequence: [
         {
           type: "condition",
           labelCondition: "¿SE PUEDE RETRABAJAR?",
           labelDown: 'SI',
           branchSide: { type: "terminal", text: "SCRAP", labelNode: 'NO' }
         },
         { stepId: "131", type: "op-ins", description: "RETRABAJO DE PRODUCTO TERMINADO" },
         { type: "transfer", description: "TRASLADO A OP 110", rework: { targetId: "110" } }
       ]
     }
   },
   
   { type: "transfer", description: "TRASLADO A SECTOR DE PRODUCTO TERMINADO" },
   { stepId: "140", type: "operation", description: "EMBALAJE DE PRODUCTO TERMINADO" },
   { type: "transfer", description: "TRASLADO A SECTOR DE ALMACENAMIENTO" },
   { type: "storage", description: "ALMACENADO FINAL DE PRODUCTO TERMINADO" }
];
