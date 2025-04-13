export const DEBUG_MODE = true;
export const OPTIMIZATION_MODE = true;

// Colors
export const CENTRAL_NODE_COLOR = '#ff4500'; 
export const EDGE_COLOR = '#5CD1FF';

// Backend server
export const BACKEND_SERVER_HOSTNAME = 'localhost';
export const BACKEND_SERVER_PORT = 8000;

// Layout
export const LAYOUT_ALGORITHMS = {
    cola: {
        options: {
            name: 'cola',
            animate: false,
            fit: false,
            nodeSpacing: 200, // Distance between nodes
            edgeLength: 100, // Edge length
            avoidOverlap: true, 
            unconstrIter: 2000, // Unconstrained iterations (prev value - 100)
            userConstIter: 2000, // User constrained iterations (prev value - 200)
            allConstIter: 2000, // All constrained iterations (prev value - 200)
            randomize: true
        },
        iterations: 20 // Number of iterations for cola layout if selection is enabled
    },
    'cose-bilkent': {
        options: {
            name: 'cose-bilkent',
            quality: 'proof',
            refresh: 0, // Number of iterations between consecutive screen positions update (0 -> only updated on the end)
            fit: true, // Whether to fit the network view after when done
            padding: 10, // Padding on fit
            incremental: true, // Whether to enable incremental mode
            debug: false, // Whether to use the JS console to print debug messages
            nodeRepulsion: 15000000, // Node repulsion (non overlapping) multiplier
            nodeOverlap: 0, // Node repulsion (overlapping) multiplier
            idealEdgeLength: 220, // Ideal edge (non nested) length
            edgeElasticity: 0.45, // Divisor to compute edge forces
            nestingFactor: 1, // Nesting factor (multiplier) to compute ideal edge length for nested edges
            gravity: 0.4, // Gravity force (constant),
            gravityRange: 3.8,
            numIter: 2500, // Maximum number of iterations to perform
            initialTemp: 200, // Initial temperature (maximum node displacement)
            coolingFactor: 0.95, // Cooling factor (how the temperature is reduced between consecutive iterations
            minTemp: 1, // Lower temperature threshold (below this point the layout will end)
            tile: false, // For enabling tiling
            animate: false
        },
        iterations: 100
    },
    dagre: {
        options: {
            name: 'dagre',
            rankDir: 'LR', // Direction for rank nodes
            align: 'DL', // Alignment for rank nodes
            ranker: 'tight-tree', // Algorithm for rank nodes
            nodeSep: 120, // Separation between nodes
            rankSep: 250, // Separation between ranks
            edgeSep: 20, // Separation between edges
            fit: true, 
            padding: 30,
            spacingFactor: 1.5, // Multiplier for spacing between nodes
            animate: false
        },
        iterations: 1
    }
};

// Custom layout operations parameters
export const GRID_SPACING = 200; // Grid step for node alignment (100 also works well)
export const HORIZONTAL_STRETCH_FACTOR = 1.25; // Horizontal coordinate stretch factor