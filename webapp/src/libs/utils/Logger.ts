/**
 * Production-safe logger utility.
 *
 * This logger wraps console methods and only outputs logs in development mode.
 * In production, debug logs are silently suppressed to keep the console clean
 * and avoid exposing potentially sensitive information.
 *
 * Usage:
 *   import { logger } from '../libs/utils/Logger';
 *   logger.debug('Debug message');  // Only in development
 *   logger.info('Info message');    // Only in development
 *   logger.warn('Warning');         // Only in development
 *   logger.error('Error');          // Always logged (errors should be tracked)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

type LogMethod = (...args: unknown[]) => void;

interface Logger {
    /** Debug logging - only in development */
    debug: LogMethod;
    /** Informational logging - only in development */
    info: LogMethod;
    /** Log alias for console.log - only in development */
    log: LogMethod;
    /** Warning logging - only in development */
    warn: LogMethod;
    /** Error logging - always logged (important for error tracking) */
    error: LogMethod;
}

const noop: LogMethod = () => {
    // No-op function for production
};

/**
 * Production-safe logger.
 * Debug, info, log, and warn are suppressed in production.
 * Errors are always logged for debugging purposes.
 */
export const logger: Logger = {
    debug: isDevelopment ? console.debug.bind(console) : noop,
    info: isDevelopment ? console.info.bind(console) : noop,
    log: isDevelopment ? console.log.bind(console) : noop,
    warn: isDevelopment ? console.warn.bind(console) : noop,
    // Errors should always be logged for debugging/monitoring
    error: console.error.bind(console),
};

export default logger;
