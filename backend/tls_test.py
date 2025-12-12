
import json
from curl_cffi import requests

def test_impersonation(target="chrome"):
    print(f"\n--- Testing Impersonation: {target} ---")
    print(f"\n--- Testing Impersonation: {target} ---")
    session = None
    try:
        session = requests.Session(impersonate=target)
        session.verify = False
    except Exception as e:
        print(f"FAILED to begin session: {e}")
        return

    # 0. Test Reachability (Google)
    try:
        print("Checking connectivity to google.com...")
        resp = session.get("https://www.google.com", timeout=5)
        print(f"Google Status: {resp.status_code}")
    except Exception as e:
        print(f"Google connectivity FAILED: {e}")

    # 1. Check Headers
    try:
        print("Fetching headers from httpbin...")
        response_headers = session.get("https://httpbin.org/headers", timeout=10)
        headers = response_headers.json().get("headers", {})
        print(f"User-Agent: {headers.get('User-Agent', 'N/A')}")
    except Exception as e:
        print(f"Httpbin headers FAILED: {e}")

    # 2. TLS Fingerprint
    try:
        print("Fetching TLS fingerprint...")
        resp_tls = session.get("https://tls.browserleaks.com/json", verify=False, timeout=10)
        data = resp_tls.json()
        print(f"JA3 Hash: {data.get('ja3_hash', 'N/A')}")
        print(f"TLS Version: {data.get('tls_version', 'N/A')}")
        print(f"Akamai Hash: {data.get('akamai_hash', 'N/A')}")
    except Exception as e:
        print(f"TLS details FAILED: {e}")

if __name__ == "__main__":
    print("Starting TLS Fingerprint Investigation...")
    
    # Test standard 'chrome' (usually latest supported by the lib)
    test_impersonation("chrome")
    
    # Test specific version if supported, e.g., 'chrome110' 
    # (Note: exact version availability depends on curl_cffi version)
    # test_impersonation("chrome110") 
    
    # Compare with 'safari'
    test_impersonation("safari")
