# Vertex AI MCP Server
[![smithery badge](https://smithery.ai/badge/@shariqriazz/vertex-ai-mcp-server)](https://smithery.ai/server/@shariqriazz/vertex-ai-mcp-server)

This project implements a Model Context Protocol (MCP) server that provides a comprehensive suite of tools for interacting with Google Cloud's Vertex AI Gemini models, focusing on coding assistance and general query answering.

<a href="https://glama.ai/mcp/servers/@shariqriazz/vertex-ai-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@shariqriazz/vertex-ai-mcp-server/badge" alt="Vertex AI Server MCP server" />
</a>

## Features

*   Provides access to Vertex AI Gemini models via numerous MCP tools.
*   Supports web search grounding (`answer_query_websearch`) and direct knowledge answering (`answer_query_direct`).
*   Configurable model ID, temperature, streaming behavior, max output tokens, and retry settings via environment variables.
*   Uses streaming API by default for potentially better responsiveness.
*   Includes basic retry logic for transient API errors.
*   Minimal safety filters applied (`BLOCK_NONE`) to reduce potential blocking (use with caution).

## Tools Provided

### Query & Generation (AI Focused)
*   `answer_query_websearch`: Answers a natural language query using the configured Vertex AI model enhanced with Google Search results.
*   `answer_query_direct`: Answers a natural language query using only the internal knowledge of the configured Vertex AI model.
*   `explain_topic_with_docs`: Provides a detailed explanation for a query about a specific software topic by synthesizing information primarily from official documentation found via web search.
*   `get_doc_snippets`: Provides precise, authoritative code snippets or concise answers for technical queries by searching official documentation.
*   `generate_project_guidelines`: Generates a structured project guidelines document (Markdown) based on a specified list of technologies (optionally with versions), using web search for best practices.

### Filesystem Operations
*   `read_file_content`: Reads the complete contents of a single file.
*   `read_multiple_files_content`: Reads the contents of multiple files simultaneously.
*   `write_file_content`: Creates a new file or completely overwrites an existing file with new content.
*   `edit_file_content`: Makes line-based edits to a text file, returning a diff preview or applying changes.
*   `create_directory`: Creates a new directory (including nested directories).
*   `list_directory_contents`: Lists files and directories directly within a specified path (non-recursive).
*   `get_directory_tree`: Gets a recursive tree view of files and directories as JSON.
*   `move_file_or_directory`: Moves or renames files and directories.
*   `search_filesystem`: Recursively searches for files/directories matching a name pattern, with optional exclusions.
*   `get_filesystem_info`: Retrieves detailed metadata (size, dates, type, permissions) about a file or directory.

### Combined AI + Filesystem Operations
*   `save_generate_project_guidelines`: Generates project guidelines based on a tech stack and saves the result to a specified file path.
*   `save_doc_snippet`: Finds code snippets from documentation and saves the result to a specified file path.
*   `save_topic_explanation`: Generates a detailed explanation of a topic based on documentation and saves the result to a specified file path.
*   `save_answer_query_direct`: Answers a query using only internal knowledge and saves the answer to a specified file path.
*   `save_answer_query_websearch`: Answers a query using web search results and saves the answer to a specified file path.

*(Note: Input/output schemas for each tool are defined in their respective files within `src/tools/` and exposed via the MCP server.)*

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
    *   Set the required and optional environment variables as described in `.env.example`.
        *   Set `AI_PROVIDER` to either `"vertex"` or `"gemini"`.
        *   If `AI_PROVIDER="vertex"`, `GOOGLE_CLOUD_PROJECT` is required.
        *   If `AI_PROVIDER="gemini"`, `GEMINI_API_KEY` is required.
4.  **Build the Server:**
    ```bash
    bun run build
    ```
    This compiles the TypeScript code to `build/index.js`.

## Usage (Standalone / NPX)

Once published to npm, you can run this server directly using `npx`:

```bash
# Ensure required environment variables are set (e.g., GOOGLE_CLOUD_PROJECT)
bunx vertex-ai-mcp-server
```

Alternatively, install it globally:

```bash
bun install -g vertex-ai-mcp-server
# Then run:
vertex-ai-mcp-server
```

**Note:** Running standalone requires setting necessary environment variables (like `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, authentication credentials if not using ADC) in your shell environment before executing the command.

### Installing via Smithery

To install Vertex AI Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@shariqriazz/vertex-ai-mcp-server):

```bash
bunx -y @smithery/cli install @shariqriazz/vertex-ai-mcp-server --client claude
```

## Running with Cline

1.  **Configure MCP Settings:** Add/update the configuration in your Cline MCP settings file (e.g., `.roo/mcp.json`). You have two primary ways to configure the command:

    **Option A: Using Node (Direct Path - Recommended for Development)**

    This method uses `node` to run the compiled script directly. It's useful during development when you have the code cloned locally.

    ```json
    {
      "mcpServers": {
        "vertex-ai-mcp-server": {
          "command": "node",
          "args": [
            "/full/path/to/your/vertex-ai-mcp-server/build/index.js" // Use absolute path or ensure it's relative to where Cline runs node
          ],
          "env": {
            // --- General AI Configuration ---
            "AI_PROVIDER": "vertex", // "vertex" or "gemini"
            // --- Required (Conditional) ---
            "GOOGLE_CLOUD_PROJECT": "YOUR_GCP_PROJECT_ID", // Required if AI_PROVIDER="vertex"
            // "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY", // Required if AI_PROVIDER="gemini"
            // --- Optional Model Selection ---
            "VERTEX_MODEL_ID": "gemini-2.5-pro-exp-03-25", // If AI_PROVIDER="vertex" (Example override)
            "GEMINI_MODEL_ID": "gemini-1.5-flash-latest", // If AI_PROVIDER="gemini"
            // --- Optional AI Parameters ---
            "GOOGLE_CLOUD_LOCATION": "us-central1", // Specific to Vertex AI
            "AI_TEMPERATURE": "0.0",
            "AI_USE_STREAMING": "true",
            "AI_MAX_OUTPUT_TOKENS": "8192", // Default from .env.example
            "AI_MAX_RETRIES": "3",
            "AI_RETRY_DELAY_MS": "1000",
            // --- Optional Vertex Authentication ---
            // "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/service-account-key.json" // If using Service Account Key for Vertex
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

    **Option B: Using NPX (Requires Package Published to npm)**

    This method uses `npx` to automatically download and run the server package from the npm registry. This is convenient if you don't want to clone the repository.

    ```json
    {
      "mcpServers": {
        "vertex-ai-mcp-server": {
          "command": "bunx", // Use bunx
          "args": [
            "-y", // Auto-confirm installation
            "vertex-ai-mcp-server" // The npm package name
          ],
          "env": {
            // --- General AI Configuration ---
            "AI_PROVIDER": "vertex", // "vertex" or "gemini"
            // --- Required (Conditional) ---
            "GOOGLE_CLOUD_PROJECT": "YOUR_GCP_PROJECT_ID", // Required if AI_PROVIDER="vertex"
            // "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY", // Required if AI_PROVIDER="gemini"
            // --- Optional Model Selection ---
            "VERTEX_MODEL_ID": "gemini-2.5-pro-exp-03-25", // If AI_PROVIDER="vertex" (Example override)
            "GEMINI_MODEL_ID": "gemini-1.5-flash-latest", // If AI_PROVIDER="gemini"
            // --- Optional AI Parameters ---
            "GOOGLE_CLOUD_LOCATION": "us-central1", // Specific to Vertex AI
            "AI_TEMPERATURE": "0.0",
            "AI_USE_STREAMING": "true",
            "AI_MAX_OUTPUT_TOKENS": "8192", // Default from .env.example
            "AI_MAX_RETRIES": "3",
            "AI_RETRY_DELAY_MS": "1000",
            // --- Optional Vertex Authentication ---
            // "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/service-account-key.json" // If using Service Account Key for Vertex
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
    *   Ensure the environment variables in the `env` block are correctly set, either matching `.env` or explicitly defined here. Remove comments from the actual JSON file.

2.  **Restart/Reload Cline:** Cline should detect the configuration change and start the server.

3.  **Use Tools:** You can now use the extensive list of tools via Cline.

## Development

*   **Watch Mode:** `bun run watch`
*   **Linting:** `bun run lint`
*   **Formatting:** `bun run format`
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
