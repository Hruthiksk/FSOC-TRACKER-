export class RingBuffer<T> {
  private buffer: (T | null)[];
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 2000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getSnapshot(): T[] {
    const result: T[] = [];
    if (this.count === 0) return result;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== null) {
        result.push(item);
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer.fill(null);
  }

  size(): number {
    return this.count;
  }
}
