import { createServer } from "node:http"
import { createReadStream } from "node:fs"
import {
  appendFile,
  mkdir,
  readFile,
  stat,
  unlink,
  writeFile
} from "node:fs/promises"
import { randomBytes, randomUUID } from "node:crypto"
import { dirname, extname, join } from "node:path"
import { createRemoteJWKSet, jwtVerify } from "jose"
import nodemailer from "nodemailer"
import { createSeedPortalState } from "./portal-seed-data.mjs"

const port = Number(process.env.PORT || 8081)
const leadStorageFile = process.env.LEAD_STORAGE_FILE || "/data/submissions.ndjson"
const portalStorageFile = process.env.PORTAL_STORAGE_FILE || "/data/portal-data.json"
const portalDocumentsDir =
  process.env.PORTAL_DOCUMENTS_DIR || "/data/portal-documents"
const portalDocumentProvider = (
  process.env.PORTAL_DOCUMENT_PROVIDER || "local"
)
  .trim()
  .toLowerCase()
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 10 * 1024 * 1024)
const portalDriveRootFolderId = process.env.PORTAL_DRIVE_ROOT_FOLDER_ID || ""
const portalDriveClientId = process.env.PORTAL_DRIVE_CLIENT_ID || ""
const portalDriveClientSecret = process.env.PORTAL_DRIVE_CLIENT_SECRET || ""
const portalDriveRefreshToken = process.env.PORTAL_DRIVE_REFRESH_TOKEN || ""
const portalDriveTokenUrl =
  process.env.PORTAL_DRIVE_TOKEN_URL || "https://oauth2.googleapis.com/token"
const portalDriveApiBaseUrl =
  process.env.PORTAL_DRIVE_API_BASE_URL || "https://www.googleapis.com/drive/v3"
const portalDriveUploadBaseUrl =
  process.env.PORTAL_DRIVE_UPLOAD_BASE_URL ||
  "https://www.googleapis.com/upload/drive/v3"

const keycloakAuthEnforced =
  (process.env.KEYCLOAK_AUTH_ENFORCED ?? "false") === "true"
const keycloakIssuer =
  process.env.KEYCLOAK_ISSUER ||
  "https://auth.pericopeai.com/realms/lecrown-portal"
const keycloakJwksUrl =
  process.env.KEYCLOAK_JWKS_URL ||
  "https://auth.pericopeai.com/realms/lecrown-portal/protocol/openid-connect/certs"
const keycloakAudiences = (process.env.KEYCLOAK_AUDIENCES || "lecrown-portal-web,account")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
const keycloakAllowedClockSkew = Number(
  process.env.KEYCLOAK_ALLOWED_CLOCK_SKEW || 60
)
const keycloakJwksCacheSeconds = Number(
  process.env.KEYCLOAK_JWKS_CACHE_SECONDS || 900
)
const portalKeycloakRealm =
  process.env.PORTAL_KEYCLOAK_REALM ||
  keycloakIssuer.match(/\/realms\/([^/]+)/)?.[1] ||
  "lecrown-portal"
const keycloakAdminBaseUrl =
  process.env.KEYCLOAK_ADMIN_BASE_URL || "https://auth.pericopeai.com"
const keycloakAdminRealm = process.env.KEYCLOAK_ADMIN_REALM || "master"
const keycloakAdminClientId =
  process.env.KEYCLOAK_ADMIN_CLIENT_ID || "admin-cli"
const keycloakAdminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || ""
const keycloakAdminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || ""
const portalInviteClientId =
  process.env.PORTAL_INVITE_CLIENT_ID || "lecrown-portal-web"
const portalInviteRedirectUri =
  process.env.PORTAL_INVITE_REDIRECT_URI ||
  "https://lecrowndevelopment.com/portal/login"
const portalInviteEmailProvider =
  process.env.PORTAL_INVITE_EMAIL_PROVIDER || "portal-smtp"
const portalPublicBaseUrl =
  process.env.PORTAL_PUBLIC_BASE_URL || "https://lecrowndevelopment.com"
const portalSmtpHost = process.env.PORTAL_SMTP_HOST || ""
const portalSmtpPort = Number(process.env.PORTAL_SMTP_PORT || 587)
const portalSmtpSecure =
  (process.env.PORTAL_SMTP_SECURE || "").toLowerCase() === "true" ||
  portalSmtpPort === 465
const portalSmtpUser = process.env.PORTAL_SMTP_USER || ""
const portalSmtpPassword = process.env.PORTAL_SMTP_PASSWORD || ""
const portalSmtpAuthRequired =
  (process.env.PORTAL_SMTP_AUTH_REQUIRED || "").toLowerCase() === "true"
const portalSmtpFrom =
  process.env.PORTAL_SMTP_FROM ||
  portalSmtpUser ||
  "no-reply@lecrowndevelopment.com"
const portalSmtpFromName =
  process.env.PORTAL_SMTP_FROM_NAME || "LeCrown Client Portal"
const portalSmtpReplyTo =
  process.env.PORTAL_SMTP_REPLY_TO || "benjamin@lecrownproperties.com"
const portalSmtpName =
  process.env.PORTAL_SMTP_NAME ||
  portalSmtpFrom.split("@")[1] ||
  (() => {
    try {
      return new URL(portalPublicBaseUrl).hostname
    } catch {
      return ""
    }
  })()
const portalAccessManagerEmail = normalizeEmail(
  process.env.PORTAL_ACCESS_MANAGER_EMAIL || "benjaminlagrone@gmail.com"
)
const billingServiceUrl = (process.env.BILLING_SERVICE_URL || "").replace(
  /\/+$/,
  ""
)
const billingProject = process.env.BILLING_PROJECT || "lecrowndev"
const billingServiceApiKey = process.env.BILLING_SERVICE_API_KEY || ""
const billingCheckoutSuccessUrl =
  process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
  `${portalPublicBaseUrl}/portal`
const billingCheckoutCancelUrl =
  process.env.STRIPE_CHECKOUT_CANCEL_URL ||
  `${portalPublicBaseUrl}/portal`

const portalDevUser = {
  email:
    process.env.PORTAL_DEV_EMAIL || "admin@lecrowndevelopment.com",
  id: "local-portal-admin",
  name: process.env.PORTAL_DEV_NAME || "Local Portal Admin",
  roles: (process.env.PORTAL_DEV_ROLES || "admin")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

const keycloakJwks = keycloakAuthEnforced
  ? createRemoteJWKSet(new URL(keycloakJwksUrl), {
      cacheMaxAge: keycloakJwksCacheSeconds * 1000,
      cooldownDuration: 5_000,
      timeoutDuration: 5_000
    })
  : null

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = "HttpError"
    this.statusCode = statusCode
  }
}

let keycloakAdminTokenCache = {
  accessToken: "",
  expiresAt: 0
}

let portalDriveTokenCache = {
  accessToken: "",
  expiresAt: 0
}

const keycloakEmailLookupCache = new Map()
const portalDriveFolderMimeType = "application/vnd.google-apps.folder"
const portalDefaultDocumentCategories = [
  "Scope & Agreements",
  "Site Structure / Outline",
  "Assets",
  "Deliverables"
]
const portalDefaultDocumentCategoryKeys = new Set(
  portalDefaultDocumentCategories.map((category) => normalizeDriveFolderKey(category))
)

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Portal-Dev-Email, X-Portal-Dev-Id, X-Portal-Dev-Name, X-Portal-Dev-Roles",
    "Access-Control-Allow-Methods":
      "DELETE,GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(payload))
}

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || ""
}

function normalizeIdentityId(value) {
  return value?.toString().trim() || ""
}

function isValidEmail(email) {
  return /.+@.+\..+/.test(normalizeEmail(email))
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function slugify(value, fallback = "project") {
  const slug = value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return slug || fallback
}

function safeFileName(fileName) {
  const ext = extname(fileName || "").slice(0, 10)
  const base = (fileName || "document")
    .replace(extname(fileName || ""), "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return `${base || "document"}${ext}`
}

function isDriveDocumentProvider() {
  return (
    portalDocumentProvider === "drive" ||
    portalDocumentProvider === "google-drive"
  )
}

function getDocumentDownloadFileName(document) {
  return document?.fileName?.trim() || document?.name?.trim() || "document"
}

function deriveDocumentFileName(displayName, originalFileName) {
  const normalizedDisplayName = displayName?.trim() || ""
  const originalExtension = extname(originalFileName || "")

  if (!normalizedDisplayName) {
    return safeFileName(originalFileName || "document")
  }

  if (extname(normalizedDisplayName)) {
    return safeFileName(normalizedDisplayName)
  }

  return safeFileName(`${normalizedDisplayName}${originalExtension}`)
}

function normalizeDocumentMatchKey(value) {
  const fileName = String(value || "").trim()
  if (!fileName) {
    return ""
  }

  const extension = extname(fileName).toLowerCase()
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName

  return `${slugify(baseName.replaceAll("_", " "))}${extension}`
}

function extractLegacyPortalSemanticFileName(fileName) {
  const normalizedFileName = String(fileName || "").trim()
  if (!normalizedFileName) {
    return ""
  }

  const extension = extname(normalizedFileName)
  const baseName = extension
    ? normalizedFileName.slice(0, -extension.length)
    : normalizedFileName
  const segments = baseName
    .split("__")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 3) {
    return ""
  }

  return `${segments[2]}${extension}`
}

function tokenizeDocumentMatchKey(value) {
  const normalizedKey = normalizeDocumentMatchKey(value)
  if (!normalizedKey) {
    return {
      extension: "",
      tokens: new Set()
    }
  }

  const extension = extname(normalizedKey).toLowerCase()
  const baseName = extension
    ? normalizedKey.slice(0, -extension.length)
    : normalizedKey

  return {
    extension,
    tokens: new Set(baseName.split("-").filter(Boolean))
  }
}

function doDocumentMatchKeysOverlap(leftValue, rightValue) {
  const left = tokenizeDocumentMatchKey(leftValue)
  const right = tokenizeDocumentMatchKey(rightValue)

  if (!left.tokens.size || !right.tokens.size || left.extension !== right.extension) {
    return false
  }

  const [smaller, larger] =
    left.tokens.size <= right.tokens.size
      ? [left.tokens, right.tokens]
      : [right.tokens, left.tokens]

  if (smaller.size < 3) {
    return false
  }

  return [...smaller].every((token) => larger.has(token))
}

function buildDocumentMatchCandidates(document) {
  const candidates = new Set()
  const expectedFileName =
    document.fileName ||
    deriveDocumentFileName(
      document.name,
      document.sourceFileName || document.fileName || document.name
    )

  ;[
    document.fileName,
    document.name,
    document.sourceFileName,
    expectedFileName
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => candidates.add(value))

  return [...candidates]
}

function buildDriveFileMatchCandidates(driveFile) {
  const candidates = new Set()

  ;[
    driveFile?.name,
    driveFile?.appProperties?.portalDisplayName,
    extractLegacyPortalSemanticFileName(driveFile?.name)
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => candidates.add(value))

  return [...candidates]
}

function isLikelyMatchingDriveDocument(document, driveFile) {
  const documentCandidates = buildDocumentMatchCandidates(document)
  const driveCandidates = buildDriveFileMatchCandidates(driveFile)
  const normalizedDriveKeys = new Set(
    driveCandidates
      .map((value) => normalizeDocumentMatchKey(value))
      .filter(Boolean)
  )

  for (const candidate of documentCandidates) {
    const normalizedCandidate = normalizeDocumentMatchKey(candidate)
    if (normalizedCandidate && normalizedDriveKeys.has(normalizedCandidate)) {
      return true
    }
  }

  return documentCandidates.some((documentCandidate) =>
    driveCandidates.some((driveCandidate) =>
      doDocumentMatchKeysOverlap(documentCandidate, driveCandidate)
    )
  )
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeDriveDate(value) {
  if (!value) {
    return todayStamp()
  }

  return String(value).slice(0, 10)
}

function escapeDriveQueryValue(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
}

function normalizeDriveFolderKey(value) {
  return slugify(
    String(value || "")
      .replaceAll("_", " ")
      .replaceAll("[", " ")
      .replaceAll("]", " ")
  )
}

function assertDriveDocumentProviderConfigured() {
  if (!isDriveDocumentProvider()) {
    return
  }

  const missing = []

  if (!portalDriveRootFolderId) {
    missing.push("PORTAL_DRIVE_ROOT_FOLDER_ID")
  }

  if (!portalDriveClientId) {
    missing.push("PORTAL_DRIVE_CLIENT_ID")
  }

  if (!portalDriveClientSecret) {
    missing.push("PORTAL_DRIVE_CLIENT_SECRET")
  }

  if (!portalDriveRefreshToken) {
    missing.push("PORTAL_DRIVE_REFRESH_TOKEN")
  }

  if (!missing.length) {
    return
  }

  throw new HttpError(
    500,
    `Portal Google Drive integration is not configured. Missing ${missing.join(", ")}.`
  )
}

function buildDriveUrl(baseUrl, pathname, query = {}) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  const url = new URL(pathname.replace(/^\//, ""), normalizedBase)

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url
}

async function readResponseText(response) {
  return await response.text().catch(() => "")
}

async function getPortalDriveAccessToken(forceRefresh = false) {
  assertDriveDocumentProviderConfigured()

  if (
    !forceRefresh &&
    portalDriveTokenCache.accessToken &&
    portalDriveTokenCache.expiresAt > Date.now() + 30_000
  ) {
    return portalDriveTokenCache.accessToken
  }

  const response = await fetch(portalDriveTokenUrl, {
    body: new URLSearchParams({
      client_id: portalDriveClientId,
      client_secret: portalDriveClientSecret,
      grant_type: "refresh_token",
      refresh_token: portalDriveRefreshToken
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  }).catch((error) => {
    throw new HttpError(
      500,
      error?.message || "Portal Google Drive could not be reached."
    )
  })

  const data = await parseFetchJson(response)
  if (!response.ok || !data?.access_token) {
    throw new HttpError(
      500,
      data?.error_description ||
        data?.error ||
        "Portal Google Drive authentication failed."
    )
  }

  portalDriveTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 60) * 1000
  }

  return portalDriveTokenCache.accessToken
}

async function portalDriveRequest(
  pathname,
  {
    baseUrl = portalDriveApiBaseUrl,
    body,
    headers: providedHeaders = {},
    method = "GET",
    query = {},
    retry = true
  } = {}
) {
  const accessToken = await getPortalDriveAccessToken(!retry)
  const headers = new Headers(providedHeaders)
  headers.set("Authorization", `Bearer ${accessToken}`)

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  const response = await fetch(buildDriveUrl(baseUrl, pathname, query), {
    body,
    headers,
    method
  }).catch((error) => {
    throw new HttpError(
      500,
      error?.message || "Portal Google Drive request failed."
    )
  })

  if (response.status === 401 && retry) {
    portalDriveTokenCache = { accessToken: "", expiresAt: 0 }
    return await portalDriveRequest(pathname, {
      baseUrl,
      body,
      headers: providedHeaders,
      method,
      query,
      retry: false
    })
  }

  if (!response.ok) {
    const data = await parseFetchJson(response)
    const fallbackMessage = await readResponseText(response)

    throw new HttpError(
      500,
      data?.error?.message ||
        data?.error_description ||
        data?.error ||
        fallbackMessage ||
        "Portal Google Drive request failed."
    )
  }

  return response
}

async function listPortalDriveFiles(query) {
  const files = []
  let pageToken = ""

  do {
    const response = await portalDriveRequest("/files", {
      query: {
        fields:
          "nextPageToken,files(id,name,mimeType,description,modifiedTime,appProperties,parents,size)",
        includeItemsFromAllDrives: "true",
        pageSize: "1000",
        q: query,
        supportsAllDrives: "true",
        ...(pageToken ? { pageToken } : {})
      }
    })
    const data = (await response.json().catch(() => null)) || {}
    files.push(...(Array.isArray(data.files) ? data.files : []))
    pageToken = data.nextPageToken || ""
  } while (pageToken)

  return files
}

async function createPortalDriveFolder(parentId, name, appProperties = {}) {
  const response = await portalDriveRequest("/files", {
    body: JSON.stringify({
      appProperties,
      mimeType: portalDriveFolderMimeType,
      name,
      parents: [parentId]
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST",
    query: {
      fields:
        "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
      supportsAllDrives: "true"
    }
  })

  return await response.json()
}

async function updatePortalDriveFile(fileId, payload) {
  const response = await portalDriveRequest(
    `/files/${encodeURIComponent(fileId)}`,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PATCH",
      query: {
        fields:
          "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
        supportsAllDrives: "true"
      }
    }
  )

  return await response.json()
}

async function uploadPortalDriveFile({
  appProperties = {},
  buffer,
  contentType,
  description,
  name,
  parentId
}) {
  const boundary = `portal-drive-${randomUUID()}`
  const metadata = {
    appProperties,
    description: description || "",
    name,
    parents: [parentId]
  }
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`)
  ])

  const response = await portalDriveRequest("/files", {
    baseUrl: portalDriveUploadBaseUrl,
    body: multipartBody,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    method: "POST",
    query: {
      fields:
        "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
      supportsAllDrives: "true",
      uploadType: "multipart"
    }
  })

  return await response.json()
}

async function deletePortalDriveFile(fileId) {
  await portalDriveRequest(`/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    query: {
      supportsAllDrives: "true"
    }
  })
}

async function downloadPortalDriveFile(fileId) {
  return await portalDriveRequest(`/files/${encodeURIComponent(fileId)}`, {
    headers: {
      Accept: "*/*"
    },
    query: {
      alt: "media",
      supportsAllDrives: "true"
    }
  })
}

async function findPortalDriveChildFolderByName(parentId, name) {
  const folders = await listPortalDriveFiles(
    [
      `'${escapeDriveQueryValue(parentId)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`,
      `name = '${escapeDriveQueryValue(name)}'`
    ].join(" and ")
  )

  return folders[0] || null
}

async function listPortalDriveChildren(parentId, { foldersOnly = false } = {}) {
  const filters = [
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    "trashed = false"
  ]

  if (foldersOnly) {
    filters.push(`mimeType = '${portalDriveFolderMimeType}'`)
  } else {
    filters.push(`mimeType != '${portalDriveFolderMimeType}'`)
  }

  return await listPortalDriveFiles(filters.join(" and "))
}

function shouldIgnoreDriveFile(driveFile) {
  return (driveFile?.name || "").startsWith(".")
}

async function listProjectDriveFileEntries(projectFolderId, initialPathSegments = []) {
  const entries = []

  async function visitFolder(folderId, pathSegments = initialPathSegments) {
    const childFiles = await listPortalDriveChildren(folderId)
    for (const driveFile of childFiles) {
      if (shouldIgnoreDriveFile(driveFile)) {
        continue
      }

      entries.push({
        categoryPath: pathSegments,
        driveFile
      })
    }

    const childFolders = await listPortalDriveChildren(folderId, {
      foldersOnly: true
    })
    for (const childFolder of childFolders) {
      const nextSegment = childFolder.appProperties?.portalCategory || childFolder.name
      await visitFolder(childFolder.id, [...pathSegments, nextSegment])
    }
  }

  await visitFolder(projectFolderId, initialPathSegments)
  return entries
}

function isLegacyPortalFolderName(value) {
  const normalizedKey = normalizeDriveFolderKey(value)
  return (
    normalizedKey.includes("client-outbound-portal") ||
    normalizedKey.includes("office-uploads")
  )
}

function isPortalDriveEntry(project, entry) {
  const driveFile = entry?.driveFile || entry
  const categoryPath = Array.isArray(entry?.categoryPath) ? entry.categoryPath : []

  if (shouldIgnoreDriveFile(driveFile)) {
    return false
  }

  if (
    driveFile?.appProperties?.portalProjectId === project.id ||
    driveFile?.appProperties?.portalDocumentId ||
    driveFile?.appProperties?.portalCategory
  ) {
    return true
  }

  return categoryPath.some((segment) => {
    const normalizedKey = normalizeDriveFolderKey(segment)
    return (
      portalDefaultDocumentCategoryKeys.has(normalizedKey) ||
      isLegacyPortalFolderName(segment)
    )
  })
}

async function listVisibleProjectDriveEntries(project) {
  const projectFolderId = await ensureProjectDriveFolder(project)
  const directFiles = await listPortalDriveChildren(projectFolderId)
  const directFolders = await listPortalDriveChildren(projectFolderId, {
    foldersOnly: true
  })
  const rootFolders = directFolders.filter((folder) => {
    return (
      folder.appProperties?.portalFolderType === "category" ||
      folder.appProperties?.portalCategory ||
      isLegacyPortalFolderName(folder.name)
    )
  })
  const entries = []
  const seenFileIds = new Set()

  for (const driveFile of directFiles) {
    const entry = {
      categoryPath: [],
      driveFile
    }

    if (!isPortalDriveEntry(project, entry) || seenFileIds.has(driveFile.id)) {
      continue
    }

    seenFileIds.add(driveFile.id)
    entries.push(entry)
  }

  for (const folder of rootFolders) {
    const nestedEntries = await listProjectDriveFileEntries(folder.id, [
      folder.appProperties?.portalCategory || folder.name
    ])

    for (const entry of nestedEntries) {
      if (
        !isPortalDriveEntry(project, entry) ||
        seenFileIds.has(entry.driveFile.id)
      ) {
        continue
      }

      seenFileIds.add(entry.driveFile.id)
      entries.push(entry)
    }
  }

  return {
    entries,
    projectFolderId,
    rootFolders
  }
}

async function findProjectDriveFolder(project) {
  const taggedFolders = await listPortalDriveFiles(
    [
      `'${escapeDriveQueryValue(portalDriveRootFolderId)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`,
      `appProperties has { key='portalProjectId' and value='${escapeDriveQueryValue(project.id)}' }`,
      "appProperties has { key='portalFolderType' and value='project' }"
    ].join(" and ")
  )

  if (taggedFolders[0]) {
    return taggedFolders[0]
  }

  const searchNames = [
    project.name?.trim(),
    project.id,
    `${project.name?.trim() || project.id} [${project.id}]`
  ].filter(Boolean)

  for (const name of searchNames) {
    const folder = await findPortalDriveChildFolderByName(
      portalDriveRootFolderId,
      name
    )

    if (folder) {
      return folder
    }
  }

  const rootFolders = await listPortalDriveChildren(portalDriveRootFolderId, {
    foldersOnly: true
  })
  const searchKeys = new Set(searchNames.map(normalizeDriveFolderKey))

  return (
    rootFolders.find((folder) => {
      return searchKeys.has(normalizeDriveFolderKey(folder.name))
    }) || null
  )
}

async function ensureProjectDriveFolder(project) {
  assertDriveDocumentProviderConfigured()

  if (project.driveFolderId) {
    return project.driveFolderId
  }

  const existingFolder = await findProjectDriveFolder(project)
  if (existingFolder?.id) {
    project.driveFolderId = existingFolder.id
    return existingFolder.id
  }

  const folder = await createPortalDriveFolder(
    portalDriveRootFolderId,
    project.name?.trim() || project.id,
    {
      portalFolderType: "project",
      portalProjectId: project.id
    }
  )
  project.driveFolderId = folder.id
  return folder.id
}

async function ensureProjectDriveCategoryFolder(project, category) {
  const folderId = await ensureProjectDriveFolder(project)
  if (!project.driveCategoryFolderIds || typeof project.driveCategoryFolderIds !== "object") {
    project.driveCategoryFolderIds = {}
  }

  const cachedFolderId = project.driveCategoryFolderIds[category]
  if (cachedFolderId) {
    return cachedFolderId
  }

  const taggedFolders = await listPortalDriveFiles(
    [
      `'${escapeDriveQueryValue(folderId)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`,
      `appProperties has { key='portalProjectId' and value='${escapeDriveQueryValue(project.id)}' }`,
      `appProperties has { key='portalCategory' and value='${escapeDriveQueryValue(category)}' }`,
      "appProperties has { key='portalFolderType' and value='category' }"
    ].join(" and ")
  )

  if (taggedFolders[0]?.id) {
    project.driveCategoryFolderIds[category] = taggedFolders[0].id
    return taggedFolders[0].id
  }

  const existingFolder = await findPortalDriveChildFolderByName(folderId, category)
  if (existingFolder?.id) {
    project.driveCategoryFolderIds[category] = existingFolder.id
    return existingFolder.id
  }

  const folder = await createPortalDriveFolder(folderId, category, {
    portalCategory: category,
    portalFolderType: "category",
    portalProjectId: project.id
  })
  project.driveCategoryFolderIds[category] = folder.id
  return folder.id
}

async function findMatchingDriveDocument(project, document, categoryFolderId = "") {
  const directCategoryFiles = categoryFolderId
    ? await listPortalDriveChildren(categoryFolderId)
    : []
  const { entries: visibleProjectEntries } = await listVisibleProjectDriveEntries(project)
  const candidateFiles = [
    ...directCategoryFiles,
    ...visibleProjectEntries.map((entry) => entry.driveFile)
  ]
  const seenFileIds = new Set()

  for (const file of candidateFiles) {
    if (seenFileIds.has(file.id) || shouldIgnoreDriveFile(file)) {
      continue
    }

    seenFileIds.add(file.id)

    if (file.appProperties?.portalDocumentId === document.id) {
      return file
    }

    if (isLikelyMatchingDriveDocument(document, file)) {
      return file
    }
  }

  return null
}

async function tagMatchingDriveDocument(project, document, driveFile, category) {
  return await updatePortalDriveFile(driveFile.id, {
    appProperties: {
      ...(driveFile.appProperties || {}),
      portalCategory: category,
      portalDisplayName: document.name,
      portalDocumentId: document.id,
      portalProjectId: project.id
    },
    description: document.description || driveFile.description || ""
  })
}

function sortProjectDocuments(documents) {
  return [...documents].sort((left, right) => {
    const dateCompare = (right.updatedAt || "").localeCompare(left.updatedAt || "")
    if (dateCompare !== 0) {
      return dateCompare
    }

    return (left.name || "").localeCompare(right.name || "")
  })
}

function snapshotProjectDocuments(documents) {
  return JSON.stringify(
    sortProjectDocuments(documents).map((document) => ({
      category: document.category,
      contentType: document.contentType,
      description: document.description,
      driveFileId: document.driveFileId,
      fileName: document.fileName,
      id: document.id,
      name: document.name,
      sourceFileName: document.sourceFileName,
      storagePath: document.storagePath,
      updatedAt: document.updatedAt
    }))
  )
}

function buildDriveBackedDocument(existingDocument, driveFile, fallbackCategory) {
  return {
    category:
      driveFile.appProperties?.portalCategory ||
      fallbackCategory ||
      existingDocument?.category ||
      "Deliverables",
    contentType:
      driveFile.mimeType || existingDocument?.contentType || "application/octet-stream",
    description: driveFile.description || existingDocument?.description || "",
    driveFileId: driveFile.id,
    fileName:
      driveFile.name ||
      existingDocument?.fileName ||
      getDocumentDownloadFileName(existingDocument),
    id:
      driveFile.appProperties?.portalDocumentId ||
      existingDocument?.id ||
      `drive-${driveFile.id}`,
    name:
      driveFile.appProperties?.portalDisplayName ||
      existingDocument?.name ||
      driveFile.name,
    sourceFileName: existingDocument?.sourceFileName || driveFile.name,
    storagePath: existingDocument?.storagePath || "",
    updatedAt: normalizeDriveDate(driveFile.modifiedTime || existingDocument?.updatedAt)
  }
}

async function syncProjectDocumentsFromDrive(project) {
  if (!isDriveDocumentProvider()) {
    return false
  }

  const previousSnapshot = snapshotProjectDocuments(project.documents || [])
  const {
    entries: driveEntries,
    projectFolderId,
    rootFolders: categoryFolders
  } = await listVisibleProjectDriveEntries(project)
  const existingByDriveFileId = new Map(
    (Array.isArray(project.documents) ? project.documents : [])
      .filter((document) => document.driveFileId)
      .map((document) => [document.driveFileId, document])
  )
  const nextDocuments = []

  if (!project.driveCategoryFolderIds || typeof project.driveCategoryFolderIds !== "object") {
    project.driveCategoryFolderIds = {}
  }

  for (const folder of categoryFolders) {
    const category = folder.appProperties?.portalCategory
    if (category) {
      project.driveCategoryFolderIds[category] = folder.id
    }
  }

  for (const entry of driveEntries) {
    const driveFile = entry.driveFile
    const fallbackCategory =
      driveFile.appProperties?.portalCategory ||
      entry.categoryPath.join(" / ") ||
      "Deliverables"
    nextDocuments.push(
      buildDriveBackedDocument(
        existingByDriveFileId.get(driveFile.id) || null,
        driveFile,
        fallbackCategory
      )
    )
  }

  const localOnlyDocuments = (Array.isArray(project.documents) ? project.documents : []).filter(
    (document) => !document.driveFileId
  )
  project.documents = sortProjectDocuments([...nextDocuments, ...localOnlyDocuments])

  return snapshotProjectDocuments(project.documents) !== previousSnapshot
}

async function migrateLocalProjectDocumentsToDrive(project) {
  if (!isDriveDocumentProvider()) {
    return false
  }

  let changed = false

  for (const document of Array.isArray(project.documents) ? project.documents : []) {
    if (document.driveFileId || !document.storagePath) {
      continue
    }

    const fileMetadata = await stat(document.storagePath).catch(() => null)
    if (!fileMetadata?.isFile()) {
      continue
    }

    const category = document.category || "Deliverables"
    const parentId = await ensureProjectDriveCategoryFolder(project, category)
    const driveFileName =
      document.fileName ||
      deriveDocumentFileName(document.name, document.fileName || document.name)
    const existingDriveFile = await findMatchingDriveDocument(
      project,
      document,
      parentId
    )

    if (existingDriveFile?.id) {
      const taggedDriveFile = await tagMatchingDriveDocument(
        project,
        document,
        existingDriveFile,
        category
      )

      document.driveFileId = taggedDriveFile.id
      document.fileName =
        taggedDriveFile.name || existingDriveFile.name || driveFileName
      document.updatedAt = normalizeDriveDate(
        taggedDriveFile.modifiedTime ||
          existingDriveFile.modifiedTime ||
          document.updatedAt
      )
      changed = true
      continue
    }

    const buffer = await readFile(document.storagePath)
    const driveFile = await uploadPortalDriveFile({
      appProperties: {
        portalCategory: category,
        portalDisplayName: document.name,
        portalDocumentId: document.id,
        portalProjectId: project.id
      },
      buffer,
      contentType: document.contentType || "application/octet-stream",
      description: document.description || "",
      name: driveFileName,
      parentId
    })

    document.driveFileId = driveFile.id
    document.fileName = driveFile.name || driveFileName
    document.updatedAt = normalizeDriveDate(driveFile.modifiedTime || document.updatedAt)
    changed = true
  }

  return changed
}

async function reconcileProjectDocuments(project) {
  if (!isDriveDocumentProvider()) {
    return false
  }

  const migrated = await migrateLocalProjectDocumentsToDrive(project)
  const synced = await syncProjectDocumentsFromDrive(project)
  return migrated || synced
}

async function reconcilePortalDriveProjects() {
  if (!isDriveDocumentProvider()) {
    return
  }

  assertDriveDocumentProviderConfigured()

  let changed = false
  for (const project of portalState.projects) {
    if (await reconcileProjectDocuments(project)) {
      changed = true
    }
  }

  if (changed) {
    await persistPortalState()
  }
}

async function refreshProjectDocuments(project) {
  if (await reconcileProjectDocuments(project)) {
    await persistPortalState()
  }
}

function splitDisplayName(name, fallbackEmail) {
  const rawName = name?.trim() || fallbackEmail?.trim() || "Portal User"
  const [firstName, ...rest] = rawName.split(/\s+/)

  return {
    firstName: firstName || "Portal",
    lastName: rest.join(" ")
  }
}

function generateTemporaryPassword(length = 18) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"
  const bytes = randomBytes(length)

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("")
}

function sanitizeDocument(projectId, document) {
  return {
    category: document.category,
    description: document.description,
    fileUrl: `/api/portal/projects/${projectId}/documents/${document.id}/download`,
    fileName: getDocumentDownloadFileName(document),
    id: document.id,
    name: document.name,
    updatedAt: document.updatedAt
  }
}

function normalizeTimelineEntry(entry, index = 0) {
  const title = entry?.title?.trim() || ""
  const description = entry?.description?.trim() || ""
  const date = entry?.date?.trim() || ""

  if (!title && !description) {
    return null
  }

  return {
    badge: entry?.badge?.trim() || "",
    date,
    description,
    id:
      entry?.id?.trim() ||
      slugify(`${date || "timeline"}-${title || `event-${index + 1}`}`, `timeline-${index + 1}`),
    title,
    tone: entry?.tone?.trim() || ""
  }
}

function normalizeProjectTimeline(timeline) {
  if (!Array.isArray(timeline)) {
    return []
  }

  return timeline
    .map((entry, index) => normalizeTimelineEntry(entry, index))
    .filter(Boolean)
    .sort((left, right) => {
      const dateCompare = (left.date || "").localeCompare(right.date || "")
      if (dateCompare !== 0) {
        return dateCompare
      }

      return (left.title || "").localeCompare(right.title || "")
    })
}

function normalizeBillingConfig(billing = {}) {
  const checkoutUrl = billing.checkoutUrl?.trim() || ""

  if (checkoutUrl) {
    let parsedUrl
    try {
      parsedUrl = new URL(checkoutUrl)
    } catch {
      throw new HttpError(400, "Billing checkout URL must be a valid URL.")
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      throw new HttpError(400, "Billing checkout URL must use HTTP or HTTPS.")
    }
  }

  return {
    amountLabel: billing.amountLabel?.trim() || "",
    checkoutUrl,
    description: billing.description?.trim() || "",
    dueDate: billing.dueDate?.trim() || "",
    enabled: Boolean(billing.enabled),
    priceLookupKey: billing.priceLookupKey?.trim() || "",
    status: billing.status?.trim() || "Not sent"
  }
}

function sanitizeProject(project) {
  return {
    billing: normalizeBillingConfig(project.billing || {}),
    feedback: project.feedback.map((comment) => ({
      authorName: comment.authorName,
      id: comment.id,
      message: comment.message,
      role: comment.role,
      status: comment.status,
      tags: Array.isArray(comment.tags) ? comment.tags : [],
      timestamp: comment.timestamp
    })),
    highlights: Array.isArray(project.highlights) ? project.highlights : [],
    id: project.id,
    lastUpdated: project.lastUpdated,
    members: project.members.map((member) => ({
      email: member.email,
      name: member.name,
      role: member.role
    })),
    name: project.name,
    phase: project.phase,
    preview: {
      notes: project.preview?.notes || "",
      reviewChecklist: Array.isArray(project.preview?.reviewChecklist)
        ? project.preview.reviewChecklist
        : [],
      url: project.preview?.url || "/"
    },
    status: project.status,
    summary: project.summary,
    timeline: normalizeProjectTimeline(project.timeline),
    documents: project.documents.map((document) =>
      sanitizeDocument(project.id, document)
    )
  }
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

function setProjectUpdated(project) {
  project.lastUpdated = todayStamp()
}

function canAccessProject(project, user) {
  if (!project || !user) {
    return false
  }

  if (user.roles.includes("admin")) {
    return true
  }

  const members = Array.isArray(project.members) ? project.members : []
  const userIdentityId = normalizeIdentityId(user.id)

  if (
    userIdentityId &&
    members.some((member) => normalizeIdentityId(member.identityId) === userIdentityId)
  ) {
    return true
  }

  if (keycloakAuthEnforced) {
    return false
  }

  const identifiers = new Set([user.email, user.username].map(normalizeEmail).filter(Boolean))
  return members.some((member) => {
    return (
      !normalizeIdentityId(member.identityId) &&
      identifiers.has(normalizeEmail(member.email))
    )
  })
}

function assertProjectAccess(project, user) {
  if (!project) {
    throw new HttpError(404, "Project not found.")
  }

  if (!canAccessProject(project, user)) {
    throw new HttpError(403, "This project is not assigned to your account.")
  }
}

function assertAdmin(user) {
  if (!user.roles.includes("admin")) {
    throw new HttpError(403, "Admin role required.")
  }
}

function assertAccessManager(user) {
  assertAdmin(user)

  if (normalizeEmail(user.email || user.username) !== portalAccessManagerEmail) {
    throw new HttpError(
      403,
      `Project access controls are restricted to ${portalAccessManagerEmail}.`
    )
  }
}

function assertKeycloakInviteConfigured() {
  if (!keycloakAdminUsername || !keycloakAdminPassword) {
    throw new HttpError(
      500,
      "Portal invite provisioning is not configured on the server."
    )
  }
}

async function parseFetchJson(response) {
  const contentType = response.headers.get("content-type") || ""

  if (!contentType.includes("application/json")) {
    return null
  }

  return await response.json().catch(() => null)
}

async function getKeycloakAdminAccessToken(forceRefresh = false) {
  assertKeycloakInviteConfigured()

  if (
    !forceRefresh &&
    keycloakAdminTokenCache.accessToken &&
    keycloakAdminTokenCache.expiresAt > Date.now() + 30_000
  ) {
    return keycloakAdminTokenCache.accessToken
  }

  const tokenUrl = new URL(
    `/realms/${encodeURIComponent(keycloakAdminRealm)}/protocol/openid-connect/token`,
    keycloakAdminBaseUrl
  )
  const params = new URLSearchParams({
    client_id: keycloakAdminClientId,
    grant_type: "password",
    password: keycloakAdminPassword,
    username: keycloakAdminUsername
  })

  const response = await fetch(tokenUrl, {
    body: params,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  }).catch((error) => {
    throw new HttpError(
      500,
      error?.message || "Portal invite provisioning could not reach Keycloak."
    )
  })

  const data = await parseFetchJson(response)
  if (!response.ok || !data?.access_token) {
    throw new HttpError(
      500,
      data?.error_description ||
        data?.error ||
        "Portal invite provisioning could not authenticate to Keycloak."
    )
  }

  keycloakAdminTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 60) * 1000
  }

  return keycloakAdminTokenCache.accessToken
}

async function keycloakAdminRequest(pathname, options = {}, retry = true) {
  const accessToken = await getKeycloakAdminAccessToken(!retry)
  const url = new URL(
    `/admin/realms/${encodeURIComponent(portalKeycloakRealm)}${pathname}`,
    keycloakAdminBaseUrl
  )
  const headers = new Headers(options.headers || {})
  headers.set("Authorization", `Bearer ${accessToken}`)
  headers.set("Accept", "application/json")

  const response = await fetch(url, {
    ...options,
    headers
  }).catch((error) => {
    throw new HttpError(
      500,
      error?.message || "Portal invite provisioning could not reach Keycloak."
    )
  })

  if (response.status === 401 && retry) {
    keycloakAdminTokenCache = { accessToken: "", expiresAt: 0 }
    return await keycloakAdminRequest(pathname, options, false)
  }

  return response
}

async function findKeycloakUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  const response = await keycloakAdminRequest(
    `/users?email=${encodeURIComponent(normalizedEmail)}&exact=true&max=20`
  )
  const users = (await parseFetchJson(response)) || []

  return (
    users.find((user) => {
      return [user.email, user.username]
        .map(normalizeEmail)
        .includes(normalizedEmail)
    }) || null
  )
}

async function createKeycloakPortalUser(email, name) {
  const { firstName, lastName } = splitDisplayName(name, email)
  const response = await keycloakAdminRequest("/users", {
    body: JSON.stringify({
      email,
      emailVerified: false,
      enabled: true,
      firstName,
      lastName,
      username: email
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  })

  if (!response.ok && response.status !== 201) {
    const data = await parseFetchJson(response)
    throw new HttpError(
      500,
      data?.errorMessage ||
        data?.error ||
        "Portal invite provisioning could not create the Keycloak user."
    )
  }

  const user = await findKeycloakUserByEmail(email)
  if (!user?.id) {
    throw new HttpError(
      500,
      "Portal invite provisioning could not resolve the new Keycloak user."
    )
  }

  return user
}

async function ensureKeycloakRealmRole(userId, roleName) {
  const mappingsResponse = await keycloakAdminRequest(
    `/users/${encodeURIComponent(userId)}/role-mappings/realm`
  )
  const mappings = (await parseFetchJson(mappingsResponse)) || []

  if (mappings.some((role) => role.name === roleName)) {
    return
  }

  const roleResponse = await keycloakAdminRequest(
    `/roles/${encodeURIComponent(roleName)}`
  )
  const role = await parseFetchJson(roleResponse)
  if (!role?.id) {
    throw new HttpError(
      500,
      `Portal invite provisioning could not load the ${roleName} Keycloak role.`
    )
  }

  const addRoleResponse = await keycloakAdminRequest(
    `/users/${encodeURIComponent(userId)}/role-mappings/realm`,
    {
      body: JSON.stringify([role]),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  )

  if (!addRoleResponse.ok && addRoleResponse.status !== 204) {
    const data = await parseFetchJson(addRoleResponse)
    throw new HttpError(
      500,
      data?.errorMessage ||
        data?.error ||
        "Portal invite provisioning could not assign the Keycloak client role."
    )
  }
}

async function setKeycloakPassword(
  userId,
  { temporary = true, value = generateTemporaryPassword() } = {}
) {
  const response = await keycloakAdminRequest(
    `/users/${encodeURIComponent(userId)}/reset-password`,
    {
      body: JSON.stringify({
        temporary,
        type: "password",
        value
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PUT"
    }
  )

  if (!response.ok && response.status !== 204) {
    const data = await parseFetchJson(response)
    throw new HttpError(
      500,
      data?.errorMessage ||
        data?.error ||
        "Portal invite provisioning could not set the temporary password."
    )
  }

  return value
}

async function setKeycloakTemporaryPassword(userId) {
  return await setKeycloakPassword(userId, { temporary: true })
}

async function findKeycloakUserIdByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return ""
  }

  if (keycloakEmailLookupCache.has(normalizedEmail)) {
    return keycloakEmailLookupCache.get(normalizedEmail) || ""
  }

  const user = await findKeycloakUserByEmail(normalizedEmail)
  const identityId = normalizeIdentityId(user?.id)
  keycloakEmailLookupCache.set(normalizedEmail, identityId)
  return identityId
}

async function backfillPortalMemberIdentityIds() {
  if (!keycloakAuthEnforced || !keycloakAdminUsername || !keycloakAdminPassword) {
    return
  }

  let changed = false

  for (const project of portalState.projects) {
    for (const member of Array.isArray(project.members) ? project.members : []) {
      if (normalizeIdentityId(member.identityId) || !isValidEmail(member.email)) {
        continue
      }

      try {
        const identityId = await findKeycloakUserIdByEmail(member.email)
        if (!identityId) {
          continue
        }

        member.identityId = identityId
        changed = true
      } catch (error) {
        console.error(
          JSON.stringify({
            email: normalizeEmail(member.email),
            error: error?.message || "Unknown Keycloak member lookup error.",
            event: "portal_member_identity_backfill_failed",
            projectId: project.id
          })
        )
      }
    }
  }

  if (changed) {
    await persistPortalState()
  }
}

async function markKeycloakEmailVerified(userId) {
  const response = await keycloakAdminRequest(
    `/users/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify({
        emailVerified: true,
        enabled: true
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PUT"
    }
  )

  if (!response.ok && response.status !== 204) {
    const data = await parseFetchJson(response)
    throw new HttpError(
      500,
      data?.errorMessage ||
        data?.error ||
        "Portal invite provisioning could not mark the Keycloak user verified."
    )
  }
}

function getProjectPortalUrl(project) {
  return new URL(`/portal/${encodeURIComponent(project.id)}`, portalPublicBaseUrl)
    .toString()
}

function buildPortalInviteEmailContent({ email, name, project, temporaryPassword }) {
  const projectUrl = getProjectPortalUrl(project)
  const displayName = name?.trim() || email
  const subject = `Your ${project.name} client portal access`
  const text = [
    `Hi ${displayName},`,
    "",
    `Your LeCrown client portal access for ${project.name} is ready.`,
    "",
    `Portal: ${projectUrl}`,
    `Login email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "You will be asked to create a new password after you sign in.",
    "",
    "Best,",
    "LeCrown Client Portal"
  ].join("\n")
  const html = `
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>Your LeCrown client portal access for <strong>${escapeHtml(project.name)}</strong> is ready.</p>
    <p>
      Portal: <a href="${escapeHtml(projectUrl)}">${escapeHtml(projectUrl)}</a><br>
      Login email: <strong>${escapeHtml(email)}</strong><br>
      Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong>
    </p>
    <p>You will be asked to create a new password after you sign in.</p>
    <p>Best,<br>LeCrown Client Portal</p>
  `

  return {
    body: text,
    html,
    subject
  }
}

function buildPortalPasswordResetEmailContent({
  email,
  name,
  project,
  temporaryPassword
}) {
  const projectUrl = getProjectPortalUrl(project)
  const displayName = name?.trim() || email
  const subject = `${project.name} portal password reset`
  const text = [
    `Hi ${displayName},`,
    "",
    `Your LeCrown client portal password for ${project.name} has been reset.`,
    "",
    `Portal: ${projectUrl}`,
    `Login email: ${email}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "You will be asked to create a new password after you sign in.",
    "",
    "Best,",
    "LeCrown Client Portal"
  ].join("\n")
  const html = `
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>Your LeCrown client portal password for <strong>${escapeHtml(project.name)}</strong> has been reset.</p>
    <p>
      Portal: <a href="${escapeHtml(projectUrl)}">${escapeHtml(projectUrl)}</a><br>
      Login email: <strong>${escapeHtml(email)}</strong><br>
      Temporary password: <strong>${escapeHtml(temporaryPassword)}</strong>
    </p>
    <p>You will be asked to create a new password after you sign in.</p>
    <p>Best,<br>LeCrown Client Portal</p>
  `

  return {
    body: text,
    html,
    subject
  }
}

function getPortalSmtpMissingReason() {
  const missing = []

  if (!portalSmtpHost) {
    missing.push("PORTAL_SMTP_HOST")
  }

  if (!portalSmtpFrom) {
    missing.push("PORTAL_SMTP_FROM")
  }

  if (portalSmtpAuthRequired && !portalSmtpUser) {
    missing.push("PORTAL_SMTP_USER")
  }

  if (portalSmtpAuthRequired && !portalSmtpPassword) {
    missing.push("PORTAL_SMTP_PASSWORD")
  }

  if (!portalSmtpAuthRequired && portalSmtpPassword && !portalSmtpUser) {
    missing.push("PORTAL_SMTP_USER")
  }

  if (!missing.length) {
    return ""
  }

  return `Portal SMTP is not fully configured. Missing ${missing.join(", ")}.`
}

async function sendPortalActionEmail({
  email,
  emailContent,
  eventName,
  name,
  operation,
  project,
  temporaryPassword
}) {
  const missingReason = getPortalSmtpMissingReason()
  if (missingReason) {
    return {
      delivery: "manual",
      emailContent,
      emailSent: false,
      operation,
      temporaryPassword,
      warning: missingReason
    }
  }

  const displayName = name?.trim() || email
  const transporterConfig = {
    host: portalSmtpHost,
    name: portalSmtpName || undefined,
    port: portalSmtpPort,
    secure: portalSmtpSecure
  }

  // Trusted relay services can accept mail without SMTP auth.
  if (portalSmtpUser && portalSmtpPassword) {
    transporterConfig.auth = {
      pass: portalSmtpPassword,
      user: portalSmtpUser
    }
  }

  const transporter = nodemailer.createTransport(transporterConfig)

  try {
    const info = await transporter.sendMail({
      from: {
        address: portalSmtpFrom,
        name: portalSmtpFromName
      },
      html: emailContent.html,
      replyTo: portalSmtpReplyTo,
      subject: emailContent.subject,
      text: emailContent.body,
      to: {
        address: email,
        name: displayName
      }
    })

    console.info(
      JSON.stringify({
        accepted: info.accepted || [],
        delivery: "portal-smtp",
        event: `${eventName}_sent`,
        messageId: info.messageId || "",
        projectId: project.id,
        rejected: info.rejected || [],
        response: info.response || "",
        to: email
      })
    )

    return {
      delivery: "portal-smtp",
      emailContent,
      emailSent: true,
      messageId: info.messageId || "",
      operation,
      temporaryPassword
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        code: error?.code || "",
        command: error?.command || "",
        delivery: "portal-smtp",
        event: `${eventName}_failed`,
        message: error?.message || "Unknown SMTP error.",
        projectId: project.id,
        response: error?.response || "",
        responseCode: error?.responseCode || "",
        to: email
      })
    )

    return {
      delivery: "manual",
      emailContent,
      emailSent: false,
      operation,
      temporaryPassword,
      warning: `Portal SMTP send failed: ${error?.message || "Unknown SMTP error."}`
    }
  }
}

async function sendPortalInviteEmail({ email, name, project, temporaryPassword }) {
  return await sendPortalActionEmail({
    email,
    emailContent: buildPortalInviteEmailContent({
      email,
      name,
      project,
      temporaryPassword
    }),
    eventName: "portal_invite_email",
    name,
    operation: "invite",
    project,
    temporaryPassword
  })
}

async function sendPortalPasswordResetEmail({
  email,
  name,
  project,
  temporaryPassword
}) {
  return await sendPortalActionEmail({
    email,
    emailContent: buildPortalPasswordResetEmailContent({
      email,
      name,
      project,
      temporaryPassword
    }),
    eventName: "portal_password_reset_email",
    name,
    operation: "password-reset",
    project,
    temporaryPassword
  })
}

async function triggerKeycloakActionEmail(userId) {
  const params = new URLSearchParams({
    client_id: portalInviteClientId,
    redirect_uri: portalInviteRedirectUri
  })
  const response = await keycloakAdminRequest(
    `/users/${encodeURIComponent(userId)}/execute-actions-email?${params.toString()}`,
    {
      body: JSON.stringify(["UPDATE_PASSWORD"]),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PUT"
    }
  )

  if (response.ok || response.status === 204) {
    return {
      delivery: "email",
      emailSent: true,
      temporaryPassword: ""
    }
  }

  const data = await parseFetchJson(response)
  return {
    delivery: "manual",
    emailSent: false,
    error:
      data?.errorMessage ||
      data?.error ||
      "Portal invite email could not be sent."
  }
}

async function provisionPortalInvite(email, name, project) {
  if (!isValidEmail(email)) {
    throw new HttpError(400, "Invite email must look valid.")
  }

  let user = await findKeycloakUserByEmail(email)
  if (!user) {
    user = await createKeycloakPortalUser(email, name)
  }

  await ensureKeycloakRealmRole(user.id, "client")

  if (portalInviteEmailProvider !== "keycloak") {
    const temporaryPassword = await setKeycloakTemporaryPassword(user.id)
    await markKeycloakEmailVerified(user.id)
    const smtpAttempt = await sendPortalInviteEmail({
      email,
      name,
      project,
      temporaryPassword
    })

    if (smtpAttempt.emailSent || portalInviteEmailProvider === "portal-smtp") {
      return {
        ...smtpAttempt,
        identityId: user.id
      }
    }
  }

  const emailAttempt = await triggerKeycloakActionEmail(user.id)
  if (emailAttempt.emailSent) {
    return {
      ...emailAttempt,
      identityId: user.id,
      operation: "invite"
    }
  }

  const temporaryPassword = await setKeycloakTemporaryPassword(user.id)
  return {
    delivery: "manual",
    emailSent: false,
    identityId: user.id,
    operation: "invite",
    temporaryPassword,
    warning:
      emailAttempt.error ||
      "Keycloak email delivery is not configured, so a temporary password was generated instead."
  }
}

async function resetPortalPassword(email, name, project) {
  if (!isValidEmail(email)) {
    throw new HttpError(400, "Password reset email must look valid.")
  }

  const user = await findKeycloakUserByEmail(email)
  if (!user?.id) {
    throw new HttpError(404, "Portal user not found in Keycloak.")
  }

  const temporaryPassword = await setKeycloakTemporaryPassword(user.id)
  await markKeycloakEmailVerified(user.id)

  if (portalInviteEmailProvider !== "keycloak") {
    const smtpAttempt = await sendPortalPasswordResetEmail({
      email,
      name,
      project,
      temporaryPassword
    })

    if (smtpAttempt.emailSent || portalInviteEmailProvider === "portal-smtp") {
      return smtpAttempt
    }
  }

  const emailAttempt = await triggerKeycloakActionEmail(user.id)
  if (emailAttempt.emailSent) {
    return {
      ...emailAttempt,
      operation: "password-reset"
    }
  }

  return {
    delivery: "manual",
    emailContent: buildPortalPasswordResetEmailContent({
      email,
      name,
      project,
      temporaryPassword
    }),
    emailSent: false,
    operation: "password-reset",
    temporaryPassword,
    warning:
      emailAttempt.error ||
      "Keycloak email delivery is not configured, so a temporary password was generated instead."
  }
}

async function readBody(request) {
  return await new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0

    request.on("data", (chunk) => {
      bytes += chunk.length

      if (bytes > maxBodyBytes) {
        reject(new HttpError(413, "Payload too large."))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })

    request.on("end", () => {
      try {
        const body = chunks.length ? Buffer.concat(chunks).toString("utf8") : "{}"
        resolve(JSON.parse(body))
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."))
      }
    })

    request.on("error", reject)
  })
}

function validateLead(payload) {
  if (!payload || typeof payload !== "object") {
    return "Lead payload is required."
  }

  if (!payload.name?.trim()) {
    return "Name is required."
  }

  if (!payload.email?.trim()) {
    return "Email is required."
  }

  if (!/.+@.+\..+/.test(payload.email)) {
    return "Email must look valid."
  }

  if (!payload.goals?.trim()) {
    return "Project note is required."
  }

  return ""
}

function buildLeadRecord(request, payload) {
  return {
    email: payload.email.trim(),
    goals: payload.goals.trim(),
    id: randomUUID(),
    name: payload.name.trim(),
    organization: payload.organization?.trim() || "",
    page: payload.page || "",
    projectType: payload.projectType || "",
    sourceIp: request.headers["x-forwarded-for"] || request.socket.remoteAddress || "",
    submittedAt: payload.submittedAt || new Date().toISOString(),
    targetBuyer: payload.targetBuyer?.trim() || "",
    timeline: payload.timeline || "",
    userAgent: request.headers["user-agent"] || ""
  }
}

function buildPortalUserFromDevHeaders(request) {
  const devEmail =
    request.headers["x-portal-dev-email"]?.toString().trim() ||
    portalDevUser.email
  const devId =
    request.headers["x-portal-dev-id"]?.toString().trim() ||
    portalDevUser.id
  const devName =
    request.headers["x-portal-dev-name"]?.toString().trim() ||
    portalDevUser.name
  const devRoles = (
    request.headers["x-portal-dev-roles"]?.toString() ||
    portalDevUser.roles.join(",")
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    email: devEmail,
    id: devId || "local-portal-user",
    name: devName,
    roles: devRoles.length ? devRoles : ["admin"],
    username: devEmail
  }
}

function tokenMatchesAudience(payload) {
  const tokenAudiences = new Set()
  const rawAudience = payload.aud

  if (Array.isArray(rawAudience)) {
    rawAudience.forEach((value) => {
      if (value) {
        tokenAudiences.add(value)
      }
    })
  } else if (rawAudience) {
    tokenAudiences.add(rawAudience)
  }

  if (payload.azp) {
    tokenAudiences.add(payload.azp)
  }

  return keycloakAudiences.some((audience) => tokenAudiences.has(audience))
}

async function resolvePortalUser(request) {
  if (!keycloakAuthEnforced) {
    return buildPortalUserFromDevHeaders(request)
  }

  const authorizationHeader = request.headers.authorization || ""
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw new HttpError(401, "Authentication is required.")
  }

  try {
    const { payload } = await jwtVerify(match[1], keycloakJwks, {
      clockTolerance: keycloakAllowedClockSkew,
      issuer: keycloakIssuer
    })

    if (!tokenMatchesAudience(payload)) {
      throw new HttpError(401, "Token audience is not allowed for this portal.")
    }

    return {
      email: payload.email || payload.preferred_username || "",
      id: payload.sub || "",
      name:
        payload.name ||
        payload.preferred_username ||
        payload.email ||
        "Portal user",
      roles: Array.isArray(payload.realm_access?.roles)
        ? payload.realm_access.roles
        : [],
      username: payload.preferred_username || payload.email || ""
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }

    throw new HttpError(401, "Authentication could not be verified.")
  }
}

async function ensureStateFile() {
  try {
    const raw = await readFile(portalStorageFile, "utf8")
    return JSON.parse(raw)
  } catch {
    const seedState = await createSeedPortalState(portalDocumentsDir)
    await writeFile(portalStorageFile, JSON.stringify(seedState, null, 2), "utf8")
    return seedState
  }
}

let portalState = { projects: [] }

async function persistPortalState() {
  await writeFile(portalStorageFile, JSON.stringify(portalState, null, 2), "utf8")
}

function requireString(value, message) {
  if (!value?.trim()) {
    throw new HttpError(400, message)
  }

  return value.trim()
}

function findProject(projectId) {
  return portalState.projects.find((project) => project.id === projectId) || null
}

function findComment(project, commentId) {
  return project.feedback.find((comment) => comment.id === commentId) || null
}

function findDocument(project, documentId) {
  return project.documents.find((document) => document.id === documentId) || null
}

function normalizeMember(member) {
  const identityId = normalizeIdentityId(member.identityId)

  return {
    email: requireString(member.email, "Member email is required."),
    ...(identityId ? { identityId } : {}),
    name: requireString(member.name, "Member name is required."),
    role: member.role === "admin" ? "admin" : "client"
  }
}

function upsertProjectMember(project, member) {
  const nextMember = normalizeMember(member)
  const normalizedMemberEmail = normalizeEmail(nextMember.email)
  const existingMembers = Array.isArray(project.members) ? project.members : []
  const existingMember =
    existingMembers.find((entry) => normalizeEmail(entry.email) === normalizedMemberEmail) || null

  if (!nextMember.identityId && existingMember?.identityId) {
    nextMember.identityId = normalizeIdentityId(existingMember.identityId)
  }

  project.members = [
    ...existingMembers.filter((entry) => {
      return normalizeEmail(entry.email) !== normalizedMemberEmail
    }),
    nextMember
  ]
}

function removeProjectMember(project, email) {
  const normalizedMemberEmail = normalizeEmail(email)
  if (!normalizedMemberEmail) {
    throw new HttpError(400, "Member email is required.")
  }

  const existingMembers = Array.isArray(project.members) ? project.members : []
  const nextMembers = existingMembers.filter((entry) => {
    return normalizeEmail(entry.email) !== normalizedMemberEmail
  })

  if (nextMembers.length === existingMembers.length) {
    throw new HttpError(404, "Project member not found.")
  }

  project.members = nextMembers
}

function removeProjectDocument(project, documentId) {
  const existingDocuments = Array.isArray(project.documents) ? project.documents : []
  const documentIndex = existingDocuments.findIndex((document) => {
    return document.id === documentId
  })

  if (documentIndex < 0) {
    throw new HttpError(404, "Document not found.")
  }

  return existingDocuments.splice(documentIndex, 1)[0]
}

function buildProjectBillingReturnUrl(project) {
  return `${portalPublicBaseUrl.replace(/\/+$/, "")}/portal/${encodeURIComponent(project.id)}?tab=billing`
}

async function createProjectBillingCheckout(project, user) {
  const billing = normalizeBillingConfig(project.billing || {})

  if (!billing.enabled) {
    throw new HttpError(404, "Credit-card billing is not enabled for this project.")
  }

  if (billing.checkoutUrl) {
    return {
      provider: "stripe-hosted-link",
      url: billing.checkoutUrl
    }
  }

  if (!billing.priceLookupKey) {
    throw new HttpError(409, "Billing lookup key is not configured for this project.")
  }

  if (!billingServiceUrl || !billingServiceApiKey) {
    throw new HttpError(503, "Central billing service is not configured.")
  }

  const returnUrl = buildProjectBillingReturnUrl(project)
  const response = await fetch(`${billingServiceUrl}/v1/checkout/sessions`, {
    body: JSON.stringify({
      account_ref: user.id || user.email,
      cancel_url:
        billingCheckoutCancelUrl === `${portalPublicBaseUrl}/portal`
          ? returnUrl
          : billingCheckoutCancelUrl,
      customer_email: user.email,
      customer_name: user.name,
      environment: process.env.NODE_ENV || "production",
      origin_domain: new URL(portalPublicBaseUrl).hostname,
      plan: billing.priceLookupKey,
      price_lookup_key: billing.priceLookupKey,
      project: billingProject,
      project_ref: project.id,
      success_url:
        billingCheckoutSuccessUrl === `${portalPublicBaseUrl}/portal`
          ? returnUrl
          : billingCheckoutSuccessUrl
    }),
    headers: {
      "Authorization": `Bearer ${billingServiceApiKey}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new HttpError(
      response.status,
      data?.error || "Billing checkout could not be created."
    )
  }

  if (!data?.url) {
    throw new HttpError(502, "Billing service did not return a checkout URL.")
  }

  return {
    provider: "central-billing-service",
    requestId: data.request_id || data.requestId || "",
    url: data.url
  }
}

function applyProjectPatch(project, payload) {
  if (payload.name?.trim()) {
    project.name = payload.name.trim()
  }

  if (payload.status?.trim()) {
    project.status = payload.status.trim()
  }

  if (payload.phase?.trim()) {
    project.phase = payload.phase.trim()
  }

  if (payload.summary?.trim()) {
    project.summary = payload.summary.trim()
  }

  if (Array.isArray(payload.highlights)) {
    project.highlights = payload.highlights
      .map((value) => value?.trim())
      .filter(Boolean)
  }

  if (Array.isArray(payload.timeline)) {
    project.timeline = normalizeProjectTimeline(payload.timeline)
  }

  if (payload.preview && typeof payload.preview === "object") {
    project.preview = {
      notes: payload.preview.notes?.trim() || project.preview?.notes || "",
      reviewChecklist: Array.isArray(payload.preview.reviewChecklist)
        ? payload.preview.reviewChecklist
            .map((value) => value?.trim())
            .filter(Boolean)
        : project.preview?.reviewChecklist || [],
      url: payload.preview.url?.trim() || project.preview?.url || "/"
    }
  }

  if (payload.billing && typeof payload.billing === "object") {
    project.billing = normalizeBillingConfig(payload.billing)
  }

  if (Array.isArray(payload.members)) {
    const existingMembersByEmail = new Map(
      (Array.isArray(project.members) ? project.members : []).map((member) => [
        normalizeEmail(member.email),
        member
      ])
    )

    project.members = payload.members.map((member) => {
      const normalizedMember = normalizeMember(member)
      const existingMember = existingMembersByEmail.get(
        normalizeEmail(normalizedMember.email)
      )

      if (!normalizedMember.identityId && existingMember?.identityId) {
        normalizedMember.identityId = normalizeIdentityId(existingMember.identityId)
      }

      return normalizedMember
    })
  }

  setProjectUpdated(project)
}

function buildComment(user, payload) {
  const message = requireString(payload.message, "Comment message is required.")
  const rawTags = Array.isArray(payload.tags) ? payload.tags : []

  return {
    authorEmail: user.email,
    authorName: user.name,
    id: randomUUID(),
    message,
    role: user.roles.includes("admin") ? "admin" : "client",
    status: "open",
    tags: user.roles.includes("admin")
      ? rawTags.map((value) => value?.trim()).filter(Boolean)
      : [],
    timestamp: new Date().toISOString()
  }
}

async function createDocument(project, payload) {
  const rawFileName =
    payload.fileName || payload.name || `document-${randomUUID()}.txt`
  const contentBase64 = requireString(
    payload.contentBase64,
    "Document contentBase64 is required."
  )
  const documentId = payload.id?.trim() || randomUUID()
  const category = requireString(payload.category, "Document category is required.")
  const name = requireString(payload.name, "Document name is required.")
  const description = payload.description?.trim() || ""
  const contentType = payload.contentType?.trim() || "application/octet-stream"
  const fileName = deriveDocumentFileName(name, rawFileName)

  let contentBuffer

  try {
    contentBuffer = Buffer.from(contentBase64, "base64")
  } catch {
    throw new HttpError(400, "Document contentBase64 must be valid base64.")
  }

  if (!contentBuffer.length) {
    throw new HttpError(400, "Document contentBase64 must not be empty.")
  }

  if (isDriveDocumentProvider()) {
    const parentId = await ensureProjectDriveCategoryFolder(project, category)
    const driveFile = await uploadPortalDriveFile({
      appProperties: {
        portalCategory: category,
        portalDisplayName: name,
        portalDocumentId: documentId,
        portalProjectId: project.id
      },
      buffer: contentBuffer,
      contentType,
      description,
      name: fileName,
      parentId
    })

    return {
      category,
      contentType,
      description,
      driveFileId: driveFile.id,
      fileName: driveFile.name || fileName,
      id: documentId,
      name,
      updatedAt: normalizeDriveDate(driveFile.modifiedTime)
    }
  }

  const projectDir = join(portalDocumentsDir, project.id)
  await mkdir(projectDir, { recursive: true })

  const storagePath = join(projectDir, `${documentId}-${fileName}`)
  await writeFile(storagePath, contentBuffer)

  return {
    category,
    contentType,
    description,
    fileName,
    id: documentId,
    name,
    storagePath,
    updatedAt: todayStamp()
  }
}

async function deleteDocumentFile(document) {
  if (document?.driveFileId) {
    await deletePortalDriveFile(document.driveFileId)
  }

  if (!document?.storagePath) {
    return
  }

  try {
    await unlink(document.storagePath)
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new HttpError(500, "Document file could not be removed.")
    }
  }
}

await mkdir(dirname(leadStorageFile), { recursive: true })
await mkdir(dirname(portalStorageFile), { recursive: true })
await mkdir(portalDocumentsDir, { recursive: true })
portalState = await ensureStateFile()
await backfillPortalMemberIdentityIds()
await reconcilePortalDriveProjects()

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost")
  const pathname = url.pathname

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Portal-Dev-Email, X-Portal-Dev-Id, X-Portal-Dev-Name, X-Portal-Dev-Roles",
      "Access-Control-Allow-Methods":
        "DELETE,GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Origin": "*"
    })
    response.end()
    return
  }

  try {
    if (request.method === "GET" && pathname === "/health") {
      json(response, 200, {
        keycloakAuthEnforced,
        ok: true,
        portalProjects: portalState.projects.length
      })
      return
    }

    if (request.method === "POST" && pathname === "/v1/intake") {
      const payload = await readBody(request)
      const validationError = validateLead(payload)

      if (validationError) {
        throw new HttpError(400, validationError)
      }

      const record = buildLeadRecord(request, payload)
      await appendFile(leadStorageFile, `${JSON.stringify(record)}\n`, "utf8")

      json(response, 201, {
        leadId: record.id,
        ok: true,
        reply: "Lead captured."
      })
      return
    }

    if (pathname.startsWith("/v1/portal")) {
      const user = await resolvePortalUser(request)

      if (request.method === "GET" && pathname === "/v1/portal/me") {
        json(response, 200, {
          ok: true,
          user: {
            email: user.email,
            id: user.id,
            name: user.name,
            roles: user.roles
          }
        })
        return
      }

      if (request.method === "GET" && pathname === "/v1/portal/projects") {
        const projects = portalState.projects
          .filter((project) => canAccessProject(project, user))
          .map(summarizeProject)

        json(response, 200, { ok: true, projects })
        return
      }

      if (request.method === "POST" && pathname === "/v1/portal/projects") {
        assertAdmin(user)
        const payload = await readBody(request)
        const name = requireString(payload.name, "Project name is required.")
        const projectId = payload.id?.trim() || slugify(name, randomUUID())

        if (findProject(projectId)) {
          throw new HttpError(409, "Project id already exists.")
        }

        const project = {
          documents: [],
          driveCategoryFolderIds: {},
          driveFolderId: payload.driveFolderId?.trim() || "",
          feedback: [],
          highlights: Array.isArray(payload.highlights)
            ? payload.highlights.map((value) => value?.trim()).filter(Boolean)
            : [],
          id: projectId,
          lastUpdated: todayStamp(),
          members: Array.isArray(payload.members)
            ? payload.members.map(normalizeMember)
            : [],
          name,
          phase: payload.phase?.trim() || "Not Started",
          preview: {
            notes: payload.preview?.notes?.trim() || "",
            reviewChecklist: Array.isArray(payload.preview?.reviewChecklist)
              ? payload.preview.reviewChecklist
                  .map((value) => value?.trim())
                  .filter(Boolean)
              : [],
            url: payload.preview?.url?.trim() || "/"
          },
          status: payload.status?.trim() || "Not Started",
          summary: payload.summary?.trim() || "",
          timeline: normalizeProjectTimeline(payload.timeline)
        }

        if (isDriveDocumentProvider()) {
          await ensureProjectDriveFolder(project)
        }

        portalState.projects.unshift(project)
        await persistPortalState()

        json(response, 201, { ok: true, project: sanitizeProject(project) })
        return
      }

      const projectMatch = pathname.match(/^\/v1\/portal\/projects\/([^/]+)$/)
      if (projectMatch) {
        const project = findProject(decodeURIComponent(projectMatch[1]))
        assertProjectAccess(project, user)

        if (request.method === "GET") {
          await refreshProjectDocuments(project)
          json(response, 200, { ok: true, project: sanitizeProject(project) })
          return
        }

        if (request.method === "PATCH") {
          assertAdmin(user)
          const payload = await readBody(request)
          applyProjectPatch(project, payload)

          if (isDriveDocumentProvider()) {
            if (payload.driveFolderId?.trim()) {
              project.driveFolderId = payload.driveFolderId.trim()
            } else if (!project.driveFolderId) {
              await ensureProjectDriveFolder(project)
            }
          }

          await persistPortalState()
          json(response, 200, { ok: true, project: sanitizeProject(project) })
          return
        }
      }

      const projectBillingCheckoutMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/billing\/checkout$/
      )
      if (projectBillingCheckoutMatch && request.method === "POST") {
        const project = findProject(
          decodeURIComponent(projectBillingCheckoutMatch[1])
        )
        assertProjectAccess(project, user)

        const checkout = await createProjectBillingCheckout(project, user)
        json(response, 200, {
          ok: true,
          ...checkout
        })
        return
      }

      const projectInviteMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/invitations$/
      )
      if (projectInviteMatch && request.method === "POST") {
        const project = findProject(decodeURIComponent(projectInviteMatch[1]))
        assertProjectAccess(project, user)
        assertAccessManager(user)

        const payload = await readBody(request)
        const email = requireString(
          payload.email,
          "Invite email is required."
        ).toLowerCase()
        const name =
          payload.name?.trim() || email

        const invitation = await provisionPortalInvite(email, name, project)
        upsertProjectMember(project, {
          email,
          identityId: invitation.identityId,
          name,
          role: "client"
        })
        setProjectUpdated(project)
        await persistPortalState()

        json(response, 201, {
          invitation,
          ok: true,
          project: sanitizeProject(project)
        })
        return
      }

      const projectMemberMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/members\/([^/]+)$/
      )
      if (projectMemberMatch && request.method === "DELETE") {
        const project = findProject(decodeURIComponent(projectMemberMatch[1]))
        assertProjectAccess(project, user)
        assertAccessManager(user)

        removeProjectMember(project, decodeURIComponent(projectMemberMatch[2]))
        setProjectUpdated(project)
        await persistPortalState()

        json(response, 200, {
          ok: true,
          project: sanitizeProject(project)
        })
        return
      }

      const projectMemberPasswordMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/members\/([^/]+)\/password-reset$/
      )
      if (projectMemberPasswordMatch && request.method === "POST") {
        const project = findProject(decodeURIComponent(projectMemberPasswordMatch[1]))
        assertProjectAccess(project, user)
        assertAccessManager(user)

        const payload = await readBody(request)
        const email = decodeURIComponent(projectMemberPasswordMatch[2]).toLowerCase()
        const member =
          project.members.find((entry) => normalizeEmail(entry.email) === email) || null
        const passwordReset = await resetPortalPassword(
          email,
          payload.name?.trim() || member?.name || email,
          project
        )

        json(response, 200, {
          ok: true,
          passwordReset,
          project: sanitizeProject(project)
        })
        return
      }

      const commentsMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/comments$/
      )
      if (commentsMatch && request.method === "POST") {
        const project = findProject(decodeURIComponent(commentsMatch[1]))
        assertProjectAccess(project, user)
        const payload = await readBody(request)
        const comment = buildComment(user, payload)

        project.feedback.unshift(comment)
        setProjectUpdated(project)
        await persistPortalState()

        json(response, 201, { ok: true, project: sanitizeProject(project) })
        return
      }

      const commentStatusMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/comments\/([^/]+)$/
      )
      if (commentStatusMatch && request.method === "PATCH") {
        const project = findProject(decodeURIComponent(commentStatusMatch[1]))
        assertProjectAccess(project, user)
        assertAdmin(user)

        const comment = findComment(project, decodeURIComponent(commentStatusMatch[2]))
        if (!comment) {
          throw new HttpError(404, "Comment not found.")
        }

        const payload = await readBody(request)
        if (payload.status && !["open", "addressed"].includes(payload.status)) {
          throw new HttpError(400, "Comment status must be open or addressed.")
        }

        if (payload.status) {
          comment.status = payload.status
        }

        if (Array.isArray(payload.tags)) {
          comment.tags = payload.tags.map((value) => value?.trim()).filter(Boolean)
        }

        setProjectUpdated(project)
        await persistPortalState()

        json(response, 200, { ok: true, project: sanitizeProject(project) })
        return
      }

      const documentsMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/documents$/
      )
      if (documentsMatch && request.method === "POST") {
        const project = findProject(decodeURIComponent(documentsMatch[1]))
        assertProjectAccess(project, user)
        assertAdmin(user)

        const payload = await readBody(request)
        const document = await createDocument(project, payload)
        project.documents.unshift(document)
        setProjectUpdated(project)
        await persistPortalState()

        json(response, 201, {
          document: sanitizeDocument(project.id, document),
          ok: true,
          project: sanitizeProject(project)
        })
        return
      }

      const documentMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/documents\/([^/]+)$/
      )
      if (documentMatch && request.method === "DELETE") {
        const project = findProject(decodeURIComponent(documentMatch[1]))
        assertProjectAccess(project, user)
        assertAccessManager(user)
        await refreshProjectDocuments(project)

        const document = findDocument(project, decodeURIComponent(documentMatch[2]))
        if (!document) {
          throw new HttpError(404, "Document not found.")
        }

        await deleteDocumentFile(document)
        removeProjectDocument(project, document.id)
        setProjectUpdated(project)
        await persistPortalState()

        json(response, 200, {
          ok: true,
          project: sanitizeProject(project)
        })
        return
      }

      const documentDownloadMatch = pathname.match(
        /^\/v1\/portal\/projects\/([^/]+)\/documents\/([^/]+)\/download$/
      )
      if (documentDownloadMatch && request.method === "GET") {
        const project = findProject(decodeURIComponent(documentDownloadMatch[1]))
        assertProjectAccess(project, user)
        await refreshProjectDocuments(project)

        const document = findDocument(project, decodeURIComponent(documentDownloadMatch[2]))
        if (!document) {
          throw new HttpError(404, "Document not found.")
        }

        if (document.driveFileId) {
          const driveResponse = await downloadPortalDriveFile(document.driveFileId)
          const contentBuffer = Buffer.from(await driveResponse.arrayBuffer())

          response.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="${getDocumentDownloadFileName(document).replace(/"/g, "")}"`,
            "Content-Length": contentBuffer.length,
            "Content-Type":
              driveResponse.headers.get("content-type") ||
              document.contentType ||
              "application/octet-stream"
          })
          response.end(contentBuffer)
          return
        }

        const metadata = await stat(document.storagePath).catch(() => null)
        if (!metadata?.isFile()) {
          throw new HttpError(404, "Document file is unavailable.")
        }

        response.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${getDocumentDownloadFileName(document).replace(/"/g, "")}"`,
          "Content-Length": metadata.size,
          "Content-Type": document.contentType || "application/octet-stream"
        })
        createReadStream(document.storagePath).pipe(response)
        return
      }
    }

    throw new HttpError(404, "Not found.")
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message =
      error instanceof HttpError
        ? error.message
        : error?.message || "Request failed."

    json(response, statusCode, { error: message })
  }
})

server.listen(port, "0.0.0.0", () => {
  console.log(`lead-api listening on ${port}`)
})
