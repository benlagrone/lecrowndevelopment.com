import page from "../content/ai-automation.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import SystemDiagram from "../components/SystemDiagram"
import StackCloud from "../components/StackCloud"
import StepsRail from "../components/StepsRail"
import CTASection from "../components/CTASection"

export default function AIAutomation() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Capabilities"
          title="Automation work that goes beyond generic AI language."
          description="The right page for operators, agencies, or primes should show the workflow mechanics, not just say AI is involved."
        />
        <CardGrid items={page.capabilities} />
      </section>

      <SystemDiagram {...page.diagram} />

      <section className="section">
        <SectionHeading
          kicker="Use cases"
          title="Practical applications with clear operating value."
          description="These are examples of how LeCrown can frame and ship automation work in a way that buyers can understand quickly."
        />
        <CardGrid items={page.useCases} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Technology stack"
          title="The stack signals real build capability."
          description="Technical buyers want to know the work can survive beyond a concept deck."
        />
        <div className="panel">
          <StackCloud items={page.stack} />
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Delivery path"
          title="A four-step model for turning automation into a real program."
          description="This is the sequence LeCrown can use for commercial builds and for public-sector-friendly pilots."
        />
        <StepsRail steps={page.process} />
      </section>

      <CTASection {...page.cta} />
    </div>
  )
}
