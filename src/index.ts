import verbRecordSchema from '../schema/verb-record.json';
import envelopeSchema from '../schema/envelope.json';

export const VALID_SHAPES = [
  'aggregate', 'explain', 'preview', 'suggest',
  'transaction', 'receipt', 'revert', 'subscribe',
  'discovery', 'trail', 'reputation', 'macro', 'telemetry',
] as const;

export type Shape = (typeof VALID_SHAPES)[number];

export const VALID_SIDE_EFFECTS = ['read', 'write', 'mixed'] as const;
export type SideEffect = (typeof VALID_SIDE_EFFECTS)[number];

export const VALID_SURFACES = ['http', 'mcp_stdio', 'webmcp', 'ucp', 'cli'] as const;
export type Surface = (typeof VALID_SURFACES)[number];

export const VERB_CLASSES = ['READ', 'WRITE_REVERSIBLE', 'WRITE_FINANCIAL', 'IRREVERSIBLE', 'BLOCKED'] as const;
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

export function validateVerbRecord(record: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof record !== 'object' || record === null) {
    return { valid: false, errors: ['VerbRecord must be an object'] };
  }

  const r = record as Record<string, unknown>;

  if (typeof r.name !== 'string' || !r.name) {
    errors.push('name is required and must be a non-empty string');
  } else if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(r.name)) {
    errors.push(`name "${r.name}" must match ^[a-zA-Z][a-zA-Z0-9_.]*$`);
  }

  if (typeof r.description !== 'string' || !r.description) {
    errors.push('description is required and must be a non-empty string');
  }

  if (!VALID_SHAPES.includes(r.shape as Shape)) {
    errors.push(`shape "${r.shape}" must be one of: ${VALID_SHAPES.join(', ')}`);
  }

  if (r.side_effects !== undefined && !VALID_SIDE_EFFECTS.includes(r.side_effects as SideEffect)) {
    errors.push(`side_effects "${r.side_effects}" must be one of: ${VALID_SIDE_EFFECTS.join(', ')}`);
  }

  if (typeof r.input_schema !== 'object' || r.input_schema === null) {
    errors.push('input_schema is required and must be an object');
  } else {
    const props = (r.input_schema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
    if (props && ('company_id' in props || 'user_id' in props)) {
      errors.push('input_schema MUST NOT include company_id or user_id — these are injected by the runtime');
    }
  }

  if (r.surfaces !== undefined) {
    if (!Array.isArray(r.surfaces)) {
      errors.push('surfaces must be an array');
    } else {
      for (const s of r.surfaces) {
        if (!VALID_SURFACES.includes(s as Surface)) {
          errors.push(`surface "${s}" must be one of: ${VALID_SURFACES.join(', ')}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEnvelope(envelope: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof envelope !== 'object' || envelope === null) {
    return { valid: false, errors: ['Envelope must be an object'] };
  }

  const e = envelope as Record<string, unknown>;

  if (typeof e.ok !== 'boolean') {
    errors.push('ok is required and must be a boolean');
  }
  if (typeof e.verb !== 'string') {
    errors.push('verb is required and must be a string');
  }

  if (e.ok === false && !e.error) {
    errors.push('error is required when ok is false');
  }

  if (e.error) {
    const err = e.error as Record<string, unknown>;
    if (typeof err.reason !== 'string') errors.push('error.reason must be a string');
    if (typeof err.message !== 'string') errors.push('error.message must be a string');
  }

  return { valid: errors.length === 0, errors };
}

export { verbRecordSchema, envelopeSchema };
