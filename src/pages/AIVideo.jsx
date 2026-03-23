import page from "../content/ai-video.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import StepsRail from "../components/StepsRail"
import VideoGrid from "../components/VideoGrid"
import ProofBand from "../components/ProofBand"
import CTASection from "../components/CTASection"

export default function AIVideo() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Capabilities"
          title="Use media as part of the system, not as an afterthought."
          description="A modern AI consultancy needs to show technical work clearly. AI video helps LeCrown do that quickly."
        />
        <CardGrid items={page.capabilities} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Content pipeline"
          title="A repeatable flow for turning technical work into visibility."
          description="This section reinforces the incubator and social-proof angle of the site."
        />
        <StepsRail steps={page.pipeline} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Portfolio signals"
          title="Representative examples from the current LeCrown portfolio."
          description="These links are here to show production range and category proof without pretending to be a giant studio."
        />
        <VideoGrid items={page.videos} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Why this offer matters"
          title="AI video makes technical delivery visible."
          description="That matters for commercial buyers, incubated products, and public-sector-facing explainers."
        />
        <ProofBand items={page.proof} />
      </section>

      <CTASection {...page.cta} />
    </div>
  )
}
