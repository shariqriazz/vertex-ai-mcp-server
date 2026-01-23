/**
 * Utilities for parsing and formatting Discovery Engine search results for Google Drive.
 */

import { cleanText } from './result-parser.js';

export interface DriveSearchResult {
    title: string;
    link?: string;
    mimeType?: string;
    modifiedTime?: string;
    snippets: string[];
    extractive_answers: string[];
}

/**
 * Get a human-readable file type from MIME type.
 */
function getFileTypeLabel(mimeType?: string): string {
    if (!mimeType) return '';

    const mimeToLabel: Record<string, string> = {
        'application/vnd.google-apps.document': 'Google Doc',
        'application/vnd.google-apps.spreadsheet': 'Google Sheet',
        'application/vnd.google-apps.presentation': 'Google Slides',
        'application/vnd.google-apps.folder': 'Folder',
        'application/vnd.google-apps.form': 'Google Form',
        'application/pdf': 'PDF',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Doc',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
        'text/plain': 'Text File',
        'text/csv': 'CSV',
        'image/png': 'PNG Image',
        'image/jpeg': 'JPEG Image',
        'video/mp4': 'MP4 Video',
    };

    return mimeToLabel[mimeType] || mimeType.split('/').pop() || '';
}

/**
 * Format search results as structured markdown.
 */
export function formatDriveResults(results: DriveSearchResult[]): string {
    if (results.length === 0) {
        return "No results found in Google Drive.";
    }

    let output = `# Google Drive Search Results\n\n`;
    output += `Found ${results.length} relevant files:\n\n`;

    results.forEach((result, idx) => {
        output += `## ${idx + 1}. ${result.title}\n\n`;

        // File metadata
        const metadata: string[] = [];
        if (result.mimeType) {
            const fileType = getFileTypeLabel(result.mimeType);
            if (fileType) metadata.push(`**Type**: ${fileType}`);
        }
        if (result.modifiedTime) {
            metadata.push(`**Modified**: ${result.modifiedTime}`);
        }
        if (metadata.length > 0) {
            output += metadata.join(' | ') + '\n\n';
        }

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
 * Parse a raw Discovery Engine search result into a DriveSearchResult object.
 */
export function parseDriveResult(result: any): DriveSearchResult | null {
    const doc = result.document;
    if (!doc) return null;

    const derivedData = doc.derivedStructData;
    const structData = doc.structData;

    const searchResult: DriveSearchResult = {
        title: derivedData?.title || structData?.title || structData?.name || 'Untitled',
        link: derivedData?.link || derivedData?.url || structData?.webViewLink || structData?.uri || '',
        mimeType: structData?.mimeType || derivedData?.mimeType,
        modifiedTime: structData?.modifiedTime || derivedData?.modifiedTime,
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
 */
export function parseDriveResults(results: any[]): DriveSearchResult[] {
    const parsed: DriveSearchResult[] = [];
    for (const result of results) {
        const parsedResult = parseDriveResult(result);
        if (parsedResult) {
            parsed.push(parsedResult);
        }
    }
    return parsed;
}
