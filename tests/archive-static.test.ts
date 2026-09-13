/**
 * Static regression tripwires (Phase 10 §23): source-level invariants
 * that must hold across refactors — DTO shapes, the public projection,
 * the lifecycle trigger, and the server-action/user-resolution pattern.
 * Each failure message names the file and rule so the fix is obvious.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
function src(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

function interfaceBody(source: string, name: string): string {
  const match = source.match(
    new RegExp(`interface ${name} \\{(.*?)\\n\\}`, "s"),
  );
  assert.ok(match, `interface ${name} must exist`);
  return match[1];
}

describe("public DTO shape (no leakage by construction)", () => {
  const archive = src("src/types/archive.ts");
  const body = interfaceBody(archive, "PublicDocument");

  for (const leaked of [
    "ownerId",
    "storage",
    "approved",
    "submittedAt",
    "grantedBy",
    "email",
  ]) {
    it(`PublicDocument exposes no ${leaked}`, () => {
      assert.ok(
        !body.includes(leaked),
        `PublicDocument must not contain ${leaked}`,
      );
    });
  }

  it("PublicDocument keeps its documented fields", () => {
    for (const field of [
      "slug",
      "title",
      "categoryName",
      "authorName",
      "authorSlug",
    ]) {
      assert.ok(body.includes(field), `PublicDocument must keep ${field}`);
    }
  });

  it("UpdateDocumentInput accepts no status/owner/approval fields", () => {
    const update = interfaceBody(archive, "UpdateDocumentInput");
    for (const field of ["status", "ownerId", "approvedBy", "submittedAt"]) {
      assert.ok(
        !update.includes(field),
        `UpdateDocumentInput must not accept ${field}`,
      );
    }
  });

  it("CreateDocumentInput accepts no status/owner/id fields", () => {
    const create = interfaceBody(archive, "CreateDocumentInput");
    for (const field of ["status", "ownerId", "approvedBy"]) {
      assert.ok(
        !create.includes(field),
        `CreateDocumentInput must not accept ${field}`,
      );
    }
    assert.ok(!/\bid\b/.test(create), "CreateDocumentInput must not accept id");
  });
});

describe("public projection SQL", () => {
  const projection = src(
    "supabase/migrations/20260913050001_archive_public_projection.sql",
  );
  const selectList = projection
    .slice(projection.indexOf("SELECT"), projection.indexOf("FROM public.documents"));

  it("selects explicit columns (no SELECT *)", () => {
    assert.ok(!projection.toLowerCase().includes("select *"));
  });

  it("gates on APPROVED + PUBLIC + not-deleted", () => {
    assert.ok(projection.includes("d.status = 'APPROVED'"));
    assert.ok(projection.includes("d.visibility = 'PUBLIC'"));
    assert.ok(projection.includes("d.deleted_at IS NULL"));
  });

  it("projects no owner/storage/approval internals", () => {
    for (const column of [
      "owner_id",
      "storage_path",
      "storage_bucket",
      "approved_by",
      "approved_at",
      "submitted_at",
    ]) {
      assert.ok(
        !selectList.includes(column),
        `projection must not select ${column}`,
      );
    }
  });

  it("gates author identity on public eligibility", () => {
    assert.ok(projection.includes("show_profile_publicly"));
    assert.ok(projection.includes("profile_visibility = 'PUBLIC'"));
  });
});

describe("lifecycle trigger SQL", () => {
  const guard = src(
    "supabase/migrations/20260913050002_document_lifecycle_guard.sql",
  );

  it("covers exactly the six legal edges", () => {
    const edges = guard.match(/OLD\.status = '[A-Z_]+' AND NEW\.status = '[A-Z_]+'/g);
    assert.deepEqual(edges?.sort(), [
      "OLD.status = 'APPROVED' AND NEW.status = 'ARCHIVED'",
      "OLD.status = 'DRAFT' AND NEW.status = 'SUBMITTED'",
      "OLD.status = 'REJECTED' AND NEW.status = 'DRAFT'",
      "OLD.status = 'SUBMITTED' AND NEW.status = 'UNDER_REVIEW'",
      "OLD.status = 'UNDER_REVIEW' AND NEW.status = 'APPROVED'",
      "OLD.status = 'UNDER_REVIEW' AND NEW.status = 'REJECTED'",
    ]);
  });

  it("forces INSERT-as-DRAFT", () => {
    assert.ok(guard.includes("NEW.status <> 'DRAFT'"));
  });
});

describe("version immutability by contract", () => {
  it("offers no update/delete on the version repository", () => {
    const repos = src("src/repositories/document.repository.ts");
    const body = interfaceBody(repos, "DocumentVersionRepository");
    assert.ok(!body.includes("update"), "versions must be append-only");
    assert.ok(!body.includes("delete"), "versions must never be deletable");
    assert.ok(body.includes("listByDocument"));
    assert.ok(body.includes("findByDocumentAndNumber"));
  });

  it("offers no delete on the version store (compensation deletes drafts, not versions)", () => {
    const service = src("src/services/storage/document-storage.service.ts");
    const match = service.match(
      new RegExp("interface DocumentVersionStore \\{(.*?)\\n\\}", "s"),
    );
    assert.ok(match, "DocumentVersionStore must exist");
    assert.ok(!match[1].includes("delete"));
  });
});

describe("service and action patterns", () => {
  it("creation hardcodes DRAFT in the service", () => {
    const service = src("src/services/archive/academic-document.service.ts");
    assert.ok(service.includes('status: "DRAFT"'));
    assert.ok(service.match(/requireTransition/g)!.length >= 6);
  });

  it("every server action resolves the server user", () => {
    const actions = src("src/features/archive/actions.ts");
    // 7 direct resolutions + 8 delegations through lifecycleAction = 15 actions.
    assert.equal(
      actions.match(/await requireActiveUser\(\)/g)?.length,
      7,
      "direct requireActiveUser resolutions changed — verify every action still resolves the caller",
    );
    assert.equal(
      actions.match(/return lifecycleAction\(/g)?.length,
      8,
      "lifecycleAction delegations changed — verify every lifecycle action still resolves the caller",
    );
  });

  it("the download route stays honest and uncached", () => {
    const route = src("src/app/api/archive/download/[id]/route.ts");
    assert.ok(route.includes("no-store"));
    assert.ok(route.includes("status: 404"));
    assert.ok(route.includes("status: 403"));
    assert.ok(route.includes("status: 401"));
  });
});
