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

      <section className="section" id="lead-form">
        <SectionHeading
          kicker="Direct"
          title="Use the form, email, or call."
          description="Keep the first note simple: scope, buyer, and timeline."
        />

        <div className="intake-grid">
          <LeadCaptureForm
            email={site.contact.email}
            heading={page.form.heading}
            description={page.form.description}
            submitLabel={page.form.submitLabel}
          />

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
          kicker="Useful details"
          title="Include these three things."
        />
        <CardGrid items={page.checklist} />
      </section>
    </div>
  )
}
