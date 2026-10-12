import { HttpError } from "./errors";
import type { SessionUser } from "./session";

export function requireOwner(user: SessionUser): void {
  if (user.role !== "owner") throw new HttpError("Only the owner can do this", 403);
}
