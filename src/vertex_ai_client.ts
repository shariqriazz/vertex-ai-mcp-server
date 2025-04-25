import * as vertexAiSdk from "@google-cloud/vertexai";
// Correct import: Use @google/generative-ai
import { GoogleGenerativeAI } from "@google/generative-ai";
// Import specific types needed, alias Content and explicitly import SafetySetting
import type { Content as GoogleGeneraiContent, GenerationConfig, SafetySetting, FunctionDeclaration } from "@google/generative-ai";

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
// Import getAIConfig and original safety setting definitions from config
import { getAIConfig, vertexSafetySettings, geminiSafetySettings as configGeminiSafetySettings } from './config.js';
import { sleep } from './utils.js';

// --- Configuration and Client Initialization ---
const aiConfig = getAIConfig();
// Use correct client types
let generativeClient: vertexAiSdk.VertexAI | GoogleGenerativeAI;

try {
    if (aiConfig.provider === 'vertex') {
        if (!aiConfig.gcpProjectId || !aiConfig.gcpLocation) {
            throw new Error("Missing GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION for Vertex AI provider.");
        }
        generativeClient = new vertexAiSdk.VertexAI({ project: aiConfig.gcpProjectId, location: aiConfig.gcpLocation });
        console.log(`Initialized Vertex AI client for project ${aiConfig.gcpProjectId} in ${aiConfig.gcpLocation}`);
    } else { // gemini
        if (!aiConfig.geminiApiKey) {
            throw new Error("Missing GEMINI_API_KEY for Gemini provider.");
        }
        // Instantiate using the correct package
        generativeClient = new GoogleGenerativeAI(aiConfig.geminiApiKey);
        console.log("Initialized Gemini API client (@google/generative-ai)");
    }
} catch (error: any) {
    console.error(`Error initializing ${aiConfig.provider} AI client:`, error.message);
    process.exit(1);
}

// Define a union type for Content
export type CombinedContent = vertexAiSdk.Content | GoogleGeneraiContent;

// --- Unified AI Call Function ---
export async function callGenerativeAI(
    initialContents: CombinedContent[],
    tools: vertexAiSdk.Tool[] | undefined // Still expect Vertex Tool format initially
): Promise<string> {

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
    let vertexModelInstance: any | undefined;
    let geminiModelInstance: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | undefined;

    if (provider === 'vertex') {
        vertexModelInstance = isGroundingRequested
            ? (generativeClient as vertexAiSdk.VertexAI).preview.getGenerativeModel({ model: modelId })
            : (generativeClient as vertexAiSdk.VertexAI).getGenerativeModel({ model: modelId });
    } else { // gemini
         geminiModelInstance = (generativeClient as GoogleGenerativeAI).getGenerativeModel({
             model: modelId,
             // Safety settings/genConfig are passed to generateContent for @google/generative-ai
         });
    }

    // --- Prepare Request Parameters (differ slightly between SDKs) ---
    const commonGenConfig = { temperature, maxOutputTokens };
    // Use the correctly typed settings imported from config
    const resolvedVertexSafetySettings: vertexAiSdk.SafetySetting[] = vertexSafetySettings;
    const resolvedGeminiSafetySettings: SafetySetting[] = configGeminiSafetySettings;

    // Safety settings variable is not needed, pass directly below


    const vertexRequest: vertexAiSdk.GenerateContentRequest = {
        contents: initialContents as vertexAiSdk.Content[],
        generationConfig: commonGenConfig,
        safetySettings: resolvedVertexSafetySettings, // Pass correct settings
        tools: filteredToolsForVertex
    };
    // @google/generative-ai takes config in generateContent call
    const geminiGenConfig: GenerationConfig = commonGenConfig;


    // --- Execute Request with Retries ---
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Simplified log line without the problematic length check
            console.error(`[${new Date().toISOString()}] Calling ${provider} AI (${modelId}, temp: ${temperature}, grounding: ${isGroundingRequested}, tools(Vertex): ${filteredToolsForVertex?.length ?? 0}, stream: ${useStreaming}, attempt: ${attempt + 1})`);

            let responseText: string | undefined;

            if (useStreaming) {
                let accumulatedText = "";
                let finalAggregatedResponse: any;

                if (provider === 'vertex') {
                    if (!vertexModelInstance) throw new Error("Vertex model instance not initialized.");
                    const streamResult = await vertexModelInstance.generateContentStream(vertexRequest);
                    for await (const item of streamResult.stream) {
                        const candidate = item.candidates?.[0];
                        const textPart = candidate?.content?.parts?.[0]?.text;
                        if (typeof textPart === 'string') accumulatedText += textPart;
                    }
                    finalAggregatedResponse = await streamResult.response;
                     const blockReasonVertex = finalAggregatedResponse?.promptFeedback?.blockReason;
                     const safetyRatingsVertex = finalAggregatedResponse?.candidates?.[0]?.safetyRatings;
                     if (blockReasonVertex && blockReasonVertex !== 'BLOCK_REASON_UNSPECIFIED' && blockReasonVertex !== 'OTHER') {
                          throw new Error(`Vertex Content generation blocked. Reason: ${blockReasonVertex}`);
                     }
                     if (!blockReasonVertex && safetyRatingsVertex && safetyRatingsVertex.length > 0) {
                          console.warn("Vertex: Safety ratings returned despite BLOCK_NONE threshold:", JSON.stringify(safetyRatingsVertex));
                     }
                } else { // gemini
                    if (!geminiModelInstance) throw new Error("Gemini model instance not initialized.");
                    const streamResult = await geminiModelInstance.generateContentStream({
                         contents: initialContents as GoogleGeneraiContent[],
                         generationConfig: geminiGenConfig,
                         safetySettings: resolvedGeminiSafetySettings,
                         // tools: adaptedToolsForGemini,
                     });

                    for await (const chunk of streamResult.stream) {
                        try {
                            accumulatedText += chunk.text();
                        } catch (e: any) {
                             console.warn("Non-text or error chunk encountered in Gemini stream:", e.message);
                             if (e.message?.toLowerCase().includes('safety')) {
                                 throw new Error(`Gemini Content generation blocked during stream. Reason: ${e.message}`);
                             }
                        }
                    }
                    try {
                         finalAggregatedResponse = await streamResult.response;
                    } catch (e: any) {
                         console.error("Error getting aggregated response from Gemini stream:", e.message);
                         if (e.message?.toLowerCase().includes('safety')) {
                            throw new Error(`Gemini Content generation blocked aggregating response. Reason: ${e.message}`);
                         }
                         throw e;
                    }
                    const blockReasonGemini = finalAggregatedResponse?.promptFeedback?.blockReason;
                    if (blockReasonGemini) {
                       throw new Error(`Gemini Content generation blocked. Aggregated Reason: ${blockReasonGemini}`);
                    }
                    const finishReasonGemini = finalAggregatedResponse?.candidates?.[0]?.finishReason;
                    if (finishReasonGemini === 'SAFETY') {
                       throw new Error(`Gemini Content generation blocked. Aggregated Finish Reason: SAFETY`);
                    }
                }

                 if (!accumulatedText && finalAggregatedResponse) {
                    try {
                        if (provider === 'vertex') {
                             const aggregatedTextVertex = finalAggregatedResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
                             if (typeof aggregatedTextVertex === 'string') accumulatedText = aggregatedTextVertex;
                         } else { // gemini
                            const aggregatedTextGemini = finalAggregatedResponse.text();
                            if (typeof aggregatedTextGemini === 'string') accumulatedText = aggregatedTextGemini;
                        }
                    } catch (e) {
                        console.warn(`Could not extract text from ${provider} aggregated stream response:`, e);
                    }
                 }

                 responseText = accumulatedText;

                 if (typeof responseText !== 'string' || !responseText) {
                     console.error(`Empty response received from ${provider} AI stream. Final Response:`, JSON.stringify(finalAggregatedResponse, null, 2));
                     throw new Error(`Received empty or non-text response from ${provider} AI stream.`);
                 }

                 console.error(`[${new Date().toISOString()}] Finished processing stream from ${provider} AI.`);

            } else { // Non-streaming
                let result: any;
                if (provider === 'vertex') {
                     if (!vertexModelInstance) throw new Error("Vertex model instance not initialized.");
                     result = await vertexModelInstance.generateContent(vertexRequest);
                     console.error(`[${new Date().toISOString()}] Received non-streaming response from Vertex AI.`);
                     const candidate = result.response?.candidates?.[0];
                     responseText = candidate?.content?.parts?.[0]?.text;
                     const blockReasonVertex = result.response?.promptFeedback?.blockReason;
                     const safetyRatingsVertex = candidate?.safetyRatings;
                     if (blockReasonVertex && blockReasonVertex !== 'BLOCK_REASON_UNSPECIFIED' && blockReasonVertex !== 'OTHER') {
                          throw new Error(`Vertex Content generation blocked. Reason: ${blockReasonVertex}`);
                     }
                     if (!blockReasonVertex && safetyRatingsVertex && safetyRatingsVertex.length > 0) {
                          console.warn("Vertex: Safety ratings returned despite BLOCK_NONE threshold:", JSON.stringify(safetyRatingsVertex));
                     }
                } else { // gemini
                     if (!geminiModelInstance) throw new Error("Gemini model instance not initialized.");
                     try {
                         result = await geminiModelInstance.generateContent({
                             contents: initialContents as GoogleGeneraiContent[],
                             generationConfig: geminiGenConfig,
                             safetySettings: resolvedGeminiSafetySettings,
                             // tools: adaptedToolsForGemini,
                         });
                     } catch (e: any) {
                         console.error("Error during non-streaming Gemini call:", e.message);
                         if (e.message?.toLowerCase().includes('safety') || e.message?.toLowerCase().includes('prompt blocked') || (e as any).status === 'BLOCKED') {
                             throw new Error(`Gemini Content generation blocked. Call Reason: ${e.message}`);
                         }
                         throw e;
                     }
                     console.error(`[${new Date().toISOString()}] Received non-streaming response from Gemini AI.`);
                     try {
                         responseText = result.response?.text();
                     } catch (e) {
                         console.warn("Could not extract text from Gemini non-streaming response:", e);
                     }
                     const blockReasonGemini = result.response?.promptFeedback?.blockReason;
                     if (blockReasonGemini) {
                        throw new Error(`Gemini Content generation blocked. Response Reason: ${blockReasonGemini}`);
                     }
                     const finishReasonGemini = result.response?.candidates?.[0]?.finishReason;
                     if (finishReasonGemini === 'SAFETY') {
                        throw new Error(`Gemini Content generation blocked. Response Finish Reason: SAFETY`);
                     }
                }

                if (typeof responseText !== 'string' || !responseText) {
                    console.error(`Unexpected non-streaming response structure from ${provider}:`, JSON.stringify(result?.response, null, 2));
                    throw new Error(`Failed to extract valid text response from ${provider} AI (non-streaming).`);
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