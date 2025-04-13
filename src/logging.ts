import { DEBUG_MODE } from './config';

export class Logger {
    private readonly prefix = 'Concept Mapper';

    // Logging info messages, always works
    log(message: string, ...args: any[]): void {
        console.log(`${this.prefix}: ${message}`, ...args);
    }

    // Logging debug messages, only works in DEBUG_MODE
    debug(message: string, ...args: any[]): void {
        if (DEBUG_MODE) {
            console.log(`${this.prefix} [DEBUG]: ${message}`, ...args);
        }
    }
    
    // Logging warning messages, always works
    warn(message: string, ...args: any[]): void {
        console.warn(`${this.prefix}: ${message}`, ...args);
    }
    
    // Logging error messages, always works
    error(message: string, ...args: any[]): void {
        console.error(`${this.prefix}: ${message}`, ...args);
    }
}

export const logger = new Logger();