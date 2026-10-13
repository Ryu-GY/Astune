import { ReadingExperience } from "@/components/reading/ReadingExperience";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ birthProfileId?: string }> }) {
  const { birthProfileId } = await searchParams;
  return <ReadingExperience birthProfileId={typeof birthProfileId === "string" ? birthProfileId : undefined} />;
}
