import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { RoadmapTimeline } from "@/components/info/Blocks";

export const metadata: Metadata = { title: "Roadmap", description: `${BRAND.name} development phases.` };

export default function RoadmapPage() {
  return (
    <InfoPage
      current="/roadmap"
      eyebrow="Roadmap"
      title="Built in phases, shipped when it works."
      lead="Each phase lists what it delivers. Phases are marked Done, In progress or Planned — we do not publish dates we cannot stand behind."
    >
      <InfoBlock title="Development phases">
        <RoadmapTimeline />
      </InfoBlock>
      <InfoBlock title="Deployment gate">
        <Prose>
          <p>
            No {BRAND.name} contract will be deployed to Robinhood Chain Mainnet before the external audit in Phase 6 is complete and its
            findings are resolved. The first mainnet deployment will start with low limits that are raised gradually.
          </p>
        </Prose>
      </InfoBlock>
    </InfoPage>
  );
}
