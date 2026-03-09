type Handler<TArgs extends unknown[]> = (...args: TArgs) => void;

export class TypedEmitter<TEvents extends Record<string, unknown[]>> {
  private readonly handlers = new Map<keyof TEvents & string, Set<Handler<unknown[]>>>();

  public on<TKey extends keyof TEvents & string>(
    event: TKey,
    handler: Handler<TEvents[TKey]>,
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)?.add(handler as Handler<unknown[]>);
    return () => {
      this.off(event, handler);
    };
  }

  public off<TKey extends keyof TEvents & string>(
    event: TKey,
    handler: Handler<TEvents[TKey]>,
  ): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown[]>);
  }

  protected emit<TKey extends keyof TEvents & string>(event: TKey, ...args: TEvents[TKey]): void {
    this.handlers.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }

  protected clear(): void {
    this.handlers.clear();
  }
}
