# Vertex AI MCP Server

This project implements a Model Context Protocol (MCP) server that provides a comprehensive suite of tools for interacting with Google Cloud's Vertex AI Gemini models, focusing on coding assistance and general query answering.

## Features

*   Provides access to Vertex AI Gemini models via numerous MCP tools.
*   Supports web search grounding (`answer_query_websearch`) and direct knowledge answering (`answer_query_direct`).
*   Configurable model ID, temperature, streaming behavior, max output tokens, and retry settings via environment variables.
*   Uses streaming API by default for potentially better responsiveness.
*   Includes basic retry logic for transient API errors.
*   Minimal safety filters applied (`BLOCK_NONE`) to reduce potential blocking (use with caution).

## Tools Provided

### Query & Answer
*   `answer_query_websearch`: Answers query using the configured Vertex AI model + Google Search grounding.
*   `answer_query_direct`: Answers query using the configured Vertex AI model's internal knowledge.
*   `answer_doc_query`: Finds official documentation for a topic and answers a query based primarily on that documentation, supplemented by web search for coding issues, using the configured Vertex AI model.

*(Note: Input/output details for each tool can be inferred from the `ListToolsRequestSchema` handler in `src/index.ts` or dynamically via MCP introspection if supported by the client.)*

## Prerequisites

*   Node.js (v18+)
*   Bun (`npm install -g bun`)
*   Google Cloud Project with Billing enabled.
*   Vertex AI API enabled in the GCP project.
*   Google Cloud Authentication configured in your environment (Application Default Credentials via `gcloud auth application-default login` is recommended, or a Service Account Key).

## Setup & Installation

1.  **Clone/Place Project:** Ensure the project files are in your desired location.
2.  **Install Dependencies:**
    ```bash
    bun install
    ```
3.  **Configure Environment:**
    *   Create a `.env` file in the project root (copy `.env.example`).
    *   Set the required and optional environment variables as described in `.env.example`. Ensure `GOOGLE_CLOUD_PROJECT` is set.
4.  **Build the Server:**
    ```bash
    bun run build
    ```
    This compiles the TypeScript code to `build/index.js`.

## Running with Cline

1.  **Configure MCP Settings:** Add/update the configuration in your Cline MCP settings file (e.g., `.roo/mcp.json`).

    ```json
    {
      "mcpServers": {
        "vertex-ai-mcp-server": {
          "command": "node",
          "args": [
            "/full/path/to/your/vertex-ai-mcp-server/build/index.js" // Use absolute path or ensure it's relative to where Cline runs node
          ],
          "env": {
            // Required: Ensure these match your .env or are set here
            "GOOGLE_CLOUD_PROJECT": "YOUR_GCP_PROJECT_ID",
            "GOOGLE_CLOUD_LOCATION": "us-central1",
            // Required if not using ADC:
            // "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/service-account-key.json",
            // Optional overrides:
            "VERTEX_AI_MODEL_ID": "gemini-2.5-pro-exp-03-25",
            "VERTEX_AI_TEMPERATURE": "0.0",
            "VERTEX_AI_USE_STREAMING": "true",
            "VERTEX_AI_MAX_OUTPUT_TOKENS": "65535",
            "VERTEX_AI_MAX_RETRIES": "3",
            "VERTEX_AI_RETRY_DELAY_MS": "1000"
          },
          "disabled": false,
          "alwaysAllow": [
             // Add tool names here if you don't want confirmation prompts
             // e.g., "answer_query_websearch"
          ],
          "timeout": 3600 // Optional: Timeout in seconds
        }
        // Add other servers here...
      }
    }
    ```
    *   **Important:** Ensure the `args` path points correctly to the `build/index.js` file. Using an absolute path might be more reliable.
    *   Ensure the environment variables in the `env` block are correctly set, either matching `.env` or explicitly defined here. Remove comments from the actual JSON file.

2.  **Restart/Reload Cline:** Cline should detect the configuration change and start the server.

3.  **Use Tools:** You can now use the extensive list of tools via Cline.

## Development

*   **Watch Mode:** `bun run watch`
*   **Linting:** `bun run lint`
*   **Formatting:** `bun run format`
