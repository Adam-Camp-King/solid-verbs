# Transport Bindings

> One registry, four projections. Adding a verb to the unified registry lights up all four transports automatically.

## Architecture

```
                    UNIFIED_VERB_REGISTRY
                            │
     ┌──────────────┬───────┴──────────┬──────────────┐
    CLI         MCP stdio          WebMCP            UCP
 shell agent   Claude Desktop    in-browser     buyer-agent
               Cursor/Windsurf   Chrome agent   Gemini/ChatGPT
```

## CLI

Shell-running agents (Claude Code, Codex, scripts) invoke verbs via the CLI.

**Discovery:**
```bash
solid verbs list --json          # full manifest
solid verbs list --shape preview # filter by shape
```

**Invocation:**
```bash
solid agent dispatch <verb> --args '{"key": "value"}' --json [--confirm] [--phrase "..."]
```

**Response envelope:**
```json
{ "ok": true, "verb": "infrastructure_diagnose", "result": { ... } }
```

Write verbs require `--confirm`. Typed-phrase verbs require `--phrase "EXACT PHRASE"`.

**Shortcut commands** promote high-traffic verbs to first-class:
```bash
solid infra diagnose             # → infrastructure_diagnose
solid deal create --title "..."  # → deals_create
solid customer-context 42        # → customer.full_context
```

## MCP stdio

MCP-speaking agent runtimes (Claude Desktop, Cursor, Windsurf, Cline) load the server via npx.

**Discovery:** Standard MCP `tools/list` method. Returns all verbs as tools.

**Invocation:** Standard MCP `tools/call` method. Verb names map 1:1 to tool names.

**Config:**
```json
{
  "mcpServers": {
    "solidnumber": {
      "command": "npx",
      "args": ["-y", "@solidnumber/mcp"],
      "env": { "SOLID_API_KEY": "sk_solid_..." }
    }
  }
}
```

The MCP server is a thin bridge. It fetches the verb manifest from `GET /api/v1/agent/verbs?surface=mcp_stdio` every 5 minutes and projects each verb as an MCP tool. New verbs appear in `tools/list` within 5 minutes of backend deployment — no npm republish required.

**Auth:** `SOLID_API_KEY` env var. Optional for read verbs (falls back to sandbox tenant), required for writes.

## WebMCP

In-browser agents (Chrome agent mode, Claude.ai web) discover verbs via the W3C draft API.

**Discovery:** `navigator.modelContext.registerTool()` called on page load. Verbs are registered per-page based on the surface (dashboard, portal, developer, tenant-site, public).

**Manifest endpoint:**
```
GET /api/v1/webmcp/manifest?surface={dashboard|portal|developer|tenant-site|public}
```

**Invocation:**
```
POST /api/v1/webmcp/execute/{tool_name}
Body: { "input": { ... }, "surface": "dashboard" }
```

**Auth:** Session cookie (in-browser). The browser's authenticated session binds the company_id.

WebMCP verbs are registered automatically by Solid#'s page generators — tenants are born WebMCP-aware with no manual setup.

## UCP (Universal Commerce Protocol)

Public buyer-agents (Gemini AI Mode, ChatGPT shopping) discover capabilities via the UCP standard.

**Discovery:** `GET /.well-known/ucp` returns the platform profile with sub-agent capabilities.

**Invocation:** HTTP requests with RFC 9421 ES256 message signatures. Verbs map to UCP capabilities under the `com.solidnumber.*` namespace.

**Auth:** Per-company JWK rotation lifecycle (`pending → active → rotating → retired`). Private keys encrypted at rest, RLS-protected.

**Differentiator:** Solid# exposes a hierarchical agent graph (platform → company → sales/AR/AP/commissions/service/compliance/marketing/ops sub-agents) instead of the stock UCP single-checkout-endpoint model.

## Parity invariant

A verb visible on one transport MUST be visible on every transport listed in its `surfaces` set. This is enforced by integration tests:

```python
# tests/integration/test_sibling_transport_parity.py
def test_all_surfaces_see_same_verbs():
    for verb in UNIFIED_VERB_REGISTRY.values():
        for surface in verb.surfaces:
            assert verb_visible_on(surface, verb.name)
```

## Error contract

All four transports return errors in the same envelope:

```json
{
  "ok": false,
  "verb": "infrastructure_resize",
  "error": {
    "reason": "no_managed_droplet",
    "message": "This company has no managed droplet.",
    "hint": "Use subscription_upgrade_tier for capacity changes."
  }
}
```

`reason` is machine-readable (the agent pattern-matches on it). `message` is for humans/LLMs. `hint` is the actionable next step.
