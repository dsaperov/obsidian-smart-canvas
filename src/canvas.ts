import { App, ItemView } from 'obsidian';
import { NodeSide } from 'obsidian/canvas';
import {
    Canvas, CanvasEdgeData, CanvasNode, CanvasNodePosition, CanvasNodeSize, CreateTextNodeOptions, CanvasView 
} from './@types/Canvas';
import { CENTRAL_NODE_COLOR, EDGE_COLOR } from './config';
import { logger } from './logging';
import { getRandomId } from './utils';

export class CanvasHelper {
    app: App;
    nodeSideOptimizer: NodeSideOptimizer;

    constructor(app: App) {
        this.app = app;
        this.nodeSideOptimizer = new NodeSideOptimizer();
    }

    getCurrentCanvas(): Canvas {
        const canvasView = this.app.workspace.getActiveViewOfType(ItemView) as CanvasView;
        return canvasView.canvas;
    }

    createTextNode(
        pos: CanvasNodePosition,
        text: string,
        size: CanvasNodeSize,
        color: string | undefined
    ): CanvasNode {
        const canvas: Canvas = this.getCurrentCanvas();
        const nodeData: CreateTextNodeOptions = {
            text,
            pos: pos,
            size: size,
            save: true,
            focus: false
        };
        const node = canvas.createTextNode(nodeData);

        // If color is provided, set it to the node
        if (color && node) {
            node.setColor(color);
        }

        return node;
    }

    createEdge(
        fromNodeId: string,
        toNodeId: string,
        isColoredEdgesEnabled: boolean,
        label?: string
    ): void {
        const canvas: Canvas = this.getCurrentCanvas();

        const fromNode = canvas.nodes.get(fromNodeId);
        const toNode = canvas.nodes.get(toNodeId);

        if (!fromNode || !toNode) {
            logger.error(`Cannot create edge. Node not found. From: ${fromNodeId}, To: ${toNodeId}`);
            return;
        }

        // Check if label should be split into multiple lines
        if (label && label.includes(' ') && label.length > 12) {
            label = this.formatTextWithLineBreaks(label, 12);
        }

        const { fromSide, toSide } = this.nodeSideOptimizer.determineOptimalSides(fromNode, toNode);

        this.nodeSideOptimizer.updateNodeSides(fromNodeId, toNodeId, fromSide, toSide);

        const edgeData: CanvasEdgeData = {
            id: getRandomId(16),
            fromNode: fromNodeId,
            fromSide: fromSide,
            toNode: toNodeId,
            toSide: toSide,
            label: label
        };

        if (isColoredEdgesEnabled) {
            edgeData.color = EDGE_COLOR;
        }

        const canvasData = canvas.getData();
        canvasData.edges.push(edgeData);
        canvas.setData(canvasData);
        canvas.requestSave();
    }

    // Method to remove all nodes and edges from the canvas
    clearCanvas(canvas: Canvas): void {
        const canvasData = canvas.getData();
        
        canvasData.nodes = [];
        canvasData.edges = [];
        
        canvas.setData(canvasData);
        canvas.requestSave();
    }

    applyClasses(): void {
        const canvas = this.getCurrentCanvas();  
        canvas.nodes.forEach((node) => {
            if (node.color === CENTRAL_NODE_COLOR) {
                node.nodeEl.classList.add('concept-mapper-central-node');
            }
        });
    }

    // Method to add line breaks to text based on a maximum line length
    private formatTextWithLineBreaks(text: string, maxLength: number): string {
        const words = text.split(' ');
        let lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
            if (currentLine.length + word.length + 1 > maxLength && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                if (currentLine.length > 0) {
                    currentLine += ' ' + word;
                } else {
                    currentLine = word;
                }
            }
        }
        
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines.join('\n');
    }
}

export class NodeSideOptimizer {
    private nodeOutgoingSides: Map<string, Set<NodeSide>> = new Map();
    private nodeIncomingSides: Map<string, Set<NodeSide>> = new Map();

    // Method to populate data structures tracking node sides used for outgoing and incoming edges
    populateNodeSides(canvas: Canvas): void {
        this.nodeOutgoingSides.clear();
        this.nodeIncomingSides.clear();
        
        canvas.nodes.forEach(node => {
            this.nodeOutgoingSides.set(node.id, new Set<NodeSide>());
            this.nodeIncomingSides.set(node.id, new Set<NodeSide>());
        });
        
        const canvasData = canvas.getData();
        for (const edge of canvasData.edges) {
            const fromSet = this.nodeOutgoingSides.get(edge.fromNode);
            const toSet = this.nodeIncomingSides.get(edge.toNode);
            
            if (fromSet) fromSet.add(edge.fromSide);
            if (toSet) toSet.add(edge.toSide);
        }
    }

    // Method to update data structures tracking node sides used for outgoing and incoming edges
    updateNodeSides(fromNodeId: string, toNodeId: string, fromSide: NodeSide, toSide: NodeSide): void {
        const fromOutgoing = this.nodeOutgoingSides.get(fromNodeId);
        const toIncoming = this.nodeIncomingSides.get(toNodeId);
        
        if (fromOutgoing) fromOutgoing.add(fromSide);
        if (toIncoming) toIncoming.add(toSide);
    }

    // Method to determine the optimal sides for the edge based on the positions of the nodes
    determineOptimalSides(fromNode: CanvasNode, toNode: CanvasNode): { fromSide: NodeSide, toSide: NodeSide } {
        // Calculate the center of each node
        const fromCenterX = fromNode.x + fromNode.width / 2;
        const fromCenterY = fromNode.y + fromNode.height / 2;
        const toCenterX = toNode.x + toNode.width / 2;
        const toCenterY = toNode.y + toNode.height / 2;

        // Vector from fromNode center to toNode center
        const deltaX = toCenterX - fromCenterX;
        const deltaY = toCenterY - fromCenterY;

        // Calculate the angle of the vector
        const angle = Math.atan2(deltaY, deltaX);

        // Get already used sides for the nodes
        const fromNodeIncoming = this.nodeIncomingSides.get(fromNode.id) || new Set<NodeSide>();
        const toNodeOutgoing = this.nodeOutgoingSides.get(toNode.id) || new Set<NodeSide>();

        // Determine optimal sides based on the angle
        let preferredFromSide: NodeSide;
        let preferredToSide: NodeSide;

        if (angle > -Math.PI / 4 && angle <= Math.PI / 4) {
            // Angle from -45 to 45 degrees -> Right
            preferredFromSide = 'right';
            preferredToSide = 'left';
        } else if (angle > Math.PI / 4 && angle <= (3 * Math.PI) / 4) {
            // Angle from 45 to 135 degrees -> Down
            preferredFromSide = 'bottom';
            preferredToSide = 'top';
        } else if (angle > (3 * Math.PI) / 4 || angle <= -(3 * Math.PI) / 4) {
            // Angle from 135 to 225 degrees -> Left
            preferredFromSide = 'left';
            preferredToSide = 'right';
        } else { // angle > -(3 * Math.PI) / 4 && angle <= -Math.PI / 4
            // Angle from -135 to -45 degrees -> Up
            preferredFromSide = 'top';
            preferredToSide = 'bottom';
        }

        // Check if the optimal sides are already used
        let fromSide = preferredFromSide;
        let toSide = preferredToSide;

        // If the preferred side of the source node is already used for incoming edges, choose another available side
        if (fromNodeIncoming.has(preferredFromSide)) {
            const sides: NodeSide[] = ['top', 'right', 'bottom', 'left'];
            // Get the sides that are not used for incoming edges
            const availableSides = sides.filter(side => !fromNodeIncoming.has(side as NodeSide));
            if (availableSides.length > 0) {
                // Choose the closest side based on the angle
                fromSide = this.getClosestSide(angle, availableSides as NodeSide[]);
            }
        }

        // If the preferred side of the target node is already used for outgoing edges, choose another available side
        if (toNodeOutgoing.has(preferredToSide)) {
            const sides: NodeSide[] = ['top', 'right', 'bottom', 'left'];
            // Get the sides that are not used for outgoing edges
            const availableSides = sides.filter(side => !toNodeOutgoing.has(side as NodeSide));
            if (availableSides.length > 0) {
                // Choose the closest side based on the angle
                toSide = this.getClosestSide(angle + Math.PI, availableSides as NodeSide[]);
            }
        }

        return { fromSide, toSide };
    }

    // Method to get the closest side based on the angle
    private getClosestSide(angle: number, availableSides: NodeSide[]): NodeSide {
        while (angle < 0) angle += 2 * Math.PI;
        while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;

        const sideAngles = {
            'right': 0,
            'bottom': Math.PI / 2,
            'left': Math.PI,
            'top': 3 * Math.PI / 2
        };

        return availableSides.reduce((closest, side) => {
            const sideAngle = sideAngles[side];
            let diff = Math.abs(angle - sideAngle);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            
            const closestAngle = sideAngles[closest];
            let closestDiff = Math.abs(angle - closestAngle);
            if (closestDiff > Math.PI) closestDiff = 2 * Math.PI - closestDiff;
            
            return diff < closestDiff ? side : closest;
        }, availableSides[0]);
    }
}