#!/usr/bin/env python3
"""
Simplified test script for querying Gemini Enterprise apps using streamAssist API.
"""

import os
from google.cloud import discoveryengine_v1
from google.cloud.discoveryengine_v1.types import StreamAssistRequest, Query
from google.auth import default

# Configuration
PROJECT_NUMBER = "403334419176"
LOCATION = "global"
COLLECTION = "default_collection"
ENGINE = "agentspace-1750425553806_1750425553806"
ASSISTANT = "default_assistant"

# Build the full path to the assistant
ASSISTANT_PATH = (
    f"projects/{PROJECT_NUMBER}/locations/{LOCATION}/"
    f"collections/{COLLECTION}/engines/{ENGINE}/"
    f"assistants/{ASSISTANT}"
)

def query_confluence(query_text: str):
    """Query the Confluence app using streamAssist."""

    print(f"\n{'='*80}")
    print(f"🔍 Querying Confluence via streamAssist")
    print(f"{'='*80}")
    print(f"Query: {query_text}")
    print(f"Path: {ASSISTANT_PATH}")
    print(f"{'='*80}\n")

    try:
        # Get credentials using Application Default Credentials
        print("🔐 Getting credentials...")
        credentials, project = default()
        print(f"✅ Got credentials for project: {project}")

        print("✅ Authentication successful")

        # Create the Discovery Engine client
        print("🔧 Creating Discovery Engine client...")
        client = discoveryengine_v1.AssistantServiceClient(credentials=credentials)
        print("✅ Discovery Engine client created")

        # Build the request
        print("📝 Building request...")
        query = Query(text=query_text)
        stream_request = StreamAssistRequest(
            name=ASSISTANT_PATH,
            query=query
        )
        print("✅ Request built")

        print("🚀 Sending request to Discovery Engine...")

        # Make the streaming request
        response_stream = client.stream_assist(request=stream_request)

        print("\n📥 Receiving response stream...\n")
        print(f"{'='*80}")
        print("RESPONSE")
        print(f"{'='*80}\n")

        # Collect and display responses
        all_text = []
        all_references = {}
        citation_counter = 0

        for response in response_stream:
            # Convert to dict for easier parsing
            response_dict = type(response).to_dict(response)

            # Extract answer content
            if 'answer' in response_dict:
                answer_data = response_dict['answer']

                if 'replies' in answer_data:
                    for reply in answer_data['replies']:
                        if 'grounded_content' in reply:
                            ground_content = reply['grounded_content']

                            # Get the text content
                            if 'content' in ground_content and 'text' in ground_content['content']:
                                text = ground_content['content']['text']
                                all_text.append(text)
                                print(text)

                            # Extract references/citations
                            if 'text_grounding_metadata' in ground_content:
                                metadata = ground_content['text_grounding_metadata']
                                if 'references' in metadata:
                                    for ref in metadata['references']:
                                        if 'document_metadata' in ref:
                                            doc_meta = ref['document_metadata']
                                            uri = doc_meta.get('uri', '')
                                            title = doc_meta.get('title', 'Untitled')

                                            if uri and uri not in all_references:
                                                citation_counter += 1
                                                all_references[uri] = {
                                                    'number': citation_counter,
                                                    'title': title,
                                                    'uri': uri
                                                }

        # Display citations
        if all_references:
            print(f"\n{'='*80}")
            print("📚 SOURCES")
            print(f"{'='*80}\n")

            for uri, ref in all_references.items():
                print(f"[{ref['number']}] {ref['title']}")
                print(f"    {ref['uri']}\n")

        print(f"{'='*80}")
        print("✅ Query completed successfully!")
        print(f"{'='*80}\n")

        return ''.join(all_text), all_references

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None, None


if __name__ == "__main__":
    # Test query - ask about a specific Confluence page
    query = "What is the Spec for the Helix Support Chatbot v2? Tell me about the requirements and design."

    result, references = query_confluence(query)

    if result:
        print(f"\n✅ Successfully retrieved {len(result)} characters of content")
        print(f"✅ Found {len(references)} source references")
    else:
        print("\n❌ Query failed - see error above")
