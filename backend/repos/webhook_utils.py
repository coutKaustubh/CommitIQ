"""
GitHub webhook security helpers.

GitHub calls OUR server (reverse API) — no Supabase JWT on this route.
Instead GitHub sends X-Hub-Signature-256: HMAC stamp using GITHUB_WEBHOOK_SECRET
(the same string you set in GitHub repo → Settings → Webhooks → Secret).
"""

import hashlib
#hashlib = used to create secure hashes of data
import hmac
#hmac = Hash-based Message Authentication Code
#used to verify the integrity(data has not been altered with a secret key) of the data


def verify_github_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Verify X-Hub-Signature-256 from GitHub.

    How it works:
      GitHub: HMAC-SHA256(secret, raw_json_bytes) → header "sha256=<hex>"
      Us:     same calculation on request.body (bytes, BEFORE json.loads)

    Why raw bytes?
      json.loads() then re-dump changes spacing/order → signature never matches.

    compare_digest prevents timing attacks — do not use == for secrets.
    """
    if not secret or not signature_header:
        return False

    # Use sha256= (X-Hub-Signature-256). Old X-Hub-Signature used sha1 — skip that.
    if not signature_header.startswith("sha256="):
        return False

    expected_hex = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()#converts the hash to a hexadecimal string
    
    #SHA = Secure Hash Algorithm
    #256 = output 256 bits (64 hex characters)

    received_hex = signature_header[7:]  # strip "sha256="

    return hmac.compare_digest(expected_hex, received_hex)
