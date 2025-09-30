export type Capability = {
  name: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
};

export type SLATarget = { p95_ms: number; success_rate_min: number };
export type Preconditions = { requiresNetwork?: boolean; requiresVpn?: boolean; env?: Record<string,string> };

export type Tool = {
  id: string;
  name: string;
  version: string;
  description?: string;
  capabilities: Capability[];
  cost_estimate?: number;
  sla?: SLATarget;
  preconditions?: Preconditions;
  endpoint?: { type: 'http' | 'rpa'; url?: string; script?: string; timeout_ms?: number };
};

export type ToolRegistry = { tools: Tool[]; updatedAt: string };

export const toolSchema = {
  type: 'object',
  required: ['id', 'name', 'version', 'capabilities'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    capabilities: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', required: ['name','inputs','outputs'],
        properties: {
          name: { type: 'string', minLength: 1 },
          inputs: { type: 'object', additionalProperties: { type: 'string' } },
          outputs:{ type: 'object', additionalProperties: { type: 'string' } }
        },
        additionalProperties: false
      }
    },
    cost_estimate: { type: 'number', minimum: 0 },
    sla: {
      type: 'object', required: ['p95_ms','success_rate_min'],
      properties: {
        p95_ms: { type: 'integer', minimum: 1 },
        success_rate_min: { type: 'number', minimum: 0, maximum: 1 }
      }, additionalProperties: false
    },
    preconditions: {
      type: 'object',
      properties: {
        requiresNetwork: { type: 'boolean' },
        requiresVpn: { type: 'boolean' },
        env: { type: 'object', additionalProperties: { type: 'string' } }
      }, additionalProperties: false
    },
    endpoint: {
      type: 'object',
      properties: {
        type: { enum: ['http','rpa'] },
        url: { type: 'string' },
        script: { type: 'string' },
        timeout_ms: { type: 'integer', minimum: 1 }
      }, additionalProperties: false
    }
  },
  additionalProperties: false
} as const;

export const registrySchema = {
  type: 'object',
  required: ['tools','updatedAt'],
  properties: {
    tools: { type: 'array', items: toolSchema },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: false
} as const;
