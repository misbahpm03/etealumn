import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicProfileRepository } from "@/repositories/public-profile.repository";
import type {
  SafeMemberProfile,
  SafePublicProfile,
  Uuid,
} from "@/types";
import { unwrapQuery } from "./errors";

/**
 * Columns of the `profiles_public` / `profiles_member` safe projections.
 * This list must never grow raw sensitive columns (no phone, no email —
 * email is not even selectable from these views).
 */
const COLUMNS =
  "user_id,full_name,display_name,profile_photo_path,bio,location,website_url,linkedin_url,facebook_url,github_url" as const;

interface Row {
  user_id: string;
  full_name: string;
  display_name: string | null;
  profile_photo_path: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  github_url: string | null;
}

function toSafeProfile(row: Row): SafePublicProfile {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    displayName: row.display_name,
    profilePhotoPath: row.profile_photo_path,
    bio: row.bio,
    location: row.location,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    facebookUrl: row.facebook_url,
    githubUrl: row.github_url,
  };
}

export class SupabasePublicProfileRepository
  implements PublicProfileRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async getPublicProfile(userId: Uuid): Promise<SafePublicProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles_public")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toSafeProfile(row) : null;
  }

  async getMemberProfile(userId: Uuid): Promise<SafeMemberProfile | null> {
    const row = (await unwrapQuery(
      this.client
        .from("profiles_member")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
    )) as Row | null;
    return row ? toSafeProfile(row) : null;
  }
}
