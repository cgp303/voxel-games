type Handler<T = unknown> = (payload: T) => void;

/**
 * Simple typed pub/sub for screen/UI/game decoupling.
 * Phase 0 stub — expand event map as features land.
 */
export class EventBus {
    private handlers = new Map<string, Set<Handler>>();

    public on<T = unknown>(event: string, handler: Handler<T>): () => void {
        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }
        set.add(handler as Handler);
        return () => this.off(event, handler);
    }

    public off<T = unknown>(event: string, handler: Handler<T>): void {
        this.handlers.get(event)?.delete(handler as Handler);
    }

    public emit<T = unknown>(event: string, payload?: T): void {
        const set = this.handlers.get(event);
        if (!set) return;
        for (const handler of set) {
            handler(payload as T);
        }
    }

    public clear(): void {
        this.handlers.clear();
    }
}
