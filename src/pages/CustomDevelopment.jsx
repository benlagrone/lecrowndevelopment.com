import page from "../content/custom-development.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import StackCloud from "../components/StackCloud"
import StepsRail from "../components/StepsRail"
import ProofBand from "../components/ProofBand"
import CTASection from "../components/CTASection"

export default function CustomDevelopment() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Systems"
          title="Software that turns process into infrastructure."
          description="LeCrown can use custom development as the layer that makes AI, operations, and new products actually usable."
        />
        <CardGrid items={page.systems} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Delivery modes"
          title="Different entry points for different levels of urgency."
          description="A small site still needs multiple ways to say yes: rapid pilot, full build, or senior technical guidance."
        />
        <CardGrid items={page.deliveryModes} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Core stack"
          title="Built for modern web products, internal platforms, and AI-enabled systems."
          description="The point here is not to show every tool. It is to show LeCrown belongs in serious technical conversations."
        />
        <div className="panel">
          <StackCloud items={page.stack} />
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Build sequence"
          title="A simple path from concept to useful release."
          description="This works for commercial teams, incubated products, and technical narratives behind capture efforts."
        />
        <StepsRail steps={page.process} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Why it matters"
          title="Custom development is also a strategic tool."
          description="The software layer often determines whether the business line feels real, scalable, and differentiated."
        />
        <ProofBand items={page.proof} />
      </section>

      <CTASection {...page.cta} />
    </div>
  )
}
