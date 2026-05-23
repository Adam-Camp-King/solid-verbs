# Receipt Contract

> Every write verb returns a receipt. The receipt is the proof that an action happened, the handle to undo it, and the key to replay it safely.

## Receipt fields

| Field | Type | Description |
|---|---|---|
| `audit_id` | integer | Unique ID in the audit log. Pass to `audit.revert` to undo. |
| `rollback_handle` | string | Opaque token encoding the inverse action (e.g., `infra:resize:1:s-2vcpu-4gb`). |
| `idempotency_key` | string | Replay-safe — calling the same verb with the same key is a no-op. |
| `timestamp` | ISO 8601 | When the action was executed. |
| `status` | string | `completed`, `pending`, `failed`. |

## Example

```json
{
  "status": "resized",
  "audit_id": 4242,
  "rollback_handle": "infra:resize:1:s-2vcpu-4gb",
  "idempotency_key": "4dbfa11cbfc149fc",
  "previous_size": "SMALL",
  "new_size": "MEDIUM"
}
```

## Rollback semantics

Rollback is **best-effort, not guaranteed.** Each action type has a whitelisted revert handler in the backend. If no handler exists for the action type, `audit.revert` returns a structured refusal:

```json
{
  "reverted": false,
  "audit_id": 4242,
  "reason": "no_revert_handler",
  "message": "This action type does not support automated rollback. Manual intervention required."
}
```

Supported revert types are declared per verb at registration time. The agent can check `reversible: true` in preview output to know ahead of time whether an action is undoable.

## Rollback handles

The `rollback_handle` is an opaque string that encodes everything the runtime needs to replay the inverse action. Format is implementation-defined. Examples:

| Handle | Meaning |
|---|---|
| `infra:resize:1:s-2vcpu-4gb` | Resize droplet 1 back to s-2vcpu-4gb |
| `infra:scale_workers:1:2` | Scale droplet 1 workers back to 2 |
| `crm:contact:42:pre_update_snapshot` | Restore contact 42 from snapshot |

The agent should treat handles as opaque — never parse or construct them.

## Idempotency

If `idempotency_key` is provided in the request, the runtime checks whether a receipt with that key already exists:
- **Exists + succeeded:** returns the original receipt (no re-execution).
- **Exists + failed:** re-executes the action.
- **Doesn't exist:** executes normally, stores the key.

If `idempotency_key` is not provided, the runtime generates one. Keys expire after 24 hours.

## Receipt chains

Transactions produce a receipt chain — a parent receipt with child receipts per step:

```json
{
  "transaction_id": "tx_abc123",
  "status": "committed",
  "audit_id": 4243,
  "steps": [
    { "verb": "crm_contact_update", "audit_id": 4244, "status": "completed" },
    { "verb": "email_send", "audit_id": 4245, "status": "completed" }
  ],
  "rollback_handle": "tx:tx_abc123:rollback_all"
}
```

Reverting the parent receipt reverts all child steps in reverse order.

## Audit log

Every dispatch writes an `AIAuditLog` row — including denials. The audit row captures:

- `company_id`, `user_id`, `agent_type`
- `action_type` (the verb name)
- `category` (system, crm, payments, etc.)
- `status` (initiated, completed, denied, reverted)
- `request_data`, `result_id`
- `is_reversible`, `reversed_at`, `reversed_by`
- `requires_approval`, `approved_by`, `approved_at`

Denied attempts are the most important rows — they prove the safety layer is working.
