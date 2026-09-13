/**
 * Lifecycle transition matrix + validator unit tests (Phase 10 §2, §22).
 * Pure functions only — no fakes, no database. The database trigger
 * (`20260913050002`) enforces the same matrix; `archive-static.test.ts`
 * locks the two together textually.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/types";
import {
  isAllowedTransition,
  validateCreateDocument,
  validateGrantPermission,
} from "@/validations/documents";

const ALLOWED: ReadonlyArray<readonly [DocumentStatus, DocumentStatus]> = [
  ["DRAFT", "SUBMITTED"],
  ["SUBMITTED", "UNDER_REVIEW"],
  ["UNDER_REVIEW", "APPROVED"],
  ["UNDER_REVIEW", "REJECTED"],
  ["REJECTED", "DRAFT"],
  ["APPROVED", "ARCHIVED"],
];

describe("document statuses", () => {
  it("expose exactly the six lifecycle states", () => {
    assert.deepEqual(Object.keys(DOCUMENT_STATUSES).sort(), [
      "APPROVED",
      "ARCHIVED",
      "DRAFT",
      "REJECTED",
      "SUBMITTED",
      "UNDER_REVIEW",
    ]);
  });
});

describe("lifecycle transition matrix", () => {
  for (const [from, to] of ALLOWED) {
    it(`permits ${from} → ${to}`, () => {
      assert.equal(isAllowedTransition(from, to), true);
    });
  }

  it("rejects every other ordered pair (no arbitrary jumps)", () => {
    const statuses = Object.keys(DOCUMENT_STATUSES) as DocumentStatus[];
    const allowed = new Set(ALLOWED.map(([f, t]) => `${f}→${t}`));
    for (const from of statuses) {
      for (const to of statuses) {
        if (from !== to && !allowed.has(`${from}→${to}`)) {
          assert.equal(
            isAllowedTransition(from, to),
            false,
            `expected ${from} → ${to} to be rejected`,
          );
        }
      }
    }
  });

  it("leaves ARCHIVED terminal", () => {
    const statuses = Object.keys(DOCUMENT_STATUSES) as DocumentStatus[];
    for (const to of statuses) {
      assert.equal(isAllowedTransition("ARCHIVED", to), false);
    }
  });

  it("never permits REJECTED → APPROVED (rework must re-enter review)", () => {
    assert.equal(isAllowedTransition("REJECTED", "APPROVED"), false);
  });

  it("never permits DRAFT → APPROVED (no self-approval jump)", () => {
    assert.equal(isAllowedTransition("DRAFT", "APPROVED"), false);
  });
});

describe("document validators", () => {
  it("requires a title and category on creation", () => {
    const issues = validateCreateDocument({ title: "", categoryId: "" });
    const fields = issues.map((i) => i.field);
    assert.ok(fields.includes("title"));
    assert.ok(fields.includes("categoryId"));
  });

  it("accepts a complete creation payload", () => {
    const issues = validateCreateDocument({
      title: "A complete thesis",
      categoryId: "00000000-0000-4000-8000-000000000001",
      year: 2026,
    });
    assert.deepEqual(issues, []);
  });

  it("rejects expired and malformed grant input", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    assert.ok(
      validateGrantPermission({
        userId,
        permission: "VIEW",
        expiresAt: "2020-01-01",
      }).some((i) => i.field === "expiresAt"),
    );
    assert.ok(
      validateGrantPermission({ userId, permission: "DELETE" }).some(
        (i) => i.field === "permission",
      ),
    );
    assert.ok(
      validateGrantPermission({ userId: "not-a-uuid", permission: "VIEW" }).some(
        (i) => i.field === "userId",
      ),
    );
  });

  it("accepts a well-formed grant without expiry", () => {
    assert.deepEqual(
      validateGrantPermission({
        userId: "00000000-0000-4000-8000-000000000001",
        permission: "DOWNLOAD",
      }),
      [],
    );
  });
});
