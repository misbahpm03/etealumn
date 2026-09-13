import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchRepository } from "@/repositories/batch.repository";
import type { Batch, Uuid } from "@/types";
import { unwrapQuery } from "./errors";

const COLUMNS =
  "id,name,batch_number,admission_year,graduation_year,description,cover_image_path,status" as const;

interface Row {
  id: string;
  name: string;
  batch_number: number | null;
  admission_year: number | null;
  graduation_year: number | null;
  description: string | null;
  cover_image_path: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

function toEntity(row: Row): Batch {
  return {
    id: row.id,
    name: row.name,
    batchNumber: row.batch_number,
    admissionYear: row.admission_year,
    graduationYear: row.graduation_year,
    description: row.description,
    coverImagePath: row.cover_image_path,
    status: row.status,
  };
}

/** Read-only batch access (public reference data). No write methods exist. */
export class SupabaseBatchRepository implements BatchRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: Uuid): Promise<Batch | null> {
    const row = (await unwrapQuery(
      this.client.from("batches").select(COLUMNS).eq("id", id).maybeSingle(),
    )) as Row | null;
    return row ? toEntity(row) : null;
  }

  async listAll(): Promise<ReadonlyArray<Batch>> {
    const rows = (await unwrapQuery(
      this.client
        .from("batches")
        .select(COLUMNS)
        .order("admission_year", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true }),
    )) as Row[];
    return rows.map(toEntity);
  }
}
