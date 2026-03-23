import home from "../content/home.json"
import Hero from "../components/Hero"
import SignalStrip from "../components/SignalStrip"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import SystemDiagram from "../components/SystemDiagram"
import ProofBand from "../components/ProofBand"
import CTASection from "../components/CTASection"

export default function Home() {
  return (
    <div className="page">
      <Hero {...home.hero} />
      <SignalStrip items={home.signals} />

      <section className="section">
        <SectionHeading
          kicker="Core offers"
          title="What LeCrown does."
        />
        <CardGrid items={home.services} />
      </section>

      <SystemDiagram {...home.diagram} />

      <section className="section">
        <SectionHeading
          kicker={home.tracks.kicker}
          title={home.tracks.title}
          description={home.tracks.description}
        />
        <CardGrid items={home.tracks.items} />
      </section>

      <section className="section">
        <SectionHeading
          kicker={home.proof.kicker}
          title={home.proof.title}
          description={home.proof.description}
        />
        <ProofBand items={home.proof.items} />
      </section>

      <CTASection {...home.cta} />
    </div>
  )
}
