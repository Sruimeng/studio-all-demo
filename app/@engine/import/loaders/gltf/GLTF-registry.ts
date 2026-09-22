/**
 * Registry for caching objects that are shared across the loader.
 */
export class GLTFRegistry {
  private objects: Map<string, unknown | Promise<unknown>>;

  constructor() {
    this.objects = new Map();
  }

  get<T>(key: string): T {
    return this.objects.get(key) as T;
  }

  add<T>(key: string, object: T): void {
    this.objects.set(key, object);
  }

  remove(key: string): void {
    this.objects.delete(key);
  }

  removeAll(): void {
    this.objects.clear();
  }
}
