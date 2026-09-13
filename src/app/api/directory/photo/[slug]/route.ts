import { NextResponse } from "next/server";
import { createPublicDirectoryService } from "@/infrastructure/supabase/server-session";

/**
 * Controlled profile-photo delivery (Phase 8 §14).
 *
 * The `profile-media` bucket stays PRIVATE. This endpoint verifies public
 * eligibility via the safe view and 302-redirects to a short-lived signed
 * URL (5 minutes). Responses are never cached: flipping a profile private
 * must stop photo delivery immediately. Slugs that are malformed, hidden,
 * or photoless all read as bare 404s (no oracle, no error details).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const directory = await createPublicDirectoryService();
    const access = await directory.getProfilePhotoAccess(slug);
    if (!access) {
      return new NextResponse(null, { status: 404 });
    }
    const response = NextResponse.redirect(access.url, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.warn("[directory] photo endpoint failed", error);
    return new NextResponse(null, { status: 404 });
  }
}
