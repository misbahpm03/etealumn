import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { checkSupabaseConnectivity } from "@/infrastructure/supabase/health";

/**
 * Development-only Supabase status probe. Returns booleans and latency
 * only — never URLs, keys, or provider internals. Does not exist in
 * production builds (renders the 404 page instead).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const supabase = await checkSupabaseConnectivity();
  return NextResponse.json({ status: "ok", supabase });
}
