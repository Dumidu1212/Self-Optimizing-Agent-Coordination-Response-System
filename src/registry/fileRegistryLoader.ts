import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import yaml from 'yaml';
import { validator, type ToolRegistry } from './validator';
import type { Tool } from './model'; // or from './validator' if you re-export Tool there

export interface IRegistryLoader {
  getRegistry(): ToolRegistry;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class FileRegistryLoader implements IRegistryLoader {
  private current: ToolRegistry = { tools: [], updatedAt: new Date(0).toISOString() };
  private watcher?: FSWatcher;

  constructor(private readonly registryDir: string) {}

  getRegistry(): ToolRegistry {
    return this.current;
  }

  async start(): Promise<void> {
    await this.loadAll();
    this.watcher = chokidar.watch(this.registryDir, { persistent: true, ignoreInitial: true });
    this.watcher.on('add', () => this.loadAll());
    this.watcher.on('change', () => this.loadAll());
    this.watcher.on('unlink', () => this.loadAll());
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }

  private async loadAll(): Promise<void> {
    const files = await fs.readdir(this.registryDir).catch(() => []);
    const tools: Tool[] = [];
    for (const f of files) {
      if (!/\.(ya?ml|json)$/.test(f)) continue;
      const txt = await fs.readFile(path.join(this.registryDir, f), 'utf-8');
      const obj = f.endsWith('.json') ? JSON.parse(txt) : yaml.parse(txt);
      if (obj?.tools && obj?.updatedAt) {
        const vr = validator.validateRegistry(obj);
        if (!vr.valid) throw new Error(`Invalid registry file ${f}: ${vr.errors?.join('; ')}`);
        tools.push(...(obj.tools as Tool[]));
      } else {
        const vt = validator.validateTool(obj);
        if (!vt.valid) throw new Error(`Invalid tool file ${f}: ${vt.errors?.join('; ')}`);
        tools.push(obj as Tool);
      }
    }
    this.current = { tools, updatedAt: new Date().toISOString() };
  }
}
