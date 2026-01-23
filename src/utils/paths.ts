/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import * as fs from 'node:fs';

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

// Construct an absolute path to the project root.
export const PROJECT_ROOT = findProjectRoot();
export const ENCRYPTED_TOKEN_PATH = path.join(
  PROJECT_ROOT,
  'vertex-ai-oauth-token.json',
);
export const ENCRYPTION_MASTER_KEY_PATH = path.join(
  PROJECT_ROOT,
  '.vertex-ai-master-key',
);
