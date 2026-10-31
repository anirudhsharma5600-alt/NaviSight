type EventHandler = (data: unknown) => void

const handlersByName = new Map<string, Set<EventHandler>>()

export function emit<TData = unknown>(name: string, data: TData): void {
  const handlers = handlersByName.get(name)
  if (!handlers) return

  for (const handler of Array.from(handlers)) {
    try {
      handler(data)
    } catch {
      // A listener failure must not interrupt other listeners or its caller.
    }
  }
}

export function on<TData = unknown>(name: string, handler: (data: TData) => void): () => void {
  const handlers = handlersByName.get(name) ?? new Set<EventHandler>()
  handlersByName.set(name, handlers)

  const wrappedHandler: EventHandler = (data) => handler(data as TData)
  handlers.add(wrappedHandler)

  return () => {
    handlers.delete(wrappedHandler)
    if (handlers.size === 0 && handlersByName.get(name) === handlers) handlersByName.delete(name)
  }
}
