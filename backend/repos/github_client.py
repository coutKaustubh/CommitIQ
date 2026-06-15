import requests

GITHUB_API_BASE = "https://api.github.com"
GITHUB_HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def github_request(method, path, token, *, params=None, json=None, timeout=30):
    """Call GitHub REST API with the user's OAuth token.""" # whats github rest api?
    # GitHub REST API is a way to interact with the GitHub API using HTTP requests.
    # It is a way to interact with the GitHub API using HTTP requests.
    url = path if path.startswith("http") else f"{GITHUB_API_BASE}{path}"
    headers = {
        **GITHUB_HEADERS_BASE,
        "Authorization": f"Bearer {token}",
    }
    return requests.request(
        method, url, headers=headers, params=params, json=json, timeout=timeout
    )


def fetch_github_user_login(token):
    """Return GitHub username for token, or empty string on failure."""
    response = github_request("GET", "/user", token)
# sourcery skip: swap-if-expression
    return "" if not response.ok else response.json().get("login") or ""
