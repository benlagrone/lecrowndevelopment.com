import { useState } from "react"
import { submitLead } from "../lib/leadApi"

const projectTypes = [
  "AI Automation",
  "Custom Development",
  "AI Video",
  "Government / Prime Contractor",
  "Incubation / Venture Build"
]

const timelines = [
  "Immediate",
  "30-60 days",
  "60-90 days",
  "Exploring options"
]

function buildInitialState(defaultProjectType) {
  return {
    email: "",
    goals: "",
    name: "",
    organization: "",
    projectType: defaultProjectType,
    targetBuyer: "",
    timeline: "30-60 days"
  }
}

export default function LeadCaptureForm({
  email,
  heading = "Send a project note",
  defaultProjectType = "AI Automation",
  description = "Start with the project, the buyer, and the next move.",
  submitLabel = "Send project note"
}) {
  const [form, setForm] = useState(() => buildInitialState(defaultProjectType))
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  function handleChange(event) {
    const { name, value } = event.target
    setError("")
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!form.name.trim() || !form.email.trim() || !form.goals.trim()) {
      setError("Name, email, and a short project note are required.")
      return
    }

    setStatus("submitting")
    setError("")

    try {
      const payload = {
        ...form,
        page: window.location.pathname,
        submittedAt: new Date().toISOString()
      }
      const submission = await submitLead(payload)

      setResult(submission)
      setStatus("success")
      setForm(buildInitialState(defaultProjectType))
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
        <h3>{heading}</h3>
        <p>
          Your note is in. LeCrown can follow up at the email you provided.
        </p>
        {result?.leadId ? <p className="mono">Lead ID: {result.leadId}</p> : null}
        <div className="cta-actions">
          <button className="button" onClick={resetForm} type="button">
            Send another note
          </button>
          <a className="button-secondary" href={`mailto:${email}`}>
            Email instead
          </a>
        </div>
      </div>
    )
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit}>
      <div>
        <span className="agent-chat-kicker">Project intake</span>
        <h3 className="form-heading">{heading}</h3>
        <p className="form-copy">{description}</p>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="lead-name">Name</label>
          <input
            id="lead-name"
            name="name"
            onChange={handleChange}
            value={form.name}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-organization">Organization</label>
          <input
            id="lead-organization"
            name="organization"
            onChange={handleChange}
            value={form.organization}
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="lead-email">Work email</label>
          <input
            id="lead-email"
            name="email"
            onChange={handleChange}
            type="email"
            value={form.email}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-project-type">Project type</label>
          <select
            id="lead-project-type"
            name="projectType"
            onChange={handleChange}
            value={form.projectType}
          >
            {projectTypes.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="lead-timeline">Timeline</label>
          <select
            id="lead-timeline"
            name="timeline"
            onChange={handleChange}
            value={form.timeline}
          >
            {timelines.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lead-target-buyer">Agency, prime, or buyer</label>
          <input
            id="lead-target-buyer"
            name="targetBuyer"
            onChange={handleChange}
            placeholder="Optional"
            value={form.targetBuyer}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="lead-goals">What are you trying to ship or win?</label>
        <textarea
          id="lead-goals"
          name="goals"
          onChange={handleChange}
          placeholder="Describe the project, the buyer, the friction, and the next step you need."
          value={form.goals}
        />
      </div>

      <div className="form-actions">
        <button className="button" disabled={status === "submitting"} type="submit">
          {status === "submitting" ? "Sending..." : submitLabel}
        </button>
        <a className="button-secondary" href={`mailto:${email}`}>
          Email instead
        </a>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
    </form>
  )
}
