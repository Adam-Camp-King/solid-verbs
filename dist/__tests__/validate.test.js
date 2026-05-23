"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.describe)('validateVerbRecord', () => {
    (0, node_test_1.it)('accepts a valid VerbRecord', () => {
        const result = (0, index_1.validateVerbRecord)({
            name: 'payments.preview_refund_impact',
            description: 'Preview refund impact.',
            shape: 'preview',
            side_effects: 'read',
            input_schema: { type: 'object', properties: { transaction_id: { type: 'integer' } } },
            surfaces: ['http', 'mcp_stdio'],
        });
        strict_1.default.equal(result.valid, true);
        strict_1.default.equal(result.errors.length, 0);
    });
    (0, node_test_1.it)('rejects missing name', () => {
        const result = (0, index_1.validateVerbRecord)({ description: 'x', shape: 'preview', input_schema: {} });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('name')));
    });
    (0, node_test_1.it)('rejects invalid shape', () => {
        const result = (0, index_1.validateVerbRecord)({ name: 'x', description: 'x', shape: 'crud', input_schema: {} });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('shape')));
    });
    (0, node_test_1.it)('rejects company_id in input_schema', () => {
        const result = (0, index_1.validateVerbRecord)({
            name: 'x.y',
            description: 'x',
            shape: 'aggregate',
            input_schema: { type: 'object', properties: { company_id: { type: 'integer' } } },
        });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('company_id')));
    });
    (0, node_test_1.it)('rejects invalid surface', () => {
        const result = (0, index_1.validateVerbRecord)({
            name: 'x.y',
            description: 'x',
            shape: 'aggregate',
            input_schema: {},
            surfaces: ['http', 'graphql'],
        });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('graphql')));
    });
    (0, node_test_1.it)('rejects invalid name pattern', () => {
        const result = (0, index_1.validateVerbRecord)({ name: '123bad', description: 'x', shape: 'aggregate', input_schema: {} });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('name')));
    });
});
(0, node_test_1.describe)('validateEnvelope', () => {
    (0, node_test_1.it)('accepts a valid success envelope', () => {
        const result = (0, index_1.validateEnvelope)({ ok: true, verb: 'infrastructure_diagnose', result: { overall: 'healthy' } });
        strict_1.default.equal(result.valid, true);
    });
    (0, node_test_1.it)('accepts a valid error envelope', () => {
        const result = (0, index_1.validateEnvelope)({
            ok: false,
            verb: 'infrastructure_diagnose',
            error: { reason: 'no_managed_droplet', message: 'No droplet.' },
        });
        strict_1.default.equal(result.valid, true);
    });
    (0, node_test_1.it)('rejects missing ok', () => {
        const result = (0, index_1.validateEnvelope)({ verb: 'x' });
        strict_1.default.equal(result.valid, false);
    });
    (0, node_test_1.it)('rejects error envelope without error object', () => {
        const result = (0, index_1.validateEnvelope)({ ok: false, verb: 'x' });
        strict_1.default.equal(result.valid, false);
        strict_1.default.ok(result.errors.some((e) => e.includes('error is required')));
    });
});
