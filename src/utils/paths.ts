/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { platform, homedir } from 'node:os';

// In ES modules, __dirname is not available by default. Use import.meta.url instead.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(): string {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(
    `Could not find project root containing package.json. Traversed up from ${__dirname}.`,
  );
}

/**
 * Returns the OS-specific configuration directory for storing sensitive files.
 * Uses standard secure storage locations:
 * - macOS/Linux: ~/.config/vertex-ai-mcp/
 * - Windows: %APPDATA%/vertex-ai-mcp/
 */
function getConfigDir(): string {
  const home = homedir();
  const os = platform();

  let configDir: string;
  if (os === 'win32') {
    // Windows: use APPDATA
    configDir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'vertex-ai-mcp');
  } else {
    // macOS, Linux, and others: use ~/.config
    configDir = path.join(home, '.config', 'vertex-ai-mcp');
  }

  // Ensure the directory exists with restrictive permissions
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  return configDir;
}

// Construct an absolute path to the project root.
export const PROJECT_ROOT = findProjectRoot();

// Store sensitive token files in OS-specific secure locations
// instead of project root to prevent accidental git commits
export const CONFIG_DIR = getConfigDir();
export const ENCRYPTED_TOKEN_PATH = path.join(
  CONFIG_DIR,
  'oauth-token.json',
);
export const ENCRYPTION_MASTER_KEY_PATH = path.join(
  CONFIG_DIR,
  'master-key',
);
