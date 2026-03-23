import site from "../content/site.json"
import page from "../content/contact.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import LeadCaptureForm from "../components/LeadCaptureForm"

export default function Contact() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Engagement types"
          title="Pick the right path."
        />
        <CardGrid items={page.engagements} />
      </section>

      <section className="section" id="lead-form">
        <SectionHeading
          kicker="Start here"
          title="Send the note or reach out directly."
          description="Use the form for a real handoff. Email and phone are here if you want the fastest manual path."
        />

        <div className="intake-grid">
          <LeadCaptureForm email={site.contact.email} />

          <div className="card-grid">
            {page.contacts.map((item) => (
              <article className="contact-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {item.label}
                  </a>
                ) : (
                  <p>{item.label}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Best first-message ingredients"
          title="What should be in the first note?"
        />
        <CardGrid items={page.checklist} />
      </section>
    </div>
  )
}
