type CacheEntry<T> = {
    value: T;
    storedAt: number;
};

export class TtlLruCache<T> {
    private readonly map = new Map<string, CacheEntry<T>>();

    public constructor(
        private readonly capacity: number,
        private readonly ttlMs: number,
        private readonly clock: () => number = () => Date.now(),
    ) {}

    public get(key: string): T | undefined {
        const entry = this.map.get(key);

        if (!entry) {
            return undefined;
        }

        if (this.clock() - entry.storedAt > this.ttlMs) {
            this.map.delete(key);
            return undefined;
        }

        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    public set(key: string, value: T): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        }

        this.map.set(key, { value, storedAt: this.clock() });

        while (this.map.size > this.capacity) {
            const oldest = this.map.keys().next();
            if (oldest.done) {
                break;
            }
            this.map.delete(oldest.value);
        }
    }
}
