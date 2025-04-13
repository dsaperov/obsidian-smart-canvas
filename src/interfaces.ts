// LLM answer
export interface ConceptMapData {
    entities: { id: string; name: string }[];
    relationships: { source_id: string; target_id: string; label: string }[];
}

export interface ConceptMapLayoutQualityMetrics {
    nodeOverlaps: number;
    edgeNodeOverlaps: number;
    edgeEdgeOverlaps: number;
    weightedScore: number;
}

export interface ConceptMapLayoutGenerationResult {
    canvasData: any;
    metrics: ConceptMapLayoutQualityMetrics;
}