import { describe, it, expect } from 'vitest';
import {
    cleanText,
    formatSearchResults,
    parseSearchResult,
    parseSearchResults,
    SearchResult
} from './result-parser.js';

describe('Result parser utilities', () => {
    describe('cleanText', () => {
        it('should decode HTML entities', () => {
            expect(cleanText('&lt;')).toBe('<');
            expect(cleanText('&gt;')).toBe('>');
            expect(cleanText('&quot;')).toBe('"');
            expect(cleanText('&#39;')).toBe("'");
            expect(cleanText('&amp;')).toBe('&');
        });

        it('should decode multiple HTML entities in text', () => {
            // Note: entities are decoded first, then resulting HTML tags are removed
            // So &lt;div&gt; becomes <div> which then gets stripped
            expect(cleanText('&lt;div&gt;Hello &amp; World&lt;/div&gt;'))
                .toBe('Hello & World');
        });

        it('should convert bold tags to markdown', () => {
            expect(cleanText('<b>bold text</b>')).toBe('**bold text**');
        });

        it('should convert br tags to newlines', () => {
            expect(cleanText('line1<br>line2')).toBe('line1\nline2');
            expect(cleanText('line1<br/>line2')).toBe('line1\nline2');
            expect(cleanText('line1<BR />line2')).toBe('line1\nline2');
        });

        it('should remove other HTML tags', () => {
            expect(cleanText('<p>paragraph</p>')).toBe('paragraph');
            expect(cleanText('<div class="test">content</div>')).toBe('content');
            expect(cleanText('<a href="url">link</a>')).toBe('link');
        });

        it('should handle complex HTML', () => {
            // Encoded <b> tags become literal <b> after entity decode, then become **
            const input = '&lt;b&gt;Note:&lt;/b&gt; See <a href="test">doc</a><br/>for details';
            expect(cleanText(input)).toBe('**Note:** See doc\nfor details');
        });

        it('should handle empty string', () => {
            expect(cleanText('')).toBe('');
        });
    });

    describe('formatSearchResults', () => {
        it('should return no results message for empty array', () => {
            expect(formatSearchResults([])).toBe('No results found in Confluence documentation.');
        });

        it('should format a single result', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                link: 'https://example.com/page',
                snippets: ['This is a snippet'],
                extractive_answers: []
            }];

            const output = formatSearchResults(results);

            expect(output).toContain('# Confluence Search Results');
            expect(output).toContain('Found 1 relevant pages');
            expect(output).toContain('## 1. Test Page');
            expect(output).toContain('**Link**: https://example.com/page');
            expect(output).toContain('This is a snippet');
        });

        it('should format multiple results', () => {
            const results: SearchResult[] = [
                {
                    title: 'Page One',
                    link: 'https://example.com/1',
                    snippets: ['Snippet 1'],
                    extractive_answers: []
                },
                {
                    title: 'Page Two',
                    link: 'https://example.com/2',
                    snippets: ['Snippet 2'],
                    extractive_answers: []
                }
            ];

            const output = formatSearchResults(results);

            expect(output).toContain('Found 2 relevant pages');
            expect(output).toContain('## 1. Page One');
            expect(output).toContain('## 2. Page Two');
        });

        it('should include extractive answers when present', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                snippets: [],
                extractive_answers: ['This is key information']
            }];

            const output = formatSearchResults(results);

            expect(output).toContain('**Key Information**');
            expect(output).toContain('- This is key information');
        });

        it('should include snippets when present', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                snippets: ['Snippet one', 'Snippet two'],
                extractive_answers: []
            }];

            const output = formatSearchResults(results);

            expect(output).toContain('**Relevant Snippets**');
            expect(output).toContain('Snippet one');
            expect(output).toContain('Snippet two');
        });

        it('should clean HTML in snippets and answers', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                snippets: ['<b>Bold</b> text'],
                extractive_answers: ['Answer with &amp; entity']
            }];

            const output = formatSearchResults(results);

            expect(output).toContain('**Bold** text');
            expect(output).toContain('Answer with & entity');
        });

        it('should skip empty snippets after cleaning', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                snippets: ['   ', '<p></p>'],
                extractive_answers: []
            }];

            const output = formatSearchResults(results);

            // Should not contain "Relevant Snippets" section if all snippets are empty
            expect(output).not.toContain('Relevant Snippets');
        });

        it('should handle result without link', () => {
            const results: SearchResult[] = [{
                title: 'Test Page',
                snippets: ['Some content'],
                extractive_answers: []
            }];

            const output = formatSearchResults(results);

            expect(output).not.toContain('**Link**');
        });
    });

    describe('parseSearchResult', () => {
        it('should return null if document is missing', () => {
            expect(parseSearchResult({})).toBeNull();
            expect(parseSearchResult({ other: 'data' })).toBeNull();
        });

        it('should parse title from derivedStructData', () => {
            const result = {
                document: {
                    derivedStructData: {
                        title: 'Derived Title'
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.title).toBe('Derived Title');
        });

        it('should fall back to structData for title', () => {
            const result = {
                document: {
                    structData: {
                        title: 'Struct Title'
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.title).toBe('Struct Title');
        });

        it('should default to Untitled when no title', () => {
            const result = {
                document: {}
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.title).toBe('Untitled');
        });

        it('should parse link from various sources', () => {
            // From derivedStructData.url
            expect(parseSearchResult({
                document: {
                    derivedStructData: { url: 'https://derived.com' }
                }
            })?.link).toBe('https://derived.com');

            // From structData.uri
            expect(parseSearchResult({
                document: {
                    structData: { uri: 'https://struct.com' }
                }
            })?.link).toBe('https://struct.com');

            // From structData.self
            expect(parseSearchResult({
                document: {
                    structData: { self: 'https://self.com' }
                }
            })?.link).toBe('https://self.com');
        });

        it('should parse snippets', () => {
            const result = {
                document: {
                    derivedStructData: {
                        snippets: [
                            { snippet: 'First snippet' },
                            { snippet: 'Second snippet' }
                        ]
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.snippets).toEqual(['First snippet', 'Second snippet']);
        });

        it('should parse extractive answers', () => {
            const result = {
                document: {
                    derivedStructData: {
                        extractive_answers: [
                            { content: 'Answer 1' },
                            { content: 'Answer 2' }
                        ]
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.extractive_answers).toEqual(['Answer 1', 'Answer 2']);
        });

        it('should parse extractive segments as snippets', () => {
            const result = {
                document: {
                    derivedStructData: {
                        extractive_segments: [
                            { content: 'Segment content' }
                        ]
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.snippets).toContain('Segment content');
        });

        it('should skip null/undefined values in arrays', () => {
            const result = {
                document: {
                    derivedStructData: {
                        snippets: [
                            { snippet: 'Valid' },
                            { snippet: null },
                            { other: 'field' },
                            null
                        ]
                    }
                }
            };

            const parsed = parseSearchResult(result);

            expect(parsed?.snippets).toEqual(['Valid']);
        });
    });

    describe('parseSearchResults', () => {
        it('should return empty array for empty input', () => {
            expect(parseSearchResults([])).toEqual([]);
        });

        it('should parse multiple results', () => {
            const results = [
                { document: { derivedStructData: { title: 'Page 1' } } },
                { document: { derivedStructData: { title: 'Page 2' } } }
            ];

            const parsed = parseSearchResults(results);

            expect(parsed.length).toBe(2);
            expect(parsed[0].title).toBe('Page 1');
            expect(parsed[1].title).toBe('Page 2');
        });

        it('should skip results without documents', () => {
            const results = [
                { document: { derivedStructData: { title: 'Valid' } } },
                { notDocument: 'invalid' },
                { document: { derivedStructData: { title: 'Also Valid' } } }
            ];

            const parsed = parseSearchResults(results);

            expect(parsed.length).toBe(2);
        });
    });
});
