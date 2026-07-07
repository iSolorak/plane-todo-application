/**
 * Fixed-capacity LRU set of recently-seen ids, used to dedupe webhook
 * deliveries by their `X-Plane-Delivery` id. Insertion order is tracked by the
 * underlying Map; the oldest entry is evicted once capacity is exceeded.
 */
export class LruSet {
  private readonly capacity: number;
  private readonly map = new Map<string, true>();

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  /** Record an id. Returns true if it was newly added, false if already seen. */
  add(id: string): boolean {
    if (this.map.has(id)) return false;
    this.map.set(id, true);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    return true;
  }

  get size(): number {
    return this.map.size;
  }
}
