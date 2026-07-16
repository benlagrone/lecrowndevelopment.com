import { Link } from "react-router-dom"
import capability from "../content/capability-statement.json"
import site from "../content/site.json"

const pdfPath = "/downloads/lecrown-development-capability-statement.pdf"

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  )
}

export default function CapabilityStatement() {
  return (
    <div className="page capability-page">
      <section className="capability-hero">
        <div className="capability-hero-copy">
          <h1>{capability.headline}</h1>
          <p>{capability.summary}</p>
          <div className="hero-actions">
            <a className="button" download href={pdfPath}>
              Download government capability statement
            </a>
            <Link className="button-secondary" to="/contact">
              Start a conversation <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="capability-hero-art" aria-hidden="true">
          <span className="glass-plane glass-plane-a" />
          <span className="glass-plane glass-plane-b" />
          <span className="glass-plane glass-plane-c" />
          <span className="glass-plane glass-plane-d" />
        </div>
      </section>

      <section className="capability-snapshot" aria-label="Company snapshot">
        <h2>Company snapshot</h2>
        {capability.snapshot.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <section className="capability-section capability-section-open">
        <div className="capability-section-title">
          <h2>Core capabilities</h2>
          <span />
        </div>
        <div className="capability-list">
          {capability.capabilities.map((item) => (
            <article key={item.number}>
              <span className="capability-number">{item.number}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <ArrowIcon />
            </article>
          ))}
        </div>
      </section>

      <section className="capability-outcomes">
        <div className="capability-section-title">
          <h2>Selected outcomes</h2>
          <span />
        </div>
        <div className="outcome-grid">
          {capability.outcomes.map((item) => (
            <article key={item.value}>
              <strong>{item.value}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="capability-industries">
        <div className="capability-section-title">
          <h2>Industry experience</h2>
          <span />
        </div>
        <div className="industry-rail">
          {capability.industries.map((industry, index) => (
            <span key={industry}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              {industry}
            </span>
          ))}
        </div>
      </section>

      <section className="capability-section capability-differentiators">
        <div className="capability-section-title">
          <h2>What sets LeCrown apart</h2>
          <span />
        </div>
        <div className="differentiator-grid">
          {capability.differentiators.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="capability-credentials">
        <div>
          <div className="capability-section-title">
            <h2>Credentials</h2>
            <span />
          </div>
          <ul>
            {capability.credentials.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <div className="capability-section-title">
            <h2>Technology depth</h2>
            <span />
          </div>
          <div className="technology-cloud">
            {capability.technologies.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section className="capability-contact">
        <div>
          <h2>Let&apos;s build what&apos;s next - together.</h2>
          <p>Modernize systems, unlock data value, and move enterprise AI from concept to an operating capability.</p>
        </div>
        <div className="capability-contact-details">
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
          <a href={`tel:${site.contact.phoneDigits}`}>{site.contact.phone}</a>
          <span>Houston, Texas</span>
        </div>
        <Link className="button capability-contact-button" to="/contact">
          Start a conversation <ArrowIcon />
        </Link>
      </section>

      <section className="experience-logos" aria-labelledby="experience-title">
        <h2 id="experience-title"><span>Client partners</span></h2>
        <div className="logo-rail">
          {capability.experience.map((company) => (
            <div className="client-partner" key={company.name}>
              <img
                className={company.logoClass || undefined}
                src={company.logo}
                alt={`${company.name} logo`}
              />
              {company.status && <span>{company.status}</span>}
            </div>
          ))}
        </div>
        <p>Company marks identify client and partner organizations represented in Benjamin LaGrone&apos;s resume and project history. “Former” denotes prior Accenture and Avanade experience; no current endorsement is implied.</p>
      </section>
    </div>
  )
}
