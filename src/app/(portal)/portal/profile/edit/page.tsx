import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import {
  PhotoForm,
  PhotoRemoveButton,
} from "@/features/profile/photo-form";
import { PrivacyForm } from "@/features/profile/privacy-form";
import { ProfileForm } from "@/features/profile/profile-form";
import {
  createProfileService,
  requireActiveUser,
} from "@/infrastructure/supabase/server-session";

export const metadata: Metadata = { title: "Edit Profile" };

export default async function PortalProfileEditPage() {
  const appUser = await requireActiveUser();
  const service = await createProfileService(appUser);
  const { profile, privacy } = await service.ensureInitialized();

  return (
    <>
      <PageHeader
        eyebrow="My Profile"
        title="Edit profile"
        description="Update your details, photo, and privacy settings."
      />
      <div className="mt-8 flex max-w-2xl flex-col gap-10">
        <section aria-label="Profile details">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Profile details
          </h2>
          <ProfileForm profile={profile} />
        </section>
        <section aria-label="Profile photo">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Profile photo
          </h2>
          <PhotoForm />
          {profile.profilePhotoPath ? (
            <div className="mt-4">
              <PhotoRemoveButton />
            </div>
          ) : null}
        </section>
        <section aria-label="Privacy settings">
          <h2 className="mb-4 text-base font-semibold text-zinc-900">
            Privacy settings
          </h2>
          <PrivacyForm privacy={privacy} />
        </section>
      </div>
    </>
  );
}
