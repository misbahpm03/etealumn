/**
 * Archive service authorization tests (Phase 10 §19, §22–24).
 *
 * Production services against in-memory fakes: ownership, lifecycle
 * gating, role gating, grant semantics, download authorization order,
 * version-conflict recovery, queue privacy, and audit coverage.
 * RLS/trigger behavior is NOT covered here — that needs the live-DB
 * matrix (`tests/rls-matrix.sql`).
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { buildDocumentVersionPath } from "@/services/storage";
import type { SessionUser, Uuid } from "@/types";
import {
  createHarness,
  makeBatch,
  makeCategory,
  makeDoc,
  makeFile,
  makeProfile,
  makeUser,
  type ArchiveHarness,
} from "./fakes";

const FUTURE = "2030-06-01";
const PAST = "2020-06-01";

interface Fixture extends ArchiveHarness {
  owner: SessionUser;
  other: SessionUser;
  moderator: SessionUser;
  admin: SessionUser;
  faculty: SessionUser;
  categoryId: Uuid;
  batchId: Uuid;
}

function setup(): Fixture {
  const harness = createHarness();
  const owner = makeUser({ role: "STUDENT" });
  const other = makeUser({ role: "STUDENT" });
  const moderator = makeUser({ role: "MODERATOR" });
  const admin = makeUser({ role: "ADMIN" });
  const faculty = makeUser({ role: "FACULTY" });
  const category = makeCategory();
  const batch = makeBatch();
  for (const user of [owner, other, moderator, admin, faculty]) {
    harness.state.users.set(user.id, user);
    harness.state.profiles.set(user.id, makeProfile(user.id, `Member ${user.id.slice(-4)}`));
  }
  harness.state.categories.set(category.id, category);
  harness.state.batches.set(batch.id, batch);
  return {
    ...harness,
    owner,
    other,
    moderator,
    admin,
    faculty,
    categoryId: category.id,
    batchId: batch.id,
  };
}

let fx: Fixture;
beforeEach(() => {
  fx = setup();
});

function seedDoc(
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED" = "DRAFT",
  overrides?: { ownerId?: Uuid; visibility?: "PUBLIC" | "STUDENT_ONLY" | "FACULTY_ONLY" | "PRIVATE"; allowDownload?: boolean },
) {
  const doc = makeDoc({
    ownerId: overrides?.ownerId ?? fx.owner.id,
    categoryId: fx.categoryId,
    status,
    visibility: overrides?.visibility,
    allowDownload: overrides?.allowDownload,
    submittedAt: status === "DRAFT" || status === "REJECTED" ? null : "2026-02-01T00:00:00.000Z",
  });
  fx.state.docs.set(doc.id, doc);
  return doc;
}

function auditActions(): string[] {
  return fx.state.audit.map((entry) => entry.action);
}

// ------------------------------------------------------------------ create ---
describe("creation", () => {
  it("creates a DRAFT owned by the caller with version 1", async () => {
    const doc = await fx.service(fx.owner).createDocument(
      { title: "Fresh thesis", categoryId: fx.categoryId, year: 2026 },
      makeFile(),
    );
    assert.equal(doc.status, "DRAFT");
    assert.equal(doc.ownerId, fx.owner.id);
    assert.equal(await fx.deps.documents.maxVersionNumber(doc.id), 1);
    assert.ok(auditActions().includes("document_created"));
  });

  it("ignores browser-supplied ownership (server derives the owner)", async () => {
    const doc = await fx.service(fx.owner).createDocument(
      {
        title: "No takeover",
        categoryId: fx.categoryId,
        ownerId: fx.other.id,
        status: "APPROVED",
      } as unknown as Parameters<
        ReturnType<Fixture["service"]>["createDocument"]
      >[0],
      makeFile(),
    );
    assert.equal(doc.ownerId, fx.owner.id);
    assert.equal(doc.status, "DRAFT");
  });

  it("requires an active category", async () => {
    await assert.rejects(
      fx.service(fx.owner).createDocument(
        { title: "Orphan", categoryId: "00000000-0000-4000-8000-999999999999" },
        makeFile(),
      ),
      ValidationError,
    );
  });
});

// ------------------------------------------------------------------ update ---
describe("owner updates (§19: cross-user update, ownership transfer)", () => {
  it("lets the owner edit a draft", async () => {
    const doc = seedDoc();
    const updated = await fx.service(fx.owner).updateDocument(doc.id, {
      title: "Revised title",
    });
    assert.equal(updated.title, "Revised title");
  });

  it("rejects cross-user updates", async () => {
    const doc = seedDoc();
    await assert.rejects(
      fx.service(fx.other).updateDocument(doc.id, { title: "Hijacked" }),
      ForbiddenError,
    );
  });

  it("locks SUBMITTED documents against owner edits", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.service(fx.owner).updateDocument(doc.id, { title: "Too late" }),
      ForbiddenError,
    );
  });

  it("cannot transfer ownership (no owner field is honored)", async () => {
    const doc = seedDoc();
    const updated = await fx.service(fx.owner).updateDocument(doc.id, {
      title: "Same owner",
      ownerId: fx.other.id,
    } as unknown as Parameters<
      ReturnType<Fixture["service"]>["updateDocument"]
    >[1]);
    assert.equal(updated.ownerId, fx.owner.id);
  });

  it("exposes no arbitrary-status API on the service", () => {
    const exposed = Object.getOwnPropertyNames(
      Object.getPrototypeOf(fx.service(fx.owner)),
    );
    assert.ok(!exposed.includes("updateStatus"));
    assert.ok(!exposed.includes("setStatus"));
    assert.ok(!exposed.includes("transitionDocument"));
  });
});

// --------------------------------------------------------------- lifecycle ---
describe("submission (§7)", () => {
  it("submits a complete draft and audits it", async () => {
    const doc = seedDoc();
    const submitted = await fx.service(fx.owner).submitDocument(doc.id);
    assert.equal(submitted.status, "SUBMITTED");
    assert.ok(submitted.submittedAt);
    assert.ok(auditActions().includes("document_submitted"));
  });

  it("refuses incomplete documents", async () => {
    const doc = seedDoc();
    doc.year = null;
    doc.description = null;
    doc.abstract = null;
    await assert.rejects(
      fx.service(fx.owner).submitDocument(doc.id),
      ValidationError,
    );
  });

  it("refuses cross-user submission", async () => {
    const doc = seedDoc();
    await assert.rejects(
      fx.service(fx.other).submitDocument(doc.id),
      ForbiddenError,
    );
  });

  it("refuses double submission", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.service(fx.owner).submitDocument(doc.id),
      ValidationError,
    );
  });
});

describe("moderation (§10, §19: self-approval, unauthorized approval/archive)", () => {
  it("moves SUBMITTED → UNDER_REVIEW for staff only", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.service(fx.owner).beginReview(doc.id),
      ForbiddenError,
    );
    const review = await fx.service(fx.moderator).beginReview(doc.id);
    assert.equal(review.status, "UNDER_REVIEW");
    assert.ok(auditActions().includes("document_review_started"));
  });

  it("approves from UNDER_REVIEW with a server-set approver", async () => {
    const doc = seedDoc("UNDER_REVIEW");
    const approved = await fx.service(fx.moderator).approveDocument(doc.id);
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.approvedBy, fx.moderator.id);
    assert.ok(approved.approvedAt);
    assert.ok(auditActions().includes("document_approved"));
  });

  it("blocks self-approval", async () => {
    const doc = seedDoc("UNDER_REVIEW", { ownerId: fx.moderator.id });
    await assert.rejects(
      fx.service(fx.moderator).approveDocument(doc.id),
      ForbiddenError,
    );
  });

  it("requires review before approval (no SUBMITTED → APPROVED jump)", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.service(fx.moderator).approveDocument(doc.id),
      ValidationError,
    );
  });

  it("blocks unauthorized approval and archive", async () => {
    const review = seedDoc("UNDER_REVIEW");
    await assert.rejects(
      fx.service(fx.other).approveDocument(review.id),
      ForbiddenError,
    );
    const approved = seedDoc("APPROVED");
    await assert.rejects(
      fx.service(fx.other).archiveDocument(approved.id),
      ForbiddenError,
    );
    await assert.rejects(
      fx.service(fx.moderator).archiveDocument(seedDoc().id),
      ValidationError,
    );
  });

  it("archives APPROVED documents and audits it", async () => {
    const doc = seedDoc("APPROVED");
    const archived = await fx.service(fx.moderator).archiveDocument(doc.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.ok(auditActions().includes("document_archived"));
  });

  it("runs the full REJECTED → DRAFT → SUBMITTED rework loop (§8)", async () => {
    const doc = seedDoc("UNDER_REVIEW");
    const rejected = await fx.service(fx.moderator).rejectDocument(doc.id);
    assert.equal(rejected.status, "REJECTED");
    assert.ok(auditActions().includes("document_rejected"));
    const reopened = await fx.service(fx.owner).reopenDocument(doc.id);
    assert.equal(reopened.status, "DRAFT");
    assert.equal(reopened.submittedAt, null);
    const resubmitted = await fx.service(fx.owner).submitDocument(doc.id);
    assert.equal(resubmitted.status, "SUBMITTED");
  });

  it("never offers REJECTED → APPROVED", async () => {
    const doc = seedDoc("REJECTED");
    await assert.rejects(
      fx.service(fx.moderator).approveDocument(doc.id),
      ValidationError,
    );
  });
});

describe("visibility and delete", () => {
  it("lets owners change visibility while drafting, admins anytime", async () => {
    const draft = seedDoc();
    const changed = await fx.service(fx.owner).updateVisibility(draft.id, "PUBLIC");
    assert.equal(changed.visibility, "PUBLIC");
    const approved = seedDoc("APPROVED");
    await assert.rejects(
      fx.service(fx.owner).updateVisibility(approved.id, "PUBLIC"),
      ForbiddenError,
    );
    const adminChanged = await fx.service(fx.admin).updateVisibility(
      approved.id,
      "PUBLIC",
    );
    assert.equal(adminChanged.visibility, "PUBLIC");
  });

  it("soft-deletes with owner/admin rules and retains objects", async () => {
    const draft = seedDoc();
    const deleted = await fx.service(fx.owner).softDeleteDocument(draft.id);
    assert.ok(deleted.deletedAt);
    const review = seedDoc("UNDER_REVIEW");
    await assert.rejects(
      fx.service(fx.owner).softDeleteDocument(review.id),
      ForbiddenError,
    );
    const restored = await fx.service(fx.admin).restoreDocument(draft.id);
    assert.equal(restored.deletedAt, null);
  });
});

// ------------------------------------------------------------- permissions ---
describe("grants (§13, §19: self-grant, foreign grant)", () => {
  it("lets the owner grant VIEW and audits it", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PRIVATE" });
    const grant = await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "VIEW",
    });
    assert.equal(grant.permission, "VIEW");
    assert.ok(auditActions().includes("document_permission_granted"));
  });

  it("re-granting updates the expiry (idempotent)", async () => {
    const doc = seedDoc();
    const first = await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "VIEW",
    });
    const second = await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "VIEW",
      expiresAt: FUTURE,
    });
    assert.equal(first.id, second.id);
    assert.equal(second.expiresAt, FUTURE);
  });

  it("blocks self-grants and foreign grants", async () => {
    const doc = seedDoc();
    await assert.rejects(
      fx.permissions(fx.other).grantPermission(doc.id, {
        userId: fx.moderator.id,
        permission: "VIEW",
      }),
      ForbiddenError,
    );
    await assert.rejects(
      fx.permissions(fx.owner).grantPermission(doc.id, {
        userId: fx.owner.id,
        permission: "VIEW",
      }),
      ValidationError,
    );
  });

  it("excludes moderators from grant management", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.permissions(fx.moderator).grantPermission(doc.id, {
        userId: fx.other.id,
        permission: "VIEW",
      }),
      ForbiddenError,
    );
  });

  it("revokes idempotently and audits", async () => {
    const doc = seedDoc();
    await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "VIEW",
    });
    await fx.permissions(fx.owner).revokePermission(doc.id, fx.other.id, "VIEW");
    await fx.permissions(fx.owner).revokePermission(doc.id, fx.other.id, "VIEW");
    assert.ok(auditActions().includes("document_permission_revoked"));
    const mine = await fx.permissions(fx.other).myPermissions(doc.id);
    assert.equal(mine.length, 0);
  });
});

// --------------------------------------------------------------- downloads ---
describe("download authorization (§14, §20)", () => {
  it("serves the owner in any live status and audits with the version", async () => {
    const doc = seedDoc("DRAFT");
    const access = await fx.service(fx.owner).getDownloadAccess(doc.id);
    assert.ok(access.url.startsWith("https://signed.invalid/"));
    assert.equal(access.filename, "file.pdf");
    assert.equal(fx.state.signedUrls, 1);
    const entry = fx.state.audit.find((a) => a.action === "document_downloaded");
    assert.ok(entry);
    assert.equal(entry?.entityId, doc.id);
  });

  it("reads unreadable documents as 404 without minting a URL (no oracle)", async () => {
    const doc = seedDoc("DRAFT", { visibility: "PRIVATE" });
    await assert.rejects(
      fx.service(fx.other).getDownloadAccess(doc.id),
      NotFoundError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("denies VIEW-only grants a download URL", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PRIVATE", allowDownload: true });
    await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "VIEW",
    });
    await assert.rejects(
      fx.service(fx.other).getDownloadAccess(doc.id),
      ForbiddenError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("denies DOWNLOAD grants when allow_download is false (switch wins)", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PRIVATE", allowDownload: false });
    await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "DOWNLOAD",
    });
    await assert.rejects(
      fx.service(fx.other).getDownloadAccess(doc.id),
      ForbiddenError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("denies expired DOWNLOAD grants", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PRIVATE", allowDownload: true });
    await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "DOWNLOAD",
      expiresAt: PAST,
    }).then(
      () => assert.fail("granting an expired permission should fail"),
      (error: unknown) => assert.ok(error instanceof ValidationError),
    );
    // Implant an expiry that lapsed after granting (validator blocks
    // creating already-expired grants, so simulate ageing). An expired
    // grant authorizes nothing — not even readability — so the private
    // document reads as 404, exactly as if no grant ever existed.
    const grant = await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "DOWNLOAD",
      expiresAt: FUTURE,
    });
    grant.expiresAt = PAST;
    await assert.rejects(
      fx.service(fx.other).getDownloadAccess(doc.id),
      NotFoundError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("honors a valid DOWNLOAD grant", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PRIVATE", allowDownload: true });
    await fx.permissions(fx.owner).grantPermission(doc.id, {
      userId: fx.other.id,
      permission: "DOWNLOAD",
      expiresAt: FUTURE,
    });
    const access = await fx.service(fx.other).getDownloadAccess(doc.id);
    assert.ok(access.url);
    assert.equal(fx.state.signedUrls, 1);
  });

  it("enforces audience tiers (student-only excludes faculty)", async () => {
    const doc = seedDoc("APPROVED", { visibility: "STUDENT_ONLY", allowDownload: true });
    await fx.service(fx.other).getDownloadAccess(doc.id);
    await assert.rejects(
      fx.service(fx.faculty).getDownloadAccess(doc.id),
      NotFoundError,
    );
  });

  it("lets moderators download in-review PRIVATE files (and nothing approved-private)", async () => {
    const review = seedDoc("SUBMITTED", { visibility: "PRIVATE" });
    await fx.service(fx.moderator).getDownloadAccess(review.id);
    const approvedPrivate = seedDoc("APPROVED", { visibility: "PRIVATE" });
    await assert.rejects(
      fx.service(fx.moderator).getDownloadAccess(approvedPrivate.id),
      NotFoundError,
    );
    assert.equal(fx.state.signedUrls, 1);
  });

  it("maps readable-but-disabled downloads to 403 (no new oracle)", async () => {
    const doc = seedDoc("APPROVED", { visibility: "FACULTY_ONLY", allowDownload: false });
    await assert.rejects(
      fx.service(fx.moderator).getDownloadAccess(doc.id),
      ForbiddenError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("never serves deleted documents", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PUBLIC" });
    await fx.service(fx.admin).softDeleteDocument(doc.id);
    await assert.rejects(
      fx.service(fx.owner).getDownloadAccess(doc.id),
      NotFoundError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });

  it("validates historic version ownership before signing", async () => {
    const doc = seedDoc("APPROVED", { visibility: "PUBLIC" });
    await assert.rejects(
      fx.service(fx.other).getDownloadAccess(doc.id, 99),
      NotFoundError,
    );
    assert.equal(fx.state.signedUrls, 0);
  });
});

// ---------------------------------------------------------------- versions ---
describe("version conflicts (§3: no silent duplicates, no orphans)", () => {
  it("retries a lost race and keeps history contiguous", async () => {
    const doc = seedDoc("DRAFT");
    // Version 1 exists (seeded row + object, as creation would leave).
    const v1Path = buildDocumentVersionPath({
      documentId: doc.id,
      versionNumber: 1,
      filename: "file.pdf",
    });
    fx.state.versions.push({
      id: "00000000-0000-4000-8000-000000000021",
      documentId: doc.id,
      versionNumber: 1,
      storageProvider: "fake",
      storageBucket: "academic-archive",
      storagePath: v1Path,
      originalFilename: "file.pdf",
      mimeType: "application/pdf",
      fileSize: 10,
      changeNote: null,
      uploadedBy: fx.owner.id,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    fx.state.objects.set(`academic-archive:${v1Path}`, {
      data: new Uint8Array([1]),
      mimeType: "application/pdf",
    });
    // Simulate losing a race for version 2: the winner's row lands as
    // our insert fails, so the retry must observe it and take 3.
    fx.state.failNextVersionInsert = new ConflictError("rival won");
    fx.state.rivalVersion = {
      documentId: doc.id,
      versionNumber: 2,
      uploadedBy: fx.owner.id,
    };

    const { versionNumber } = await fx
      .service(fx.owner)
      .uploadVersion(doc.id, makeFile("v3.pdf"), "third attempt");
    assert.equal(versionNumber, 3);

    const numbers = fx.state.versions
      .filter((v) => v.documentId === doc.id)
      .map((v) => v.versionNumber)
      .sort();
    assert.deepEqual(numbers, [1, 2, 3]);

    const keys = [...fx.state.objects.keys()];
    assert.ok(!keys.some((k) => k.includes("staging")), "no staging leftovers");
    const v2Path = buildDocumentVersionPath({
      documentId: doc.id,
      versionNumber: 2,
      filename: "v3.pdf",
    });
    assert.ok(
      !fx.state.objects.has(`academic-archive:${v2Path}`),
      "loser's moved object is removed",
    );
    assert.ok(auditActions().includes("document_version_uploaded"));
  });

  it("locks versions to DRAFT/REJECTED owners", async () => {
    const doc = seedDoc("SUBMITTED");
    await assert.rejects(
      fx.service(fx.owner).uploadVersion(doc.id, makeFile()),
      ForbiddenError,
    );
    const draft = seedDoc("DRAFT");
    await assert.rejects(
      fx.service(fx.other).uploadVersion(draft.id, makeFile()),
      ForbiddenError,
    );
  });
});

// ------------------------------------------------------------------- queue ---
describe("moderation queue (§9, privacy)", () => {
  it("serves staff an oldest-first queue with names, never emails", async () => {
    const first = seedDoc("SUBMITTED");
    first.submittedAt = "2026-01-10T00:00:00.000Z";
    const second = seedDoc("UNDER_REVIEW");
    second.submittedAt = "2026-03-10T00:00:00.000Z";
    seedDoc("APPROVED");
    const queue = await fx.service(fx.moderator).listReviewQueue();
    assert.deepEqual(
      queue.map((item) => item.id),
      [first.id, second.id],
    );
    const row = queue[0];
    assert.equal(row.ownerDisplayName, `Member ${fx.owner.id.slice(-4)}`);
    assert.equal(row.categoryName, "Thesis");
    assert.ok(!("email" in row), "queue rows must never carry emails");
    assert.ok(!("phone" in row), "queue rows must never carry phones");
  });

  it("rejects non-staff queue reads", async () => {
    await assert.rejects(
      fx.service(fx.owner).listReviewQueue(),
      ForbiddenError,
    );
  });
});

// ------------------------------------------------------------------- audit ---
describe("audit trail (§24: events without secrets)", () => {
  it("records moderation events and never audit secrets or URLs", async () => {
    const doc = seedDoc();
    await fx.service(fx.owner).submitDocument(doc.id);
    await fx.service(fx.moderator).beginReview(doc.id);
    await fx.service(fx.moderator).approveDocument(doc.id);
    await fx.service(fx.moderator).archiveDocument(doc.id);
    const actions = auditActions();
    for (const action of [
      "document_submitted",
      "document_review_started",
      "document_approved",
      "document_archived",
    ]) {
      assert.ok(actions.includes(action), `missing audit: ${action}`);
    }
    const blob = JSON.stringify(fx.state.audit);
    assert.ok(!blob.includes("signed.invalid"), "no signed URLs in audit");
    assert.ok(!blob.includes("storagePath"), "no storage paths in audit");
  });
});
