import {
  createContext,
  type MiddlewareFunction,
  type RouterContext,
  RouterContextProvider,
  type Session,
  type SessionStorage,
} from 'react-router';

type SessionContextReader = {
  get<T>(context: RouterContext<T>): T;
};

export interface RequestSession {
  readonly id: string;
  destroy(): void;
  flash(name: string, value: unknown): void;
  get<Value = unknown>(name: string): Value | undefined;
  has(name: string): boolean;
  set(name: string, value: unknown): void;
  unset(name: string): void;
}

const sessionStorageContext = createContext<SessionStorage>();
const requestSessionContext = createContext<RequestSession>();

class TrackedRequestSession implements RequestSession {
  readonly #session: Session;
  #state: 'clean' | 'dirty' | 'destroyed' = 'clean';

  constructor(session: Session) {
    this.#session = session;
  }

  get id(): string {
    return this.#session.id;
  }

  destroy(): void {
    this.#state = 'destroyed';
  }

  flash(name: string, value: unknown): void {
    this.#assertActive();
    this.#session.flash(name, value);
    this.#state = 'dirty';
  }

  get<Value = unknown>(name: string): Value | undefined {
    this.#assertActive();
    const keyCount = Object.keys(this.#session.data).length;
    const value = this.#session.get(name) as Value | undefined;

    if (Object.keys(this.#session.data).length !== keyCount) {
      this.#state = 'dirty';
    }

    return value;
  }

  has(name: string): boolean {
    this.#assertActive();
    return this.#session.has(name);
  }

  set(name: string, value: unknown): void {
    this.#assertActive();
    this.#session.set(name, value);
    this.#state = 'dirty';
  }

  unset(name: string): void {
    this.#assertActive();
    this.#session.unset(name);
    this.#state = 'dirty';
  }

  async createSetCookieHeader(storage: SessionStorage): Promise<string | undefined> {
    if (this.#state === 'clean') {
      return undefined;
    }

    if (this.#state === 'destroyed') {
      return storage.destroySession(this.#session);
    }

    return storage.commitSession(this.#session);
  }

  #assertActive(): void {
    if (this.#state === 'destroyed') {
      throw new Error('The session has already been destroyed');
    }
  }
}

export const sessionMiddleware: MiddlewareFunction<Response> = async (
  { context, request },
  next,
) => {
  const storage = context.get(sessionStorageContext);
  const session = new TrackedRequestSession(
    await storage.getSession(request.headers.get('Cookie')),
  );

  context.set(requestSessionContext, session);

  const response = await next();
  const setCookie = await session.createSetCookieHeader(storage);

  if (setCookie !== undefined) {
    response.headers.append('Set-Cookie', setCookie);
  }

  return response;
};

export function getSession(context: SessionContextReader): RequestSession {
  return context.get(requestSessionContext);
}

export function createSessionContext(storage: SessionStorage): RouterContextProvider {
  const context = new RouterContextProvider();
  context.set(sessionStorageContext, storage);
  return context;
}
