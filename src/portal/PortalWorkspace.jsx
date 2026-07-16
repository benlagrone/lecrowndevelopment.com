import { useEffect, useMemo, useRef, useState } from "react"
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom"
import { usePortalAuth } from "./PortalAuthContext"
import { usePortalProjects } from "./PortalProjectsContext"
import { PortalLoadingScreen } from "./PortalRoot"
import {
  createPortalBillingCheckout,
  createPortalProject,
  deletePortalDocument,
  downloadPortalDocument,
  fetchPortalProject,
  invitePortalMember,
  postPortalComment,
  resetPortalMemberPassword,
  revokePortalMember,
  updatePortalComment,
  updatePortalProject,
  uploadPortalDocument
} from "./portalApi"

const portalTabs = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "preview", label: "Preview" },
  { id: "documents", label: "Documents" },
  { id: "billing", label: "Billing" },
  { id: "feedback", label: "Feedback" }
]

const projectStatusOptions = [
  "Not Started",
  "In Progress",
  "Review",
  "Completed"
]

const documentCategoryOrder = [
  "Scope & Agreements",
  "Site Structure / Outline",
  "Assets",
  "Deliverables"
]

function formatDate(value) {
  if (!value) {
    return "Date pending"
  }

  const normalizedValue = String(value)
  const parsedDate = new Date(normalizedValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: normalizedValue.includes("T") ? "short" : undefined
  }).format(parsedDate)
}

function statusClassName(status) {
  return status
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function groupDocuments(documents) {
  const itemsByCategory = new Map()

  documents.forEach((document) => {
    const category = document.category?.trim() || "Deliverables"
    if (!itemsByCategory.has(category)) {
      itemsByCategory.set(category, [])
    }

    itemsByCategory.get(category).push(document)
  })

  const orderedCategories = documentCategoryOrder.filter((category) =>
    itemsByCategory.has(category)
  )
  const extraCategories = [...itemsByCategory.keys()]
    .filter((category) => !documentCategoryOrder.includes(category))
    .sort((left, right) => left.localeCompare(right))

  return [...orderedCategories, ...extraCategories].map((category) => ({
    category,
    items: itemsByCategory.get(category) || []
  }))
}

function ManualInviteEmail({ result }) {
  if (!result?.emailContent) {
    return null
  }

  return (
    <span className="portal-manual-email">
      <span className="portal-manual-email-label">Manual email to send</span>
      <span>
        <strong>Subject:</strong> {result.emailContent.subject}
      </span>
      <textarea readOnly rows={9} value={result.emailContent.body} />
    </span>
  )
}

function emptyCreateProjectForm() {
  return {
    clientEmail: "",
    clientName: "",
    name: ""
  }
}

function emptyUploadForm() {
  return {
    category: documentCategoryOrder[0],
    description: "",
    file: null,
    name: ""
  }
}

function emptyInviteForm() {
  return {
    email: "",
    name: ""
  }
}

function buildProjectSettingsForm(project) {
  const billing = project.billing || {}

  return {
    billing: {
      amountLabel: billing.amountLabel || "",
      checkoutUrl: billing.checkoutUrl || "",
      description: billing.description || "",
      dueDate: billing.dueDate || "",
      enabled: Boolean(billing.enabled),
      priceLookupKey: billing.priceLookupKey || "",
      status: billing.status || "Not sent"
    },
    phase: project.phase || "",
    status: project.status || projectStatusOptions[0]
  }
}

function formatTimelineBadge(entry) {
  if (entry.badge?.trim()) {
    return entry.badge.trim()
  }

  const tone = entry.tone?.trim()
  if (!tone) {
    return ""
  }

  return tone
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function summarizeProject(project) {
  return {
    id: project.id,
    lastUpdated: project.lastUpdated,
    name: project.name,
    phase: project.phase,
    status: project.status,
    summary: project.summary
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Document upload could not be prepared."))
        return
      }

      const [, base64Payload = ""] = reader.result.split(",")
      resolve(base64Payload)
    }

    reader.onerror = () => {
      reject(new Error("Document upload could not be prepared."))
    }

    reader.readAsDataURL(file)
  })
}

function PortalStatusPill({ children, tone }) {
  return (
    <span className={`portal-status-pill portal-status-${statusClassName(tone)}`}>
      {children}
    </span>
  )
}

function PortalUnauthorized() {
  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <span className="portal-kicker">Access denied</span>
        <h1 className="portal-login-title">
          This project is not assigned to your account.
        </h1>
        <p className="portal-login-copy">
          Project access is scoped per client. Contact LeCrown Development if
          the wrong user was invited or a project membership needs to be added.
        </p>
        <Link className="button" to="/portal">
          Return to portal home
        </Link>
      </section>
    </main>
  )
}

function PortalNotFound() {
  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <span className="portal-kicker">Not found</span>
        <h1 className="portal-login-title">That project workspace does not exist.</h1>
        <p className="portal-login-copy">
          The URL may be wrong or the project has not been provisioned in the
          portal yet.
        </p>
        <Link className="button" to="/portal">
          Return to portal home
        </Link>
      </section>
    </main>
  )
}

function PortalRequestError({ message }) {
  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <span className="portal-kicker">Portal error</span>
        <h1 className="portal-login-title">The workspace could not be loaded.</h1>
        <p className="portal-login-copy">{message}</p>
        <Link className="button" to="/portal">
          Return to portal home
        </Link>
      </section>
    </main>
  )
}

export default function PortalWorkspace() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const auth = usePortalAuth()
  const portalProjects = usePortalProjects()
  const uploadInputRef = useRef(null)
  const [projectState, setProjectState] = useState({
    error: "",
    loading: true,
    project: null,
    statusCode: 0
  })
  const [draftComment, setDraftComment] = useState("")
  const [commentState, setCommentState] = useState({
    error: "",
    pending: false,
    statusTarget: ""
  })
  const [projectSettingsForm, setProjectSettingsForm] = useState({
    billing: {
      amountLabel: "",
      checkoutUrl: "",
      description: "",
      dueDate: "",
      enabled: false,
      priceLookupKey: "",
      status: "Not sent"
    },
    phase: "",
    status: projectStatusOptions[0]
  })
  const [projectSettingsState, setProjectSettingsState] = useState({
    error: "",
    pending: false
  })
  const [createProjectForm, setCreateProjectForm] = useState(
    emptyCreateProjectForm()
  )
  const [createProjectState, setCreateProjectState] = useState({
    error: "",
    pending: false
  })
  const [inviteForm, setInviteForm] = useState(emptyInviteForm())
  const [inviteState, setInviteState] = useState({
    error: "",
    pending: false,
    result: null
  })
  const [memberActionState, setMemberActionState] = useState({
    action: "",
    email: "",
    error: "",
    result: null
  })
  const [uploadForm, setUploadForm] = useState(emptyUploadForm())
  const [uploadState, setUploadState] = useState({
    downloadingId: "",
    error: "",
    pending: false
  })
  const [documentActionState, setDocumentActionState] = useState({
    deletingId: "",
    error: ""
  })
  const [billingActionState, setBillingActionState] = useState({
    error: "",
    pending: false
  })
  const [passwordState, setPasswordState] = useState({
    error: "",
    pending: false,
    result: null
  })

  useEffect(() => {
    let cancelled = false

    if (!auth.ready || !auth.isAuthenticated) {
      return () => {
        cancelled = true
      }
    }

    setProjectState({
      error: "",
      loading: true,
      project: null,
      statusCode: 0
    })

    fetchPortalProject(auth, projectId)
      .then((project) => {
        if (cancelled) {
          return
        }

        setProjectState({
          error: "",
          loading: false,
          project,
          statusCode: 200
        })
        setProjectSettingsForm(buildProjectSettingsForm(project))
        portalProjects.upsertProject(project)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setProjectState({
          error: error.message,
          loading: false,
          project: null,
          statusCode: error.status || 500
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    auth.isAuthenticated,
    auth.ready,
    auth.user?.email,
    auth.user?.id,
    projectId
  ])

  const project = projectState.project
  const activeTab = portalTabs.some((tab) => tab.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview"
  const documentsByCategory = groupDocuments(project?.documents || [])
  const isAdmin = auth.hasRole("admin")
  const canManageAccess =
    isAdmin && auth.user?.email?.toLowerCase() === "benjaminlagrone@gmail.com"
  const clientMembers = project?.members?.filter((member) => member.role === "client") || []
  const overviewInstructions =
    project?.preview?.reviewChecklist?.filter(Boolean) || []
  const timelineEntries = Array.isArray(project?.timeline) ? project.timeline : []
  const visibleProjects = useMemo(() => {
    if (!project) {
      return portalProjects.projects
    }

    if (portalProjects.projects.some((entry) => entry.id === project.id)) {
      return portalProjects.projects
    }

    return [summarizeProject(project), ...portalProjects.projects]
  }, [portalProjects.projects, project])

  function applyProject(projectPayload) {
    setProjectState({
      error: "",
      loading: false,
      project: projectPayload,
      statusCode: 200
    })
    setProjectSettingsForm(buildProjectSettingsForm(projectPayload))
    portalProjects.upsertProject(projectPayload)
  }

  function selectTab(tabId) {
    setSearchParams({ tab: tabId }, { replace: true })
  }

  async function handleCommentSubmit(event) {
    event.preventDefault()
    const message = draftComment.trim()

    if (!message || !project) {
      return
    }

    setCommentState({
      error: "",
      pending: true,
      statusTarget: ""
    })

    try {
      const nextProject = await postPortalComment(auth, project.id, { message })
      applyProject(nextProject)
      setDraftComment("")
    } catch (error) {
      setCommentState({
        error: error.message,
        pending: false,
        statusTarget: ""
      })
      return
    }

    setCommentState({
      error: "",
      pending: false,
      statusTarget: ""
    })
  }

  async function toggleCommentStatus(commentId, nextStatus) {
    if (!project) {
      return
    }

    setCommentState({
      error: "",
      pending: false,
      statusTarget: commentId
    })

    try {
      const nextProject = await updatePortalComment(auth, project.id, commentId, {
        status: nextStatus
      })
      applyProject(nextProject)
    } catch (error) {
      setCommentState({
        error: error.message,
        pending: false,
        statusTarget: ""
      })
      return
    }

    setCommentState({
      error: "",
      pending: false,
      statusTarget: ""
    })
  }

  async function handleProjectSettingsSave(event) {
    event.preventDefault()

    if (!project) {
      return
    }

    setProjectSettingsState({
      error: "",
      pending: true
    })

    try {
      const nextProject = await updatePortalProject(auth, project.id, {
        billing: projectSettingsForm.billing,
        phase: projectSettingsForm.phase,
        status: projectSettingsForm.status
      })
      applyProject(nextProject)
    } catch (error) {
      setProjectSettingsState({
        error: error.message,
        pending: false
      })
      return
    }

    setProjectSettingsState({
      error: "",
      pending: false
    })
  }

  async function handleBillingCheckout() {
    if (!project) {
      return
    }

    setBillingActionState({
      error: "",
      pending: true
    })

    try {
      const result = await createPortalBillingCheckout(auth, project.id)
      if (!result?.url) {
        throw new Error("Billing checkout is not configured for this project.")
      }

      window.location.assign(result.url)
    } catch (error) {
      setBillingActionState({
        error: error.message,
        pending: false
      })
    }
  }

  async function handleProjectCreate(event) {
    event.preventDefault()

    setCreateProjectState({
      error: "",
      pending: true
    })

    try {
      const nextProject = await createPortalProject(auth, {
        members: [
          {
            email: auth.user.email,
            name: auth.user.name,
            role: "admin"
          },
          {
            email: createProjectForm.clientEmail,
            name:
              createProjectForm.clientName.trim() ||
              createProjectForm.clientEmail.trim(),
            role: "client"
          }
        ],
        name: createProjectForm.name,
        phase: "Kickoff",
        preview: {
          notes: "Preview link pending.",
          reviewChecklist: [],
          url: "/"
        },
        status: "Not Started",
        summary:
          "Project workspace created. Add the summary, files, and first milestone."
      })

      portalProjects.upsertProject(nextProject)
      setCreateProjectForm(emptyCreateProjectForm())
      navigate(`/portal/${nextProject.id}`)
    } catch (error) {
      setCreateProjectState({
        error: error.message,
        pending: false
      })
      return
    }

    setCreateProjectState({
      error: "",
      pending: false
    })
  }

  async function handleDocumentUpload(event) {
    event.preventDefault()

    if (!project) {
      return
    }

    if (!uploadForm.file) {
      setUploadState((currentState) => ({
        ...currentState,
        error: "Choose a file before uploading."
      }))
      return
    }

    setUploadState((currentState) => ({
      ...currentState,
      error: "",
      pending: true
    }))

    try {
      const contentBase64 = await readFileAsBase64(uploadForm.file)
      const nextProject = await uploadPortalDocument(auth, project.id, {
        category: uploadForm.category,
        contentBase64,
        contentType: uploadForm.file.type || "application/octet-stream",
        description: uploadForm.description,
        fileName: uploadForm.file.name,
        name: uploadForm.name.trim() || uploadForm.file.name
      })

      applyProject(nextProject)
      setUploadForm(emptyUploadForm())

      if (uploadInputRef.current) {
        uploadInputRef.current.value = ""
      }
    } catch (error) {
      setUploadState((currentState) => ({
        ...currentState,
        error: error.message,
        pending: false
      }))
      return
    }

    setUploadState((currentState) => ({
      ...currentState,
      error: "",
      pending: false
    }))
  }

  async function handleInviteSubmit(event) {
    event.preventDefault()

    if (!project) {
      return
    }

    setInviteState({
      error: "",
      pending: true,
      result: null
    })

    try {
      const result = await invitePortalMember(auth, project.id, {
        email: inviteForm.email,
        name: inviteForm.name
      })
      applyProject(result.project)
      setInviteForm(emptyInviteForm())
      setInviteState({
        error: "",
        pending: false,
        result: result.invitation
      })
    } catch (error) {
      setInviteState({
        error: error.message,
        pending: false,
        result: null
      })
    }
  }

  async function handleResendAccess(member) {
    if (!project) {
      return
    }

    setMemberActionState({
      action: "resend",
      email: member.email,
      error: "",
      result: null
    })

    try {
      const result = await invitePortalMember(auth, project.id, {
        email: member.email,
        name: member.name
      })
      applyProject(result.project)
      setMemberActionState({
        action: "",
        email: member.email,
        error: "",
        result: result.invitation
      })
    } catch (error) {
      setMemberActionState({
        action: "",
        email: member.email,
        error: error.message,
        result: null
      })
    }
  }

  async function handleRevokeAccess(member) {
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Revoke portal access for ${member.email} on ${project.name}?`
    )
    if (!confirmed) {
      return
    }

    setMemberActionState({
      action: "revoke",
      email: member.email,
      error: "",
      result: null
    })

    try {
      const updatedProject = await revokePortalMember(
        auth,
        project.id,
        member.email
      )
      applyProject(updatedProject)
      setMemberActionState({
        action: "",
        email: member.email,
        error: "",
        result: {
          revoked: true
        }
      })
    } catch (error) {
      setMemberActionState({
        action: "",
        email: member.email,
        error: error.message,
        result: null
      })
    }
  }

  async function handleResetPassword(member) {
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Reset the portal password for ${member.email}?`
    )
    if (!confirmed) {
      return
    }

    setMemberActionState({
      action: "password-reset",
      email: member.email,
      error: "",
      result: null
    })

    try {
      const result = await resetPortalMemberPassword(auth, project.id, member.email, {
        name: member.name
      })
      applyProject(result.project)
      setMemberActionState({
        action: "",
        email: member.email,
        error: "",
        result: result.passwordReset
      })
    } catch (error) {
      setMemberActionState({
        action: "",
        email: member.email,
        error: error.message,
        result: null
      })
    }
  }

  async function handleResetMyPassword() {
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Reset the portal password for ${auth.user.email}?`
    )
    if (!confirmed) {
      return
    }

    setPasswordState({
      error: "",
      pending: true,
      result: null
    })

    try {
      const result = await resetPortalMemberPassword(
        auth,
        project.id,
        auth.user.email,
        {
          name: auth.user.name
        }
      )
      applyProject(result.project)
      setPasswordState({
        error: "",
        pending: false,
        result: result.passwordReset
      })
    } catch (error) {
      setPasswordState({
        error: error.message,
        pending: false,
        result: null
      })
    }
  }

  async function handleDocumentDownload(portalDocument) {
    if (!project) {
      return
    }

    setUploadState((currentState) => ({
      ...currentState,
      downloadingId: portalDocument.id,
      error: ""
    }))

    try {
      await downloadPortalDocument(auth, project.id, portalDocument)
    } catch (error) {
      setUploadState((currentState) => ({
        ...currentState,
        downloadingId: "",
        error: error.message
      }))
      return
    }

    setUploadState((currentState) => ({
      ...currentState,
      downloadingId: ""
    }))
  }

  async function handleDocumentDelete(portalDocument) {
    if (!project) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${portalDocument.name} from ${project.name}?`
    )
    if (!confirmed) {
      return
    }

    setDocumentActionState({
      deletingId: portalDocument.id,
      error: ""
    })

    try {
      const nextProject = await deletePortalDocument(
        auth,
        project.id,
        portalDocument.id
      )
      applyProject(nextProject)
    } catch (error) {
      setDocumentActionState({
        deletingId: "",
        error: error.message
      })
      return
    }

    setDocumentActionState({
      deletingId: "",
      error: ""
    })
  }

  if (projectState.loading) {
    return <PortalLoadingScreen title="Opening the project workspace." />
  }

  if (projectState.statusCode === 404) {
    return <PortalNotFound />
  }

  if (projectState.statusCode === 403) {
    return <PortalUnauthorized />
  }

  if (!project) {
    return <PortalRequestError message={projectState.error} />
  }

  return (
    <main className="portal-page">
      <header className="portal-topbar">
        <div>
          <Link className="portal-brand" to="/portal">
            LeCrown Client Portal
          </Link>
          <p className="portal-subtitle">
            Secure project tracking, previews, documents, and feedback.
          </p>
        </div>

        <div className="portal-session-block">
          {auth.authDisabled ? (
            <PortalStatusPill tone="preview-mode">Preview mode</PortalStatusPill>
          ) : null}
          <div className="portal-user-card">
            <strong>{auth.user.name}</strong>
            <span>{auth.user.email}</span>
          </div>
          {!auth.authDisabled ? (
            <button className="button-secondary" onClick={auth.logout} type="button">
              Sign out
            </button>
          ) : (
            <Link className="button-secondary" to="/">
              Exit preview
            </Link>
          )}
        </div>
      </header>

      <div className="portal-grid">
        <aside className="portal-sidebar">
          <section className="portal-sidebar-section">
            <span className="portal-kicker">Projects</span>
            <div className="portal-project-list">
              {visibleProjects.length ? (
                visibleProjects.map((item) => (
                  <NavLink
                    key={item.id}
                    className={({ isActive }) =>
                      `portal-project-link${isActive ? " active" : ""}`
                    }
                    to={`/portal/${item.id}`}
                  >
                    <strong>{item.name}</strong>
                    <span>{item.phase}</span>
                  </NavLink>
                ))
              ) : (
                <p className="portal-muted-copy">
                  {portalProjects.loading
                    ? "Loading project access."
                    : "No projects are assigned yet."}
                </p>
              )}
            </div>
          </section>

          {canManageAccess ? (
            <section className="portal-sidebar-section portal-sidebar-card">
              <span className="portal-kicker">Project access</span>
              <p>
                Clients only see workspaces that match their account membership.
              </p>
              <ul className="portal-bullet-list portal-member-list">
                {clientMembers.map((member) => (
                  <li className="portal-member-row" key={member.email}>
                    <span>
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </span>
                    <span className="portal-member-actions">
                      <button
                        className="portal-inline-button"
                        disabled={
                          memberActionState.action === "resend" &&
                          memberActionState.email === member.email
                        }
                        onClick={() => handleResendAccess(member)}
                        type="button"
                      >
                        {memberActionState.action === "resend" &&
                        memberActionState.email === member.email
                          ? "Sending..."
                          : "Resend"}
                      </button>
                      <button
                        className="portal-inline-button"
                        disabled={
                          memberActionState.action === "password-reset" &&
                          memberActionState.email === member.email
                        }
                        onClick={() => handleResetPassword(member)}
                        type="button"
                      >
                        {memberActionState.action === "password-reset" &&
                        memberActionState.email === member.email
                          ? "Resetting..."
                          : "Reset password"}
                      </button>
                      <button
                        className="portal-inline-button portal-inline-button-danger"
                        disabled={
                          memberActionState.action === "revoke" &&
                          memberActionState.email === member.email
                        }
                        onClick={() => handleRevokeAccess(member)}
                        type="button"
                      >
                        {memberActionState.action === "revoke" &&
                        memberActionState.email === member.email
                          ? "Revoking..."
                          : "Revoke"}
                        </button>
                      </span>
                    {memberActionState.email === member.email &&
                    memberActionState.error ? (
                      <span className="portal-member-message portal-member-message-error">
                        {memberActionState.error}
                      </span>
                    ) : null}
                    {memberActionState.email === member.email &&
                    memberActionState.result?.warning ? (
                      <span className="portal-member-message">
                        {memberActionState.result.warning}
                      </span>
                    ) : null}
                    {memberActionState.email === member.email &&
                    memberActionState.result?.temporaryPassword ? (
                      <span className="portal-member-message">
                        Manual password to send:{" "}
                        <code>{memberActionState.result.temporaryPassword}</code>
                      </span>
                    ) : null}
                    {memberActionState.email === member.email &&
                    memberActionState.result?.emailSent ? (
                      <span className="portal-member-message">
                        {memberActionState.result.operation === "password-reset"
                          ? "Password reset email sent"
                          : "Setup email sent"}
                        {memberActionState.result.messageId
                          ? ` (${memberActionState.result.messageId})`
                          : ""}.
                      </span>
                    ) : null}
                    {memberActionState.email === member.email ? (
                      <ManualInviteEmail result={memberActionState.result} />
                    ) : null}
                    {memberActionState.email === member.email &&
                    memberActionState.result?.revoked ? (
                      <span className="portal-member-message">
                        Access revoked.
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {canManageAccess ? (
            <section className="portal-sidebar-section portal-sidebar-card">
              <span className="portal-kicker">Invite client</span>
              <form className="portal-comment-form" onSubmit={handleInviteSubmit}>
                <label className="field" htmlFor="portal-invite-name">
                  <span>Client name</span>
                  <input
                    id="portal-invite-name"
                    onChange={(event) =>
                      setInviteForm((currentForm) => ({
                        ...currentForm,
                        name: event.target.value
                      }))
                    }
                    placeholder="Jessica Huang"
                    value={inviteForm.name}
                  />
                </label>
                <label className="field" htmlFor="portal-invite-email">
                  <span>Client email</span>
                  <input
                    id="portal-invite-email"
                    onChange={(event) =>
                      setInviteForm((currentForm) => ({
                        ...currentForm,
                        email: event.target.value
                      }))
                    }
                    placeholder="jessica@example.com"
                    type="email"
                    value={inviteForm.email}
                  />
                </label>
                <button
                  className="button"
                  disabled={inviteState.pending}
                  type="submit"
                >
                  {inviteState.pending ? "Provisioning..." : "Invite client"}
                </button>
                {inviteState.error ? (
                  <p className="portal-auth-error">{inviteState.error}</p>
                ) : null}
                {inviteState.result?.emailSent ? (
                  <p className="portal-muted-copy">
                    Invite email sent by{" "}
                    <strong>{inviteState.result.delivery}</strong>
                    {inviteState.result.messageId
                      ? ` (${inviteState.result.messageId})`
                      : ""}.
                  </p>
                ) : null}
                {inviteState.result?.warning ? (
                  <p className="portal-muted-copy">{inviteState.result.warning}</p>
                ) : null}
                {inviteState.result?.temporaryPassword ? (
                  <p className="portal-muted-copy">
                    Manual password to send:{" "}
                    <code>{inviteState.result.temporaryPassword}</code>
                  </p>
                ) : null}
                <ManualInviteEmail result={inviteState.result} />
              </form>
            </section>
          ) : null}

          {canManageAccess ? (
            <section className="portal-sidebar-section portal-sidebar-card">
              <span className="portal-kicker">Password controls</span>
              <p>
                Portal passwords are managed in Pericope Keycloak. Resetting
                your password here creates a temporary password and forces a
                password change on next sign-in.
              </p>
              <button
                className="button"
                disabled={passwordState.pending}
                onClick={handleResetMyPassword}
                type="button"
              >
                {passwordState.pending ? "Resetting..." : "Reset my password"}
              </button>
              {passwordState.error ? (
                <p className="portal-auth-error">{passwordState.error}</p>
              ) : null}
              {passwordState.result?.emailSent ? (
                <p className="portal-muted-copy">
                  Password reset email sent by{" "}
                  <strong>{passwordState.result.delivery}</strong>
                  {passwordState.result.messageId
                    ? ` (${passwordState.result.messageId})`
                    : ""}.
                </p>
              ) : null}
              {passwordState.result?.warning ? (
                <p className="portal-muted-copy">{passwordState.result.warning}</p>
              ) : null}
              {passwordState.result?.temporaryPassword ? (
                <p className="portal-muted-copy">
                  Manual password to send:{" "}
                  <code>{passwordState.result.temporaryPassword}</code>
                </p>
              ) : null}
              <ManualInviteEmail result={passwordState.result} />
            </section>
          ) : null}

          <section className="portal-sidebar-section portal-sidebar-card">
            <span className="portal-kicker">Admin controls</span>
            <p>
              Status updates, file uploads, and project creation now save through
              the live portal API.
            </p>
          </section>

          {isAdmin ? (
            <section className="portal-sidebar-section portal-sidebar-card">
              <span className="portal-kicker">New project</span>
              <form className="portal-comment-form" onSubmit={handleProjectCreate}>
                <label className="field" htmlFor="portal-project-name">
                  <span>Project name</span>
                  <input
                    id="portal-project-name"
                    onChange={(event) =>
                      setCreateProjectForm((currentForm) => ({
                        ...currentForm,
                        name: event.target.value
                      }))
                    }
                    placeholder="Civic Expansion Site"
                    value={createProjectForm.name}
                  />
                </label>
                <label className="field" htmlFor="portal-client-name">
                  <span>Client name</span>
                  <input
                    id="portal-client-name"
                    onChange={(event) =>
                      setCreateProjectForm((currentForm) => ({
                        ...currentForm,
                        clientName: event.target.value
                      }))
                    }
                    placeholder="Jane Smith"
                    value={createProjectForm.clientName}
                  />
                </label>
                <label className="field" htmlFor="portal-client-email">
                  <span>Client email</span>
                  <input
                    id="portal-client-email"
                    onChange={(event) =>
                      setCreateProjectForm((currentForm) => ({
                        ...currentForm,
                        clientEmail: event.target.value
                      }))
                    }
                    placeholder="jane@example.com"
                    type="email"
                    value={createProjectForm.clientEmail}
                  />
                </label>
                <button
                  className="button"
                  disabled={createProjectState.pending}
                  type="submit"
                >
                  {createProjectState.pending ? "Creating project..." : "Create project"}
                </button>
                {createProjectState.error ? (
                  <p className="portal-auth-error">{createProjectState.error}</p>
                ) : null}
              </form>
            </section>
          ) : null}
        </aside>

        <section className="portal-main">
          <section className="portal-hero">
            <div className="portal-hero-copy">
              <span className="portal-kicker">Project workspace</span>
              <h1>{project.name}</h1>
              <p>{project.summary}</p>
            </div>

            <div className="portal-hero-status">
              <PortalStatusPill tone={project.status}>{project.status}</PortalStatusPill>
              <PortalStatusPill tone="phase">{project.phase}</PortalStatusPill>
            </div>
          </section>

          <section className="portal-tabs" aria-label="Portal sections">
            {portalTabs.map((tab) => (
              <button
                key={tab.id}
                className={`portal-tab-button${activeTab === tab.id ? " active" : ""}`}
                onClick={() => selectTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </section>

          {activeTab === "overview" ? (
            <section className="portal-section-panel">
              <div className="portal-meta-grid">
                <article className="portal-metric-card">
                  <span className="portal-metric-label">Project name</span>
                  <strong>{project.name}</strong>
                </article>
                <article className="portal-metric-card">
                  <span className="portal-metric-label">Status</span>
                  <strong>{project.status}</strong>
                </article>
                <article className="portal-metric-card">
                  <span className="portal-metric-label">Current phase</span>
                  <strong>{project.phase}</strong>
                </article>
                <article className="portal-metric-card">
                  <span className="portal-metric-label">Last updated</span>
                  <strong>{formatDate(project.lastUpdated)}</strong>
                </article>
              </div>

              <div className="portal-panel-grid">
                <article className="portal-content-card">
                  <h2>Current focus</h2>
                  <ul className="portal-bullet-list">
                    {project.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="portal-content-card">
                  <h2>Client instructions</h2>
                  {overviewInstructions.length ? (
                    <ul className="portal-bullet-list">
                      {overviewInstructions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      Review the documents and feedback tabs for the next items
                      that need your approval, upload, or response.
                    </p>
                  )}
                </article>

                {isAdmin ? (
                  <article className="portal-content-card">
                    <h2>Update project</h2>
                    <form
                      className="portal-comment-form"
                      onSubmit={handleProjectSettingsSave}
                    >
                      <label className="field" htmlFor="portal-project-status">
                        <span>Status</span>
                        <select
                          id="portal-project-status"
                          onChange={(event) =>
                            setProjectSettingsForm((currentForm) => ({
                              ...currentForm,
                              status: event.target.value
                            }))
                          }
                          value={projectSettingsForm.status}
                        >
                          {projectStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field" htmlFor="portal-project-phase">
                        <span>Current phase</span>
                        <input
                          id="portal-project-phase"
                          onChange={(event) =>
                            setProjectSettingsForm((currentForm) => ({
                              ...currentForm,
                              phase: event.target.value
                            }))
                          }
                          value={projectSettingsForm.phase}
                        />
                      </label>
                      <button
                        className="button"
                        disabled={projectSettingsState.pending}
                        type="submit"
                      >
                        {projectSettingsState.pending
                          ? "Saving update..."
                          : "Save project details"}
                      </button>
                      {projectSettingsState.error ? (
                        <p className="portal-auth-error">
                          {projectSettingsState.error}
                        </p>
                      ) : null}
                    </form>
                  </article>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab === "timeline" ? (
            <section className="portal-section-panel">
              <div className="portal-section-header">
                <div>
                  <h2>Timeline</h2>
                  <p>Key project milestones and submission history.</p>
                </div>
              </div>

              {timelineEntries.length ? (
                <div className="portal-timeline-list">
                  {timelineEntries.map((entry) => {
                    const timelineBadge = formatTimelineBadge(entry)

                    return (
                      <article className="portal-timeline-item" key={entry.id}>
                        <div className="portal-timeline-rail" aria-hidden="true">
                          <span className="portal-timeline-dot" />
                        </div>
                        <div className="portal-timeline-card">
                          <div className="portal-timeline-head">
                            <div className="portal-timeline-copy">
                              <strong>{entry.title}</strong>
                              <span>{formatDate(entry.date)}</span>
                            </div>
                            {timelineBadge ? (
                              <PortalStatusPill tone={entry.tone || "phase"}>
                                {timelineBadge}
                              </PortalStatusPill>
                            ) : null}
                          </div>
                          {entry.description ? <p>{entry.description}</p> : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <p className="portal-empty-copy">
                  No timeline milestones have been recorded yet.
                </p>
              )}
            </section>
          ) : null}

          {activeTab === "preview" ? (
            <section className="portal-section-panel portal-panel-grid">
              <article className="portal-content-card">
                <h2>Latest preview</h2>
                <p>{project.preview.notes}</p>
                <a
                  className="button"
                  href={project.preview.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open preview
                </a>
              </article>

              <article className="portal-content-card">
                <h2>Review checklist</h2>
                <ul className="portal-bullet-list">
                  {project.preview.reviewChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </section>
          ) : null}

          {activeTab === "documents" ? (
            <section className="portal-section-panel">
              <div className="portal-section-header">
                <div>
                  <h2>Documents</h2>
                  <p>
                    Files are served through an authenticated proxy and only to
                    users mapped to this project.
                  </p>
                </div>
              </div>

              {documentActionState.error ? (
                <p className="portal-auth-error">{documentActionState.error}</p>
              ) : null}

              {isAdmin ? (
                <article className="portal-content-card">
                  <h2>Upload document</h2>
                  <form className="portal-comment-form" onSubmit={handleDocumentUpload}>
                    <label className="field" htmlFor="portal-document-category">
                      <span>Category</span>
                      <select
                        id="portal-document-category"
                        onChange={(event) =>
                          setUploadForm((currentForm) => ({
                            ...currentForm,
                            category: event.target.value
                          }))
                        }
                        value={uploadForm.category}
                      >
                        {documentCategoryOrder.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field" htmlFor="portal-document-name">
                      <span>Document label</span>
                      <input
                        id="portal-document-name"
                        onChange={(event) =>
                          setUploadForm((currentForm) => ({
                            ...currentForm,
                            name: event.target.value
                          }))
                        }
                        placeholder="Sprint handoff"
                        value={uploadForm.name}
                      />
                    </label>
                    <label className="field" htmlFor="portal-document-description">
                      <span>Description</span>
                      <input
                        id="portal-document-description"
                        onChange={(event) =>
                          setUploadForm((currentForm) => ({
                            ...currentForm,
                            description: event.target.value
                          }))
                        }
                        placeholder="What the client should expect from this file."
                        value={uploadForm.description}
                      />
                    </label>
                    <label className="field" htmlFor="portal-document-file">
                      <span>File</span>
                      <input
                        id="portal-document-file"
                        onChange={(event) =>
                          setUploadForm((currentForm) => ({
                            ...currentForm,
                            file: event.target.files?.[0] || null
                          }))
                        }
                        ref={uploadInputRef}
                        type="file"
                      />
                    </label>
                    <button
                      className="button"
                      disabled={uploadState.pending}
                      type="submit"
                    >
                      {uploadState.pending ? "Uploading..." : "Upload document"}
                    </button>
                    {uploadState.error ? (
                      <p className="portal-auth-error">{uploadState.error}</p>
                    ) : null}
                  </form>
                </article>
              ) : null}

              {documentsByCategory.length ? (
                documentsByCategory.map(({ category, items }) => (
                  <article className="portal-document-group" key={category}>
                    <h3>{category}</h3>
                    <div className="portal-document-list">
                      {items.map((portalDocument) => (
                        <div className="portal-document-row" key={portalDocument.id}>
                          <div>
                            <strong>{portalDocument.name}</strong>
                            <p>{portalDocument.description}</p>
                            <span>
                              Updated {formatDate(portalDocument.updatedAt)}
                            </span>
                          </div>
                          <div className="portal-document-actions">
                            <button
                              className="button-secondary"
                              disabled={uploadState.downloadingId === portalDocument.id}
                              onClick={() => handleDocumentDownload(portalDocument)}
                              type="button"
                            >
                              {uploadState.downloadingId === portalDocument.id
                                ? "Preparing..."
                                : "Download"}
                            </button>
                            {canManageAccess ? (
                              <button
                                className="button-secondary portal-document-delete"
                                disabled={
                                  documentActionState.deletingId === portalDocument.id
                                }
                                onClick={() => handleDocumentDelete(portalDocument)}
                                type="button"
                              >
                                {documentActionState.deletingId === portalDocument.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <p className="portal-empty-copy">No files have been added yet.</p>
              )}
            </section>
          ) : null}

          {activeTab === "billing" ? (
            <section className="portal-section-panel portal-billing-grid">
              <article className="portal-content-card portal-billing-summary">
                <div>
                  <h2>Billing</h2>
                  <p>
                    {project.billing?.description ||
                      "Credit-card payment will appear here when billing is ready for this project."}
                  </p>
                </div>

                <div className="portal-billing-facts">
                  <span>
                    <strong>Amount</strong>
                    {project.billing?.amountLabel || "Pending"}
                  </span>
                  <span>
                    <strong>Status</strong>
                    {project.billing?.status || "Not sent"}
                  </span>
                  <span>
                    <strong>Due date</strong>
                    {project.billing?.dueDate
                      ? formatDate(project.billing.dueDate)
                      : "Pending"}
                  </span>
                </div>

                {project.billing?.enabled ? (
                  <button
                    className="button"
                    disabled={billingActionState.pending}
                    onClick={handleBillingCheckout}
                    type="button"
                  >
                    {billingActionState.pending
                      ? "Opening billing..."
                      : "Pay by credit card"}
                  </button>
                ) : (
                  <span className="portal-disabled-action">
                    Credit-card billing is not enabled yet.
                  </span>
                )}

                {billingActionState.error ? (
                  <p className="portal-auth-error">{billingActionState.error}</p>
                ) : null}
              </article>

              {isAdmin ? (
                <article className="portal-content-card">
                  <h2>Configure billing</h2>
                  <form
                    className="portal-comment-form"
                    onSubmit={handleProjectSettingsSave}
                  >
                    <label className="portal-checkbox-row" htmlFor="portal-billing-enabled">
                      <input
                        checked={projectSettingsForm.billing.enabled}
                        id="portal-billing-enabled"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              enabled: event.target.checked
                            }
                          }))
                        }
                        type="checkbox"
                      />
                      <span>Enable credit-card billing for this project</span>
                    </label>
                    <label className="field" htmlFor="portal-billing-amount">
                      <span>Amount label</span>
                      <input
                        id="portal-billing-amount"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              amountLabel: event.target.value
                            }
                          }))
                        }
                        placeholder="$2,500.00"
                        value={projectSettingsForm.billing.amountLabel}
                      />
                    </label>
                    <label className="field" htmlFor="portal-billing-status">
                      <span>Billing status</span>
                      <input
                        id="portal-billing-status"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              status: event.target.value
                            }
                          }))
                        }
                        placeholder="Invoice ready"
                        value={projectSettingsForm.billing.status}
                      />
                    </label>
                    <label className="field" htmlFor="portal-billing-due-date">
                      <span>Due date</span>
                      <input
                        id="portal-billing-due-date"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              dueDate: event.target.value
                            }
                          }))
                        }
                        type="date"
                        value={projectSettingsForm.billing.dueDate}
                      />
                    </label>
                    <label className="field" htmlFor="portal-billing-description">
                      <span>Description</span>
                      <textarea
                        id="portal-billing-description"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              description: event.target.value
                            }
                          }))
                        }
                        placeholder="Engagement invoice for the next project milestone."
                        value={projectSettingsForm.billing.description}
                      />
                    </label>
                    <label className="field" htmlFor="portal-billing-checkout-url">
                      <span>Stripe-hosted invoice or payment link</span>
                      <input
                        id="portal-billing-checkout-url"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              checkoutUrl: event.target.value
                            }
                          }))
                        }
                        placeholder="https://invoice.stripe.com/..."
                        type="url"
                        value={projectSettingsForm.billing.checkoutUrl}
                      />
                    </label>
                    <label className="field" htmlFor="portal-billing-price-key">
                      <span>Central billing lookup key</span>
                      <input
                        id="portal-billing-price-key"
                        onChange={(event) =>
                          setProjectSettingsForm((currentForm) => ({
                            ...currentForm,
                            billing: {
                              ...currentForm.billing,
                              priceLookupKey: event.target.value
                            }
                          }))
                        }
                        placeholder="lecrowndev_engagement_next"
                        value={projectSettingsForm.billing.priceLookupKey}
                      />
                    </label>
                    <button
                      className="button"
                      disabled={projectSettingsState.pending}
                      type="submit"
                    >
                      {projectSettingsState.pending
                        ? "Saving billing..."
                        : "Save billing settings"}
                    </button>
                    {projectSettingsState.error ? (
                      <p className="portal-auth-error">
                        {projectSettingsState.error}
                      </p>
                    ) : null}
                  </form>
                </article>
              ) : null}
            </section>
          ) : null}

          {activeTab === "feedback" ? (
            <section className="portal-section-panel portal-feedback-stack">
              <article className="portal-content-card">
                <h2>Submit feedback</h2>
                <form className="portal-comment-form" onSubmit={handleCommentSubmit}>
                  <label className="field" htmlFor="portal-feedback">
                    <span>Comment</span>
                    <textarea
                      id="portal-feedback"
                      onChange={(event) => setDraftComment(event.target.value)}
                      placeholder="Share review notes, approval, or revision requests."
                      value={draftComment}
                    />
                  </label>
                  <button className="button" disabled={commentState.pending} type="submit">
                    {commentState.pending ? "Posting update..." : "Post update"}
                  </button>
                  {commentState.error ? (
                    <p className="portal-auth-error">{commentState.error}</p>
                  ) : null}
                </form>
              </article>

              <article className="portal-content-card">
                <h2>Thread</h2>
                <div className="portal-comment-thread">
                  {project.feedback.map((comment) => {
                    const nextStatus =
                      comment.status === "open" ? "addressed" : "open"

                    return (
                      <div className="portal-comment-card" key={comment.id}>
                        <div className="portal-comment-head">
                          <div>
                            <strong>{comment.authorName}</strong>
                            <span>
                              {comment.role} · {formatDate(comment.timestamp)}
                            </span>
                          </div>
                          <div className="portal-comment-actions">
                            <PortalStatusPill tone={comment.status}>
                              {comment.status}
                            </PortalStatusPill>
                            {isAdmin ? (
                              <button
                                className="button-secondary"
                                disabled={commentState.statusTarget === comment.id}
                                onClick={() =>
                                  toggleCommentStatus(comment.id, nextStatus)
                                }
                                type="button"
                              >
                                {commentState.statusTarget === comment.id
                                  ? "Saving..."
                                  : `Mark ${nextStatus}`}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p>{comment.message}</p>
                        {comment.tags.length ? (
                          <div className="portal-tag-row">
                            {comment.tags.map((tag) => (
                              <span className="portal-tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </article>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  )
}
