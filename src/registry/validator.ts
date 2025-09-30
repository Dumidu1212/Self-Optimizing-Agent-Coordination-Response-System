import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { registrySchema, toolSchema, type ToolRegistry, type Tool } from './model';

class Validator {
  private ajv = new Ajv({ allErrors: true, strict: true });
  constructor() {
    addFormats(this.ajv);
    this.ajv.addSchema(registrySchema, 'ToolRegistry');
    this.ajv.addSchema(toolSchema, 'Tool');
  }
  validateRegistry(obj: unknown): { valid: boolean; errors?: string[] } {
    const v = this.ajv.getSchema('ToolRegistry')!;
    const ok = v(obj);
    return ok ? { valid: true } : { valid: false, errors: (v.errors ?? []).map(e => `${e.instancePath} ${e.message}`) };
  }
  validateTool(obj: unknown): { valid: boolean; errors?: string[] } {
    const v = this.ajv.getSchema('Tool')!;
    const ok = v(obj);
    return ok ? { valid: true } : { valid: false, errors: (v.errors ?? []).map(e => `${e.instancePath} ${e.message}`) };
  }
}
export const validator = new Validator();
export type { ToolRegistry, Tool };
