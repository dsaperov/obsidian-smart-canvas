export interface ConceptMapperSettings {
    mySetting: string;
    fixedPathLabels: boolean;
    coloredNodes: boolean;
    coloredEdges: boolean;
    bestLayoutSelection: boolean;
}
export const DEFAULT_SETTINGS: ConceptMapperSettings = {
    mySetting: 'default',
    fixedPathLabels: true,
    coloredNodes: true,
    coloredEdges: true,
    bestLayoutSelection: true,
};