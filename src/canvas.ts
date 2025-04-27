import { App,  ItemView, MarkdownRenderer } from 'obsidian';
import { NodeSide } from 'obsidian/canvas';
import {
    Canvas, CanvasEdge, CanvasEdgeData, CanvasNode, CanvasNodePosition,
    CanvasNodeSize, CanvasObject, CreateTextNodeOptions, CanvasView
} from './@types/Canvas';
import { CENTRAL_NODE_COLOR, EDGE_COLOR } from './config';
import { logger } from './logging';
import { getRandomId } from './utils';
import { Entity, HTMLElementWithTooltip, Relationship } from './interfaces';

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

    activeFileIsCanvas(): boolean {
        const activeFile = this.app.workspace.getActiveFile();
        const activeFileExtension = activeFile?.extension;

        if (activeFile && activeFileExtension === "canvas") {
            return true;
        }
        return false;
    }

    createTextNode(
        pos: CanvasNodePosition,
        entity: Entity,
        size: CanvasNodeSize,
        color: string | undefined
    ): CanvasNode {
        const canvas: Canvas = this.getCurrentCanvas();
        const nodeData: CreateTextNodeOptions = {
            text: entity.name,
            pos: pos,
            size: size,
            save: true,
            focus: false
        };
        const node = canvas.createTextNode(nodeData);

        if (node) {
            this.saveNodeExplanationData(node.id, entity.explanation);
        }

        // If color is provided, set it to the node
        if (color && node) {
            node.setColor(color);
        }

        return node;
    }

    createEdge(
        fromNodeId: string,
        toNodeId: string, 
        relationship: Relationship,
        isColoredEdgesEnabled: boolean
    ): void {
        const canvas: Canvas = this.getCurrentCanvas();

        let label = relationship.label;
        const explanation = relationship.explanation

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
            label: label,
            explanation: explanation,
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

    // Method to wait untill all edges are initialized and then run attachExplanations()
    attachExplanationsWhenReady(): void {
        const maxAttempts = 5
        const delay = 100

        let attempts = 0;
        
        const tryAttach = () => {
            const canvas = this.getCurrentCanvas();
            const allEdgesInitialized = Array.from(canvas.edges.values())
                .every(edge => edge.initialized);

            if (allEdgesInitialized) {
                this.attachExplanations(canvas);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(tryAttach, delay);
            } else {
                logger.error('Could not wait for edges to be initialized. Explanations not attached.');
            }
        };
        
        // Начать проверки
        setTimeout(tryAttach, delay);
    }

    // Method to run attaching tooltips with explanations for all nodes and edges
    attachExplanations(canvas: Canvas): void {
        const canvasObjectCollections = [
            { collection: canvas.nodes, isNode: true },
            { collection: canvas.edges, isNode: false }
        ];
        for (const { collection, isNode } of canvasObjectCollections) {
            collection.forEach((canvasObject: CanvasObject) => {
                const explanation = canvasObject.unknownData.explanation;
                if (!explanation) return; // No explanation to attach
                this.attachExplanationTooltip(canvasObject, explanation, isNode);
            });
        }
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

    // Method to add an explanation field to node JSON and set its value
    private saveNodeExplanationData(nodeId: string, explanation: string): void {
        // Get actual canvas data
        const canvas = this.getCurrentCanvas();
        const data = canvas.getData();

        // Find the node with the given ID and set value for explanation field
        const nodeJson = data.nodes.find(n => n.id === nodeId);
        if (nodeJson) {
          nodeJson.explanation = explanation;
          canvas.setData(data);
        }
    }

    // Method to attach a tooltip to a node that shows the explanation when hovered over
    private attachExplanationTooltip(
        canvasObject: CanvasObject, explanation: string, isNode: boolean
    ): void {
        const el = this.getHtmlForCanvasObject(canvasObject, isNode)
        if (el._conceptMapperTooltipHandler) return; // Prevent multiple handlers
        
        let tooltip: HTMLElement | null = null;

        // Callback function to show tooltip on mouse moving over the node
        const showTooltip = (e: MouseEvent) => {
            const currentView = this.app.workspace.getActiveViewOfType(ItemView);
            if (!currentView) return; // No active view

            if (!tooltip) {
                // Create tooltip element and append it to the body
                tooltip = document.createElement('div');
                tooltip.classList.add('concept-mapper-explanation-tooltip');
                document.body.appendChild(tooltip);

                // Render markdown inside the tooltip
                MarkdownRenderer.render(
                    this.app,
                    explanation,
                    tooltip,
                    this.app.workspace.getActiveFile()?.path || '',
                    currentView
                );
                
            }
            // Position the tooltip near the mouse cursor
            tooltip.style.top = `${e.clientY + 10}px`;
            tooltip.style.left = `${e.clientX + 10}px`;
        };
    
        // Callback function to hide tooltip when mouse leaves the node
        const hideTooltip = () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        };

        el.addEventListener('mousemove', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);

        // Mark that the tooltip handler is already attached
        el._conceptMapperTooltipHandler = true;
    }

    // Method to get the HTML element for a canvas object (node or edge)
    private getHtmlForCanvasObject(canvasObject: CanvasObject, isNode: boolean): HTMLElementWithTooltip {
        let el: HTMLElementWithTooltip;
        if (isNode) {
            el = (canvasObject as CanvasNode).nodeEl;
        } else {
            console.log(canvasObject);
            el = (canvasObject as CanvasEdge).labelElement.textareaEl;
        }
        return el
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