export interface FlowchartHeaderData {
    title: string;
    documentCode: string;
    revision: string;
    date: string;
    preparedBy: string;
    reviewedBy: string;
    project: string;
    client: string;
}

export interface FlowchartProductCode {
    code: string;
    level: string;
    description: string;
    version: string;
}

export interface FlowchartNode {
    type: 'operation' | 'inspection' | 'condition' | 'storage' | 'transfer' | 'op-ins' | 'connector' | 'terminal';
    stepId?: string;
    description?: string;
    labelCondition?: string;
    labelDown?: string;
    branchSide?: {
        type?: 'terminal' | 'operation' | 'connector' | 'inspection';
        text?: string;
        labelNode?: string;
        stepId?: string;
        description?: string;
        sequence?: FlowchartNode[];
    };
    branches?: FlowchartNode[][];
    incomingConnector?: string;
    rework?: { targetId: string };
    text?: string;
    labelNode?: string;
    sequence?: FlowchartNode[];
    critical?: boolean;
    criticalType?: string;
}

export interface FlowchartDocument {
    id: string; // Typically linkedAmfeProject
    linkedAmfeProject: string;
    header: FlowchartHeaderData;
    productCodes: FlowchartProductCode[];
    nodes: FlowchartNode[];
    createdAt: string;
    updatedAt: string;
}
