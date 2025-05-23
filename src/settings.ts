export interface SmartCanvasSettings {
    mySetting: string;
    fixedPathLabels: boolean;
    coloredNodes: boolean;
    coloredEdges: boolean;
    bestLayoutSelection: boolean;
    multipleLayoutAlgorithms: boolean;
    animateModals: boolean;
}
export const DEFAULT_SETTINGS: SmartCanvasSettings = {
    mySetting: 'default',
    fixedPathLabels: true,
    coloredNodes: true,
    coloredEdges: true,
    bestLayoutSelection: true,
    multipleLayoutAlgorithms: true,
    animateModals: true
};