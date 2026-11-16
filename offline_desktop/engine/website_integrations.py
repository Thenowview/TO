"""Read-only catalogue for TheOrg's local web app and optional provider links.

No API keys, OAuth tokens, network probes, external operations or client-data
transfers.  This is discovery, not an integration executor.
"""
from __future__ import annotations

# Explicitly distinguish the third-party theorg.com business from this project.
_CATALOG = (
    dict(id="local_workspace", title="TheOrg local workspace", group="first_party",
         status="local_ui", integration="authenticated_loopback_api",
         capabilities=("chat_sessions", "sqlite_tasks", "reviewed_knowledge", "scoped_files"),
         permission="Existing local bearer token", cost="none",
         description="The web interface and local Python engine are part of this project."),
    dict(id="github", title="GitHub", group="optional_external",
         status="requires_separate_authorization", integration="existing_review_only_source_tools",
         capabilities=("source_review", "workflow_evidence", "pull_requests"),
         permission="Owner-approved GitHub connection and per-action review", cost="verify_provider_terms",
         description="Repository inspection and CI evidence; no automatic merges, pushes or deploys."),
    dict(id="google_workspace", title="Google Workspace", group="optional_external",
         status="requires_separate_authorization", integration="existing_read_only_candidate",
         capabilities=("drive_metadata", "gmail_labels", "calendar_lists"),
         permission="Explicit Google OAuth scopes; tokens kept outside the UI", cost="verify_provider_terms",
         description="Existing connector sketches are read-only and do not imply a connected account."),
    dict(id="cloudflare", title="Cloudflare", group="optional_external",
         status="not_implemented", integration="candidate",
         capabilities=("static_web_hosting", "dns_review", "pages_build_evidence"),
         permission="Separate authorized account, environment and explicit deployment approval",
         cost="verify_provider_terms",
         description="Suitable for a public static information page; never expose the local task API or its bearer token."),
    dict(id="the_org_data", title="The Org (separate company)", group="third_party",
         status="not_implemented", integration="optional_api_or_mcp",
         capabilities=("organization_charts", "company_lookup", "people_and_role_research"),
         permission="Third-party API key, license and per-request credit approval",
         cost="potentially_metered",
         documentation="https://developers.theorg.com/",
         description="theorg.com is not this TheOrg project. Do not connect by default or imply free API access."),
)


def catalog():
    """Return a fresh, credential-free snapshot without probing any provider."""
    providers = []
    for entry in _CATALOG:
        provider = {**entry, "capabilities": list(entry["capabilities"])}
        # No live connection was tested; UI files are not a remote integration.
        provider["connected"] = None
        provider["live_probed"] = False
        provider["data_sent"] = False
        providers.append(provider)
    return {"schema": "theorg-website-integrations-v1", "providers": providers,
            "local_endpoint_only": True, "external_calls_made": False,
            "note": "Available capabilities are not confirmation of connected accounts, API entitlements, or deployed public websites."}
