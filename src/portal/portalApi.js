const portalApiBase = "/api/portal"

export class PortalApiError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.name = "PortalApiError"
    this.status = status
    this.details = details
  }
}

export function summarizePortalProject(project) {
  return {
    id: project.id,
    lastUpdated: project.lastUpdated,
    name: project.name,
    phase: project.phase,
    status: project.status,
    summary: project.summary
  }
}

async function buildPortalHeaders(auth, providedHeaders = {}) {
  const headers = new Headers(providedHeaders)
  headers.set("Accept", "application/json")

  if (auth.authDisabled) {
    if (auth.user?.email) {
      headers.set("X-Portal-Dev-Email", auth.user.email)
    }

    if (auth.user?.name) {
      headers.set("X-Portal-Dev-Name", auth.user.name)
    }

    if (auth.user?.roles?.length) {
      headers.set("X-Portal-Dev-Roles", auth.user.roles.join(","))
    }

    return headers
  }

  const accessToken = await auth.getAccessToken()
  if (!accessToken) {
    throw new Error("Portal session is missing an access token.")
  }

  headers.set("Authorization", `Bearer ${accessToken}`)
  return headers
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || ""

  if (!contentType.includes("application/json")) {
    return null
  }

  return await response.json().catch(() => null)
}

async function portalRequest(auth, path, options = {}) {
  const { body, headers: providedHeaders, ...rest } = options
  const headers = await buildPortalHeaders(auth, providedHeaders)
  const requestInit = {
    ...rest,
    headers
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json")
    requestInit.body = JSON.stringify(body)
  }

  const response = await fetch(`${portalApiBase}${path}`, requestInit)
  const data = await parseResponse(response)

  if (!response.ok) {
    throw new PortalApiError(
      data?.error || `Portal request failed with ${response.status}.`,
      response.status,
      data
    )
  }

  return data
}

export async function fetchPortalProjects(auth) {
  const data = await portalRequest(auth, "/projects")
  return Array.isArray(data?.projects) ? data.projects : []
}

export async function fetchPortalProject(auth, projectId) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}`
  )

  return data.project
}

export async function createPortalProject(auth, payload) {
  const data = await portalRequest(auth, "/projects", {
    body: payload,
    method: "POST"
  })

  return data.project
}

export async function updatePortalProject(auth, projectId, payload) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}`,
    {
      body: payload,
      method: "PATCH"
    }
  )

  return data.project
}

export async function createPortalBillingCheckout(auth, projectId) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/billing/checkout`,
    {
      method: "POST"
    }
  )

  return data
}

export async function invitePortalMember(auth, projectId, payload) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/invitations`,
    {
      body: payload,
      method: "POST"
    }
  )

  return {
    invitation: data.invitation || null,
    project: data.project
  }
}

export async function revokePortalMember(auth, projectId, email) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(email)}`,
    {
      method: "DELETE"
    }
  )

  return data.project
}

export async function resetPortalMemberPassword(auth, projectId, email, payload = {}) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(email)}/password-reset`,
    {
      body: payload,
      method: "POST"
    }
  )

  return {
    passwordReset: data.passwordReset || null,
    project: data.project
  }
}

export async function postPortalComment(auth, projectId, payload) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/comments`,
    {
      body: payload,
      method: "POST"
    }
  )

  return data.project
}

export async function updatePortalComment(auth, projectId, commentId, payload) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
    {
      body: payload,
      method: "PATCH"
    }
  )

  return data.project
}

export async function uploadPortalDocument(auth, projectId, payload) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/documents`,
    {
      body: payload,
      method: "POST"
    }
  )

  return data.project
}

export async function deletePortalDocument(auth, projectId, documentId) {
  const data = await portalRequest(
    auth,
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE"
    }
  )

  return data.project
}

export async function downloadPortalDocument(auth, projectId, portalDocument) {
  const headers = await buildPortalHeaders(auth)
  const path =
    portalDocument.fileUrl ||
    `${portalApiBase}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(portalDocument.id)}/download`

  const response = await fetch(path, { headers })

  if (!response.ok) {
    const data = await parseResponse(response)

    throw new PortalApiError(
      data?.error || `Document download failed with ${response.status}.`,
      response.status,
      data
    )
  }

  const blob = await response.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  const link = window.document.createElement("a")

  link.href = objectUrl
  link.download = portalDocument.fileName || portalDocument.name || "document"
  window.document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl)
  }, 0)
}
