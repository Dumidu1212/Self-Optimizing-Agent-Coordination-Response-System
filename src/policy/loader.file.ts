import fs from 'node:fs/promises';  // Promise-based filesystem API from Node.js
import path from 'node:path';       // Utilities for working with file and directory paths
import YAML from 'yaml';            // YAML parser/stringifier
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats'; // Adds format validators (e.g., email, uri) to Ajv
import policySchema from './schema.json'; // JSON Schema defining the structure of the policy document
import type { PolicyDoc } from './model'; // TypeScript type for a validated policy document

/**
 * Loads and validates a policy file (YAML or JSON) from disk.
 * - Reads the file from POLICY_PATH or a default location.
 * - Parses YAML/JSON.
 * - Validates against the JSON schema using Ajv.
 */
export class FilePolicyLoader {
  constructor(
    /**
     * Path to the policy file.
     * - Can be overridden via the POLICY_PATH environment variable.
     * - Defaults to: <project-root>/policy/policy.yaml
     */
    private readonly policyPath = process.env.POLICY_PATH
      ?? path.join(process.cwd(), 'policy', 'policy.yaml'),
  ) {}

  /**
   * Public API: load and return a validated PolicyDoc.
   * @returns A Promise that resolves with a validated PolicyDoc.
   */
  async load(): Promise<PolicyDoc> {
    // Read the raw file contents as UTF-8 text
    const raw = await fs.readFile(this.policyPath, 'utf8');

    // Extract the file extension (.yaml, .yml, .json, etc.)
    const ext = path.extname(this.policyPath).toLowerCase();

    // Parse the raw content based on file extension / best-effort strategy
    const parsed = this.parse(raw, ext);

    // Validate the parsed object against the JSON schema
    this.validate(parsed);

    // At this point, we trust the structure to match PolicyDoc
    return parsed as PolicyDoc;
  }

  /**
   * Parse the policy content based on file extension.
   * - Prefers YAML parser for .yaml/.yml.
   * - Uses JSON.parse for .json.
   * - For unknown extensions, tries YAML first, then falls back to JSON.
   *
   * @param content Raw file content as a string.
   * @param ext File extension (e.g., ".yaml", ".json").
   * @returns Parsed JavaScript object (unknown until validation).
   */
  private parse(content: string, ext: string): unknown {
    // Explicit YAML extensions
    if (ext === '.yaml' || ext === '.yml') return YAML.parse(content);

    // Explicit JSON extension
    if (ext === '.json') return JSON.parse(content);

    // For other extensions, try YAML first…
    try {
      return YAML.parse(content);
    } catch {
      // …if YAML fails, fall back to JSON
      return JSON.parse(content);
    }
  }

  /**
   * Validate the parsed document against the policy JSON schema.
   * - Uses Ajv with strict mode and allErrors enabled.
   * - Throws an Error if validation fails, including detailed error messages.
   *
   * @param doc Parsed document to validate.
   */
  private validate(doc: unknown): void {
    // Create a new Ajv instance in strict mode with allErrors to collect all issues
    const ajv = new Ajv2020({ allErrors: true, strict: false });

    // Add standard format validators (e.g., "email", "uri") to Ajv
    addFormats(ajv);

    // Compile the schema into a validation function
    const validate = ajv.compile(policySchema);

    // Run validation
    const ok = validate(doc);

    // If validation failed, stringify the errors and throw a descriptive error
    if (!ok) {
      const err = JSON.stringify(validate.errors ?? [], null, 2);
      throw new Error(`Invalid policy: ${err}`);
    }
  }
}
