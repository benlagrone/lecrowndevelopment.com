import page from "../content/solutions.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import ProofBand from "../components/ProofBand"
import CTASection from "../components/CTASection"

export default function Solutions() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Solution lines"
          title="Choose the line of work."
        />
        <CardGrid items={page.categories} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Industries and buying contexts"
          title="Built for commercial and public-sector work."
        />
        <div className="panel">
          <div className="stack-cloud">
            {page.industries.map((industry) => (
              <span className="stack-pill" key={industry}>
                {industry}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Delivery approach"
          title="A simple delivery path."
        />
        <CardGrid items={page.delivery} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Why this architecture works"
          title="Less noise, better signal."
        />
        <ProofBand items={page.proof} />
      </section>

      <CTASection {...page.cta} />
    </div>
  )
}
