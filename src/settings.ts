export interface ConceptMapperSettings {
    mySetting: string;
    fixedPathLabels: boolean;
    coloredNodes: boolean;
    coloredEdges: boolean;
    bestLayoutSelection: boolean;
    multipleLayoutAlgorithms: boolean;
    animateModals: boolean;
}
export const DEFAULT_SETTINGS: ConceptMapperSettings = {
    mySetting: 'default',
    fixedPathLabels: true,
    coloredNodes: true,
    coloredEdges: true,
    bestLayoutSelection: true,
    multipleLayoutAlgorithms: false,
    animateModals: true
};