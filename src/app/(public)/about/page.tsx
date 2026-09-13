import type { Metadata } from "next";
import { PlaceholderSection } from "@/components/layout/placeholder-section";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="Department"
        title="About"
        description="The department's mission, history, and the purpose of this platform."
      />
      <div className="mt-8">
        <PlaceholderSection
          summary="The public About page will present department information managed through the admin CMS."
          planned={[
            "Department overview and mission",
            "Platform purpose and content policies",
            "Contact and official links",
          ]}
        />
      </div>
    </Container>
  );
}
