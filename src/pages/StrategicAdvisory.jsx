import { useState } from "react"
import site from "../content/site.json"
import page from "../content/strategic-advisory.json"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import StepsRail from "../components/StepsRail"
import CTASection from "../components/CTASection"
import { submitLead } from "../lib/leadApi"

const organizationTypes = [
  "Business Owner",
  "Investor",
  "Attorney",
  "Commercial Property Owner",
  "Family Office",
  "Lender",
  "Court or Court-Appointed Stakeholder",
  "Buyer or Seller",
  "Development Firm",
  "Other"
]

const advisoryFocusOptions = [
  "Business Evaluation",
  "Economics Consulting",
  "M&A Advisory",
  "Property Evaluation",
  "Due Diligence Support",
  "Other"
]

function buildInitialState() {
  return {
    advisoryFocus: [],
    company: "",
    email: "",
    message: "",
    name: "",
    organizationType: "Business Owner",
    phone: ""
  }
}

function ServiceArea({ area }) {
  return (
    <article className="advisory-card">
      <div>
        <h3>{area.title}</h3>
        <p>{area.text}</p>
      </div>

      <div className="advisory-card-lists">
        <div>
          <span className="advisory-list-label">Services</span>
          <ul>
            {area.services.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </div>

        {area.secondary?.length ? (
          <div>
            <span className="advisory-list-label">{area.secondaryLabel}</span>
            <ul>
              {area.secondary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {area.disclaimer ? (
        <p className="advisory-disclaimer">{area.disclaimer}</p>
      ) : null}
    </article>
  )
}

function StrategicAdvisoryForm() {
  const [form, setForm] = useState(buildInitialState)
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  function handleChange(event) {
    const { name, value } = event.target
    setError("")
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleFocusChange(event) {
    const { checked, value } = event.target
    setError("")
    setForm((current) => ({
      ...current,
      advisoryFocus: checked
        ? [...current.advisoryFocus, value]
        : current.advisoryFocus.filter((item) => item !== value)
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Name, email, and message are required.")
      return
    }

    setStatus("submitting")
    setError("")

    try {
      const submission = await submitLead({
        ...form,
        goals: form.message,
        organization: form.company,
        page: window.location.pathname,
        projectType: "Strategic Advisory",
        submittedAt: new Date().toISOString()
      })

      setResult(submission)
      setStatus("success")
      setForm(buildInitialState())
    } catch (submissionError) {
      setStatus("error")
      setError(
        submissionError.message ||
          "The form could not be submitted. Use email or phone as a fallback."
      )
    }
  }

  function resetForm() {
    setStatus("idle")
    setError("")
    setResult(null)
  }

  if (status === "success") {
    return (
      <div className="intake-form lead-success">
        <span className="agent-chat-kicker">Submission received</span>
        <h3>{page.form.heading}</h3>
        <p>Thanks. I received your consultation request and will follow up.</p>
        {result?.leadId ? <p className="mono">Lead ID: {result.leadId}</p> : null}
        <div className="cta-actions">
          <button className="button" onClick={resetForm} type="button">
            Send another request
          </button>
          <a className="button-secondary" href={`mailto:${site.contact.email}`}>
            Email instead
          </a>
        </div>
      </div>
    )
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit}>
      <div>
        <span className="agent-chat-kicker">Advisory intake</span>
        <h3 className="form-heading">{page.form.heading}</h3>
        <p className="form-copy">{page.form.description}</p>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="advisory-name">Name</label>
          <input
            id="advisory-name"
            name="name"
            onChange={handleChange}
            value={form.name}
          />
        </div>
        <div className="field">
          <label htmlFor="advisory-company">Company</label>
          <input
            id="advisory-company"
            name="company"
            onChange={handleChange}
            value={form.company}
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="advisory-phone">Phone</label>
          <input
            id="advisory-phone"
            name="phone"
            onChange={handleChange}
            type="tel"
            value={form.phone}
          />
        </div>
        <div className="field">
          <label htmlFor="advisory-email">Email</label>
          <input
            id="advisory-email"
            name="email"
            onChange={handleChange}
            type="email"
            value={form.email}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="advisory-organization-type">Organization Type</label>
        <select
          id="advisory-organization-type"
          name="organizationType"
          onChange={handleChange}
          value={form.organizationType}
        >
          {organizationTypes.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <fieldset className="checkbox-field">
        <legend>Advisory Focus</legend>
        <div className="checkbox-grid">
          {advisoryFocusOptions.map((option) => (
            <label key={option}>
              <input
                checked={form.advisoryFocus.includes(option)}
                onChange={handleFocusChange}
                type="checkbox"
                value={option}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="advisory-message">Message</label>
        <textarea
          id="advisory-message"
          name="message"
          onChange={handleChange}
          placeholder="Describe the business, transaction, asset, decision, timeline, and current constraints."
          value={form.message}
        />
      </div>

      <div className="form-actions">
        <button className="button" disabled={status === "submitting"} type="submit">
          {status === "submitting" ? "Sending..." : "Request Consultation"}
        </button>
        <a className="button-secondary" href={`mailto:${site.contact.email}`}>
          Email instead
        </a>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
    </form>
  )
}

export default function StrategicAdvisory() {
  return (
    <div className="page">
      <Hero {...page.hero} />

      <section className="section">
        <SectionHeading
          kicker="Overview"
          title="Independent advisory support for critical decisions."
        />
        <div className="panel advisory-overview">
          {page.overview.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Practice areas"
          title="Corporate, transaction, economic, and asset analysis."
        />
        <div className="advisory-grid">
          {page.serviceAreas.map((area) => (
            <ServiceArea area={area} key={area.title} />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading kicker="We commonly support" title="Stakeholders who need decision-ready analysis." />
        <div className="panel">
          <div className="stack-cloud">
            {page.clients.map((client) => (
              <span className="stack-pill" key={client}>
                {client}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading kicker="Engagement process" title="A clear path from question to recommendation." />
        <StepsRail steps={page.process} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Deliverables"
          title="Outputs depend on the engagement scope."
          description="Depending on engagement scope, deliverables may include:"
        />
        <div className="panel">
          <div className="stack-cloud">
            {page.deliverables.map((deliverable) => (
              <span className="stack-pill stack-pill-light" key={deliverable}>
                {deliverable}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="advisory-intake">
        <SectionHeading
          kicker="Pricing and consultation"
          title={page.pricing.title}
          description={page.pricing.text}
        />
        <div className="intake-grid">
          <StrategicAdvisoryForm />
          <div className="advisory-intake-side">
            <div className="contact-card">
              <h3>Private scope discussion</h3>
              <p>
                Fixed pricing is not published publicly. Scope, confidentiality,
                deliverables, timeline, and pricing can be discussed privately.
              </p>
              <a href={`tel:${site.contact.phoneDigits}`}>{site.contact.phone}</a>
            </div>
            <div className="contact-card">
              <h3>Advisory boundary</h3>
              <p>
                LeCrown provides consulting analysis and strategic recommendations,
                not brokerage, legal representation, or formal licensed appraisal
                services where those are legally required.
              </p>
              <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            </div>
          </div>
        </div>
      </section>

      <CTASection {...page.cta} />
    </div>
  )
}
