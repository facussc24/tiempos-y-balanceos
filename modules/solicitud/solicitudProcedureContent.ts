/**
 * Solicitud Procedure Content — Static text for SGC procedure document
 *
 * Procedure P-ING-001: Solicitud de Generación de Código en Sistema ARB.
 * Written entirely in Spanish following Barack Mercosul SGC standards.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcedureSection {
    number: string;
    title: string;
    content: string;
    subsections?: Array<{ title: string; content: string }>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const PROCEDURE_METADATA = {
    formNumber: 'P-ING-001',
    title: 'Solicitud de Generación de Código en Sistema ARB',
    revision: 'A',
    date: '2026-03-06',
    approvedBy: 'Ingeniería',
    scope: 'Aplica a todas las solicitudes de códigos nuevos de productos e insumos',
};

// ---------------------------------------------------------------------------
// Related documents
// ---------------------------------------------------------------------------

export const RELATED_DOCUMENTS = [
    { code: 'P-05', title: 'Control de los documentos' },
    { code: 'P-08', title: 'Identificación y rastreabilidad del producto' },
    { code: 'P-09.1', title: 'Reacción ante una NO conformidad' },
    { code: 'I-AC-005', title: 'APQP Planificación avanzada de la calidad' },
    { code: 'I-AC-012', title: 'Aprobación de partes de producción PPAP' },
];

// ---------------------------------------------------------------------------
// Procedure sections
// ---------------------------------------------------------------------------

export const PROCEDURE_SECTIONS: ProcedureSection[] = [
    {
        number: '1',
        title: 'OBJETIVO',
        content:
            'Establecer la metodología para solicitar, revisar y aprobar la generación de códigos ' +
            'nuevos de productos terminados e insumos productivos en el sistema de gestión ARB, ' +
            'asegurando la trazabilidad, la correcta identificación y el cumplimiento de los ' +
            'requisitos del sistema de gestión de calidad (SGC) según IATF 16949:2016.',
    },
    {
        number: '2',
        title: 'ALCANCE',
        content:
            'Este procedimiento aplica a todas las solicitudes de códigos nuevos generadas por ' +
            'cualquier departamento de Barack Mercosul S.A. Incluye tanto productos terminados ' +
            '(piezas automotrices destinadas a clientes OEM y aftermarket) como insumos ' +
            '(materias primas, componentes comprados, materiales de empaque y consumibles ' +
            'utilizados en los procesos productivos). Quedan excluidos los códigos de herramental ' +
            'y activos fijos, los cuales se gestionan mediante el procedimiento P-MAN-003.',
    },
    {
        number: '3',
        title: 'DEFINICIONES',
        content:
            'Código ARB: Identificador único alfanumérico asignado a cada producto o insumo ' +
            'dentro del sistema de gestión ARB. ' +
            'Producto terminado: Pieza o conjunto que se entrega al cliente tras completar ' +
            'todas las operaciones de manufactura y control. ' +
            'Insumo: Material, componente o servicio que ingresa al proceso productivo y se ' +
            'incorpora directa o indirectamente al producto terminado. ' +
            'PPAP: Proceso de Aprobación de Partes de Producción, requerido para insumos ' +
            'nuevos que afectan la calidad del producto según I-AC-012. ' +
            'Carpeta de producto: Estructura de archivos en el servidor de red donde se ' +
            'almacenan planos, especificaciones, AMFE, plan de control y demás documentación ' +
            'APQP asociada al código.',
    },
    {
        number: '4',
        title: 'RESPONSABILIDADES',
        content: '',
        subsections: [
            {
                title: 'Solicitante',
                content:
                    'Completar el formulario F-ING-001 con todos los datos requeridos según el tipo ' +
                    'de solicitud (producto o insumo). Adjuntar la documentación de soporte ' +
                    '(planos, especificaciones del cliente, fichas técnicas de proveedor). ' +
                    'Verificar que no exista un código previo para el mismo artículo antes de ' +
                    'generar una nueva solicitud. Realizar el seguimiento del estado de su ' +
                    'solicitud hasta la aprobación o rechazo.',
            },
            {
                title: 'Jefe de Ingeniería',
                content:
                    'Revisar la completitud y coherencia de cada solicitud recibida. Asignar el ' +
                    'número secuencial de solicitud. Aprobar o rechazar la solicitud indicando ' +
                    'motivo en caso de rechazo. Coordinar con Sistemas/IT la creación efectiva ' +
                    'del código en ARB. Supervisar la creación de la carpeta de producto en el ' +
                    'servidor de red y verificar que la estructura cumpla con el estándar ' +
                    'definido en P-05.',
            },
            {
                title: 'Departamento de Calidad',
                content:
                    'Evaluar las solicitudes de insumos nuevos para determinar si requieren ' +
                    'proceso PPAP según I-AC-012. Verificar que los insumos críticos cuenten ' +
                    'con certificación de material y/o fichas de datos de seguridad (SDS) ' +
                    'cuando corresponda. Validar que la descripción del producto o insumo sea ' +
                    'consistente con las especificaciones del cliente y las normas aplicables. ' +
                    'Registrar en el sistema las características críticas (CC) y significativas ' +
                    '(SC) asociadas al nuevo código cuando aplique.',
            },
            {
                title: 'Sistemas / IT',
                content:
                    'Crear el código en el sistema ARB una vez recibida la aprobación del Jefe ' +
                    'de Ingeniería. Generar la estructura de carpetas en el servidor de red ' +
                    'siguiendo la nomenclatura estándar. Notificar al solicitante y al Jefe de ' +
                    'Ingeniería una vez completada la alta en el sistema. Mantener el respaldo ' +
                    'y la integridad de la base de datos de códigos.',
            },
        ],
    },
    {
        number: '5',
        title: 'PROCEDIMIENTO',
        content: '',
        subsections: [
            {
                title: '5.1 Inicio de la solicitud',
                content:
                    'El solicitante accede al módulo de Solicitudes de Código en la aplicación ' +
                    'de gestión y crea una nueva solicitud seleccionando el tipo correspondiente ' +
                    '(producto o insumo). El sistema asigna automáticamente un número secuencial ' +
                    'con formato SGC-NNN y registra la fecha, el solicitante y el departamento. ' +
                    'Antes de continuar, el solicitante debe verificar en el listado de códigos ' +
                    'existentes que el artículo no posea ya un código activo en ARB.',
            },
            {
                title: '5.2 Completar el formulario',
                content:
                    'El solicitante completa todos los campos obligatorios del formulario F-ING-001. ' +
                    'Para productos: código de pieza del cliente, descripción funcional y nombre del ' +
                    'cliente. Para insumos: código de proveedor (si existe), descripción del material, ' +
                    'unidad de medida y si requiere generación interna de código. El solicitante ' +
                    'adjunta la documentación de soporte: planos dimensionales, especificaciones ' +
                    'técnicas, fichas de proveedor o cualquier otro documento relevante. El campo ' +
                    'de observaciones se utiliza para justificaciones adicionales o referencias ' +
                    'cruzadas a otros proyectos.',
            },
            {
                title: '5.3 Revisión de Calidad (solo insumos)',
                content:
                    'Cuando la solicitud es de tipo insumo, el Departamento de Calidad recibe una ' +
                    'notificación para realizar la evaluación PPAP. Calidad determina si el insumo ' +
                    'afecta directa o indirectamente la calidad del producto terminado. Si se ' +
                    'requiere PPAP, Calidad registra la necesidad en el sistema y la solicitud no ' +
                    'puede avanzar a aprobación hasta que se presente evidencia del inicio del ' +
                    'proceso PPAP (nivel 1 a 5 según I-AC-012). Para insumos que no afectan la ' +
                    'calidad del producto (materiales de empaque genérico, consumibles de limpieza), ' +
                    'Calidad libera la solicitud con una nota indicando "PPAP no requerido".',
            },
            {
                title: '5.4 Aprobación',
                content:
                    'El Jefe de Ingeniería revisa la solicitud completa, incluyendo la documentación ' +
                    'adjunta y el dictamen de Calidad cuando aplique. Si toda la información es ' +
                    'correcta y suficiente, aprueba la solicitud cambiando el estado a "Aprobada". ' +
                    'En caso de información faltante o inconsistente, rechaza la solicitud indicando ' +
                    'el motivo detallado para que el solicitante pueda corregir y reenviar. Una ' +
                    'solicitud rechazada puede ser corregida y reenviada sin generar un nuevo ' +
                    'número de solicitud.',
            },
            {
                title: '5.5 Creación del código en ARB',
                content:
                    'Una vez aprobada la solicitud, Sistemas/IT procede a dar de alta el código en ' +
                    'el sistema ARB. La nomenclatura del código sigue las reglas definidas por tipo: ' +
                    'productos utilizan el prefijo de familia de pieza seguido de un secuencial ' +
                    'numérico; insumos utilizan el prefijo de categoría de material. Sistemas/IT ' +
                    'verifica que el código generado no colisione con códigos existentes y registra ' +
                    'la fecha de alta. El nuevo código queda vinculado al número de solicitud para ' +
                    'trazabilidad completa.',
            },
            {
                title: '5.6 Creación de carpeta y archivado',
                content:
                    'Simultáneamente a la creación del código, Sistemas/IT genera la estructura de ' +
                    'carpetas en el servidor de red bajo la ruta estándar (Y:\\Ingeniería\\). La ' +
                    'estructura incluye subcarpetas para: planos, especificaciones, APQP ' +
                    '(AMFE, plan de control, diagrama de flujo, hoja de operaciones), PPAP ' +
                    '(cuando aplique) y correspondencia. La documentación adjunta a la solicitud ' +
                    'se copia automáticamente a la carpeta correspondiente. El sistema actualiza ' +
                    'la solicitud con la ruta de la carpeta creada y registra la fecha de ' +
                    'sincronización. La solicitud queda archivada como registro de calidad ' +
                    'según P-05 con un período de retención mínimo de 15 años conforme a los ' +
                    'requisitos IATF 16949.',
            },
        ],
    },
    {
        number: '6',
        title: 'REGISTROS',
        content:
            'F-ING-001: Formulario de Solicitud de Generación de Código (electrónico, almacenado ' +
            'en base de datos SQLite del sistema de gestión). ' +
            'Adjuntos digitales: Planos, especificaciones y fichas técnicas asociadas a cada ' +
            'solicitud (almacenados en servidor de red). ' +
            'Log de cambios de estado: Registro automático de cada transición de estado con ' +
            'fecha, usuario y motivo (almacenado en base de datos). ' +
            'Los registros se conservan por un mínimo de 15 años según los requisitos de ' +
            'retención del SGC y las exigencias contractuales de los clientes OEM.',
    },
    {
        number: '7',
        title: 'DOCUMENTOS RELACIONADOS',
        content:
            'Los siguientes documentos del SGC complementan este procedimiento y deben ' +
            'consultarse para los procesos referenciados en las secciones anteriores.',
    },
];
