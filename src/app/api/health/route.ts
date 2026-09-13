import { NextResponse } from "next/server";

/**
 * Liveness probe for deployment checks and load balancers.
 * Dependency checks (database, storage) arrive with provider wiring.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "etealumn",
    timestamp: new Date().toISOString(),
  });
}
