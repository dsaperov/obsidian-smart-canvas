import { TFile, requestUrl, RequestUrlParam, Notice } from 'obsidian';
import { NodeSide } from 'obsidian/canvas';
import { Canvas, CanvasNode,  CanvasNodeSize, CanvasNodePosition } from './@types/Canvas';
import { CanvasHelper } from './canvas';
import { 
    CENTRAL_NODE_COLOR, BACKEND_SERVER_HOSTNAME, BACKEND_SERVER_PORT, LAYOUT_ALGORITHMS,
    GRID_SPACING, HORIZONTAL_STRETCH_FACTOR
} from './config';
import {
    ConceptMapData, ConceptMapLayoutQualityMetrics, LayoutAlgorithm, ConceptMapLayoutGenerationResult
} from './interfaces';
import { logger } from './logging';
import { SmartCanvasSettings } from './settings';
import cytoscape from 'cytoscape';
// @ts-ignore
import cola from 'cytoscape-cola';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { request } from 'http';

cytoscape.use(cola);
cytoscape.use(coseBilkent);
cytoscape.use(dagre);

const POLLING_INTERVAL_MS = 10000; 
const MAX_POLLING_ATTEMPTS = 60;

export class ConceptMapCreator {
    private readonly canvasHelper: CanvasHelper;
    private readonly colorizer: ConceptMapColorizer;
    private readonly layoutEvaluator: LayoutEvaluator = new LayoutEvaluator();
    private readonly getSettings: () => SmartCanvasSettings;
    private layoutResults: ConceptMapLayoutGenerationResult[] = []; // Array to store layout generation results
    private currentLayoutIndex: number = 0;
    private lastCanvasPath: string | null = null; // Path of the last opened canvas

    constructor(canvasHelper: CanvasHelper, getSettings: () => SmartCanvasSettings) {
        this.canvasHelper = canvasHelper;
        this.colorizer = new ConceptMapColorizer();
        this.getSettings = getSettings;
    }

    private async makeApiRequest(
        method: 'GET' | 'POST',
        apiPath: string,
        data?: any
    ): Promise<any> {
        const url = `http://${BACKEND_SERVER_HOSTNAME}:${BACKEND_SERVER_PORT}${apiPath}`;
        const requestParams: RequestUrlParam = {
            url: url,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            throw: false,
        };

        if (data && method === 'POST') {
            requestParams.body = JSON.stringify(data);
        }

        try {
            const response = await requestUrl(requestParams);

            if (response.status >= 200 && response.status < 300) {
                return response.json;
            } else {
                let errorMessage = `API запрос к ${apiPath} не удался со статусом ${response.status}.`;
                try {
                    const errorJson = response.json;
                    if (errorJson && (errorJson.detail || errorJson.message || errorJson.error)) {
                        errorMessage = errorJson.detail || errorJson.message || errorJson.error;
                    } else if (response.text && response.text.length < 500) {
                        errorMessage += ` Тело ответа: ${response.text}`;
                    }
                } catch (e) {
                     if (response.text && response.text.length < 500) {
                        errorMessage += ` Тело ответа: ${response.text}`;
                    }
                }
                logger.error(`Ошибка API запроса: ${url}, Статус: ${response.status}, Ответ: ${response.text?.substring(0, 500)}`);
                throw new Error(errorMessage);
            }
        } catch (error) {
            logger.error(`Ошибка во время API запроса к ${url}:`, error);
            if (error instanceof Error) {
                 throw new Error(`API запрос к ${apiPath} не удался: ${error.message}`);
            }
            throw new Error(`API запрос к ${apiPath} не удался с неизвестной ошибкой.`);
        }
    }

    private async initiateConceptMapGeneration(topic: string, text: string): Promise<string> {
        try {
            const trimmedText = text.trim();
            let apiPath: string;
            let requestBody: { topic: string; text?: string };

            if (trimmedText) {
                apiPath = '/extract_from_text'; // Если текст предоставлен
                requestBody = {
                    topic: topic,
                    text: trimmedText,
                };
            } else {
                apiPath = '/extract_from_wiki'; // Если текст отсутствует (только тема)
                requestBody = {
                    topic: topic,
                };
            }

            const response = await this.makeApiRequest('POST', apiPath, requestBody);

            if (response && response.task_id && response.status === "PENDING") {
                return response.task_id;
            } else {
                throw new Error('Не удалось инициировать генерацию карты концептов. Неверный ответ от сервера.');
            }
        } catch (error) {
            logger.error('Ошибка при инициации генерации карты концептов:', error);
            throw error;
        }
    }

    private async pollForConceptMapResult(taskId: string): Promise<ConceptMapData> {
        let attempts = 0;
        while (attempts < MAX_POLLING_ATTEMPTS) {
            attempts++;
            try {
                const response = await this.makeApiRequest('GET', `/status/${taskId}`);

                if (response && response.status) {
                    switch (response.status) {
                        case 'COMPLETED':
                            if (response.result && typeof response.result === 'object') {
                                return response.result as ConceptMapData;
                            } else if (response.entities && response.relationships) {
                                const { status, task_id, ...mapData } = response;
                                return mapData as ConceptMapData;
                            }
                            throw new Error('Задача завершена, но данные карты не найдены.');
                        case 'PENDING':
                        case 'PROCESSING':
                            logger.debug(`Статус задачи ${taskId}: ${response.status}. Попытка ${attempts}/${MAX_POLLING_ATTEMPTS}.`);
                            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
                            break;
                        case 'FAILED':
                            const errorMessage = response.error || response.message || 'Неизвестная ошибка выполнения задачи';
                            throw new Error(`Задача не выполнена: ${errorMessage}`);
                        default:
                            throw new Error(`Неизвестный статус задачи: ${response.status}`);
                    }
                } else {
                    if (attempts >= MAX_POLLING_ATTEMPTS) throw new Error('Неверный ответ от сервера ');
                    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
                }
            } catch (error) {
                if (attempts >= MAX_POLLING_ATTEMPTS) {
                    throw new Error(`Превышено время ожидания для задачи ${taskId} после ${attempts} попыток: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }
        }
        throw new Error(`Достигнуто максимальное количество попыток опроса для задачи ${taskId}.`);
    }

    async createConceptMap(topic: string, text: string): Promise<void> {
            const taskId = await this.initiateConceptMapGeneration(topic, text);
            const conceptMapData: ConceptMapData = await this.pollForConceptMapResult(taskId);

        if (!conceptMapData || !conceptMapData.entities || !conceptMapData.relationships) {
            console.error('Invalid concept map data format received from backend:', conceptMapData);
            throw new Error('Invalid concept map data format received from backend.');
        }
 
        const canvas = this.canvasHelper.getCurrentCanvas();

        // Save the current canvas path
        const activeFile = this.canvasHelper.app.workspace.getActiveFile();
        this.lastCanvasPath = activeFile ? activeFile.path : null;

        const nodeSizes = this.calculateNodeSizes(canvas, conceptMapData);

        // Clear all previous layout results
        this.layoutResults = [];
        this.currentLayoutIndex = 0;

        // Generate layout using cola algorithm and save results
        const colaResult = this.generateLayoutWithAlgorithm('cola', canvas, conceptMapData, nodeSizes);
        this.layoutResults.push(colaResult);

        // Check if multiple layout algorithms setting is enabled
        const useMultipleAlgorithms = this.getSettings().multipleLayoutAlgorithms;

        // If enabled, generate layouts using other algorithms
        if (useMultipleAlgorithms) {
            // cose-bilkent
            const coseBilkentResult = this.generateLayoutWithAlgorithm('cose-bilkent', canvas, conceptMapData, nodeSizes);
            this.layoutResults.push(coseBilkentResult);

            // dagre
            const dagreResult = this.generateLayoutWithAlgorithm('dagre', canvas, conceptMapData, nodeSizes);
            this.layoutResults.push(dagreResult);
        }

        // Apply cola-generated layout to the canvas
        this.applyLayout(canvas, this.layoutResults[this.currentLayoutIndex]);
    }

    // Method to check if multiple layouts are available for the current canvas
    public multipleLayoutAreAvailable(activeFile: TFile): boolean {
        // Check if current canvas matches the last one for which layouts were generated
        if (this.lastCanvasPath !== activeFile.path) {
            // If it is not the same canvas, layouts are not available
            return false;
        }

        // True if there are more than one layout results
        return this.layoutResults.length > 1;
    }

    // Method to send a request to the backend server to get concept map data
    private async getConceptMapData(topic: string, text: string, sample: boolean = false): Promise<ConceptMapData> {
        try {
            const data = JSON.stringify({ topic, text });
            
            return new Promise((resolve, reject) => {
                // If no text is provided, topic is a wiki article title, use '/extract_from_wiki' endpoint
                const extractPath = text.trim() ? '/extract_from_text' : '/extract_from_wiki';

                const options = {
                    hostname: BACKEND_SERVER_HOSTNAME,
                    port: BACKEND_SERVER_PORT,
                    path: sample ? '/sample' : extractPath,
                    method: sample ? 'GET' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data, 'utf8')
                    },
                    family: 4
                };
                
                const req = request(options, (res) => {
                    let responseData = '';
                    
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            const parsedResponseData = JSON.parse(responseData);
                            if (parsedResponseData.details) {
                                // If there are details, reject the promise with the error message
                                reject(new Error(`Error from backend: ${parsedResponseData.details}`));
                            }
                            // Otherwise, try to resolve the promise
                            resolve(parsedResponseData);
                        } catch (error) {
                            reject(new Error(`Error parsing response from backend: ${error.message}`));
                        }
                    });
                });
                
                req.on('error', (error) => {
                    reject(new Error(`Error sending request to backend: ${error.message}`));
                });
                
                if (options.method !== 'GET') { req.write(data); }
                req.end();
            });
        } catch (error) {
            logger.error('Error recieving response from backend:', error);
            throw error;
        }
    }

    // Method to generate a concept map layout using specified algorithm
    private generateLayoutWithAlgorithm(
        algorithm: LayoutAlgorithm,
        canvas: Canvas,
        conceptMapData: ConceptMapData,
        nodeSizes: Map<string, CanvasNodeSize>
    ): ConceptMapLayoutGenerationResult {
        // Check if best layout selection setting is enabled and set iterations count
        const bestLayoutSelectionEnabled = this.getSettings().bestLayoutSelection;
        const iterations = bestLayoutSelectionEnabled ? LAYOUT_ALGORITHMS[algorithm].iterations : 1;

        // Vars to store best layout generation results
        let bestGeneration: ConceptMapLayoutGenerationResult | null = null;
        let bestScore = Infinity;

        logger.debug(`Layout generation using ${algorithm}. (${iterations} iterations)`);

        for (let i = 0; i < iterations; i++) {
            // Generate a new layout
            this.canvasHelper.clearCanvas(canvas);
            this.generateConceptMapLayout(canvas, conceptMapData, nodeSizes, algorithm);

            // Evaluate the layout quality
            const metrics = this.evaluateConceptMapLayoutQuality(canvas);

            // Store canvas data
            const canvasData = canvas.getData();

            logger.debug(`Iteration ${i+1} metrics: nodes=${metrics.nodeOverlaps}, nodes-edges=${metrics.edgeNodeOverlaps}, edges=${metrics.edgeEdgeOverlaps}, weighted-score=${metrics.weightedScore}`);

            // Check if this generation is better than the best one
            if (metrics.weightedScore < bestScore) {
                bestScore = metrics.weightedScore;
                bestGeneration = {
                    canvasData: JSON.parse(JSON.stringify(canvasData)),
                    metrics,
                    algorithm
                };
                logger.debug(`New best result with score ${bestScore}`);
            }
        }

        if (!bestGeneration) {
            throw new Error(`Faled to generate layout using ${algorithm} algorithm.`);
        }
        
        return bestGeneration;
    }

    private generateConceptMapLayout(
        canvas: Canvas,
        conceptMapData: ConceptMapData,
        nodeSizes: Map<string, CanvasNodeSize>,
        algorithm: LayoutAlgorithm
    ): void {
        const defaultNodeSize = canvas.config.defaultTextNodeDimensions;

        const nodePositions = this.calculateNodePositions(conceptMapData, nodeSizes, defaultNodeSize, algorithm);
        const nodeLevels = this.colorizer.calculateNodeLevels(conceptMapData);

        // Map to store node IDs
        const nodeMap = new Map<string, string>(); // Map<llmEntityId, canvasNodeId>

        // Check if colored nodes and edges settings enabled
        const isColoredNodesEnabled = this.getSettings().coloredNodes;
        const isColoredEdgesEnabled = this.getSettings().coloredEdges;

        // Create nodes
        for (const entity of conceptMapData.entities) {
            const pos = nodePositions.get(entity.id);
            let size = nodeSizes.get(entity.id);

            if (!pos) {
                logger.error(`No position found for entity: ${entity.name}. Node will not be created.`);
                continue;
            }

            if (!size) {
                logger.warn(`No size found for entity: ${entity.name}. Default size will be used for node creation.`);
                size = defaultNodeSize;
            }

            // Get node color
            let color: string | undefined;
            if (isColoredNodesEnabled) {
                const level = nodeLevels.get(entity.id);
                color = this.colorizer.getNodeColor(level);
            }

            const newNode = this.canvasHelper.createTextNode(pos, entity, size, color);
            if (newNode) {
                nodeMap.set(entity.id, newNode.id);
            } else {
                logger.error(`Failed to create node for entity: ${entity.name}`);
            }
        }
        
        // Start tracking node sides that are already have incoming / outgoing edges
        this.canvasHelper.nodeSideOptimizer.populateNodeSides(canvas);

        // Create edges
        for (const relationship of conceptMapData.relationships) {
            const fromNodeId = nodeMap.get(relationship.source_id);
            const toNodeId = nodeMap.get(relationship.target_id);

            if (fromNodeId && toNodeId) {
                this.canvasHelper.createEdge(
                    fromNodeId,
                    toNodeId,
                    relationship,
                    isColoredEdgesEnabled
                );
            } else {
                logger.error(`Could not find nodes for relationship: ${relationship.source_id} -> ${relationship.target_id}`);
            }
        }
    }

    // Method to evaluate the quality of the concept map layout
    private evaluateConceptMapLayoutQuality(canvas: Canvas): ConceptMapLayoutQualityMetrics {
        const nodeOverlaps = this.layoutEvaluator.countNodeOverlaps(canvas);
        const edgeNodeOverlaps = this.layoutEvaluator.countEdgeNodeOverlaps(canvas);
        const edgeEdgeOverlaps = this.layoutEvaluator.countEdgeEdgeOverlaps(canvas);
        
        const weightedScore = nodeOverlaps * 10 + edgeNodeOverlaps * 3 + edgeEdgeOverlaps * 1;
        
        return { nodeOverlaps, edgeNodeOverlaps, edgeEdgeOverlaps, weightedScore };
    }

    private calculateNodeSizes(canvas: Canvas, conceptMapData: ConceptMapData): Map<string, CanvasNodeSize> {
        const nodeSizes = new Map<string, CanvasNodeSize>(); // Map<llmEntityId, canvasNodeSize>
        for (const entity of conceptMapData.entities) {
            // Currently use default node size from Canvas configuration
            const size = canvas.config.defaultTextNodeDimensions
            nodeSizes.set(entity.id, size);
        }

        return nodeSizes;
    }

    // Method to calculate node positions using graph layout algorithm
    private calculateNodePositions(
        conceptMapData: ConceptMapData,
        nodeSizes: Map<string, CanvasNodeSize>,
        defaultNodeSize: CanvasNodeSize,
        algorithm: LayoutAlgorithm
    ): Map<string, CanvasNodePosition> {
        const cyNodes: cytoscape.NodeDefinition[] = conceptMapData.entities.map(entity => ({
            data: { id: entity.id, name: entity.name }
        }));

        const cyEdges: cytoscape.EdgeDefinition[] = conceptMapData.relationships.map((rel, index) => ({
            data: {
                id: `edge-${index}`,
                source: rel.source_id,
                target: rel.target_id,
                label: rel.label
            }
        }));

        const cy = cytoscape({
            elements: { nodes: cyNodes, edges: cyEdges},
            headless: true,
        });

        // Get the layout options for the selected algorithm
        const layoutOptions = LAYOUT_ALGORITHMS[algorithm].options

        const layout = cy.layout(layoutOptions);
        layout.run();

        const positions = new Map<string, CanvasNodePosition>();
        const calculatedPositions: { id: string; x: number; y: number }[] = [];

        cy.nodes().forEach((node: cytoscape.NodeSingular) => {
            const pos = node.position();
            const entityId = node.id();
            calculatedPositions.push({ id: entityId, x: pos.x, y: pos.y });
        });

        if (calculatedPositions.length === 0) {
            logger.error('Cytoscape did not return any node positions.');
            return positions;
        }
        
        // Calculate the center of the graph
        const bb = cy.elements().boundingBox({});
        const graphCenterX = bb.x1 + bb.w / 2;
        const graphCenterY = bb.y1 + bb.h / 2;

        cy.destroy();

        for (const nodePos of calculatedPositions) {
            // Calculate positions relative to the center of the graph (0,0)
            const centeredX = nodePos.x - graphCenterX;
            const centeredY = nodePos.y - graphCenterY;

            // Calculate positions of left-top corner of the node
            let size = nodeSizes.get(nodePos.id);

            if (!size) {
                logger.warn(`No size found for node ${nodePos.id}. Default size will be used for converting center coordinates to top-left coordinates.`);
                size = defaultNodeSize;
            }

            const topLeftX = (centeredX - size.width / 2) * HORIZONTAL_STRETCH_FACTOR;
            const topLeftY = centeredY - size.height / 2;

            positions.set(nodePos.id, { x: topLeftX, y: topLeftY });
        }
        
        return this.alignNodesToGrid(positions);
    }

    private alignNodesToGrid(positions: Map<string, CanvasNodePosition>): Map<string, CanvasNodePosition> {
        if (GRID_SPACING <= 0) {
            logger.debug('GRID_SPACING is not positive. Skipping alignment.');
            return positions;
        }

        const alignedPositions = new Map<string, CanvasNodePosition>();

        for (const [id, pos] of positions.entries()) {
            const alignedX = Math.round(pos.x / GRID_SPACING) * GRID_SPACING;
            const alignedY = Math.round(pos.y / GRID_SPACING) * GRID_SPACING;

            alignedPositions.set(id, { x: alignedX, y: alignedY });
        }

        return alignedPositions;
    }
    
    // Method to apply generated layout to the canvas
    private applyLayout(canvas: Canvas, layout: ConceptMapLayoutGenerationResult): void {       
        logger.debug(`Apply the best generation for ${layout.algorithm} algorithm: nodes=${layout.metrics.nodeOverlaps}, nodes-edges=${layout.metrics.edgeNodeOverlaps}, edges=${layout.metrics.edgeEdgeOverlaps}`);

        this.canvasHelper.clearCanvas(canvas);
        canvas.setData(layout.canvasData);
        canvas.requestSave();

        // Apply custom classes to nodes
        this.canvasHelper.applyClasses();

        // Attach explanations for nodes and edges
        this.canvasHelper.attachExplanationsWhenReady()
    }

    public switchLayout(): void {
        // Switch to the next layout
        this.currentLayoutIndex = (this.currentLayoutIndex + 1) % this.layoutResults.length;
        
        const canvas = this.canvasHelper.getCurrentCanvas();
        const currentLayout = this.layoutResults[this.currentLayoutIndex];
        
        this.applyLayout(canvas, currentLayout);
        
        logger.debug(`Switched to ${currentLayout.algorithm}`);
    }
}

class ConceptMapColorizer {
    // Method to calculate node levels based on how many connections they are away from the central node
    calculateNodeLevels(conceptMapData: ConceptMapData): Map<string, number> {
        const levels = new Map<string, number>();
        
        // The first node in the list is considered the central node
        const centralNodeId = conceptMapData.entities[0].id;
        levels.set(centralNodeId, 0);
        
        const graph = new Map<string, string[]>();
        for (const entity of conceptMapData.entities) {
            graph.set(entity.id, []);
        }
        
        for (const rel of conceptMapData.relationships) {
            const sourceNeighbors = graph.get(rel.source_id) || [];
            sourceNeighbors.push(rel.target_id);
            graph.set(rel.source_id, sourceNeighbors);
            
            const targetNeighbors = graph.get(rel.target_id) || [];
            targetNeighbors.push(rel.source_id);
            graph.set(rel.target_id, targetNeighbors);
        }
        
        const queue: string[] = [centralNodeId];
        const visited = new Set<string>([centralNodeId]);
        
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentLevel = levels.get(currentId)!;
            
            for (const neighbor of graph.get(currentId) || []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    levels.set(neighbor, currentLevel + 1);
                    queue.push(neighbor);
                }
            }
        }
        
        return levels;
    }

    // Method to provide the color of a node based on its level
    getNodeColor(level: number | undefined): string {
        if (level === undefined) {
            return '#95A5A6'; // Nodes without a level
        }

        switch (level) {
            case 0: return CENTRAL_NODE_COLOR;
            case 1: return '#00ff00';
            case 2: return '#00ffff';
            case 3: return '#ff80ed';
            case 4: return '#ffa500';
            case 5: return '#8a2be2';
            case 6: return '#3498db';
            case 7: return '#ffd700';
            case 8: return '#ff5733';
            case 9: return '#16a085';
            case 10: return '#800000';
            case 11: return '#40e0d0';
            default: return '#bada55';
        }
    }
}

class LayoutEvaluator {
    // Method to count the number of overlaps between nodes
    countNodeOverlaps(canvas: Canvas): number {
        const nodes = Array.from(canvas.nodes.values());
        let overlapsCount = 0;
        
        for (let i = 0; i < nodes.length; i++) {
            const node1 = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const node2 = nodes[j];
                
                if (!(node1.x + node1.width < node2.x || 
                    node1.x > node2.x + node2.width || 
                    node1.y + node1.height < node2.y || 
                    node1.y > node2.y + node2.height)) {
                    overlapsCount++;
                }
            }
        }
        return overlapsCount;
    }

    // Method to count the number of overlaps between edges and nodes
    countEdgeNodeOverlaps(canvas: Canvas): number {
        const canvasData = canvas.getData();
        const edges = canvasData.edges;
        let overlapsCount = 0;
        
        for (const edge of edges) {
            // Get nodes connected by the edge
            const fromNode = canvas.nodes.get(edge.fromNode);
            const toNode = canvas.nodes.get(edge.toNode);
            
            if (!fromNode || !toNode) continue;
            
            // Get connection points between the edge and nodes
            const fromPoint = this.getEdgeNodeConnectionPoint(fromNode, edge.fromSide);
            const toPoint = this.getEdgeNodeConnectionPoint(toNode, edge.toSide);
            
            // Check if the edge intersects with any other node
            for (const node of canvas.nodes.values()) {
                // If the node is one of the endpoints of the edge, skip it
                if (node.id === edge.fromNode || node.id === edge.toNode) continue;
                
                // Check if the edge intersects with the node's rectangle
                if (this.lineIntersectsRectangle(
                    fromPoint.x, fromPoint.y, 
                    toPoint.x, toPoint.y, 
                    node.x, node.y, node.width, node.height)) {
                    overlapsCount++;
                }
            }
        }
        return overlapsCount;
    }

    // Method to count the number of overlaps between edges
    countEdgeEdgeOverlaps(canvas: Canvas): number {
        const canvasData = canvas.getData();
        const edges = canvasData.edges;
        let overlapsCount = 0;

        // Loop over all edges
        for (let i = 0; i < edges.length; i++) {
            const edge1 = edges[i];
            const fromNode1 = canvas.nodes.get(edge1.fromNode);
            const toNode1 = canvas.nodes.get(edge1.toNode);
            
            if (!fromNode1 || !toNode1) continue;
            
            // Get coordinates for the start and end of the first edge
            const line1Start = this.getEdgeNodeConnectionPoint(fromNode1, edge1.fromSide);
            const line1End = this.getEdgeNodeConnectionPoint(toNode1, edge1.toSide);
            
            // Loop over all other edges
            for (let j = i + 1; j < edges.length; j++) {
                const edge2 = edges[j];
                
            // Skip special cases
            if ((edge1.fromNode === edge2.fromNode && edge1.fromSide === edge2.fromSide) || // Both edges start from the same side of the same node
                (edge1.toNode === edge2.toNode && edge1.toSide === edge2.toSide) || // Both edges end at the same side of the same node
                (edge1.fromNode === edge2.toNode && edge1.fromSide === edge2.toSide) || // One edge starts where the other ends
                (edge1.toNode === edge2.fromNode && edge1.toSide === edge2.fromSide)) { // One edge ends where the other starts
                continue;
            }
                
                const fromNode2 = canvas.nodes.get(edge2.fromNode);
                const toNode2 = canvas.nodes.get(edge2.toNode);
                
                if (!fromNode2 || !toNode2) continue;
                
                // Get coordinates for the start and end of the second edge
                const line2Start = this.getEdgeNodeConnectionPoint(fromNode2, edge2.fromSide);
                const line2End = this.getEdgeNodeConnectionPoint(toNode2, edge2.toSide);
                
                // Check if the two edges intersect
                if (this.lineIntersectsLine(
                    line1Start.x, line1Start.y, line1End.x, line1End.y,
                    line2Start.x, line2Start.y, line2End.x, line2End.y)) {
                    overlapsCount++;
                }
            }
        }
        
        return overlapsCount;
    }

    // Method to get the connection point between the node and the edge
    private getEdgeNodeConnectionPoint(node: CanvasNode, side: NodeSide): {x: number, y: number} {
        switch (side) {
            case 'top':
                return { x: node.x + node.width / 2, y: node.y };
            case 'right':
                return { x: node.x + node.width, y: node.y + node.height / 2 };
            case 'bottom':
                return { x: node.x + node.width / 2, y: node.y + node.height };
            case 'left':
                return { x: node.x, y: node.y + node.height / 2 };
        }
    }

    // Method to check if a line intersects with a rectangle of given location
    private lineIntersectsRectangle(
        x1: number, y1: number, x2: number, y2: number, 
        rectX: number, rectY: number, rectWidth: number, rectHeight: number
    ): boolean {
        // Check if the line intersects with any of the rectangle's sides
        return this.lineIntersectsLine(x1, y1, x2, y2, rectX, rectY, rectX + rectWidth, rectY) || // top
               this.lineIntersectsLine(x1, y1, x2, y2, rectX + rectWidth, rectY, rectX + rectWidth, rectY + rectHeight) || // right
               this.lineIntersectsLine(x1, y1, x2, y2, rectX, rectY + rectHeight, rectX + rectWidth, rectY + rectHeight) || // bottom
               this.lineIntersectsLine(x1, y1, x2, y2, rectX, rectY, rectX, rectY + rectHeight); // left
    }

    // Method to check if a line intersects with another line
    private lineIntersectsLine(
        x1: number, y1: number, x2: number, y2: number, 
        x3: number, y3: number, x4: number, y4: number
    ): boolean {
        // Calculate the determinant
        const d = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
        
        // Lines are parallel
        if (d === 0) return false;
        
        // Calculate the intersection point
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / d;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / d;
        
        // Check if the intersection point belongs to both lines
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }
}