export const DEBUG_MODE = true;
export const OPTIMIZATION_MODE = true;

// Colors
export const CENTRAL_NODE_COLOR = '#ff4500'; 
export const EDGE_COLOR = '#5CD1FF';

// Backend server
export const BACKEND_SERVER_HOSTNAME = 'localhost';
export const BACKEND_SERVER_PORT = 8000;

// Layout algorithm
export const COLA_LAYOUT_OPTIONS = {
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
};

export const COLA_LAYOUT_SELECTION_ITERATIONS = 20; // Number of iterations for cola layout

// Custom layout operations parameters
export const GRID_SPACING = 200; // Grid step for node alignment (100 also works well)
export const HORIZONTAL_STRETCH_FACTOR = 1.25; // Horizontal coordinate stretch factor