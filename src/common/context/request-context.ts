import { AsyncLocalStorage } from 'async_hooks';

// Captures per-request metadata (client IP + raw User-Agent) so it can be
// read from deep inside a service call — e.g. ActivityService.log(), which
// is called by TasksService/CommentsService without ever seeing the
// Express Request itself. Populated once per request by
// RequestContextMiddleware; everything downstream just reads it.
export interface RequestContextStore {
  ip: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export const requestContext = {
  run<T>(store: RequestContextStore, callback: () => T): T {
    return storage.run(store, callback);
  },
  get(): RequestContextStore {
    return storage.getStore() ?? { ip: null, userAgent: null };
  },
};
