import { useEffect, useMemo, useRef, useState } from "react"
import agentProfile from "../content/agent-profile.json"
import {
  buildLeadPayload,
  clearLinkedInAuthCallback,
  getAgentApiBaseUrl,
  getAgentId,
  getAgentSiteId,
  getLinkedInAuthStartUrl,
  hasSharedAgentApi,
  readLinkedInAuthCallback,
  resolveLinkedInAuthSession,
  submitLeadToSharedAgent
} from "../lib/agentApi"

const detailState = {
  projectType: "",
  timeline: "",
  goals: ""
}

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

const recommendedNextStepByType = {
  "AI Automation": "a workflow review and pilot scoping call",
  "Custom Development": "a build scoping session with technical requirements",
  "AI Video": "a creative brief and production planning call",
  "Government / Prime Contractor": "a capture review tied to the agency or prime path",
  "Incubation / Venture Build": "a venture-fit session to frame the first buildable wedge"
}

function getMatch(projectType) {
  return (
    agentProfile.matchByProjectType[projectType] ||
    agentProfile.matchByProjectType.default
  )
}

function buildContactState(linkedInProfile = null) {
  return {
    email: linkedInProfile?.email || "",
    linkedin: linkedInProfile,
    name: linkedInProfile?.name || "",
    organization: ""
  }
}

function getInitials(name) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "LI"
  )
}

function buildMailto(email, contact, details, recommendedNextStep, match) {
  const subject = encodeURIComponent(
    `LeCrown agent chat: ${details.projectType || "New opportunity"}`
  )

  const body = encodeURIComponent(
    [
      "New agent-chat intake",
      "",
      `Name: ${contact.name}`,
      `Organization: ${contact.organization || "Not provided"}`,
      `Email: ${contact.email}`,
      `LinkedIn: ${contact.linkedin?.profileUrl || "Not connected"}`,
      `LinkedIn headline: ${contact.linkedin?.headline || "Not provided"}`,
      `Project type: ${details.projectType}`,
      `Timeline: ${details.timeline}`,
      `Recommended next step: ${recommendedNextStep}`,
      "",
      "Relevant LeCrown background:",
      ...match.bullets.map((bullet) => `- ${bullet}`),
      "",
      "Goals / context:",
      details.goals
    ].join("\n")
  )

  return `mailto:${email}?subject=${subject}&body=${body}`
}

function buildMessages(contact, details, recommendedNextStep, step, match) {
  const messages = [
    {
      id: "intro",
      speaker: "agent",
      label: "LeCrown Agent",
      text: `I can qualify the opportunity and line up the right follow-up. I’m grounded in ${agentProfile.founder.name}'s background across AI systems, product engineering, cloud delivery, and technical consulting. Start with your contact details.`
    }
  ]

  if (step !== "contact") {
    messages.push({
      id: "contact",
      speaker: "user",
      label: contact.name,
      text: [contact.name, contact.organization, contact.email]
        .filter(Boolean)
        .join(" • ")
    })
    messages.push({
      id: "project-type-prompt",
      speaker: "agent",
      label: "LeCrown Agent",
      text: "Thanks. What kind of engagement are you exploring?"
    })
  }

  if (step === "timeline" || step === "goals" || step === "done") {
    messages.push({
      id: "project-type",
      speaker: "user",
      label: contact.name || "You",
      text: details.projectType
    })
    messages.push({
      id: "experience-match",
      speaker: "agent",
      label: "LeCrown Agent",
      text: `${match.headline} ${match.bullets[0]}`
    })
    messages.push({
      id: "timeline-prompt",
      speaker: "agent",
      label: "LeCrown Agent",
      text: "What timeline are you working against?"
    })
  }

  if (step === "goals" || step === "done") {
    messages.push({
      id: "timeline",
      speaker: "user",
      label: contact.name || "You",
      text: details.timeline
    })
    messages.push({
      id: "goals-prompt",
      speaker: "agent",
      label: "LeCrown Agent",
      text: "What are you trying to ship, win, or unblock?"
    })
  }

  if (step === "done") {
    messages.push({
      id: "goals",
      speaker: "user",
      label: contact.name || "You",
      text: details.goals
    })
    messages.push({
      id: "summary",
      speaker: "agent",
      label: "LeCrown Agent",
      text: `Based on this, the best next move is ${recommendedNextStep}. I’m carrying forward relevant founder experience so the handoff reflects LeCrown’s actual background.`
    })
  }

  return messages
}

export default function AgentChatIntake({ email }) {
  const [contact, setContact] = useState(() => buildContactState())
  const [details, setDetails] = useState(detailState)
  const [step, setStep] = useState("contact")
  const [error, setError] = useState("")
  const [apiStatus, setApiStatus] = useState("idle")
  const [apiResult, setApiResult] = useState(null)
  const [linkedInStatus, setLinkedInStatus] = useState("idle")
  const linkedInCallbackHandledRef = useRef(false)

  const recommendedNextStep =
    recommendedNextStepByType[details.projectType] ||
    "a founder-led discovery call"
  const match = getMatch(details.projectType)
  const sharedApiEnabled = hasSharedAgentApi()
  const siteId = getAgentSiteId()
  const agentId = getAgentId()
  const apiBaseUrl = getAgentApiBaseUrl()
  const linkedInProfile = contact.linkedin
  const linkedInAuthUrl = getLinkedInAuthStartUrl()

  const messages = buildMessages(contact, details, recommendedNextStep, step, match)

  const mailto = useMemo(
    () => buildMailto(email, contact, details, recommendedNextStep, match),
    [contact, details, email, match, recommendedNextStep]
  )

  useEffect(() => {
    if (linkedInCallbackHandledRef.current) {
      return
    }

    const callback = readLinkedInAuthCallback()

    if (!callback) {
      return
    }

    linkedInCallbackHandledRef.current = true

    let cancelled = false

    async function hydrateLinkedInProfile() {
      if (callback.status === "cancelled") {
        setLinkedInStatus("idle")
        setError("LinkedIn sign-in was cancelled before the profile could be returned.")
        clearLinkedInAuthCallback()
        return
      }

      if (callback.error) {
        setLinkedInStatus("error")
        setError(callback.error)
        clearLinkedInAuthCallback()
        return
      }

      setLinkedInStatus(callback.session ? "restoring" : "connected")

      try {
        const profile =
          callback.member || (callback.session ? await resolveLinkedInAuthSession(callback.session) : null)

        if (!profile) {
          throw new Error(
            "LinkedIn sign-in completed, but no profile data was returned from the shared agent API."
          )
        }

        if (cancelled) {
          return
        }

        setContact((current) => ({
          ...current,
          email: current.email.trim() || profile.email || "",
          linkedin: profile,
          name: current.name.trim() || profile.name || ""
        }))
        setLinkedInStatus("connected")
        setError("")
      } catch (authError) {
        if (cancelled) {
          return
        }

        setLinkedInStatus("error")
        setError(
          authError.message ||
            "LinkedIn sign-in could not be restored. Use the manual fields instead."
        )
      } finally {
        clearLinkedInAuthCallback()
      }
    }

    hydrateLinkedInProfile()

    return () => {
      cancelled = true
    }
  }, [])

  function handleContactChange(event) {
    const { name, value } = event.target
    setError("")
    setContact((current) => ({ ...current, [name]: value }))
  }

  function handleContactSubmit(event) {
    event.preventDefault()

    if (!contact.name.trim() || !contact.email.trim()) {
      setError("Name and email are required to start the handoff.")
      return
    }

    setError("")
    setStep("projectType")
  }

  function handleProjectTypeSelect(projectType) {
    setError("")
    setDetails((current) => ({ ...current, projectType }))
    setStep("timeline")
  }

  function handleTimelineSelect(timeline) {
    setError("")
    setDetails((current) => ({ ...current, timeline }))
    setStep("goals")
  }

  function handleGoalsChange(event) {
    const { value } = event.target
    setError("")
    setDetails((current) => ({ ...current, goals: value }))
  }

  function handleGoalsSubmit(event) {
    event.preventDefault()

    if (!details.goals.trim()) {
      setError("Add a short note about the problem, opportunity, or desired outcome.")
      return
    }

    setError("")
    setStep("done")
  }

  function resetConversation() {
    setContact(buildContactState(linkedInProfile))
    setDetails(detailState)
    setStep("contact")
    setError("")
    setApiStatus("idle")
    setApiResult(null)
  }

  function handleLinkedInStart() {
    if (!linkedInAuthUrl) {
      setError(
        "LinkedIn sign-in needs the shared agent API so the OAuth flow can complete server-side."
      )
      return
    }

    setError("")
    setLinkedInStatus("redirecting")
    window.location.assign(linkedInAuthUrl)
  }

  async function handleApiSubmit() {
    setError("")
    setApiStatus("submitting")

    try {
      const payload = buildLeadPayload({
        contact,
        details,
        recommendedNextStep,
        match,
        messages
      })
      const result = await submitLeadToSharedAgent(payload)

      setApiResult(result)
      setApiStatus("submitted")
    } catch (submissionError) {
      setApiStatus("error")
      setError(
        submissionError.message ||
          "Unable to reach the shared agent API. Use the email fallback instead."
      )
    }
  }

  return (
    <div className="agent-chat">
      <div className="agent-chat-header">
        <div>
          <span className="agent-chat-kicker">Agent intake</span>
          <h3>Start with contact capture, then qualify the opportunity.</h3>
        </div>
        <p>
          {sharedApiEnabled
            ? "Shared API mode: this intake can post to a central agent service, and that same backend can broker LinkedIn sign-in for contact prefill."
            : "Fallback mode: this intake drafts the follow-up email locally until a shared agent API is configured. LinkedIn sign-in stays unavailable in this mode."}
        </p>
      </div>

      <div className="agent-mode-row">
        <span
          className={`agent-mode ${
            sharedApiEnabled ? "agent-mode-live" : "agent-mode-fallback"
          }`}
        >
          {sharedApiEnabled ? "Shared API enabled" : "Local fallback only"}
        </span>
        <span className="agent-mode-meta">
          Agent: {agentId} • Site: {siteId}
        </span>
      </div>

      <div className="agent-context">
        <article className="agent-context-card">
          <span>Grounded in</span>
          <strong>
            {agentProfile.founder.name} • {agentProfile.founder.title}
          </strong>
          <p>{agentProfile.founder.summary}</p>
          <div className="stack-cloud">
            {agentProfile.founder.skills.map((skill) => (
              <span className="stack-pill stack-pill-light" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </article>

        <article className="agent-context-card">
          <span>Relevant experience</span>
          <strong>{match.headline}</strong>
          <ul>
            {match.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <p className="agent-context-footnote">
            Domain exposure includes {agentProfile.industryExposure.join(", ")}.
          </p>
          {sharedApiEnabled ? (
            <p className="agent-context-footnote">
              Shared backend target: {apiBaseUrl}/v1/intake
            </p>
          ) : null}
        </article>
      </div>

      <div className="chat-thread" aria-live="polite">
        {messages.map((message) => (
          <article
            className={`chat-bubble chat-bubble-${message.speaker}`}
            key={message.id}
          >
            <span>{message.label}</span>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <div className="chat-composer">
        {step === "contact" && (
          <form className="chat-form" onSubmit={handleContactSubmit}>
            <div className="linkedin-prefill">
              <div className="linkedin-prefill-header">
                <span className="agent-chat-kicker">Optional shortcut</span>
                <h4>Use LinkedIn to prefill the first step.</h4>
                <p>
                  The sign-in flow returns to this page with your name and email so
                  the handoff starts cleaner. The conversation still stays on
                  LeCrown&apos;s site, not inside LinkedIn chat.
                </p>
              </div>

              <div className="linkedin-prefill-actions">
                <button
                  className="button-secondary"
                  disabled={
                    !sharedApiEnabled ||
                    linkedInStatus === "redirecting" ||
                    linkedInStatus === "restoring"
                  }
                  onClick={handleLinkedInStart}
                  type="button"
                >
                  {linkedInStatus === "redirecting"
                    ? "Redirecting to LinkedIn..."
                    : linkedInStatus === "restoring"
                      ? "Restoring LinkedIn profile..."
                      : linkedInProfile
                        ? "Refresh LinkedIn prefill"
                        : "Use LinkedIn to prefill"}
                </button>

                {!sharedApiEnabled ? (
                  <p className="linkedin-note">
                    Configure the shared agent API first. That backend owns the
                    LinkedIn client secret and callback exchange.
                  </p>
                ) : null}
              </div>

              {linkedInProfile ? (
                <div className="linkedin-profile">
                  {linkedInProfile.picture ? (
                    <img
                      alt={linkedInProfile.name || "LinkedIn profile"}
                      className="linkedin-avatar"
                      src={linkedInProfile.picture}
                    />
                  ) : (
                    <div className="linkedin-avatar linkedin-avatar-fallback">
                      {getInitials(linkedInProfile.name || "")}
                    </div>
                  )}

                  <div>
                    <strong>{linkedInProfile.name || "LinkedIn connected"}</strong>
                    <p>
                      {[
                        linkedInProfile.email,
                        linkedInProfile.headline
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Name and email are ready to reuse in the handoff."}
                    </p>
                    {linkedInProfile.profileUrl ? (
                      <a href={linkedInProfile.profileUrl} rel="noreferrer" target="_blank">
                        Open LinkedIn profile
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="field-grid">
              <div className="field">
                <label htmlFor="chat-name">Name</label>
                <input
                  id="chat-name"
                  name="name"
                  value={contact.name}
                  onChange={handleContactChange}
                />
              </div>
              <div className="field">
                <label htmlFor="chat-organization">Organization</label>
                <input
                  id="chat-organization"
                  name="organization"
                  value={contact.organization}
                  onChange={handleContactChange}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="chat-email">Work email</label>
              <input
                id="chat-email"
                name="email"
                type="email"
                value={contact.email}
                onChange={handleContactChange}
              />
            </div>

            <button className="button" type="submit">
              Start the chat
            </button>
          </form>
        )}

        {step === "projectType" && (
          <div className="quick-replies" role="group" aria-label="Project type">
            {projectTypes.map((option) => (
              <button
                className="quick-reply"
                key={option}
                onClick={() => handleProjectTypeSelect(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {step === "timeline" && (
          <div className="quick-replies" role="group" aria-label="Timeline">
            {timelines.map((option) => (
              <button
                className="quick-reply"
                key={option}
                onClick={() => handleTimelineSelect(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {step === "goals" && (
          <form className="chat-form" onSubmit={handleGoalsSubmit}>
            <div className="field">
              <label htmlFor="chat-goals">Project note</label>
              <textarea
                id="chat-goals"
                name="goals"
                value={details.goals}
                onChange={handleGoalsChange}
                placeholder="Describe the opportunity, buyer, current friction, and what a good next step looks like."
              />
            </div>

            <button className="button" type="submit">
              Finish handoff
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="chat-summary">
            <div className="chat-summary-grid">
              <div>
                <span>Contact</span>
                <strong>{contact.name}</strong>
                <p>{[contact.organization, contact.email].filter(Boolean).join(" • ")}</p>
                {linkedInProfile?.profileUrl ? (
                  <a href={linkedInProfile.profileUrl} rel="noreferrer" target="_blank">
                    LinkedIn profile attached
                  </a>
                ) : null}
              </div>
              <div>
                <span>Recommended next step</span>
                <strong>{recommendedNextStep}</strong>
                <p>
                  {details.projectType} • {details.timeline}
                </p>
              </div>
            </div>

            <div className="chat-actions">
              {sharedApiEnabled ? (
                <button
                  className="button"
                  disabled={apiStatus === "submitting" || apiStatus === "submitted"}
                  onClick={handleApiSubmit}
                  type="button"
                >
                  {apiStatus === "submitting"
                    ? "Sending to shared agent..."
                    : apiStatus === "submitted"
                      ? "Sent to shared agent"
                      : "Send to shared agent"}
                </button>
              ) : (
                <a className="button" href={mailto}>
                  Draft intro email
                </a>
              )}
              {sharedApiEnabled ? (
                <a className="button-secondary" href={mailto}>
                  Draft email fallback
                </a>
              ) : null}
              <button
                className="button-secondary"
                onClick={resetConversation}
                type="button"
              >
                Start over
              </button>
            </div>

            {apiResult ? (
              <div className="agent-response">
                <span>Shared agent response</span>
                <strong>{apiResult.reply}</strong>
                {apiResult.followUp?.href ? (
                  <a href={apiResult.followUp.href}>
                    {apiResult.followUp.label || "Open next step"}
                  </a>
                ) : null}
                {apiResult.leadId ? (
                  <p className="mono">Lead ID: {apiResult.leadId}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="field-error">{error}</p> : null}
      </div>
    </div>
  )
}
