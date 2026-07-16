import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { useEffect, useRef } from "react"
import { PortalAuthProvider, usePortalAuth } from "./PortalAuthContext"
import {
  PortalProjectsProvider,
  usePortalProjects
} from "./PortalProjectsContext"

export function PortalLoadingScreen({ title }) {
  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <span className="portal-kicker">Client portal</span>
        <h1 className="portal-login-title">{title}</h1>
        <p className="portal-login-copy">
          Preparing your secure workspace and checking access permissions.
        </p>
      </section>
    </main>
  )
}

function PortalNoProjects() {
  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <span className="portal-kicker">Access pending</span>
        <h1 className="portal-login-title">No projects are assigned yet.</h1>
        <p className="portal-login-copy">
          Your portal account is active, but there are no projects mapped to it
          yet. Contact LeCrown Development to finish project access.
        </p>
        <Link className="button" to="/">
          Return to site
        </Link>
      </section>
    </main>
  )
}

export default function PortalRoot() {
  return (
    <PortalAuthProvider>
      <PortalProjectsProvider>
        <div className="portal-shell">
          <div className="portal-orb portal-orb-left" />
          <div className="portal-orb portal-orb-right" />
          <Outlet />
        </div>
      </PortalProjectsProvider>
    </PortalAuthProvider>
  )
}

export function PortalProtectedRoute() {
  const auth = usePortalAuth()
  const location = useLocation()

  if (!auth.ready) {
    return <PortalLoadingScreen title="Opening the portal." />
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/portal/login"
      />
    )
  }

  return <Outlet />
}

export function PortalIndexRedirect() {
  const auth = usePortalAuth()
  const portalProjects = usePortalProjects()

  if (!auth.ready || portalProjects.loading) {
    return <PortalLoadingScreen title="Opening the portal." />
  }

  if (!auth.isAuthenticated) {
    return <Navigate replace to="/portal/login" />
  }

  if (portalProjects.error) {
    return <PortalLoadingScreen title="Loading project access." />
  }

  if (!portalProjects.projects.length) {
    return <PortalNoProjects />
  }

  return <Navigate replace to={`/portal/${portalProjects.projects[0].id}`} />
}

export function PortalLoginPage() {
  const auth = usePortalAuth()
  const portalProjects = usePortalProjects()
  const location = useLocation()
  const loginTriggeredRef = useRef(false)
  const visibleProjects = auth.isAuthenticated ? portalProjects.projects : []
  const returnTarget =
    location.state?.from && location.state.from !== "/portal/login"
      ? location.state.from
      : visibleProjects[0]
        ? `/portal/${visibleProjects[0].id}`
        : "/portal"

  if (auth.isAuthenticated && portalProjects.loading) {
    return <PortalLoadingScreen title="Loading your projects." />
  }

  if (auth.isAuthenticated && visibleProjects.length) {
    return <Navigate replace to={returnTarget} />
  }

  if (auth.isAuthenticated && !portalProjects.error && !visibleProjects.length) {
    return <PortalNoProjects />
  }

  useEffect(() => {
    if (
      auth.ready &&
      !auth.authDisabled &&
      !auth.isAuthenticated &&
      !auth.error &&
      !loginTriggeredRef.current
    ) {
      loginTriggeredRef.current = true
      auth.login(returnTarget)
    }
  }, [
    auth.authDisabled,
    auth.error,
    auth.isAuthenticated,
    auth.ready,
    returnTarget
  ])

  if (!auth.ready) {
    return <PortalLoadingScreen title="Preparing secure sign-in." />
  }

  return (
    <main className="portal-page portal-login-page">
      <section className="portal-login-card">
        <div className="portal-login-grid">
          <div>
            <span className="portal-kicker">LeCrown client portal</span>
            <h1 className="portal-login-title">
              Secure project access for clients and internal delivery.
            </h1>
            <p className="portal-login-copy">
              Review current status, open the latest preview, keep project files
              in one place, and centralize feedback in a single workspace.
            </p>

            {!auth.authDisabled ? (
              <p className="portal-login-copy">
                Redirecting to the secure authentication portal now. If the
                redirect does not start, use the sign-in button below.
              </p>
            ) : null}

            <div className="portal-login-actions">
              <button
                className="button"
                onClick={() => auth.login(returnTarget)}
                type="button"
              >
                {auth.authDisabled
                  ? "Open local portal preview"
                  : "Continue to auth portal"}
              </button>
              <Link className="button-secondary" to="/">
                Back to main site
              </Link>
            </div>

            {auth.error || portalProjects.error ? (
              <p className="portal-auth-error">
                {auth.error || portalProjects.error}
              </p>
            ) : null}
          </div>

          <aside className="portal-security-card">
            <h2>Authentication boundary</h2>
            <ul className="portal-bullet-list">
              <li>Authority: `auth.pericopeai.com`</li>
              <li>Realm: `{auth.config.realm}`</li>
              <li>Client: `{auth.config.clientId}`</li>
              <li>Roles: `client`, `admin`</li>
            </ul>
            <p>
              {auth.authDisabled
                ? "Auth is disabled locally so the portal UI can be developed without live Keycloak."
                : "Production sign-in should run through the separate portal realm, not the main Pericope user base."}
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}
