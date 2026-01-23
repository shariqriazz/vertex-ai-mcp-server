#!/usr/bin/env python3
"""
Test script for querying Gemini Enterprise using Discovery Engine Search API.
"""

import json
from google.cloud import discoveryengine_v1
from google.cloud.discoveryengine_v1.types import SearchRequest
from google.auth import default

# Configuration
PROJECT_NUMBER = "403334419176"
LOCATION = "global"
COLLECTION = "default_collection"
ENGINE = "agentspace-1750425553806_1750425553806"
SERVING_CONFIG = "default_search"

# Build the full path to the serving config
SERVING_CONFIG_PATH = (
    f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/"
    f"collections/{COLLECTION}/engines/{ENGINE}/"
    f"servingConfigs/{SERVING_CONFIG}"
)

def search_confluence(query_text: str):
    """Search Confluence using Discovery Engine Search API."""

    print(f"\n{'='*80}")
    print(f"🔍 Searching Confluence via Discovery Engine")
    print(f"{'='*80}")
    print(f"Query: {query_text}")
    print(f"Path: {SERVING_CONFIG_PATH}")
    print(f"{'='*80}\n")

    try:
        # Get credentials
        print("🔐 Getting credentials...")
        credentials, project = default()
        print(f"✅ Got credentials for project: {project}")

        # Create the Search Service client
        print("🔧 Creating Search Service client...")
        client = discoveryengine_v1.SearchServiceClient(credentials=credentials)
        print("✅ Search Service client created")

        # Build the search request
        print("📝 Building search request...")
        request = SearchRequest(
            serving_config=SERVING_CONFIG_PATH,
            query=query_text,
            page_size=10,
            spell_correction_spec={"mode": "AUTO"},
            content_search_spec={
                "snippet_spec": {"return_snippet": True},
                "extractive_content_spec": {
                    "max_extractive_answer_count": 5,
                    "max_extractive_segment_count": 3,
                }
            }
        )
        print("✅ Request built")

        print("🚀 Sending search request...")

        # Make the search request
        response = client.search(request=request)

        print("\n📥 Processing results...\n")
        print(f"{'='*80}")
        print("SEARCH RESULTS")
        print(f"{'='*80}\n")

        # Process results
        results_count = 0
        for result in response.results:
            results_count += 1
            doc = result.document

            print(f"\n{'─'*80}")
            print(f"Result #{results_count}")
            print(f"{'─'*80}")

            # Convert to dict for easier access
            doc_dict = type(doc).to_dict(doc)
            struct_data = doc_dict.get('struct_data', {})
            derived_data = doc_dict.get('derived_struct_data', {})

            # Extract title
            title = struct_data.get('title', 'Untitled')
            print(f"📄 Title: {title}")

            # Extract link if available
            link = struct_data.get('link') or struct_data.get('url')
            if link:
                print(f"🔗 Link: {link}")

            # Extract snippets
            snippets = derived_data.get('snippets', [])
            if snippets:
                print(f"\n📝 Snippets:")
                for snippet_obj in snippets:
                    snippet_text = snippet_obj.get('snippet', '')
                    if snippet_text:
                        print(f"  {snippet_text}")

            # Extract extractive answers
            answers = derived_data.get('extractive_answers', [])
            if answers:
                print(f"\n💡 Extractive Answers:")
                for answer in answers:
                    content = answer.get('content', '')
                    if content:
                        print(f"  • {content}")

        print(f"\n{'='*80}")
        print(f"✅ Search completed successfully!")
        print(f"✅ Found {results_count} results")
        print(f"{'='*80}\n")

        return results_count

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # Test query
    query = "tell me about the helix support chatbot"

    result = search_confluence(query)

    if result is not None:
        print(f"\n✅ Search returned {result} results")
    else:
        print("\n❌ Search failed - see error above")
