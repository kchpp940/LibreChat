export class RendererRegistry {
    renderers = new Map();
    sortedCache = null;
    register(renderer) {
        if (this.renderers.has(renderer.id)) {
            console.warn(`Renderer with id "${renderer.id}" already registered. Overwriting.`);
        }
        this.renderers.set(renderer.id, renderer);
        this.sortedCache = null;
    }
    registerMany(renderers) {
        renderers.forEach((r) => this.register(r));
    }
    unregister(id) {
        const result = this.renderers.delete(id);
        if (result) {
            this.sortedCache = null;
        }
        return result;
    }
    get(id) {
        return this.renderers.get(id);
    }
    getAll() {
        if (!this.sortedCache) {
            this.sortedCache = Array.from(this.renderers.values()).sort((a, b) => {
                const priorityA = a.priority ?? 0;
                const priorityB = b.priority ?? 0;
                return priorityB - priorityA;
            });
        }
        return this.sortedCache;
    }
    match(input) {
        const renderers = this.getAll();
        let bestMatch = null;
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
    matchAll(input) {
        const renderers = this.getAll();
        const matches = [];
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
    clear() {
        this.renderers.clear();
        this.sortedCache = null;
    }
    get size() {
        return this.renderers.size;
    }
}
