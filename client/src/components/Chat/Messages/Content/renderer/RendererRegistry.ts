import type { ComponentType } from 'react';

export interface RendererMatchResult {
  matched: boolean;
  priority?: number;
}

export interface BaseRenderer<TProps, TMatchInput> {
  id: string;
  name: string;
  match: (input: TMatchInput) => RendererMatchResult;
  render: ComponentType<TProps>;
  priority?: number;
}

export class RendererRegistry<TProps, TMatchInput> {
  private renderers: Map<string, BaseRenderer<TProps, TMatchInput>> = new Map();
  private sortedCache: BaseRenderer<TProps, TMatchInput>[] | null = null;

  register(renderer: BaseRenderer<TProps, TMatchInput>): void {
    if (this.renderers.has(renderer.id)) {
      console.warn(`Renderer with id "${renderer.id}" already registered. Overwriting.`);
    }
    this.renderers.set(renderer.id, renderer);
    this.sortedCache = null;
  }

  registerMany(renderers: BaseRenderer<TProps, TMatchInput>[]): void {
    renderers.forEach((r) => this.register(r));
  }

  unregister(id: string): boolean {
    const result = this.renderers.delete(id);
    if (result) {
      this.sortedCache = null;
    }
    return result;
  }

  get(id: string): BaseRenderer<TProps, TMatchInput> | undefined {
    return this.renderers.get(id);
  }

  getAll(): BaseRenderer<TProps, TMatchInput>[] {
    if (!this.sortedCache) {
      this.sortedCache = Array.from(this.renderers.values()).sort((a, b) => {
        const priorityA = a.priority ?? 0;
        const priorityB = b.priority ?? 0;
        return priorityB - priorityA;
      });
    }
    return this.sortedCache;
  }

  match(input: TMatchInput): BaseRenderer<TProps, TMatchInput> | null {
    const renderers = this.getAll();
    let bestMatch: BaseRenderer<TProps, TMatchInput> | null = null;
    let bestPriority = -Infinity;

    for (const renderer of renderers) {
      const result = renderer.match(input);
      if (result.matched) {
        const priority = result.priority ?? renderer.priority ?? 0;
        if (priority > bestPriority) {
          bestMatch = renderer;
          bestPriority = priority;
        }
      }
    }

    return bestMatch;
  }

  matchAll(input: TMatchInput): BaseRenderer<TProps, TMatchInput>[] {
    const renderers = this.getAll();
    const matches: Array<{ renderer: BaseRenderer<TProps, TMatchInput>; priority: number }> = [];

    for (const renderer of renderers) {
      const result = renderer.match(input);
      if (result.matched) {
        const priority = result.priority ?? renderer.priority ?? 0;
        matches.push({ renderer, priority });
      }
    }

    matches.sort((a, b) => b.priority - a.priority);
    return matches.map((m) => m.renderer);
  }

  clear(): void {
    this.renderers.clear();
    this.sortedCache = null;
  }

  get size(): number {
    return this.renderers.size;
  }
}
