import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type GenerationConfig,
  type SafetySetting,
  type FunctionDeclaration,
  type Tool
} from "@google/genai";

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
// Import getAIConfig and original safety setting definitions from config
import { getAIConfig, vertexSafetySettings, geminiSafetySettings as configGeminiSafetySettings } from './config.js';
import { sleep } from './utils.js';

// --- Configuration and Client Initialization ---
let ai: GoogleGenAI;
let aiConfig: ReturnType<typeof getAIConfig>;

export function initializeAI() {
    aiConfig = getAIConfig();
    
    try {
        if (aiConfig.geminiApiKey) {
            ai = new GoogleGenAI({ apiKey: aiConfig.geminiApiKey });
        } else if (aiConfig.gcpProjectId && aiConfig.gcpLocation) {
            ai = new GoogleGenAI({
                vertexai: true,
                project: aiConfig.gcpProjectId,
                location: aiConfig.gcpLocation
            });
        } else {
            throw new Error("Missing Gemini API key or Vertex AI project/location configuration.");
        }
        console.log("Initialized GoogleGenAI with config:", aiConfig.modelId);
    } catch (error: any) {
        console.error(`Error initializing GoogleGenAI:`, error.message);
        process.exit(1);
    }
}

// Define a union type for Content
export type CombinedContent = Content;

// --- Unified AI Call Function ---
export async function callGenerativeAI(
    initialContents: CombinedContent[],
    tools: Tool[] | undefined
): Promise<string> {
    // Ensure AI is initialized
    if (!ai || !aiConfig) {
        throw new Error("AI client not initialized. Call initializeAI() first.");
    }

    const {
        provider,
        modelId,
        temperature,
        useStreaming,
        maxOutputTokens,
        maxRetries,
        retryDelayMs,
    } = aiConfig;

    const isGroundingRequested = tools?.some(tool => (tool as any).googleSearchRetrieval);

    let filteredToolsForVertex = tools;
    let adaptedToolsForGemini: FunctionDeclaration[] | undefined = undefined;

    if (provider === 'gemini' && tools) {
        const nonSearchTools = tools.filter(tool => !(tool as any).googleSearchRetrieval);
        if (nonSearchTools.length > 0) {
             console.warn(`Gemini Provider: Function calling tools detected but adaptation/usage with @google/generative-ai is not fully implemented.`);
        } else {
             console.log(`Gemini Provider: Explicit googleSearchRetrieval tool filtered out (search handled implicitly or by model).`);
        }
        filteredToolsForVertex = undefined;
        adaptedToolsForGemini = undefined; // Keep undefined for now

    } else if (provider === 'vertex' && isGroundingRequested && tools && tools.length > 1) {
        console.warn("Vertex Provider: Grounding requested with other tools; keeping only search.");
        filteredToolsForVertex = tools.filter(tool => (tool as any).googleSearchRetrieval);
    }


    // Get appropriate model instance
    // Unified model instance
    // generativeModel is already initialized above

    // --- Prepare Request Parameters (differ slightly between SDKs) ---
    const commonGenConfig: GenerationConfig = { temperature, maxOutputTokens };
    const resolvedSafetySettings: SafetySetting[] = aiConfig.provider === "vertex" ? vertexSafetySettings : configGeminiSafetySettings;
    // All requests will use generativeModel.generateContent or generateContentStream


    // --- Execute Request with Retries ---
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Simplified log line without the problematic length check
            console.error(`[${new Date().toISOString()}] Calling ${provider} AI (${modelId}, temp: ${temperature}, grounding: ${isGroundingRequested}, tools(Vertex): ${filteredToolsForVertex?.length ?? 0}, stream: ${useStreaming}, attempt: ${attempt + 1})`);

            let responseText: string | undefined;

            if (useStreaming) {

                const stream = await ai.models.generateContentStream({
                    model: modelId,
                    contents: initialContents,
                    ...(tools && tools.length > 0
                        ? { config: { tools } }
                        : {})
                });
                let accumulatedText = "";

                let lastChunk: any = null;

                for await (const chunk of stream) {
                    lastChunk = chunk;
                    try {
                        if (chunk.text) accumulatedText += chunk.text;
                    } catch (e: any) {
                        console.warn("Non-text or error chunk encountered in stream:", e.message);
                        if (e.message?.toLowerCase().includes('safety')) {
                            throw new Error(`Content generation blocked during stream. Reason: ${e.message}`);
                        }
                    }
                }

                // Check block/safety reasons on lastChunk if available
                if (lastChunk) {
                    const blockReason = lastChunk?.promptFeedback?.blockReason;
                    if (blockReason) {
                        throw new Error(`Content generation blocked. Aggregated Reason: ${blockReason}`);
                    }
                    const finishReason = lastChunk?.candidates?.[0]?.finishReason;
                    if (finishReason === 'SAFETY') {
                        throw new Error(`Content generation blocked. Aggregated Finish Reason: SAFETY`);
                    }
                }

                responseText = accumulatedText;

                if (typeof responseText !== 'string' || !responseText) {
                    console.error(`Empty response received from AI stream.`);
                    throw new Error(`Received empty or non-text response from AI stream.`);
                }

                console.error(`[${new Date().toISOString()}] Finished processing stream from AI.`);
            } else { // Non-streaming
                let result: any;
                try {
                    result = await ai.models.generateContent({
                        model: modelId,
                        contents: initialContents,
                        ...(tools && tools.length > 0
                            ? { config: { tools } }
                            : {})
                    });
                } catch (e: any) {
                    console.error("Error during non-streaming call:", e.message);
                    if (e.message?.toLowerCase().includes('safety') || e.message?.toLowerCase().includes('prompt blocked') || (e as any).status === 'BLOCKED') {
                        throw new Error(`Content generation blocked. Call Reason: ${e.message}`);
                    }
                    throw e;
                }
                console.error(`[${new Date().toISOString()}] Received non-streaming response from AI.`);
                try {
                    responseText = result.text;
                } catch (e) {
                    console.warn("Could not extract text from non-streaming response:", e);
                }
                const blockReason = result?.promptFeedback?.blockReason;
                if (blockReason) {
                    throw new Error(`Content generation blocked. Response Reason: ${blockReason}`);
                }
                const finishReason = result?.candidates?.[0]?.finishReason;
                if (finishReason === 'SAFETY') {
                    throw new Error(`Content generation blocked. Response Finish Reason: SAFETY`);
                }

                if (typeof responseText !== 'string' || !responseText) {
                    console.error(`Unexpected non-streaming response structure:`, JSON.stringify(result, null, 2));
                    throw new Error(`Failed to extract valid text response from AI (non-streaming).`);
                }
            }

            // --- Return Text ---
            if (typeof responseText === 'string') {
                 return responseText;
            } else {
                 throw new Error(`Invalid state: No valid text response obtained from ${provider} AI.`);
            }

        } catch (error: any) {
             console.error(`[${new Date().toISOString()}] Error details (attempt ${attempt + 1}):`, error);
             const errorMessageString = String(error.message || error || '').toLowerCase();
             const isBlockingError = errorMessageString.includes('blocked') || errorMessageString.includes('safety');
             const isRetryable = !isBlockingError && (
                 errorMessageString.includes('429') ||
                 errorMessageString.includes('500') ||
                 errorMessageString.includes('503') ||
                 errorMessageString.includes('deadline_exceeded') ||
                 errorMessageString.includes('internal') ||
                 errorMessageString.includes('network error') ||
                 errorMessageString.includes('socket hang up') ||
                 errorMessageString.includes('unavailable') ||
                 errorMessageString.includes('could not connect')
             );

            if (isRetryable && attempt < maxRetries) {
                const jitter = Math.random() * 500;
                const delay = (retryDelayMs * Math.pow(2, attempt)) + jitter;
                console.error(`[${new Date().toISOString()}] Retrying in ${delay.toFixed(0)}ms...`);
                await sleep(delay);
                continue;
            } else {
                 let finalErrorMessage = `${provider} AI API error: ${error.message || "Unknown error"}`;
                 if (isBlockingError) {
                      const match = error.message?.match(/(Reason|Finish Reason):\s*(.*)/i);
                       if (match?.[2]) {
                          finalErrorMessage = `Content generation blocked by ${provider} safety filters. Reason: ${match[2]}`;
                       } else {
                          const geminiBlockMatch = error.message?.match(/prompt.*blocked.*\s*safety.*?setting/i);
                           if (geminiBlockMatch) {
                              finalErrorMessage = `Content generation blocked by Gemini safety filters.`;
                           } else {
                              finalErrorMessage = `Content generation blocked by ${provider} safety filters. (${error.message || 'No specific reason found'})`;
                           }
                       }
                 } else if (errorMessageString.match(/\b(429|500|503|internal|unavailable)\b/)) {
                     finalErrorMessage += ` (Status: ${errorMessageString.match(/\b(429|500|503|internal|unavailable)\b/)?.[0]})`;
                 } else if (errorMessageString.includes('deadline_exceeded')) {
                     finalErrorMessage = `${provider} AI API error: Operation timed out (deadline_exceeded).`;
                 }
                 console.error("Final error message:", finalErrorMessage);
                 throw new McpError(ErrorCode.InternalError, finalErrorMessage);
            }
        }
    } // End retry loop

    throw new McpError(ErrorCode.InternalError, `Max retries (${maxRetries + 1}) reached for ${provider} LLM call without success.`);
}