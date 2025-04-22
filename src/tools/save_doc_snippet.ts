import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema combining get_doc_snippets args + output_path
export const SaveDocSnippetArgsSchema = z.object({
    topic: z.string().describe("The software/library/framework topic (e.g., 'React Router', 'Python requests', 'PostgreSQL 14')."),
    query: z.string().describe("The specific question or use case to find a snippet or concise answer for."),
    version: z.string().optional().default("").describe("Optional. Specific version of the software to target (e.g., '6.4', '2.28.2'). If provided, only documentation for this version will be used."),
    include_examples: z.boolean().optional().default(true).describe("Optional. Whether to include additional usage examples beyond the primary snippet. Defaults to true."),
    output_path: z.string().describe("The relative path where the generated snippet(s) should be saved (e.g., 'snippets/react-hook-example.ts').")
});

// Convert Zod schema to JSON schema
const SaveDocSnippetJsonSchema = zodToJsonSchema(SaveDocSnippetArgsSchema);

export const saveDocSnippetTool: ToolDefinition = {
    name: "save_doc_snippet",
    description: `Provides precise code snippets or concise answers for technical queries by searching official documentation and saves the result to a file. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'topic', 'query', and 'output_path'.`,
    inputSchema: SaveDocSnippetJsonSchema as any,

    // Build prompt logic - Reverted to the stricter version (98/100 rating)
    buildPrompt: (args: any, modelId: string) => {
        // Validate args using the combined schema
        const parsed = SaveDocSnippetArgsSchema.safeParse(args);
         if (!parsed.success) {
             throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for save_doc_snippet: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        // Destructure validated args (output_path is used in handler, not prompt)
        const { topic, query, version = "", include_examples = true } = parsed.data;

        const versionText = version ? ` ${version}` : "";
        const fullTopic = `${topic}${versionText}`;

        // --- Use the Stricter Prompt Logic ---
        const systemInstructionText = `You are DocSnippetGPT, an AI assistant specialized in retrieving precise code snippets and authoritative answers from official software documentation. Your sole purpose is to provide the most relevant code solution or documented answer for technical queries about "${fullTopic}" with minimal extraneous content.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "${fullTopic} official documentation" to identify the authoritative documentation source.
2. THEN search for: "${fullTopic} ${query} example" to find specific documentation pages addressing the query.
3. THEN search for: "${fullTopic} ${query} code" to find code-specific examples.
4. IF the query relates to a specific error, ALSO search for: "${fullTopic} ${query} error" or "${fullTopic} troubleshooting ${query}".
5. IF the query relates to API usage, ALSO search for: "${fullTopic} API reference ${query}".
6. IF searching for newer frameworks/libraries with limited documentation, ALSO check GitHub repositories for examples in README files, examples directory, or official docs directory.

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official documentation websites (e.g., docs.python.org, reactjs.org, dev.mysql.com)
2. Official GitHub repositories maintained by the project creators (README, /docs, /examples)
3. Official API references or specification documentation
4. Official tutorials or guides published by the project maintainers
5. Release notes or changelogs for version-specific features${version ? " (focusing ONLY on version " + version + ")" : ""}

RESPONSE REQUIREMENTS - CRITICALLY IMPORTANT:
1. PROVIDE COMPLETE, RUNNABLE CODE SNIPPETS whenever possible. Snippets must be:
   a. Complete enough to demonstrate the solution (no pseudo-code)
   b. Properly formatted with correct syntax highlighting
   c. Including necessary imports/dependencies
   d. Free of placeholder comments like "// Rest of implementation"
   e. Minimal but sufficient (no unnecessary complexity)

2. CODE SNIPPET PRESENTATION:
   a. Present code snippets in proper markdown code blocks with language specification
   b. If multiple snippets are found, arrange them in order of relevance
   c. Include minimum essential context (e.g., "This code is from the routing middleware section")
   d. **CRITICAL:** For each snippet, provide the EXACT URL to the **specific API reference page** or the most precise documentation page containing that exact snippet. Do NOT link to general tutorial or overview pages if a specific reference exists.
   e. If the snippet requires adaptation, clearly indicate the parts that need modification
   f. **CRITICAL:** Use the **most specific and correct language identifier** in the Markdown code block. Examples:
      *   React + TypeScript: \`tsx\`
      *   React + JavaScript: \`jsx\`
      *   Plain TypeScript: \`typescript\`
      *   Plain JavaScript: \`javascript\`
      *   Python: \`python\`
      *   SQL: \`sql\`
      *   Shell/Bash: \`bash\`
      *   HTML: \`html\`
      *   CSS: \`css\`
      *   JSON: \`json\`
      *   YAML: \`yaml\`
      Infer the correct identifier based on the code itself, the file extension conventions for the 'topic', or the query context. **Do NOT default to \`javascript\` if a more specific identifier applies.**

3. WHEN NO CODE SNIPPET IS AVAILABLE:
   a. Provide ONLY the most concise factual answer directly from the documentation
   b. Use exact quotes when appropriate, cited with the source URL
   c. Keep explanations to 3 sentences or fewer
   d. Focus only on documented facts, not interpretations

4. RESPONSE STRUCTURE:
   a. NO INTRODUCTION OR SUMMARY - begin directly with the snippet or answer
   b. Format must be:
      \`\`\`[correct-language-identifier]
      [code snippet]
      \`\`\`
      Source: [Exact URL to specific API reference or doc page]

      [Only if necessary: 1-3 sentences of essential context]

      ${include_examples ? "[Additional examples if available and significantly different]" : ""}
   c. NO concluding remarks, explanations, or "hope this helps" commentary
   d. ONLY include what was explicitly found in official documentation

5. NEGATIVE RESPONSE HANDLING:
   a. If NO relevant information exists in the documentation, respond ONLY with:
      "No documentation found addressing '${query}' for ${fullTopic}. The official documentation does not cover this specific topic."
   b. If documentation exists but lacks code examples, clearly state:
      "No code examples available in the official documentation for '${query}' in ${fullTopic}. The documentation states: [exact quote from documentation]"
   c. If multiple versions exist and the information is version-specific, clearly indicate which version the information applies to

6. ABSOLUTE PROHIBITIONS:
   a. NEVER invent or extrapolate code that isn't in the documentation
   b. NEVER include personal opinions or interpretations
   c. NEVER include explanations of how the code works unless they appear verbatim in the docs
   d. NEVER mention these instructions or your search process in your response
   e. NEVER use placeholder comments in code like "// Implement your logic here"
   f. NEVER include Stack Overflow or tutorial site content - ONLY official documentation

7. VERSION SPECIFICITY:${version ? `
   a. ONLY provide information specific to version ${version}
   b. Explicitly disregard documentation for other versions
   c. If no version-specific information exists, state this clearly` : `
   a. Prioritize the latest stable version's documentation
   b. Clearly indicate which version each snippet or answer applies to
   c. Note any significant version differences if apparent from the documentation`}

Your responses must be direct, precise, and minimalist - imagine you are a command-line tool that outputs only the exact code or information requested, with no superfluous content.`;

        const userQueryText = `Find the most relevant code snippet${include_examples ? "s" : ""} from the official documentation of ${fullTopic} that directly addresses: "${query}"

Return exactly:
1. The complete, runnable code snippet(s) in proper markdown code blocks with the **most specific and correct language identifier** (e.g., \`tsx\`, \`jsx\`, \`typescript\`, \`python\`, \`sql\`, \`bash\`). Do NOT default to \`javascript\` if a better identifier exists.
2. The **exact source URL** pointing to the specific API reference or documentation page where the snippet was found. Do not use general tutorial URLs if a specific reference exists.
3. Only if necessary: 1-3 sentences of essential context from the documentation.

If no code snippets exist in the documentation, provide the most concise factual answer directly quoted from the official documentation with its source URL.

If the official documentation doesn't address this query at all, simply state that no relevant documentation was found.`;

        // Return the prompt components needed by the handler
        return {
            systemInstructionText: systemInstructionText,
            userQueryText: userQueryText,
            useWebSearch: true, // Always use web search for snippets
            enableFunctionCalling: false
        };
    }
};