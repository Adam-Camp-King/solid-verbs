"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envelopeSchema = exports.verbRecordSchema = exports.VERB_CLASSES = exports.VALID_SURFACES = exports.VALID_SIDE_EFFECTS = exports.VALID_SHAPES = void 0;
exports.validateVerbRecord = validateVerbRecord;
exports.validateEnvelope = validateEnvelope;
const verb_record_json_1 = __importDefault(require("../schema/verb-record.json"));
exports.verbRecordSchema = verb_record_json_1.default;
const envelope_json_1 = __importDefault(require("../schema/envelope.json"));
exports.envelopeSchema = envelope_json_1.default;
exports.VALID_SHAPES = [
    'aggregate', 'explain', 'preview', 'suggest',
    'transaction', 'receipt', 'revert', 'subscribe',
    'discovery', 'trail', 'reputation', 'macro', 'telemetry',
];
exports.VALID_SIDE_EFFECTS = ['read', 'write', 'mixed'];
exports.VALID_SURFACES = ['http', 'mcp_stdio', 'webmcp', 'ucp', 'cli'];
exports.VERB_CLASSES = ['READ', 'WRITE_REVERSIBLE', 'WRITE_FINANCIAL', 'IRREVERSIBLE', 'BLOCKED'];
function validateVerbRecord(record) {
    const errors = [];
    if (typeof record !== 'object' || record === null) {
        return { valid: false, errors: ['VerbRecord must be an object'] };
    }
    const r = record;
    if (typeof r.name !== 'string' || !r.name) {
        errors.push('name is required and must be a non-empty string');
    }
    else if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(r.name)) {
        errors.push(`name "${r.name}" must match ^[a-zA-Z][a-zA-Z0-9_.]*$`);
    }
    if (typeof r.description !== 'string' || !r.description) {
        errors.push('description is required and must be a non-empty string');
    }
    if (!exports.VALID_SHAPES.includes(r.shape)) {
        errors.push(`shape "${r.shape}" must be one of: ${exports.VALID_SHAPES.join(', ')}`);
    }
    if (r.side_effects !== undefined && !exports.VALID_SIDE_EFFECTS.includes(r.side_effects)) {
        errors.push(`side_effects "${r.side_effects}" must be one of: ${exports.VALID_SIDE_EFFECTS.join(', ')}`);
    }
    if (typeof r.input_schema !== 'object' || r.input_schema === null) {
        errors.push('input_schema is required and must be an object');
    }
    else {
        const props = r.input_schema.properties;
        if (props && ('company_id' in props || 'user_id' in props)) {
            errors.push('input_schema MUST NOT include company_id or user_id — these are injected by the runtime');
        }
    }
    if (r.surfaces !== undefined) {
        if (!Array.isArray(r.surfaces)) {
            errors.push('surfaces must be an array');
        }
        else {
            for (const s of r.surfaces) {
                if (!exports.VALID_SURFACES.includes(s)) {
                    errors.push(`surface "${s}" must be one of: ${exports.VALID_SURFACES.join(', ')}`);
                }
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
function validateEnvelope(envelope) {
    const errors = [];
    if (typeof envelope !== 'object' || envelope === null) {
        return { valid: false, errors: ['Envelope must be an object'] };
    }
    const e = envelope;
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
        const err = e.error;
        if (typeof err.reason !== 'string')
            errors.push('error.reason must be a string');
        if (typeof err.message !== 'string')
            errors.push('error.message must be a string');
    }
    return { valid: errors.length === 0, errors };
}
