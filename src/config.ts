import * as vertexAi from "@google-cloud/vertexai";
// Correctly import Gemini types only from @google/generative-ai
import { HarmCategory as GenaiHarmCategory, HarmBlockThreshold as GenaiHarmBlockThreshold } from "@google/generative-ai";

// --- Provider Configuration ---
export type AIProvider = "vertex" | "gemini";
export const AI_PROVIDER = (process.env.AI_PROVIDER?.toLowerCase() === "gemini" ? "gemini" : "vertex") as AIProvider;

// --- Vertex AI Specific ---
export const GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
export const GCLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

// --- Gemini API Specific ---
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Common AI Configuration Defaults ---
const DEFAULT_VERTEX_MODEL_ID = "gemini-2.5-pro-exp-03-25";
const DEFAULT_GEMINI_MODEL_ID = "gemini-2.5-pro-exp-03-25";
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_USE_STREAMING = true;
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export const WORKSPACE_ROOT = process.cwd();

// --- Safety Settings ---
// For Vertex AI (@google-cloud/vertexai)
export const vertexSafetySettings = [
    { category: vertexAi.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: vertexAi.HarmBlockThreshold.BLOCK_NONE },
    { category: vertexAi.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: vertexAi.HarmBlockThreshold.BLOCK_NONE },
    { category: vertexAi.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: vertexAi.HarmBlockThreshold.BLOCK_NONE },
    { category: vertexAi.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: vertexAi.HarmBlockThreshold.BLOCK_NONE },
];

// For Gemini API (@google/generative-ai) - using corrected imports
export const geminiSafetySettings = [
    { category: GenaiHarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: GenaiHarmBlockThreshold.BLOCK_NONE },
    { category: GenaiHarmCategory.HARM_CATEGORY_HARASSMENT, threshold: GenaiHarmBlockThreshold.BLOCK_NONE },
    { category: GenaiHarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: GenaiHarmBlockThreshold.BLOCK_NONE },
    { category: GenaiHarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: GenaiHarmBlockThreshold.BLOCK_NONE },
];

// --- Validation ---
if (AI_PROVIDER === "vertex" && !GCLOUD_PROJECT) {
  console.error("Error: AI_PROVIDER is 'vertex' but GOOGLE_CLOUD_PROJECT environment variable is not set.");
  process.exit(1);
}

if (AI_PROVIDER === "gemini" && !GEMINI_API_KEY) {
  console.error("Error: AI_PROVIDER is 'gemini' but GEMINI_API_KEY environment variable is not set.");
  process.exit(1);
}

// --- Shared Config Retrieval ---
export function getAIConfig() {
    // Common parameters
    let temperature = DEFAULT_TEMPERATURE;
    const tempEnv = process.env.AI_TEMPERATURE;
    if (tempEnv) {
        const parsedTemp = parseFloat(tempEnv);
        // Temperature range varies, allow 0-2 for Gemini flexibility
        temperature = (!isNaN(parsedTemp) && parsedTemp >= 0.0 && parsedTemp <= 2.0) ? parsedTemp : DEFAULT_TEMPERATURE;
        if (temperature !== parsedTemp) console.warn(`Invalid AI_TEMPERATURE value "${tempEnv}". Using default: ${DEFAULT_TEMPERATURE}`);
    }

    let useStreaming = DEFAULT_USE_STREAMING;
    const streamEnv = process.env.AI_USE_STREAMING?.toLowerCase();
    if (streamEnv === 'false') useStreaming = false;
    else if (streamEnv && streamEnv !== 'true') console.warn(`Invalid AI_USE_STREAMING value "${streamEnv}". Using default: ${DEFAULT_USE_STREAMING}`);

    let maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
    const tokensEnv = process.env.AI_MAX_OUTPUT_TOKENS;
    if (tokensEnv) {
        const parsedTokens = parseInt(tokensEnv, 10);
        maxOutputTokens = (!isNaN(parsedTokens) && parsedTokens > 0) ? parsedTokens : DEFAULT_MAX_OUTPUT_TOKENS;
        if (maxOutputTokens !== parsedTokens) console.warn(`Invalid AI_MAX_OUTPUT_TOKENS value "${tokensEnv}". Using default: ${DEFAULT_MAX_OUTPUT_TOKENS}`);
    }

    let maxRetries = DEFAULT_MAX_RETRIES;
    const retriesEnv = process.env.AI_MAX_RETRIES;
    if (retriesEnv) {
        const parsedRetries = parseInt(retriesEnv, 10);
        maxRetries = (!isNaN(parsedRetries) && parsedRetries >= 0) ? parsedRetries : DEFAULT_MAX_RETRIES;
        if (maxRetries !== parsedRetries) console.warn(`Invalid AI_MAX_RETRIES value "${retriesEnv}". Using default: ${DEFAULT_MAX_RETRIES}`);
    }

    let retryDelayMs = DEFAULT_RETRY_DELAY_MS;
    const delayEnv = process.env.AI_RETRY_DELAY_MS;
    if (delayEnv) {
        const parsedDelay = parseInt(delayEnv, 10);
        retryDelayMs = (!isNaN(parsedDelay) && parsedDelay >= 0) ? parsedDelay : DEFAULT_RETRY_DELAY_MS;
        if (retryDelayMs !== parsedDelay) console.warn(`Invalid AI_RETRY_DELAY_MS value "${delayEnv}". Using default: ${DEFAULT_RETRY_DELAY_MS}`);
    }

    // Provider-specific model ID
    let modelId: string;
    if (AI_PROVIDER === 'vertex') {
        modelId = process.env.VERTEX_MODEL_ID || DEFAULT_VERTEX_MODEL_ID;
    } else { // gemini
        modelId = process.env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID;
    }

     return {
        provider: AI_PROVIDER,
        modelId,
        temperature,
        useStreaming,
        maxOutputTokens,
        maxRetries,
        retryDelayMs,
        // Provider-specific connection info
        gcpProjectId: GCLOUD_PROJECT,
        gcpLocation: GCLOUD_LOCATION,
        geminiApiKey: GEMINI_API_KEY
     };
}