class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  get length(): number {
    return this.data.size;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const storage = new MemoryStorage();
  for (const [key, value] of Object.entries(initial)) {
    storage.setItem(key, value);
  }
  return storage;
}
