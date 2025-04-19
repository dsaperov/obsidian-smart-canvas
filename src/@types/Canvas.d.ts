import { App, ItemView, TFile } from "obsidian";
import { AllCanvasNodeData, CanvasColor, EdgeEnd, NodeSide } from "obsidian/canvas";

type CanvasNodeID = string;
type CanvasEdgeID = string;
type CanvasDirection = 'bottomright' | 'bottomleft'  | 'topright' | 'topleft' | 'right' | 'left' | 'top' | 'bottom';
type UnknownData = Record<string, string>;

interface CanvasView extends ItemView {
    canvas: Canvas;
}

interface Canvas {
    config: CanvasConfig;
    readonly: boolean;

    edges: Map<string, CanvasEdge>;
    nodes: Map<CanvasNodeID, CanvasNode>;

    menu: CanvasMenu;
    nodeInteractionLayer: CanvasInteractionLayer;
    selection: Set<CanvasNode>;
    wrapperEl: HTMLElement;
    
    history: any;
    requestPushHistory: any;

    x: number;
    y: number;

    addNode(node: CanvasNode): void
    createTextNode(data: CreateTextNodeOptions): CanvasTextNode;
    getContainingNodes(coords: CanvasCoords): CanvasNode[];
    removeNode(node: CanvasNode): void;
    select(node: CanvasNode): void;
    deselectAll(): void;

    addEdge(edge: CanvasEdge): void;
    getEdgesForNode(node: CanvasNode): CanvasEdge[];
    removeEdge(edge: CanvasEdge): void;

    getData(): CanvasData;
    setData(data: CanvasData): void;

    requestFrame(): void;
    requestSave(save?: boolean, triggerBySelf?: boolean): void;
}

interface CanvasConfig {
    defaultTextNodeDimensions: CanvasNodeSize;
    defaultFileNodeDimensions: CanvasNodeSize;
    minContainerDimension: number;
}

interface CanvasNodeSize {
    width: number;
    height: number;
}

interface CanvasEdge {
    id: CanvasEdgeID;

    canvas: Canvas;

    color: string;
    label: string;
    
    lineEndGroupEl: SVGGElement;
    lineGroupEl: SVGGElement;
    path: {
        display: SVGPathElement;
        interaction: SVGPathElement;
    };
    
    initialized: boolean;

    bbox: CanvasCoords;
    bezier: BezierCurve;
    from: CanvasEdgeEndpoint;
    fromLineEnd: CanvasLineEnd;
    to: CanvasEdgeEndpoint;
    toLineEnd: CanvasLineEnd;

    initialize(): void;

    getData(): CanvasEdgeData;
    setData(data: CanvasEdgeData, addHistory?: boolean): void;

    getCenter(): CanvasNodePosition;
    showMenu(): void;
    updatePath(): void;

    render(): void;
}

interface CanvasCoords {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
}

interface BezierCurve {
    cp1: CanvasNodePosition;
    cp2: CanvasNodePosition;
    from: CanvasNodePosition;
    path: string;
    to: CanvasNodePosition;
}

interface CanvasNodePosition {
    x: number;
    y: number;
}

interface CanvasEdgeEndpoint {
    node: CanvasNode;
    side: NodeSide;
    end: EdgeEnd;
}

interface CanvasNode {
    id: string;

    app: App;
    canvas: Canvas;

    color: string;
    height: number;
    width: number;
    x: number;
    y: number;
    zIndex: number;

    containerBlockerEl: HTMLElement;
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    nodeEl: HTMLElement;
    placeholderEl: HTMLElement;
    unknownData: UnknownData;

    child: Partial<CanvasNode>;
    destroyed: boolean;
    initialized: boolean;
    isContentMounted: boolean;
    isEditing: boolean;
    renderedZIndex: number;
    resizeDirty: boolean;

    bbox: CanvasCoords;
    
    initialize(): void;

    getData(): AllCanvasNodeData;
    setData(data: Partial<AllCanvasNodeData>): void;

    moveAndResize(x: number, y: number, width: number, height: number): void;
    setColor(color: string): void;
    setText(text: string): Promise<void>;

    convertToFile(): Promise<void>;
    showMenu(): void;

    render(): void;
}

interface CanvasLineEnd {
    el: HTMLElement;
    type: 'arrow';
}

interface CanvasMenu {
    canvas: Canvas;

    containerEl: HTMLElement;
    menuEl: HTMLElement;

    selection: CanvasSelection;

    updateZIndex(): void;

    render(): void;
}

interface CanvasSelection {
    canvas: Canvas;

    selectionEl: HTMLElement;
    resizerEls: HTMLElement;

    bbox: CanvasCoords | undefined;

    hide(): void;
    update(bbox: CanvasCoords): void;
    onResizePointerDown(e: PointerEvent, direction: CanvasDirection): void;
    
    render(): void;
}

interface CanvasInteractionLayer {
    canvas: Canvas;

    interactionEl: HTMLElement;

    target: CanvasNode | null;

    setTarget(target: CanvasNode | null): void;

    render(): void;
}

interface CreateTextNodeOptions {
    text: string;
    pos?: CanvasNodePosition;
    position?: NodeSide;
    size?: CanvasNodeSize;
    save?: boolean;
    focus?: boolean
}

interface CanvasTextNode extends CanvasNode {
    text: string;
    explanation: string;
}

interface CanvasFileNode extends CanvasNode {
    file: TFile;
}

interface CanvasLinkNode extends CanvasNode {
    url: string;
}

interface CanvasGroupNode extends CanvasNode {
    label: string;
}

interface CanvasEdgeData {
    id: string;
    fromNode: string;
    fromSide: NodeSide;
    fromEnd?: EdgeEnd;
    toNode: string;
    toSide: NodeSide;
    toEnd?: EdgeEnd;
    color?: CanvasColor;
    label?: string;
    [key: string]: any;
}

export interface CanvasData {
    nodes: AllCanvasNodeData[];
    edges: CanvasEdgeData[];
    [key: string]: any;
}