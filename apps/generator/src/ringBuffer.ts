/** Fixed-capacity FIFO for reconnect replay. */
export class RingBuffer<T> {
  private readonly items: T[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.shift();
    }
  }

  snapshot(): T[] {
    return this.items.slice();
  }

  get size(): number {
    return this.items.length;
  }
}
