import { HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";

// --- Configuration ---
export const GCLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
export const GCLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
export const DEFAULT_MODEL_ID = "gemini-2.5-pro-exp-03-25";
export const DEFAULT_TEMPERATURE = 0.0;
export const DEFAULT_USE_STREAMING = true;
export const DEFAULT_MAX_OUTPUT_TOKENS = 65535;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;
export const WORKSPACE_ROOT = process.cwd();

// Define safety settings to disable blocking
export const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

if (!GCLOUD_PROJECT) {
  console.error("Error: GOOGLE_CLOUD_PROJECT environment variable is not set.");
  process.exit(1);
}

export function getVertexAIConfig() {
    let temperature = DEFAULT_TEMPERATURE;
    const tempEnv = process.env.VERTEX_AI_TEMPERATURE;
    if (tempEnv) {
        const parsedTemp = parseFloat(tempEnv);
        temperature = (!isNaN(parsedTemp) && parsedTemp >= 0.0 && parsedTemp <= 1.0) ? parsedTemp : DEFAULT_TEMPERATURE;
        if (temperature !== parsedTemp) console.warn(`Invalid VERTEX_AI_TEMPERATURE value "${tempEnv}". Using default: ${DEFAULT_TEMPERATURE}`);
    }

    let useStreaming = DEFAULT_USE_STREAMING;
    const streamEnv = process.env.VERTEX_AI_USE_STREAMING?.toLowerCase();
     if (streamEnv === 'false') useStreaming = false;
     else if (streamEnv && streamEnv !== 'true') console.warn(`Invalid VERTEX_AI_USE_STREAMING value. Using default: ${DEFAULT_USE_STREAMING}`);

    let maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
    const tokensEnv = process.env.VERTEX_AI_MAX_OUTPUT_TOKENS;
     if (tokensEnv) {
         const parsedTokens = parseInt(tokensEnv, 10);
         maxOutputTokens = (!isNaN(parsedTokens) && parsedTokens > 0) ? parsedTokens : DEFAULT_MAX_OUTPUT_TOKENS;
         if (maxOutputTokens !== parsedTokens) console.warn(`Invalid VERTEX_AI_MAX_OUTPUT_TOKENS value. Using default: ${DEFAULT_MAX_OUTPUT_TOKENS}`);
     }

    let maxRetries = DEFAULT_MAX_RETRIES;
    const retriesEnv = process.env.VERTEX_AI_MAX_RETRIES;
     if (retriesEnv) {
         const parsedRetries = parseInt(retriesEnv, 10);
         maxRetries = (!isNaN(parsedRetries) && parsedRetries >= 0) ? parsedRetries : DEFAULT_MAX_RETRIES;
         if (maxRetries !== parsedRetries) console.warn(`Invalid VERTEX_AI_MAX_RETRIES value. Using default: ${DEFAULT_MAX_RETRIES}`);
     }

    let retryDelayMs = DEFAULT_RETRY_DELAY_MS;
    const delayEnv = process.env.VERTEX_AI_RETRY_DELAY_MS;
     if (delayEnv) {
         const parsedDelay = parseInt(delayEnv, 10);
         retryDelayMs = (!isNaN(parsedDelay) && parsedDelay >= 0) ? parsedDelay : DEFAULT_RETRY_DELAY_MS;
         if (retryDelayMs !== parsedDelay) console.warn(`Invalid VERTEX_AI_RETRY_DELAY_MS value. Using default: ${DEFAULT_RETRY_DELAY_MS}`);
     }

     const modelId = process.env.VERTEX_AI_MODEL_ID || DEFAULT_MODEL_ID;

     return {
        modelId,
        temperature,
        useStreaming,
        maxOutputTokens,
        maxRetries,
        retryDelayMs
     };
}