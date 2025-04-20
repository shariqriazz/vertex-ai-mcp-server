import {
    VertexAI,
    GenerateContentRequest,
    GenerateContentResult,
    Tool,
    Content,
    Part,
    FunctionResponsePart,
} from "@google-cloud/vertexai";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { GCLOUD_PROJECT, GCLOUD_LOCATION, safetySettings } from './config.js';
import { sleep } from './utils.js';
// import { functionImplementationMap } from './server_functions.js'; // Removed as function calling is no longer used

// --- Vertex AI Client Initialization ---
let vertexAI: VertexAI;
try {
  vertexAI = new VertexAI({ project: GCLOUD_PROJECT, location: GCLOUD_LOCATION });
} catch (error) {
  console.error("Error initializing VertexAI client:", error);
  process.exit(1);
}

// --- Vertex AI Call Function (Handles Function Calling) ---
export async function callVertexAIWithOptionalFunctionCalling(
    initialContents: Content[],
    tools: Tool[] | undefined,
    modelId: string,
    temperature: number,
    useStreaming: boolean,
    maxOutputTokens: number,
    maxRetries: number,
    retryDelayMs: number
    // maxFunctionCalls: number = 5 // Removed function calling parameter
): Promise<string> {

    // Check if grounding tool is present - simplified check
    const isGrounding = tools && tools.some(tool => 'googleSearch' in tool);
    const generativeModel = isGrounding
            ? vertexAI.preview.getGenerativeModel({ model: modelId })
            : vertexAI.getGenerativeModel({ model: modelId });

        const req: GenerateContentRequest = {
            contents: initialContents, // Use initialContents directly
            generationConfig: { temperature: temperature, maxOutputTokens: maxOutputTokens },
            safetySettings: safetySettings,
            tools: tools,
        };

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.error(`[${new Date().toISOString()}] Calling Vertex AI (${modelId}, temp: ${temperature}, tools: ${!!tools}, stream: ${useStreaming}, attempt: ${attempt + 1})`); // Removed funcCalls

                // let responsePart: Part | undefined; // No longer needed for function calls
                let responseText: string | undefined;

                if (useStreaming) {
                    const streamResult = await generativeModel.generateContentStream(req);
                    let accumulatedText = "";
                    let finalAggregatedResponse: GenerateContentResult['response'] | undefined;

                    for await (const item of streamResult.stream) {
                        const candidate = item.candidates?.[0];
                        // responsePart = candidate?.content?.parts?.find((part: Part) => part.functionCall); // Removed function call check
                        // if (responsePart) break; // Removed function call check

                        const textPart = candidate?.content?.parts?.[0]?.text;
                        if (typeof textPart === 'string') accumulatedText += textPart;
                    }

                    finalAggregatedResponse = await streamResult.response;

                    // if (!responsePart) { // Removed function call check
                    //      responsePart = finalAggregatedResponse?.candidates?.[0]?.content?.parts?.find((part: Part) => part.functionCall); // Removed function call check
                    // } // Removed function call check

                    // if (!responsePart) { // Removed function call check
                        if (!accumulatedText) {
                            const aggregatedText = finalAggregatedResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (typeof aggregatedText === 'string') accumulatedText = aggregatedText;
                        }
                        responseText = accumulatedText;
                        const blockReason = finalAggregatedResponse?.promptFeedback?.blockReason;
                        const safetyRatings = finalAggregatedResponse?.candidates?.[0]?.safetyRatings;
                        if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED' && blockReason !== 'OTHER') {
                             throw new Error(`Content generation blocked. Reason: ${blockReason}`);
                        }
                        if (!blockReason && safetyRatings && safetyRatings.length > 0) {
                             console.warn("Safety ratings returned despite BLOCK_NONE threshold:", JSON.stringify(safetyRatings));
                        }
                        if (!responseText) {
                             console.error("Empty response received from Vertex AI stream:", JSON.stringify(finalAggregatedResponse, null, 2));
                             throw new Error("Received empty or non-text response from Vertex AI stream.");
                            }
                    console.error(`[${new Date().toISOString()}] Finished processing stream from Vertex AI.`);

                } else { // Non-streaming
                    const result = await generativeModel.generateContent(req);
                    console.error(`[${new Date().toISOString()}] Received non-streaming response from Vertex AI.`);
                    const candidate = result.response?.candidates?.[0];
                    // responsePart = candidate?.content?.parts?.find((part: Part) => part.functionCall); // Removed function call check

                    // if (!responsePart) { // Removed function call check
                        responseText = candidate?.content?.parts?.[0]?.text;
                        const blockReason = result.response?.promptFeedback?.blockReason;
                        const safetyRatings = candidate?.safetyRatings;
                        if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED' && blockReason !== 'OTHER') {
                             throw new Error(`Content generation blocked. Reason: ${blockReason}`);
                        }
                        if (!blockReason && safetyRatings && safetyRatings.length > 0) {
                             console.warn("Safety ratings returned despite BLOCK_NONE threshold:", JSON.stringify(safetyRatings));
                        }
                        if (typeof responseText !== 'string' || !responseText) {
                             console.error("Unexpected non-streaming response structure:", JSON.stringify(result.response, null, 2));
                             throw new Error("Failed to extract valid text response from Vertex AI (non-streaming).");
                        }
                }

                // --- Return Text ---
                // if (responsePart?.functionCall) { ... } // Removed function call handling block

                if (typeof responseText === 'string') {
                    return responseText; // Final answer success
                } else {
                     // This state should ideally not be reached if the API behaves as expected
                     throw new Error("Invalid state: No text response received from Vertex AI.");
                }

            } catch (error: any) {
                console.error(`[${new Date().toISOString()}] Error calling/processing Vertex AI (attempt ${attempt + 1}):`, error);
                const errorMessageString = String(error.message || '').toLowerCase();
                const isBlockingError = errorMessageString.includes('content generation blocked');
                const isRetryable = !isBlockingError && (errorMessageString.includes('429') || errorMessageString.includes('500') || errorMessageString.includes('503'));

                if (isRetryable && attempt < maxRetries) {
                    const delay = retryDelayMs * Math.pow(2, attempt);
                    console.error(`[${new Date().toISOString()}] Retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue; // Retry current LLM call
                } else {
                    let errorMessage = `Vertex AI API error: ${error.message || "Unknown error"}`;
                    if (errorMessageString.match(/\b(429|500|503)\b/)) {
                        errorMessage += ` (Status Code: ${errorMessageString.match(/\b(429|500|503)\b/)?.[0]})`;
                    }
                    throw new McpError(ErrorCode.InternalError, errorMessage);
                }
            }
        } // End retry loop

        // If the loop finishes without returning, it means all retries failed
        throw new McpError(ErrorCode.InternalError, `Max retries (${maxRetries + 1}) reached for LLM call without success.`);
}