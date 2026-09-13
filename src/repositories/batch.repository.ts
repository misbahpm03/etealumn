import type { Batch, Uuid } from "@/types";

/**
 * Read-only persistence contract for batches. Batches are publicly readable
 * reference data; creation/editing stays administrative (no write methods
 * exist here by design).
 */
export interface BatchRepository {
  findById(id: Uuid): Promise<Batch | null>;
  listAll(): Promise<ReadonlyArray<Batch>>;
}
