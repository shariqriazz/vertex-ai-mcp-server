/**
 * Utilities for parsing and formatting Discovery Engine search results.
 */

export interface SearchResult {
    title: string;
    link?: string;
    snippets: string[];
    extractive_answers: string[];
}

/**
 * Clean HTML entities and tags from text.
 *
 * @param text - The text to clean
 * @returns Cleaned text with HTML entities decoded and tags removed
 */
export function cleanText(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/<\/?b>/g, '**')  // Convert bold tags to markdown
        .replace(/<br\s*\/?>/gi, '\n')  // Convert breaks to newlines
        .replace(/<[^>]+>/g, '');  // Remove other HTML tags
}

/**
 * Format search results as structured markdown.
 *
 * @param results - Array of search results to format
 * @returns Formatted markdown string
 */
export function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
        return "No results found in Confluence documentation.";
    }

    let output = `# Confluence Search Results\n\n`;
    output += `Found ${results.length} relevant pages:\n\n`;

    results.forEach((result, idx) => {
        output += `## ${idx + 1}. ${result.title}\n\n`;

        if (result.link) {
            output += `**Link**: ${result.link}\n\n`;
        }

        // Filter to non-empty content after cleaning
        const cleanedAnswers = result.extractive_answers
            .map(answer => cleanText(answer).trim())
            .filter(answer => answer.length > 0);

        if (cleanedAnswers.length > 0) {
            output += `**Key Information**:\n\n`;
            cleanedAnswers.forEach(answer => {
                output += `- ${answer}\n`;
            });
            output += '\n';
        }

        // Filter to non-empty snippets after cleaning
        const cleanedSnippets = result.snippets
            .map(snippet => cleanText(snippet).trim())
            .filter(snippet => snippet.length > 0);

        if (cleanedSnippets.length > 0) {
            output += `**Relevant Snippets**:\n\n`;
            cleanedSnippets.forEach(snippet => {
                output += `${snippet}\n\n`;
            });
        }

        output += '---\n\n';
    });

    return output;
}

/**
 * Parse a raw Discovery Engine search result into a SearchResult object.
 *
 * @param result - Raw result from Discovery Engine API
 * @returns Parsed SearchResult object
 */
export function parseSearchResult(result: any): SearchResult | null {
    const doc = result.document;
    if (!doc) return null;

    const derivedData = doc.derivedStructData;
    const structData = doc.structData;

    const searchResult: SearchResult = {
        title: derivedData?.title || structData?.title || 'Untitled',
        link: derivedData?.url || structData?.uri || structData?.self || '',
        snippets: [],
        extractive_answers: []
    };

    // Extract snippets
    const snippetsList = derivedData?.snippets;
    if (snippetsList && Array.isArray(snippetsList)) {
        for (const snippetItem of snippetsList) {
            const snippetText = snippetItem?.snippet;
            if (snippetText) {
                searchResult.snippets.push(snippetText);
            }
        }
    }

    // Extract extractive answers
    const answersList = derivedData?.extractive_answers;
    if (answersList && Array.isArray(answersList)) {
        for (const answerItem of answersList) {
            const answerText = answerItem?.content;
            if (answerText) {
                searchResult.extractive_answers.push(answerText);
            }
        }
    }

    // Extract extractive segments as additional snippets
    const segmentsList = derivedData?.extractive_segments;
    if (segmentsList && Array.isArray(segmentsList)) {
        for (const segmentItem of segmentsList) {
            const segmentText = segmentItem?.content;
            if (segmentText) {
                searchResult.snippets.push(segmentText);
            }
        }
    }

    return searchResult;
}

/**
 * Parse all search results from a Discovery Engine API response.
 *
 * @param results - Array of raw results from Discovery Engine API
 * @returns Array of parsed SearchResult objects
 */
export function parseSearchResults(results: any[]): SearchResult[] {
    const parsed: SearchResult[] = [];
    for (const result of results) {
        const parsedResult = parseSearchResult(result);
        if (parsedResult) {
            parsed.push(parsedResult);
        }
    }
    return parsed;
}
