# Manifest Format

> Every verb is declared as a VerbRecord — a single JSON object that carries the verb's identity, schema, shape, and surface coverage.

## VerbRecord

```json
{
  "name": "payments.preview_refund_impact",
  "description": "Project the impact of refunding a transaction WITHOUT executing it.",
  "shape": "preview",
  "side_effects": "read",
  "input_schema": {
    "type": "object",
    "properties": {
      "company_id": { "type": "integer", "minimum": 1 },
      "transaction_id": { "type": "integer", "minimum": 1 }
    },
    "required": ["company_id", "transaction_id"]
  },
  "output_schema": { "$ref": "../schema/shapes/preview.json" },
  "surfaces": ["http", "mcp_stdio", "webmcp", "ucp", "cli"],
  "requires_consent": false,
  "tier_floor": "starter"
}
```

**JSON Schema:** [`schema/verb-record.json`](../schema/verb-record.json)

## Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Dot-notation (`payments.preview_refund_impact`) or snake_case (`charge_invoice`). Must match `^[a-zA-Z][a-zA-Z0-9_.]*$`. |
| `description` | string | yes | Written for an LLM, not a human. Should state what the verb does and what the agent should expect. |
| `shape` | enum | yes | One of the 12 shapes defined in [shapes.md](shapes.md). |
| `side_effects` | enum | no | `read` (default, safe to call freely), `write` (mutates state), `mixed` (writes but reverses cleanly). |
| `input_schema` | JSON Schema | yes | OpenAI-compatible tool parameter schema. |
| `output_schema` | JSON Schema | no | Describes the response shape. If omitted, the response is `{ type: object, additionalProperties: true }`. |
| `surfaces` | string[] | no | Transports: `http`, `mcp_stdio`, `webmcp`, `ucp`, `cli`. Defaults to all five. |
| `requires_consent` | boolean | no | Whether the runtime gates this verb behind human approval. |
| `tier_floor` | string | no | Minimum subscription tier. Defaults to `starter`. |

## Naming conventions

**Dot-notation** for agent-attraction verbs (the multi-transport surface):
- `{domain}.{verb}` — e.g., `payments.preview_refund_impact`, `customer.full_context`, `infrastructure.diagnose`
- The domain groups verbs logically: `crm`, `payments`, `inventory`, `infrastructure`, `deal`, `customer`, etc.

**Snake_case** for ADA dispatcher verbs (the typed-phrase / consent-gated surface):
- e.g., `charge_invoice`, `subscription_upgrade_tier`, `infrastructure_resize`
- These are the verbs that require human confirmation. The snake_case name is what the LLM emits in its function call.

Both naming styles coexist in the same registry. The ADA-to-manifest bridge auto-mirrors snake_case names into the unified registry so discovery surfaces see the full set.

## Registration semantics

- **One declaration per verb.** The unified registry is the single source. Downstream registries (MCP tool list, WebMCP manifest, UCP capabilities, CLI verbs) derive from it.
- **Last write wins.** Re-registering the same name overwrites the previous record.
- **Surface filtering.** Verbs can opt out of surfaces by omitting them from the `surfaces` set. A verb with `surfaces: ["http", "cli"]` won't appear in MCP or WebMCP tool lists.
- **Parity invariant.** A verb visible on one transport MUST be visible on every transport in its `surfaces` set. Enforced by integration tests.

## company_id is NEVER in the schema

`company_id` is injected by the runtime from the authenticated session — never accepted from the LLM. Including `company_id` in `input_schema.properties` is a registration-time error. This prevents cross-tenant data access via prompt injection.

Same rule applies to `user_id`. Both are bound by the runtime, not by the model.

## Manifest endpoint

The live manifest is available at:

```
GET /api/v1/agent/verbs?surface=mcp_stdio
```

Returns an array of VerbRecords filtered by surface. Cached for 5 minutes. New verbs appear in the manifest within 5 minutes of backend deployment — no client-side package republish required.
