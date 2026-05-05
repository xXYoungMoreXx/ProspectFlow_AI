/**
 * Result<T, E> — Either monad for error handling without exceptions.
 * Domain layer NEVER throws exceptions. All failures are expressed as Result.
 */

export type Result<T, E = Error> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly _tag = 'Ok' as const;
  constructor(readonly value: T) {}

  isOk(): this is Ok<T> { return true; }
  isErr(): this is never { return false; }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  flatMap<U, E2>(fn: (value: T) => Result<U, E2>): Result<U, E2> {
    return fn(this.value);
  }

  unwrap(): T { return this.value; }
  unwrapOr(_fallback: T): T { return this.value; }
}

export class Err<E> {
  readonly _tag = 'Err' as const;
  constructor(readonly error: E) {}

  isOk(): this is never { return false; }
  isErr(): this is Err<E> { return true; }

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  flatMap<U, E2>(_fn: (value: never) => Result<U, E2>): Result<never, E | E2> {
    return this as unknown as Result<never, E | E2>;
  }

  unwrap(): never { throw this.error; }
  unwrapOr<T>(fallback: T): T { return fallback; }
}

export function ok<T>(value: T): Ok<T> { return new Ok(value); }
export function err<E>(error: E): Err<E> { return new Err(error); }

// Domain-specific error types
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, readonly field?: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id '${id}' not found`);
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends DomainError {
  constructor() {
    super('AUTHENTICATION_ERROR', 'Credenciais inválidas');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'Acesso não autorizado') {
    super('AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class InsufficientBudgetError extends DomainError {
  constructor(message = 'Token budget exceeded') {
    super('INSUFFICIENT_BUDGET', message);
    this.name = 'InsufficientBudgetError';
  }
}
