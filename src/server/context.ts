import type { AuthedContext } from "./middleware";

export function authed(context: unknown): AuthedContext {
  return context as AuthedContext;
}
