#!/usr/bin/env python3
"""
Test script for querying Gemini Enterprise using Discovery Engine Search REST API.
"""

import json
import requests
from google.auth import default
from google.auth.transport.requests import Request

# Configuration
PROJECT_NUMBER = "403334419176"
LOCATION = "global"
COLLECTION = "default_collection"
ENGINE = "agentspace-1750425553806_1750425553806"
SERVING_CONFIG = "default_search"

# Build the REST API URL
API_URL = (
    f"https://discoveryengine.googleapis.com/v1alpha/"
    f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/"
    f"collections/{COLLECTION}/engines/{ENGINE}/"
    f"servingConfigs/{SERVING_CONFIG}:search"
)

def search_confluence(query_text: str):
    """Search Confluence using Discovery Engine Search REST API."""

    print(f"\n{'='*80}")
    print(f"🔍 Searching Confluence via REST API")
    print(f"{'='*80}")
    print(f"Query: {query_text}")
    print(f"URL: {API_URL}")
    print(f"{'='*80}\n")

    try:
        # Get credentials
        print("🔐 Getting credentials...")
        credentials, project = default()
        print(f"✅ Got credentials for project: {project}")

        # Get access token
        print("🔑 Getting access token...")
        if not credentials.valid:
            session = requests.Session()
            session.verify = "/Users/ryan.niemes/.config/certs/nscacert_combined.pem"
            auth_request = Request(session=session)
            credentials.refresh(auth_request)

        access_token = credentials.token
        print("✅ Got access token")

        # Build the search request
        print("📝 Building search request...")
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        payload = {
            "query": query_text,
            "pageSize": 10,
            "spellCorrectionSpec": {"mode": "AUTO"},
            "languageCode": "en-US",
            "contentSearchSpec": {
                "snippetSpec": {"returnSnippet": True},
                "extractiveContentSpec": {
                    "maxExtractiveAnswerCount": 5,
                    "maxExtractiveSegmentCount": 3
                }
            },
            "naturalLanguageQueryUnderstandingSpec": {
                "filterExtractionCondition": "ENABLED"
            }
        }

        print("✅ Request built")
        print("🚀 Sending search request...")

        # Make the REST API call with custom CA bundle
        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            verify="/Users/ryan.niemes/.config/certs/nscacert_combined.pem"
        )

        response.raise_for_status()
        data = response.json()

        print("\n📥 Processing results...\n")
        print(f"{'='*80}")
        print("SEARCH RESULTS")
        print(f"{'='*80}\n")

        # Process results
        results = data.get('results', [])
        results_count = len(results)

        for idx, result in enumerate(results, 1):
            doc = result.get('document', {})
            struct_data = doc.get('structData', {})
            derived_data = doc.get('derivedStructData', {})

            print(f"\n{'─'*80}")
            print(f"Result #{idx}")
            print(f"{'─'*80}")

            # Extract title
            title = struct_data.get('title', 'Untitled')
            print(f"📄 Title: {title}")

            # Extract link
            link = struct_data.get('link') or struct_data.get('url')
            if link:
                print(f"🔗 Link: {link}")

            # Extract snippets
            snippets = derived_data.get('snippets', [])
            if snippets:
                print(f"\n📝 Snippets:")
                for snippet in snippets:
                    snippet_text = snippet.get('snippet', '')
                    if snippet_text:
                        print(f"  {snippet_text}")

            # Extract extractive answers
            answers = derived_data.get('extractiveAnswers', [])
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

        return results_count, data

    except requests.exceptions.RequestException as e:
        print(f"\n❌ HTTP Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
        return None, None
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None, None


if __name__ == "__main__":
    # Test query
    query = "tell me about the helix support chatbot"

    result_count, data = search_confluence(query)

    if result_count is not None:
        print(f"\n✅ Search returned {result_count} results")
    else:
        print("\n❌ Search failed - see error above")
