import { HarmCategory, HarmBlockThreshold } from "@google/genai";

// --- Provider Configuration ---
export type AIProvider = "vertex" | "gemini";

function getAIProvider(): AIProvider {
    return (process.env.AI_PROVIDER?.toLowerCase() === "gemini" ? "gemini" : "vertex") as AIProvider;
}

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
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// For Gemini API (@google/generative-ai) - using corrected imports
export const geminiSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Validation Function ---
export function validateConfig() {
  const aiProvider = getAIProvider();
  
  if (aiProvider === "vertex" && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error("Error: AI_PROVIDER is 'vertex' but GOOGLE_CLOUD_PROJECT environment variable is not set.");
    process.exit(1);
  }

  if (aiProvider === "gemini" && !process.env.GEMINI_API_KEY) {
    console.error("Error: AI_PROVIDER is 'gemini' but GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
  }
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
    const aiProvider = getAIProvider();
    let modelId: string;
    if (aiProvider === 'vertex') {
        modelId = process.env.VERTEX_MODEL_ID || DEFAULT_VERTEX_MODEL_ID;
    } else { // gemini
        modelId = process.env.GEMINI_MODEL_ID || DEFAULT_GEMINI_MODEL_ID;
    }

     return {
        provider: aiProvider,
        modelId,
        temperature,
        useStreaming,
        maxOutputTokens,
        maxRetries,
        retryDelayMs,
        // Provider-specific connection info
        gcpProjectId: process.env.GOOGLE_CLOUD_PROJECT,
        gcpLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
        geminiApiKey: process.env.GEMINI_API_KEY
     };
}