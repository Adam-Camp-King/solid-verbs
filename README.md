# solid-verbs

> The verb taxonomy for AI agents acting on real businesses.

**solid-verbs** is an open specification for how AI agents should structure actions against business systems — safely, auditably, and reversibly. It defines **12 verb shapes**, a **manifest format**, a **receipt contract**, and **transport bindings** for CLI, MCP, WebMCP, and UCP.

This is the spec. [Solid#](https://solidnumber.com) is the reference implementation.

## Why this exists

Every MCP server today is CRUD in tool-calling wrapping paper. An agent gets `create_invoice`, `update_contact`, `delete_record` — raw database mutations with no structure for reasoning.

Agents don't think in CRUD. They think in loops:

```
observe → explain → preview → commit → verify → (rollback if wrong)
```

solid-verbs codifies that loop as a type system. Each verb declares its **shape** — what kind of reasoning step it represents — so the agent knows what to do with the result before it calls the tool.

## The 12 shapes

| Shape | What it does | Agent uses it to... |
|---|---|---|
| **aggregate** | Collapse N sub-queries into one tenant-scoped read | Build situational awareness without N round-trips |
| **explain** | Return the causal chain that produced a state | Understand *why* something is the way it is |
| **preview** | Dry-run a write, return the projected impact | Decide whether to commit without side effects |
| **suggest** | Ranked next-actions with confidence envelope | Pick the highest-value move |
| **transaction** | ACID grouping over multi-step writes | Batch mutations with rollback on failure |
| **receipt** | Attestation on a side-effecting write | Prove an action happened (audit trail) |
| **revert** | Single-action undo against an audit row | Roll back a mistake |
| **subscribe** | Cursor-polling observe stream | Watch for changes without websockets |
| **discovery** | Introspect the verb manifest itself | Learn what tools are available |
| **trail** | Query the audit log | Trace what happened and when |
| **reputation** | Reliability scoreboard for verbs/agents | Pick tools that actually work |
| **macro** | Saved multi-verb chains promoted to one-click | Replay proven sequences |

## Manifest format

Every verb is declared as a **VerbRecord**:

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
      "transaction_id": { "type": "integer", "minimum": 1 },
      "refund_amount_cents": { "type": "integer", "minimum": 1, "nullable": true }
    },
    "required": ["company_id", "transaction_id"]
  },
  "output_schema": { "type": "object", "additionalProperties": true },
  "surfaces": ["http", "mcp_stdio", "webmcp", "ucp", "cli"],
  "requires_consent": false,
  "tier_floor": "starter"
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Dot-notation namespace. `{domain}.{verb}` for agent-attraction; `snake_case` for ADA dispatcher verbs. |
| `description` | string | What the verb does — written for an LLM, not a human. |
| `shape` | enum | One of the 12 shapes above. |
| `side_effects` | enum | `read` (safe to call freely), `write` (mutates state), `mixed` (writes but reverses cleanly). |
| `input_schema` | JSON Schema | OpenAI-compatible tool parameter schema. `company_id` is injected by the runtime, never by the LLM. |
| `output_schema` | JSON Schema | Optional. Describes the response shape. |
| `surfaces` | string[] | Which transports project this verb: `http`, `mcp_stdio`, `webmcp`, `ucp`, `cli`. |
| `requires_consent` | boolean | Whether the runtime gates this verb behind human approval. |
| `tier_floor` | string | Minimum subscription tier required to call this verb. |

## Receipt contract

Every write verb returns a **receipt**:

```json
{
  "status": "completed",
  "audit_id": 4242,
  "rollback_handle": "infra:resize:1:s-2vcpu-4gb",
  "idempotency_key": "4dbfa11cbfc149fc"
}
```

- `audit_id` — pass to `audit.revert` to undo the action.
- `rollback_handle` — opaque token the runtime uses to replay the inverse.
- `idempotency_key` — replay-safe; calling the same verb with the same key is a no-op.

The reasoning loop with receipts:

```
aggregate → explain → preview → commit (receipt + audit_id)
                                         │
                                         ↓ if wrong
                                    revert (audit_id)
```

## Consent gates

Write verbs are classified by risk:

| Class | Gate | Min role | Example |
|---|---|---|---|
| `READ` | none | read_only | `crm_contacts_search` |
| `WRITE_REVERSIBLE` | confirmation click | employee | `crm_contact_update` |
| `WRITE_FINANCIAL` | typed phrase + admin | admin | `charge_invoice` |
| `IRREVERSIBLE` | typed phrase + owner | owner | `gdpr_delete_contact` |
| `BLOCKED` | never | — | `subscription_cancel_immediate` |

Typed-phrase gates require the human to type a specific string that includes the action details (e.g., `"CHARGE $50.00 to invoice #4242"`). The phrase is bound into a nonce signature — tampering between dispatch and confirm is cryptographically blocked.

## Transport bindings

One registry, four projections:

```
                    UNIFIED_VERB_REGISTRY
                            │
     ┌──────────────┬───────┴──────────┬──────────────┐
    CLI         MCP stdio          WebMCP            UCP
 shell agent   Claude Desktop    in-browser     buyer-agent
               Cursor/Windsurf   Chrome agent   Gemini/ChatGPT
```

Adding a verb to the registry lights up all four transports. Parity is enforced by integration tests — a verb visible on one transport is visible on all four unless it explicitly opts out via `surfaces`.

| Transport | Discovery | Auth |
|---|---|---|
| **CLI** | `solid verbs list --json` | API key or browser login |
| **MCP stdio** | `tools/list` MCP method | `SOLID_API_KEY` env var |
| **WebMCP** | `navigator.modelContext` | Session cookie (in-browser) |
| **UCP** | `/.well-known/ucp` | RFC 9421 ES256 signatures |

## Reference implementation

[Solid#](https://solidnumber.com) is the reference implementation:

- **316 verbs** across 36 categories (CRM, payments, voice, scheduling, CMS, inventory, infrastructure, subscriptions, GDPR, email, analytics, social, integrations, agents, KB, workflows, audit, team, predict, and more).
- **4 transports** shipping in production: `@solidnumber/cli`, `@solidnumber/mcp`, WebMCP (in-browser), UCP.
- **Receipt infrastructure** with typed-phrase consent gates, nonce-signed confirmation, and append-only audit trail.
- **Live verb manifest:** `GET https://api.solidnumber.com/api/v1/agent/verbs`

## Spec documents

- [Shapes](spec/shapes.md) — detailed definition of each verb shape with examples
- [Manifest](spec/manifest.md) — VerbRecord format and registration semantics
- [Transport bindings](spec/transport.md) — how shapes project to CLI / MCP / WebMCP / UCP
- [Receipts](spec/receipts.md) — receipt contract, rollback handles, idempotency
- [Consent](spec/consent.md) — typed-phrase gates, role floors, verb classification

## JSON Schema

Machine-readable schemas for validators and code generators:

- [`schema/verb-record.json`](schema/verb-record.json) — VerbRecord schema
- [`schema/shapes/*.json`](schema/shapes/) — per-shape input/output contracts
- [`schema/envelope.json`](schema/envelope.json) — standard response envelope

## Who this is for

- **Agent runtime builders** (Anthropic, OpenAI, Google, Cohere) — implement verb shapes in your tool-calling APIs so agents reason in structured loops instead of raw CRUD.
- **SaaS platforms** — adopt the manifest format so your tools are discoverable and interoperable across transports.
- **AI agent developers** — build against typed shapes instead of guessing what a tool returns.
- **Compliance teams** — use the receipt + consent spec to audit what AI agents did and why.

## License

MIT. Use it, implement it, extend it.

The spec is open. The Solid# runtime is [BSL-1.1](https://solidnumber.com/legal/terms) (converts to Apache 2.0 on 2030-04-14).

---

Created by [Adam Campbell](mailto:adam@solidnumber.com) — Solid Number Inc.
