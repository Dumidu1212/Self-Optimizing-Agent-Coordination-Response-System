import { validator } from '../../src/registry/validator';

describe('Tool validator', () => {
  it('accepts a valid tool', () => {
    const tool = { id: 't1', name: 'Tool', version: '1.0.0', capabilities: [{ name: 'cap', inputs: {}, outputs: {} }] };
    expect(validator.validateTool(tool).valid).toBe(true);
  });
  it('rejects invalid tool', () => {
    const bad = { id: 't1', name: 'Tool', version: '1.0.0' };
    const res = validator.validateTool(bad);
    expect(res.valid).toBe(false);
    expect(res.errors?.join(' ')).toMatch(/capabilities/);
  });
});
