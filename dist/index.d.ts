import verbRecordSchema from '../schema/verb-record.json';
import envelopeSchema from '../schema/envelope.json';
export declare const VALID_SHAPES: readonly ["aggregate", "explain", "preview", "suggest", "transaction", "receipt", "revert", "subscribe", "discovery", "trail", "reputation", "macro", "telemetry"];
export type Shape = (typeof VALID_SHAPES)[number];
export declare const VALID_SIDE_EFFECTS: readonly ["read", "write", "mixed"];
export type SideEffect = (typeof VALID_SIDE_EFFECTS)[number];
export declare const VALID_SURFACES: readonly ["http", "mcp_stdio", "webmcp", "ucp", "cli"];
export type Surface = (typeof VALID_SURFACES)[number];
export declare const VERB_CLASSES: readonly ["READ", "WRITE_REVERSIBLE", "WRITE_FINANCIAL", "IRREVERSIBLE", "BLOCKED"];
export type VerbClass = (typeof VERB_CLASSES)[number];
export interface VerbRecord {
    name: string;
    description: string;
    shape: Shape;
    side_effects?: SideEffect;
    input_schema: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
    surfaces?: Surface[];
    requires_consent?: boolean;
    tier_floor?: string;
}
export interface VerbEnvelope {
    ok: boolean;
    verb: string;
    result?: Record<string, unknown>;
    error?: {
        reason: string;
        message: string;
        hint?: string;
    };
    audit_id?: number;
    idempotency_key?: string;
    rollback_handle?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare function validateVerbRecord(record: unknown): ValidationResult;
export declare function validateEnvelope(envelope: unknown): ValidationResult;
export { verbRecordSchema, envelopeSchema };
