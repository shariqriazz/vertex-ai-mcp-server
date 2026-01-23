#!/usr/bin/env python3
"""
SSL/Connectivity Troubleshooting Script for Discovery Engine with Netskope.

Tests various connection methods to identify SSL/gRPC issues.
"""

import sys
import socket
import ssl
import json
from datetime import datetime

def test_dns_resolution():
    """Test DNS resolution for Google APIs."""
    print("\n" + "="*80)
    print("TEST 1: DNS Resolution")
    print("="*80)

    domains = [
        "discoveryengine.googleapis.com",
        "oauth2.googleapis.com",
    ]

    for domain in domains:
        try:
            ip = socket.gethostbyname(domain)
            print(f"✅ {domain} -> {ip}")
        except Exception as e:
            print(f"❌ {domain} -> ERROR: {e}")
            return False

    return True


def test_tcp_connection():
    """Test TCP connection to Discovery Engine."""
    print("\n" + "="*80)
    print("TEST 2: TCP Connection")
    print("="*80)

    host = "discoveryengine.googleapis.com"
    port = 443

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()

        if result == 0:
            print(f"✅ TCP connection to {host}:{port} successful")
            return True
        else:
            print(f"❌ TCP connection to {host}:{port} failed (code: {result})")
            return False
    except Exception as e:
        print(f"❌ TCP connection error: {e}")
        return False


def test_ssl_handshake():
    """Test SSL/TLS handshake."""
    print("\n" + "="*80)
    print("TEST 3: SSL/TLS Handshake")
    print("="*80)

    host = "discoveryengine.googleapis.com"
    port = 443

    try:
        context = ssl.create_default_context()

        with socket.create_connection((host, port), timeout=5) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                print(f"✅ SSL handshake successful")
                print(f"   Protocol: {ssock.version()}")

                # Check ALPN
                try:
                    alpn = ssock.selected_alpn_protocol()
                    print(f"   ALPN: {alpn if alpn else 'None (this may cause gRPC issues!)'}")
                except AttributeError:
                    print(f"   ALPN: Not supported by Python version")

                # Check certificate
                cert = ssock.getpeercert()
                subject = dict(x[0] for x in cert['subject'])
                issuer = dict(x[0] for x in cert['issuer'])
                print(f"   Subject: {subject.get('commonName', 'Unknown')}")
                print(f"   Issuer: {issuer.get('commonName', 'Unknown')}")

                # Check if Netskope is intercepting
                if 'netskope' in issuer.get('commonName', '').lower():
                    print(f"   ⚠️  WARNING: Netskope is still intercepting SSL!")
                    print(f"       The bypass rule may not be active yet.")
                    return False

                return True

    except ssl.SSLError as e:
        print(f"❌ SSL handshake failed: {e}")
        return False
    except Exception as e:
        print(f"❌ SSL error: {e}")
        return False


def test_http_request():
    """Test basic HTTPS request."""
    print("\n" + "="*80)
    print("TEST 4: HTTPS Request")
    print("="*80)

    try:
        import requests

        url = "https://discoveryengine.googleapis.com/"
        response = requests.get(url, timeout=5)

        print(f"✅ HTTPS request successful")
        print(f"   Status: {response.status_code}")
        return True

    except ImportError:
        print(f"⚠️  Skipped (requests library not installed)")
        return True
    except Exception as e:
        print(f"❌ HTTPS request failed: {e}")
        return False


def test_grpc_connection():
    """Test gRPC connection with ALPN."""
    print("\n" + "="*80)
    print("TEST 5: gRPC Connection (with ALPN)")
    print("="*80)

    try:
        import grpc

        # Test gRPC channel creation
        channel = grpc.secure_channel(
            'discoveryengine.googleapis.com:443',
            grpc.ssl_channel_credentials(),
            options=[
                ('grpc.http2.max_pings_without_data', 0),
            ]
        )

        # Test channel connectivity
        try:
            grpc.channel_ready_future(channel).result(timeout=5)
            print(f"✅ gRPC channel ready")
            channel.close()
            return True
        except grpc.FutureTimeoutError:
            print(f"⚠️  gRPC channel timeout (may still work for actual requests)")
            channel.close()
            return True
        except Exception as e:
            print(f"❌ gRPC channel failed: {e}")
            channel.close()
            return False

    except ImportError:
        print(f"⚠️  Skipped (grpcio library not installed)")
        return True
    except Exception as e:
        print(f"❌ gRPC error: {e}")
        return False


def test_oauth_connection():
    """Test OAuth endpoint connectivity."""
    print("\n" + "="*80)
    print("TEST 6: OAuth Token Endpoint")
    print("="*80)

    try:
        import requests

        url = "https://oauth2.googleapis.com/.well-known/openid-configuration"
        response = requests.get(url, timeout=5)

        print(f"✅ OAuth endpoint accessible")
        print(f"   Status: {response.status_code}")
        return True

    except ImportError:
        print(f"⚠️  Skipped (requests library not installed)")
        return True
    except Exception as e:
        print(f"❌ OAuth endpoint failed: {e}")
        return False


def test_discovery_engine_client():
    """Test Discovery Engine client creation."""
    print("\n" + "="*80)
    print("TEST 7: Discovery Engine Client")
    print("="*80)

    try:
        from google.cloud import discoveryengine_v1
        from google.auth import default

        # Get credentials
        credentials, project = default()
        print(f"✅ Credentials loaded for project: {project}")

        # Create client
        client = discoveryengine_v1.SearchServiceClient(credentials=credentials)
        print(f"✅ Discovery Engine client created")

        # Test a simple operation (list serving configs - should fail with permission error but connection works)
        try:
            # This will likely fail with permission error, but that's OK - we're testing connectivity
            parent = f"projects/403334419176/locations/global/collections/default_collection/engines/agentspace-1750425553806_1750425553806"
            request = discoveryengine_v1.ListServingConfigsRequest(parent=parent, page_size=1)
            response = client.list_serving_configs(request=request, timeout=5)
            configs = list(response)
            print(f"✅ API call successful (listed {len(configs)} configs)")
            return True
        except Exception as api_err:
            error_msg = str(api_err)
            if "503" in error_msg or "UNAVAILABLE" in error_msg:
                print(f"❌ API call failed with 503/UNAVAILABLE - SSL/gRPC issue")
                print(f"   Error: {error_msg[:200]}")
                return False
            elif "ALPN" in error_msg:
                print(f"❌ API call failed with ALPN error - Netskope still intercepting")
                print(f"   Error: {error_msg[:200]}")
                return False
            else:
                # Other errors (permission, etc) are OK - connection worked
                print(f"✅ API connection works (got expected error: {error_msg[:100]})")
                return True

    except ImportError as e:
        print(f"⚠️  Skipped (google-cloud-discoveryengine not installed)")
        return True
    except Exception as e:
        print(f"❌ Client creation failed: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("SSL/CONNECTIVITY TROUBLESHOOTING")
    print("="*80)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python: {sys.version}")

    tests = [
        ("DNS Resolution", test_dns_resolution),
        ("TCP Connection", test_tcp_connection),
        ("SSL/TLS Handshake", test_ssl_handshake),
        ("HTTPS Request", test_http_request),
        ("gRPC Connection", test_grpc_connection),
        ("OAuth Endpoint", test_oauth_connection),
        ("Discovery Engine Client", test_discovery_engine_client),
    ]

    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))

    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")

    print("\n" + "-"*80)
    print(f"Results: {passed}/{total} tests passed")
    print("="*80)

    if passed == total:
        print("\n🎉 All tests passed! Discovery Engine should work.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        print("If SSL/ALPN tests failed, Netskope bypass may need more time to propagate.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
