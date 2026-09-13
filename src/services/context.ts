import { ServiceNotConfiguredError } from "@/lib/errors";
import type { AuthProvider, StorageProvider } from "@/providers";
import type {
  DocumentRepository,
  ProfileRepository,
  UserRepository,
} from "@/repositories";

/**
 * Composition root for the application layer.
 *
 * Server actions, route handlers, and services resolve providers through
 * `getServiceContext()` instead of importing provider SDKs. The concrete
 * implementations are registered once per runtime in later phases
 * (e.g. `src/infrastructure/supabase/*` during Phase 3/4 wiring).
 */
export interface ServiceContext {
  auth: AuthProvider;
  storage: StorageProvider;
  users: UserRepository;
  profiles: ProfileRepository;
  documents: DocumentRepository;
}

let context: ServiceContext | null = null;

/** Register the active providers. Called once during server startup wiring. */
export function setServiceContext(next: ServiceContext): void {
  context = next;
}

export function getServiceContext(): ServiceContext {
  if (!context) {
    throw new ServiceNotConfiguredError("ServiceContext");
  }
  return context;
}

/** Test-only escape hatch to swap or clear the registered context. */
export function resetServiceContext(): void {
  context = null;
}
