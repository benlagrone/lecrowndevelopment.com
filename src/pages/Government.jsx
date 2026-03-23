import site from "../content/site.json"
import page from "../content/government.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import ProofBand from "../components/ProofBand"
import LeadCaptureForm from "../components/LeadCaptureForm"

export default function Government() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker={page.buyers.kicker}
          title={page.buyers.title}
        />
        <CardGrid items={page.buyers.items} />
      </section>

      <section className="section">
        <SectionHeading
          kicker={page.offers.kicker}
          title={page.offers.title}
        />
        <CardGrid items={page.offers.items} />
      </section>

      <section className="section">
        <SectionHeading
          kicker={page.proof.kicker}
          title={page.proof.title}
        />
        <ProofBand items={page.proof.items} />
      </section>

      <section className="section">
        <SectionHeading
          kicker={page.checklist.kicker}
          title={page.checklist.title}
        />
        <CardGrid items={page.checklist.items} />
      </section>

      <section className="section" id="government-intake">
        <SectionHeading
          kicker="Government intake"
          title="Send the opportunity."
          description="Include the agency, prime path, or capture context if you have it."
        />
        <LeadCaptureForm
          defaultProjectType="Government / Prime Contractor"
          description="Start with the buyer, the wedge, and the next move."
          email={site.contact.email}
          heading="Government / prime intake"
          submitLabel="Send government intake"
        />
      </section>
    </div>
  )
}
