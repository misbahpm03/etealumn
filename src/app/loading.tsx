import { Container } from "@/components/ui/container";
import { LoadingState } from "@/components/ui/loading-state";

/** Global loading fallback while route segments stream in. */
export default function GlobalLoading() {
  return (
    <Container>
      <LoadingState label="Loading page…" />
    </Container>
  );
}
