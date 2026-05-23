# Consent Gates

> Write verbs are classified by risk. Each class defines the minimum approval gate the runtime enforces before the action executes.

## Verb classes

| Class | Gate | Min role | Daily cap | Example |
|---|---|---|---|---|
| `READ` | none | read_only | none | `crm_contacts_search` |
| `WRITE_REVERSIBLE` | confirmation click | employee | `ada_writes_per_day` | `crm_contact_update` |
| `WRITE_FINANCIAL` | typed phrase | admin | `ada_financial_writes_per_day` | `charge_invoice` |
| `IRREVERSIBLE` | typed phrase | owner | `ada_irreversible_writes_per_day` | `gdpr_delete_contact` |
| `BLOCKED` | never | — | — | `subscription_cancel_immediate` |

## Role hierarchy

```
read_only < employee < admin < owner
```

Each class enforces a minimum role. A verb classified as `WRITE_FINANCIAL` requires at least `admin` — `employee` and `read_only` are denied at dispatch time.

## Typed-phrase protocol

For `WRITE_FINANCIAL` and `IRREVERSIBLE` verbs, the human must type a specific phrase that includes the action details. The protocol:

1. **Agent calls verb with `_confirmed=false`.** The runtime returns a preflight response with the verb's metadata (no side effects).

2. **Runtime generates the required phrase** via `confirmation_phrase_builder(args)`. Example: `"CHARGE $50.00 to invoice #4242"` or `"RESIZE droplet to MEDIUM"`.

3. **Frontend displays the phrase and asks the human to type it.** The phrase is echoed verbatim — no paraphrasing.

4. **Human types the phrase.** The frontend sends `{ verb, args, confirm: true, typed_phrase: "..." }`.

5. **Runtime validates the phrase.** The phrase is bound into an HMAC nonce signature at step 2. If the human's input doesn't match, the dispatch is denied with `reason: "phrase_mismatch"`. Tampering between dispatch and confirm is cryptographically blocked.

6. **Action executes.** Receipt is returned.

### Phrase examples

| Verb | Required phrase |
|---|---|
| `charge_invoice` | `CHARGE $50.00 to invoice #4242` |
| `issue_refund` | `REFUND $50.00 on charge ch_xyz` |
| `infrastructure_resize` | `RESIZE droplet to MEDIUM` |
| `infrastructure_scale_workers` | `SCALE celery workers by +2` |
| `gdpr_delete_contact` | `DELETE CONTACT 4242 PERMANENTLY` |
| `subscription_upgrade_tier` | `UPGRADE to PROFESSIONAL tier immediately` |

## Nonce signing

The confirmation nonce is:
- Generated at preflight time with a short-lived secret (`ADA_DISPATCH_NONCE_SECRET`)
- Embeds a timestamp + HMAC-SHA256 of the dispatch payload
- Expires after 5 minutes (`_NONCE_TTL_SECONDS = 300`)
- Validated at confirm time — replay or tampering fails

## Daily caps

Each verb class has an optional daily rate limit per tenant:

| Cap key | Default | Purpose |
|---|---|---|
| `ada_writes_per_day` | 100 | Bounds reversible write volume |
| `ada_financial_writes_per_day` | 25 | Bounds money-movement volume |
| `ada_irreversible_writes_per_day` | 10 | Bounds destructive action volume |

Caps reset at midnight UTC. Exceeding the cap returns `reason: "daily_cap_exceeded"`.

## Audit on denial

Every dispatch attempt writes an `AIAuditLog` row — including denials. Denied rows record:
- The verb that was attempted
- The role that attempted it
- The reason for denial (`role_denied`, `phrase_mismatch`, `daily_cap_exceeded`, `blocked_verb`)
- The timestamp

Denied attempts are the most important audit rows. They prove the safety layer is working and provide signal for threat detection.

## Cross-transport consent

| Transport | Confirmation UX |
|---|---|
| CLI | `--confirm` flag + `--phrase "..."` option |
| MCP stdio | Not supported — write verbs return `dispatch_pending` envelope; agent must re-call with `confirm: true` |
| WebMCP | Browser dialog with phrase input field |
| UCP | RFC 9421 signed request implies consent (buyer-agent pre-authorized by its principal) |

## BLOCKED verbs

Some verb names are permanently blocked — they can never be called by an AI agent, regardless of role or confirmation:

- `subscription_cancel_immediate` (autonomous mid-cycle cancel with refund)
- `customer_delete` (autonomous customer-row delete)
- `company_delete`
- `employee_terminate`

These exist in the blocklist as defense-in-depth against LLM hallucination of dangerous verb names. The safe alternatives (e.g., `gdpr_delete_contact` with IRREVERSIBLE gate) have different names deliberately.
