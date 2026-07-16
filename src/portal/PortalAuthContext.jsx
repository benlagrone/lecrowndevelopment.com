import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import Keycloak from "keycloak-js"
import {
  portalAuthDisabled,
  portalDefaultProjectId,
  portalDevUser,
  portalKeycloakConfig
} from "./portalConfig"

const PortalAuthContext = createContext(null)

function buildPortalUser(tokenParsed) {
  const roles = Array.isArray(tokenParsed?.realm_access?.roles)
    ? tokenParsed.realm_access.roles
    : []

  return {
    email: tokenParsed?.email || tokenParsed?.preferred_username || "",
    id: tokenParsed?.sub || "",
    name:
      tokenParsed?.name ||
      tokenParsed?.preferred_username ||
      tokenParsed?.email ||
      "Portal user",
    roles,
    source: "keycloak"
  }
}

export function PortalAuthProvider({ children }) {
  const keycloakRef = useRef(null)
  const [authState, setAuthState] = useState({
    accessToken: "",
    error: "",
    isAuthenticated: false,
    ready: false,
    user: null
  })

  useEffect(() => {
    let cancelled = false

    if (portalAuthDisabled) {
      setAuthState({
        accessToken: "",
        error: "",
        isAuthenticated: true,
        ready: true,
        user: portalDevUser
      })
      return undefined
    }

    const keycloak = new Keycloak(portalKeycloakConfig)
    keycloakRef.current = keycloak
    const syncAuthState = (isAuthenticated, error = "") => {
      if (cancelled) {
        return
      }

      setAuthState({
        accessToken: isAuthenticated ? keycloak.token || "" : "",
        error,
        isAuthenticated,
        ready: true,
        user: isAuthenticated ? buildPortalUser(keycloak.tokenParsed) : null
      })
    }

    keycloak.onAuthLogout = () => {
      syncAuthState(false)
    }

    keycloak.onAuthRefreshSuccess = () => {
      syncAuthState(true)
    }

    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(30)
        .then(() => {
          syncAuthState(true)
        })
        .catch(() => {
          keycloak.login({
            redirectUri: `${window.location.origin}/portal/${portalDefaultProjectId}`
          })
        })
    }

    keycloak
      .init({
        checkLoginIframe: false,
        onLoad: "check-sso",
        pkceMethod: "S256",
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`
      })
      .then((isAuthenticated) => {
        if (cancelled) {
          return
        }

        syncAuthState(isAuthenticated)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        syncAuthState(
          false,
          "Portal sign-in could not be initialized. Check the Keycloak realm, client, and redirect URI settings."
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => {
    return {
      ...authState,
      authDisabled: portalAuthDisabled,
      config: portalKeycloakConfig,
      hasRole(role) {
        return authState.user?.roles?.includes(role) ?? false
      },
      async getAccessToken() {
        if (portalAuthDisabled) {
          return ""
        }

        const keycloak = keycloakRef.current
        if (!keycloak) {
          return ""
        }

        await keycloak.updateToken(30)
        return keycloak.token || ""
      },
      login(redirectPath = "/portal") {
        if (portalAuthDisabled) {
          return
        }

        const target = new URL(redirectPath, window.location.origin).toString()
        keycloakRef.current?.login({ redirectUri: target })
      },
      logout() {
        if (portalAuthDisabled) {
          return
        }

        keycloakRef.current?.logout({
          redirectUri: `${window.location.origin}/portal/login`
        })
      }
    }
  }, [authState])

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext)

  if (!context) {
    throw new Error("usePortalAuth must be used inside PortalAuthProvider.")
  }

  return context
}
