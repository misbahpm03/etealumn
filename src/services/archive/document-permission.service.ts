import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type {
  AuditLogRepository,
  DocumentPermissionRepository,
  DocumentRepository,
  UserRepository,
} from "@/repositories";
import { assertActiveUser } from "@/services/auth/guards";
import type {
  Document,
  DocumentPermission,
  DocumentPermissionKind,
  SessionUser,
  Uuid,
} from "@/types";
import { validateGrantPermission } from "@/validations/documents";
import { validateRecordId } from "@/validations/profile";

/**
 * Wiring. Reads run on the request client (RLS scopes grant rows to
 * recipient/owner/admin); writes are privileged (no direct-SQL grant path
 * exists) with the acting user resolved server-side — never trusted input.
 */
export interface DocumentPermissionDeps {
  documents: DocumentRepository;
  documentsPrivileged: DocumentRepository;
  permissions: DocumentPermissionRepository;
  permissionsPrivileged: DocumentPermissionRepository;
  /** Privileged: recipient existence checks must not depend on RLS reads. */
  usersPrivileged: UserRepository;
  audit: AuditLogRepository;
}

export interface GrantPermissionArgs {
  userId: Uuid;
  permission: DocumentPermissionKind;
  expiresAt?: string | null;
}

/**
 * Explicit document grants. VIEW and DOWNLOAD stay independent: holding
 * VIEW never implies download rights (the download tree checks DOWNLOAD
 * separately). Only owners and admins manage grants — moderators are
 * deliberately excluded (review access is role-based, not grant-based).
 */
export class DocumentPermissionService {
  constructor(
    private readonly deps: DocumentPermissionDeps,
    private readonly appUser: SessionUser,
  ) {}

  /** Owner/admin grant (re-grant updates expiry — idempotent by design). */
  async grantPermission(
    documentId: Uuid,
    args: GrantPermissionArgs,
  ): Promise<DocumentPermission> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(documentId));
    throwIfIssues(
      validateGrantPermission({
        userId: args.userId,
        permission: args.permission,
        expiresAt: args.expiresAt ?? null,
      }),
    );
    if (args.userId === this.appUser.id) {
      throw new ValidationError([
        {
          field: "userId",
          message: "Owners and admins already have access — no grant needed.",
        },
      ]);
    }
    const doc = await this.requireLivePrivileged(documentId);
    this.requireManager(doc);
    const recipient = await this.deps.usersPrivileged.findById(args.userId);
    if (!recipient) {
      throw new ValidationError([
        { field: "userId", message: "No member found for this grant." },
      ]);
    }
    const grant = await this.deps.permissionsPrivileged.grant(documentId, {
      userId: args.userId,
      permission: args.permission,
      grantedBy: this.appUser.id,
      expiresAt: args.expiresAt ?? null,
    });
    await this.deps.audit.record({
      actorId: this.appUser.id,
      action: "document_permission_granted",
      entityType: "document_permissions",
      entityId: grant.id,
      metadata: {
        documentId,
        permission: args.permission,
        hasExpiry: (args.expiresAt ?? null) !== null,
      },
    });
    return grant;
  }

  /** Owner/admin revoke (idempotent — absent grants succeed silently). */
  async revokePermission(
    documentId: Uuid,
    userId: Uuid,
    permission: DocumentPermissionKind,
  ): Promise<void> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(documentId));
    throwIfIssues(validateGrantPermission({ userId, permission }));
    const doc = await this.requireLivePrivileged(documentId);
    this.requireManager(doc);
    await this.deps.permissionsPrivileged.revoke(documentId, userId, permission);
    await this.deps.audit.record({
      actorId: this.appUser.id,
      action: "document_permission_revoked",
      entityType: "document_permissions",
      entityId: null,
      metadata: { documentId, permission },
    });
  }

  /** Full grant list (owner/admin only — recipients use `myPermissions`). */
  async listPermissions(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(documentId));
    const doc = await this.requireLivePrivileged(documentId);
    this.requireManager(doc);
    return this.deps.permissions.listByDocument(documentId);
  }

  /** The caller's own grants on a document (RLS also scopes this read). */
  async myPermissions(
    documentId: Uuid,
  ): Promise<ReadonlyArray<DocumentPermission>> {
    assertActiveUser(this.appUser);
    throwIfIssues(validateRecordId(documentId));
    return this.deps.permissions.listByDocumentAndUser(
      documentId,
      this.appUser.id,
    );
  }

  private async requireLivePrivileged(documentId: Uuid): Promise<Document> {
    const doc = await this.deps.documentsPrivileged.findById(documentId);
    if (!doc || doc.deletedAt) throw new NotFoundError("Document");
    return doc;
  }

  /** Owners manage their own grants; admins manage any. Nobody else. */
  private requireManager(doc: Document): void {
    const isOwner = doc.ownerId === this.appUser.id;
    const isAdmin =
      this.appUser.role === "ADMIN" && this.appUser.status === "ACTIVE";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError(
        "Only the owner or an admin can manage these permissions.",
      );
    }
  }
}

function throwIfIssues(
  issues: ReadonlyArray<{ field: string; message: string }>,
): void {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}
