import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateVerbRecord, validateEnvelope } from '../index';

describe('validateVerbRecord', () => {
  it('accepts a valid VerbRecord', () => {
    const result = validateVerbRecord({
      name: 'payments.preview_refund_impact',
      description: 'Preview refund impact.',
      shape: 'preview',
      side_effects: 'read',
      input_schema: { type: 'object', properties: { transaction_id: { type: 'integer' } } },
      surfaces: ['http', 'mcp_stdio'],
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects missing name', () => {
    const result = validateVerbRecord({ description: 'x', shape: 'preview', input_schema: {} });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('name')));
  });

  it('rejects invalid shape', () => {
    const result = validateVerbRecord({ name: 'x', description: 'x', shape: 'crud', input_schema: {} });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('shape')));
  });

  it('rejects company_id in input_schema', () => {
    const result = validateVerbRecord({
      name: 'x.y',
      description: 'x',
      shape: 'aggregate',
      input_schema: { type: 'object', properties: { company_id: { type: 'integer' } } },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('company_id')));
  });

  it('rejects invalid surface', () => {
    const result = validateVerbRecord({
      name: 'x.y',
      description: 'x',
      shape: 'aggregate',
      input_schema: {},
      surfaces: ['http', 'graphql'],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('graphql')));
  });

  it('rejects invalid name pattern', () => {
    const result = validateVerbRecord({ name: '123bad', description: 'x', shape: 'aggregate', input_schema: {} });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('name')));
  });
});

describe('validateEnvelope', () => {
  it('accepts a valid success envelope', () => {
    const result = validateEnvelope({ ok: true, verb: 'infrastructure_diagnose', result: { overall: 'healthy' } });
    assert.equal(result.valid, true);
  });

  it('accepts a valid error envelope', () => {
    const result = validateEnvelope({
      ok: false,
      verb: 'infrastructure_diagnose',
      error: { reason: 'no_managed_droplet', message: 'No droplet.' },
    });
    assert.equal(result.valid, true);
  });

  it('rejects missing ok', () => {
    const result = validateEnvelope({ verb: 'x' });
    assert.equal(result.valid, false);
  });

  it('rejects error envelope without error object', () => {
    const result = validateEnvelope({ ok: false, verb: 'x' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('error is required')));
  });
});
