# Verb Shapes

> solid-verbs defines 12 verb shapes. Each shape declares what kind of reasoning step the verb represents, so an agent knows what to do with the result before calling the tool.

## Shape definitions

### aggregate

Collapse N sub-queries into one tenant-scoped read. Returns a merged entity with all relations populated in a single round-trip.

- **Side effects:** `read`
- **Input:** Entity IDs + include flags (e.g., `customer_id`, `include_payment_methods`)
- **Output:** `{ entity_id, entity_type, data, relations[], fetched_at }`
- **Schema:** [`schema/shapes/aggregate.json`](../schema/shapes/aggregate.json)

```json
{
  "verb": "customer.full_context",
  "input": { "customer_id": 42, "include_payment_methods": true },
  "output": {
    "entity_id": 42,
    "entity_type": "customer",
    "data": { "name": "Acme Plumbing", "lifetime_value_cents": 245000, "open_deals": 2 },
    "relations": [
      { "type": "deal", "id": 7, "title": "Kitchen remodel" },
      { "type": "appointment", "id": 15, "date": "2026-05-25T09:00:00-06:00" }
    ]
  }
}
```

### explain

Return the causal chain that produced a state. The agent uses this to understand *why* something is the way it is before deciding whether to change it.

- **Side effects:** `read`
- **Input:** Entity ID
- **Output:** `{ entity_id, current_state, causal_chain[], reasoning }`
- **Schema:** [`schema/shapes/explain.json`](../schema/shapes/explain.json)

```json
{
  "verb": "crm.explain_contact_state",
  "input": { "contact_id": 42 },
  "output": {
    "entity_id": 42,
    "current_state": { "status": "lost", "lost_reason": "competitor" },
    "causal_chain": [
      { "timestamp": "2026-05-01T10:00:00Z", "action": "deal_created", "actor": "marcus" },
      { "timestamp": "2026-05-10T14:00:00Z", "action": "proposal_sent", "actor": "user:1" },
      { "timestamp": "2026-05-18T09:00:00Z", "action": "deal_lost", "actor": "user:1", "detail": "Went with competitor quote" }
    ],
    "reasoning": "Deal lost to competitor after proposal stage — 17 days in pipeline."
  }
}
```

### preview

Dry-run a write. Returns the projected impact without side effects. The agent uses this to show the human what will happen before they confirm.

- **Side effects:** `read`
- **Input:** Same parameters as the write verb it previews
- **Output:** `{ current, projected, delta, reversible, notes }`
- **Schema:** [`schema/shapes/preview.json`](../schema/shapes/preview.json)

```json
{
  "verb": "infrastructure.preview_resize",
  "input": { "target_size_slug": "MEDIUM" },
  "output": {
    "current": { "size": "SMALL", "price_monthly_cents": 7200 },
    "projected": { "size": "MEDIUM", "price_monthly_cents": 14400 },
    "delta": { "price_change_cents": 7200 },
    "reversible": true,
    "notes": "CPU-only resize — reversible by resizing back."
  }
}
```

### suggest

Ranked next-actions with a confidence envelope. The agent uses this to pick the highest-value move.

- **Side effects:** `read`
- **Input:** Entity context (deal ID, customer ID, etc.)
- **Output:** `{ suggestions[]: { action, confidence, confidence_band, reason, model_version, sample_size } }`
- **Schema:** [`schema/shapes/suggest.json`](../schema/shapes/suggest.json)

```json
{
  "verb": "deal.suggest_next_action",
  "input": { "deal_id": 7 },
  "output": {
    "suggestions": [
      {
        "action": "Send follow-up email with revised quote",
        "confidence": 0.82,
        "confidence_band": "high",
        "reason": "Deals in proposal_sent stage convert 3x faster with a follow-up within 48h.",
        "model_version": "tabpfn-v2",
        "sample_size": 1240
      },
      {
        "action": "Schedule a phone call",
        "confidence": 0.65,
        "confidence_band": "medium",
        "reason": "Phone follow-ups after proposal have 40% higher close rate than email alone."
      }
    ]
  }
}
```

### transaction

ACID grouping over multi-step writes. The agent uses `start`, `append`, `commit`, or `abort` to batch mutations with rollback on failure.

- **Side effects:** `write`
- **Input:** Per step: `{ verb, args }`. Transaction-level: `{ transaction_id }`
- **Output:** `{ transaction_id, status, steps[], rollback_handle }`
- **Schema:** [`schema/shapes/transaction.json`](../schema/shapes/transaction.json)

### receipt

Attestation on a side-effecting write. Every write verb returns a receipt with an `audit_id` that can be passed to `revert`.

- **Side effects:** `write`
- **Input:** Action-specific arguments
- **Output:** `{ status, audit_id, rollback_handle, idempotency_key, timestamp }`
- **Schema:** [`schema/shapes/receipt.json`](../schema/shapes/receipt.json)

### revert

Single-action undo against an audit row. Pass the `audit_id` from a receipt to undo the action.

- **Side effects:** `write`
- **Input:** `{ audit_id }`
- **Output:** `{ reverted, audit_id, original_action, revert_action, reason }`
- **Schema:** [`schema/shapes/revert.json`](../schema/shapes/revert.json)

### subscribe

Cursor-polling observe stream. The agent subscribes to changes and polls for new events using a cursor — no websockets required.

- **Side effects:** `read`
- **Input:** Filters (event types, entity IDs, time range)
- **Output:** `{ subscription_id, cursor, initial_events[] }`
- **Schema:** [`schema/shapes/subscribe.json`](../schema/shapes/subscribe.json)

### discovery

Introspect the verb manifest itself. The agent uses this to learn what tools are available.

- **Side effects:** `read`
- **Input:** Optional surface filter
- **Output:** `{ verbs[], total, surface }`
- **Schema:** [`schema/shapes/discovery.json`](../schema/shapes/discovery.json)

### trail

Query the audit log. Returns timestamped records of what happened and who did it.

- **Side effects:** `read`
- **Input:** Filters (time range, action types, entity ID)
- **Output:** `{ entries[]: { audit_id, timestamp, action, actor, entity_id, status } }`

### reputation

Reliability scoreboard for verbs and agents. The agent uses this to pick tools that actually work.

- **Side effects:** `read`
- **Input:** Optional verb filter + time window
- **Output:** `{ scores[]: { verb, invocations, success_rate, p50_ms, p95_ms, star_rating } }`

### macro

Saved multi-verb chains promoted to one-click execution. Proven sequences that an agent or operator saved for replay.

- **Side effects:** `write`
- **Input:** `{ macro_id, override_args }`
- **Output:** Chain result (array of per-step receipts)

## The reasoning loop

Shapes compose into a reasoning loop:

```
aggregate → explain → preview → commit (receipt)
    ↑                              │
    │                              ↓
    └──────── revert ←─────── if wrong
```

This is the loop every agent should follow. `aggregate` builds context, `explain` clarifies causation, `preview` shows impact, the write verb commits with a receipt, and `revert` undoes mistakes. `suggest` can enter the loop at any point to recommend the next action.
