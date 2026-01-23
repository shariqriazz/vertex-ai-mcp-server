/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PROJECT_ROOT } from './paths.js';

const logFilePath = path.join(PROJECT_ROOT, 'logs', 'server.log');

async function ensureLogDirectoryExists() {
    try {
        await fs.mkdir(path.dirname(logFilePath), { recursive: true });
    } catch (error) {
        // If we can't create the log directory, log to console as a fallback.
        console.error('Could not create log directory:', error);
    }
}

// Ensure the directory exists when the module is loaded.
ensureLogDirectoryExists();

// Check if DEBUG_LOGGING environment variable is set to enable logging
const debugLoggingEnv = process.env.DEBUG_LOGGING;
const debugLoggingDefault =
    typeof debugLoggingEnv === 'string'
        ? debugLoggingEnv.toLowerCase() === 'true' || debugLoggingEnv === '1'
        : false;

let isLoggingEnabled = debugLoggingDefault;

export function setLoggingEnabled(enabled: boolean) {
    isLoggingEnabled = enabled;
}

export function logToFile(message: string) {
    if (!isLoggingEnabled) {
        return;
    }
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;

    fs.appendFile(logFilePath, logMessage).catch(err => {
        // Fallback to console if file logging fails
        console.error('Failed to write to log file:', err);
    });
}
