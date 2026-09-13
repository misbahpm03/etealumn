import type { IsoDateString } from "./common";
import type { SessionUser } from "./user";

/** Provider-agnostic authenticated session. */
export interface AuthSession {
  user: SessionUser;
  expiresAt: IsoDateString;
}

export interface SignInCredentials {
  email: string;
  password: string;
}
