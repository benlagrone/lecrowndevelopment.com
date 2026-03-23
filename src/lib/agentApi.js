const rawApiBaseUrl = import.meta.env.VITE_AGENT_API_BASE_URL?.trim() || ""
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "")
const configuredSiteId = import.meta.env.VITE_AGENT_SITE_ID?.trim() || ""
const configuredAgentId =
  import.meta.env.VITE_AGENT_BOT_ID?.trim() || "benjamin-lagrone"
const linkedInCallbackKeys = [
  "linkedin_auth",
  "linkedin_session",
  "linkedin_error",
  "linkedin_name",
  "linkedin_email",
  "linkedin_picture",
  "linkedin_profile",
  "linkedin_headline",
  "linkedin_given_name",
  "linkedin_family_name",
  "error",
  "error_description"
]

function readPageContext() {
  if (typeof window === "undefined") {
    return {
      path: "/contact",
      referrer: "",
      url: ""
    }
  }

  return {
    path: window.location.pathname,
    referrer: document.referrer || "",
    url: window.location.href
  }
}

export function hasSharedAgentApi() {
  return Boolean(apiBaseUrl)
}

export function getAgentApiBaseUrl() {
  return apiBaseUrl
}

export function getAgentSiteId() {
  if (configuredSiteId) {
    return configuredSiteId
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname
  }

  return "lecrowndevelopment.com"
}

export function getAgentId() {
  return configuredAgentId
}

function getReturnToUrl() {
  if (typeof window === "undefined") {
    return ""
  }

  const returnTo = new URL(window.location.href)
  returnTo.hash = "agent-chat"

  return returnTo.toString()
}

function normalizeLinkedInMember(data) {
  const source = data?.member || data?.profile || data || {}
  const givenName =
    source.givenName || source.firstName || source.localizedFirstName || ""
  const familyName =
    source.familyName || source.lastName || source.localizedLastName || ""
  const name =
    source.name ||
    source.formattedName ||
    [givenName, familyName].filter(Boolean).join(" ").trim()
  const email = source.email || data?.email || ""
  const picture =
    source.picture || source.pictureUrl || source.profilePicture || ""
  const profileUrl =
    source.profileUrl || source.publicProfileUrl || source.linkedinUrl || ""
  const headline = source.headline || data?.headline || ""

  if (!name && !email && !picture && !profileUrl && !headline) {
    return null
  }

  return {
    email,
    familyName,
    givenName,
    headline,
    name,
    picture,
    profileUrl,
    provider: "linkedin"
  }
}

export function getLinkedInAuthStartUrl() {
  if (!apiBaseUrl || typeof window === "undefined") {
    return ""
  }

  const url = new URL(`${apiBaseUrl}/v1/auth/linkedin/start`)
  url.searchParams.set("agentId", getAgentId())
  url.searchParams.set("returnTo", getReturnToUrl())
  url.searchParams.set("siteId", getAgentSiteId())

  return url.toString()
}

export function readLinkedInAuthCallback() {
  if (typeof window === "undefined") {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const status = params.get("linkedin_auth") || ""
  const session = params.get("linkedin_session") || ""
  const hasDirectProfile =
    Boolean(params.get("linkedin_name")) ||
    Boolean(params.get("linkedin_email")) ||
    Boolean(params.get("linkedin_profile")) ||
    Boolean(params.get("linkedin_picture")) ||
    Boolean(params.get("linkedin_headline"))

  if (!status && !session && !hasDirectProfile && !params.get("linkedin_error")) {
    return null
  }

  const member = hasDirectProfile
    ? normalizeLinkedInMember({
        email: params.get("linkedin_email") || "",
        member: {
          familyName: params.get("linkedin_family_name") || "",
          givenName: params.get("linkedin_given_name") || "",
          headline: params.get("linkedin_headline") || "",
          name: params.get("linkedin_name") || "",
          picture: params.get("linkedin_picture") || "",
          profileUrl: params.get("linkedin_profile") || ""
        }
      })
    : null

  return {
    error:
      params.get("linkedin_error") ||
      (status ? params.get("error_description") || params.get("error") || "" : ""),
    member,
    session,
    status
  }
}

export function clearLinkedInAuthCallback() {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  let changed = false

  linkedInCallbackKeys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  })

  if (!changed) {
    return
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, document.title, nextUrl)
}

export function buildLeadPayload({
  contact,
  details,
  recommendedNextStep,
  match,
  messages
}) {
  return {
    agentId: getAgentId(),
    page: readPageContext(),
    siteId: getAgentSiteId(),
    submittedAt: new Date().toISOString(),
    transcript: messages.map((message) => ({
      name: message.label,
      role: message.speaker,
      text: message.text
    })),
    lead: {
      contact,
      details,
      recommendedNextStep
    },
    context: {
      experienceMatch: {
        bullets: match.bullets,
        headline: match.headline
      }
    }
  }
}

export async function resolveLinkedInAuthSession(session) {
  if (!apiBaseUrl) {
    throw new Error("Shared agent API is not configured.")
  }

  if (!session) {
    throw new Error("LinkedIn auth session is missing.")
  }

  const url = new URL(`${apiBaseUrl}/v1/auth/linkedin/session`)
  url.searchParams.set("session", session)
  url.searchParams.set("siteId", getAgentSiteId())

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  })

  let data = null

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `LinkedIn auth session lookup failed with ${response.status}.`
    )
  }

  return normalizeLinkedInMember(data)
}

export async function submitLeadToSharedAgent(payload) {
  if (!apiBaseUrl) {
    throw new Error("Shared agent API is not configured.")
  }

  const response = await fetch(`${apiBaseUrl}/v1/intake`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  })

  let data = null

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Shared agent API request failed with ${response.status}.`
    )
  }

  return {
    followUp: data?.followUp || null,
    leadId: data?.leadId || data?.id || "",
    reply:
      data?.reply ||
      "The shared agent received this intake and can continue the conversation from there."
  }
}
