// LLM answer
export interface ConceptMapData {
    entities: Entity[];
    relationships: Relationship[];
}

export interface Entity { id: string; name: string; explanation: string; }
export interface Relationship { 
    source_id: string; target_id: string; label: string; explanation: string;
}

export interface ConceptMapLayoutQualityMetrics {
    nodeOverlaps: number;
    edgeNodeOverlaps: number;
    edgeEdgeOverlaps: number;
    weightedScore: number;
}

export type LayoutAlgorithm = 'cola' | 'cose-bilkent' | 'dagre';

export interface ConceptMapLayoutGenerationResult {
    canvasData: any;
    metrics: ConceptMapLayoutQualityMetrics;
    algorithm: LayoutAlgorithm;
}

export interface HTMLElementWithTooltip extends HTMLElement {
    _conceptMapperTooltipHandler?: boolean;
}