import { useMemo, useState } from "react"

const initialState = {
  name: "",
  organization: "",
  email: "",
  projectType: "AI Automation",
  timeline: "30-60 days",
  goals: ""
}

export default function ProjectIntakeForm({ email }) {
  const [form, setForm] = useState(initialState)

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(
      `LeCrown inquiry: ${form.projectType || "Project"}`
    )
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Organization: ${form.organization}`,
        `Email: ${form.email}`,
        `Project type: ${form.projectType}`,
        `Timeline: ${form.timeline}`,
        "",
        "Goals:",
        form.goals
      ].join("\n")
    )

    return `mailto:${email}?subject=${subject}&body=${body}`
  }, [email, form])

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    window.location.href = mailto
  }

  return (
    <form className="intake-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} />
        </div>
        <div className="field">
          <label htmlFor="organization">Organization</label>
          <input
            id="organization"
            name="organization"
            value={form.organization}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="field">
          <label htmlFor="projectType">Project type</label>
          <select
            id="projectType"
            name="projectType"
            value={form.projectType}
            onChange={handleChange}
          >
            <option>AI Automation</option>
            <option>Custom Development</option>
            <option>AI Video</option>
            <option>Government / Prime Contractor</option>
            <option>Incubation / Venture Build</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="timeline">Timeline</label>
        <select
          id="timeline"
          name="timeline"
          value={form.timeline}
          onChange={handleChange}
        >
          <option>30-60 days</option>
          <option>60-90 days</option>
          <option>90+ days</option>
          <option>Exploring options</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="goals">What are you trying to ship or win?</label>
        <textarea
          id="goals"
          name="goals"
          value={form.goals}
          onChange={handleChange}
        />
      </div>

      <button className="button" type="submit">
        Draft the email
      </button>
    </form>
  )
}
