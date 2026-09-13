import { NextResponse } from "next/server";
import {
  createAcademicDocumentService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors";
import { validateRecordId } from "@/validations/profile";

/**
 * Controlled document delivery (Phase 9).
 *
 * The `academic-archive` bucket stays PRIVATE. This endpoint runs the
 * full download tree (live row → readability → download rule → global
 * `allow_download` switch → version ownership) and 302-redirects to a
 * short-lived signed URL (5 minutes). Responses are never cached.
 *
 * Status mapping is oracle-free: malformed ids and unreadable documents
 * read as bare 404s; readable-but-not-downloadable documents read as
 * 403 (the caller already knows they exist via the detail page, so the
 * 403 leaks nothing new); signed-out callers get 401.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (validateRecordId(id).length > 0) {
    return new NextResponse(null, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const versionParam = searchParams.get("version");
  let version: number | null = null;
  if (versionParam !== null) {
    if (!/^\d+$/.test(versionParam)) {
      return new NextResponse(null, { status: 404 });
    }
    version = Number(versionParam);
  }
  try {
    const appUser = await requireActiveUser();
    const service = await createAcademicDocumentService(appUser);
    const access = await service.getDownloadAccess(id, version);
    const response = NextResponse.redirect(access.url, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "Sign in to download documents." },
        { status: 401 },
      );
    }
    if (error instanceof NotFoundError) {
      return new NextResponse(null, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[archive] download endpoint failed", error);
    return NextResponse.json(
      { error: "Could not prepare the download. Please try again." },
      { status: 500 },
    );
  }
}
