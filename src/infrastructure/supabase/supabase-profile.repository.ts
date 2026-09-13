import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "@/lib/errors";
import type {
  ProfilePrivacyRepository,
  ProfileRepository,
} from "@/repositories/profile.repository";
import type {
  DocumentVisibility,
  Profile,
  ProfilePrivacy,
  UpdatePrivacyInput,
  UpdateProfileInput,
  Uuid,
} from "@/types";
import { unwrapQuery } from "./errors";

const PROFILE_COLUMNS =
  "id,user_id,full_name,display_name,profile_photo_path,bio,phone,location,website_url,linkedin_url,facebook_url,github_url,profile_slug,profile_visibility,created_at,updated_at" as const;

const PRIVACY_COLUMNS =
  "id,user_id,show_email,show_phone,show_location,show_bio,show_career,show_education,show_social_links,show_profile_publicly,created_at,updated_at" as const;

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string | null;
  profile_photo_path: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  github_url: string | null;
  profile_slug: string | null;
  profile_visibility: DocumentVisibility;
  created_at: string;
  updated_at: string;
}

interface PrivacyRow {
  id: string;
  user_id: string;
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  show_bio: boolean;
  show_career: boolean;
  show_education: boolean;
  show_social_links: boolean;
  show_profile_publicly: boolean;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    displayName: row.display_name,
    profilePhotoPath: row.profile_photo_path,
    bio: row.bio,
    phone: row.phone,
    location: row.location,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    facebookUrl: row.facebook_url,
    githubUrl: row.github_url,
    profileSlug: row.profile_slug,
    profileVisibility: row.profile_visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPrivacy(row: PrivacyRow): ProfilePrivacy {
  return {
    id: row.id,
    userId: row.user_id,
    showEmail: row.show_email,
    showPhone: row.show_phone,
    showLocation: row.show_location,
    showBio: row.show_bio,
    showCareer: row.show_career,
    showEducation: row.show_education,
    showSocialLinks: row.show_social_links,
    showProfilePublicly: row.show_profile_publicly,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProfileDb(input: UpdateProfileInput): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.fullName !== undefined) db.full_name = input.fullName;
  if (input.displayName !== undefined) db.display_name = input.displayName;
  if (input.profilePhotoPath !== undefined)
    db.profile_photo_path = input.profilePhotoPath;
  if (input.bio !== undefined) db.bio = input.bio;
  if (input.phone !== undefined) db.phone = input.phone;
  if (input.location !== undefined) db.location = input.location;
  if (input.websiteUrl !== undefined) db.website_url = input.websiteUrl;
  if (input.linkedinUrl !== undefined) db.linkedin_url = input.linkedinUrl;
  if (input.facebookUrl !== undefined) db.facebook_url = input.facebookUrl;
  if (input.githubUrl !== undefined) db.github_url = input.githubUrl;
  if (input.profileVisibility !== undefined)
    db.profile_visibility = input.profileVisibility;
  return db;
}

function toPrivacyDb(input: UpdatePrivacyInput): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (input.showEmail !== undefined) db.show_email = input.showEmail;
  if (input.showPhone !== undefined) db.show_phone = input.showPhone;
  if (input.showLocation !== undefined) db.show_location = input.showLocation;
  if (input.showBio !== undefined) db.show_bio = input.showBio;
  if (input.showCareer !== undefined) db.show_career = input.showCareer;
  if (input.showEducation !== undefined)
    db.show_education = input.showEducation;
  if (input.showSocialLinks !== undefined)
    db.show_social_links = input.showSocialLinks;
  if (input.showProfilePublicly !== undefined)
    db.show_profile_publicly = input.showProfilePublicly;
  return db;
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: Uuid): Promise<Profile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as ProfileRow | null;
    return row ? toProfile(row) : null;
  }

  async findBySlug(slug: string): Promise<Profile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("profile_slug", slug)
        .maybeSingle(),
    )) as ProfileRow | null;
    return row ? toProfile(row) : null;
  }

  async create(input: { userId: Uuid; fullName: string }): Promise<Profile> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles")
        .insert({ user_id: input.userId, full_name: input.fullName })
        .select(PROFILE_COLUMNS)
        .single(),
    )) as ProfileRow;
    return toProfile(row);
  }

  async setSlug(userId: Uuid, slug: string): Promise<Profile> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles")
        .update({ profile_slug: slug })
        .eq("user_id", userId)
        .select(PROFILE_COLUMNS)
        .maybeSingle(),
    )) as ProfileRow | null;
    if (!row) throw new NotFoundError("Profile");
    return toProfile(row);
  }

  async update(userId: Uuid, input: UpdateProfileInput): Promise<Profile> {
    const db = toProfileDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findByUserId(userId);
      if (!current) throw new NotFoundError("Profile");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("profiles")
        .update(db)
        .eq("user_id", userId)
        .select(PROFILE_COLUMNS)
        .maybeSingle(),
    )) as ProfileRow | null;
    if (!row) throw new NotFoundError("Profile");
    return toProfile(row);
  }
}

export class SupabaseProfilePrivacyRepository
  implements ProfilePrivacyRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: Uuid): Promise<ProfilePrivacy | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profile_privacy")
        .select(PRIVACY_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as PrivacyRow | null;
    return row ? toPrivacy(row) : null;
  }

  async create(input: { userId: Uuid }): Promise<ProfilePrivacy> {
    const row = (await unwrapQuery(
      this.client
        .from("profile_privacy")
        .insert({ user_id: input.userId })
        .select(PRIVACY_COLUMNS)
        .single(),
    )) as PrivacyRow;
    return toPrivacy(row);
  }

  async update(
    userId: Uuid,
    input: UpdatePrivacyInput,
  ): Promise<ProfilePrivacy> {
    const db = toPrivacyDb(input);
    if (Object.keys(db).length === 0) {
      const current = await this.findByUserId(userId);
      if (!current) throw new NotFoundError("Privacy settings");
      return current;
    }
    const row = (await unwrapQuery(
      this.client
        .from("profile_privacy")
        .update(db)
        .eq("user_id", userId)
        .select(PRIVACY_COLUMNS)
        .maybeSingle(),
    )) as PrivacyRow | null;
    if (!row) throw new NotFoundError("Privacy settings");
    return toPrivacy(row);
  }
}
