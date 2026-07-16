export const portalAuthDisabled =
  (import.meta.env.VITE_PORTAL_DISABLE_AUTH ?? "true") === "true"

export const portalKeycloakConfig = {
  clientId:
    import.meta.env.VITE_PORTAL_KEYCLOAK_CLIENT_ID || "lecrown-portal-web",
  realm: import.meta.env.VITE_PORTAL_KEYCLOAK_REALM || "lecrown-portal",
  url: import.meta.env.VITE_PORTAL_KEYCLOAK_URL || "https://auth.pericopeai.com"
}

export const portalDefaultProjectId =
  import.meta.env.VITE_PORTAL_DEFAULT_PROJECT_ID || "northstar-automation"

export const portalDevUser = {
  email:
    import.meta.env.VITE_PORTAL_DEV_EMAIL || "admin@lecrowndevelopment.com",
  id: "local-portal-admin",
  name: import.meta.env.VITE_PORTAL_DEV_NAME || "Local Portal Admin",
  roles: ["admin"],
  source: "local"
}
