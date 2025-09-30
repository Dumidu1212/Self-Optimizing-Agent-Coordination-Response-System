import type { IRegistryLoader } from './fileRegistryLoader.js';
import type { Tool, ToolRegistry } from './validator.js';

export interface IRegistryService { list(): Tool[]; getRegistry(): ToolRegistry; }

export class RegistryService implements IRegistryService {
  constructor(private readonly loader: IRegistryLoader) {}
  list(): Tool[] { return this.loader.getRegistry().tools; }
  getRegistry(): ToolRegistry { return this.loader.getRegistry(); }
}
