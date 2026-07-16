import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, extname, join } from "node:path"

const portalDriveFolderMimeType = "application/vnd.google-apps.folder"
const envFilePath = new URL("../.env.local", import.meta.url)
const packageTempPrefix = "lecrown-portal-package-"

const projectConfigs = {
  "houston-auto-storage-acquisition": {
    archiveRootFolderName: "Portal_Version_History",
    outboundFolderName: "06_Client_Outbound_Portal 4",
    packageFolderPattern:
      /^06_Client_Outbound_Portal\/(?<uploadFolder>Office_Uploads_v[^/]+)\/(?<fileName>[^/]+)$/,
    projectName: "Houston Auto Storage Acquisition Due Diligence",
    knownDocuments: {
      "doc_retainer_receipt__asset_valuation_retainer_receipt": {
        category: "Scope & Agreements",
        description:
          "Retainer payment acknowledgment for the acquisition diligence engagement.",
        displayName: "Asset valuation retainer receipt.docx",
        portalDocumentId: "houston-retainer-receipt"
      },
      "doc_onboarding_welcome__client_welcome_letter": {
        category: "Scope & Agreements",
        description:
          "Client welcome letter outlining the diligence kickoff and communication path.",
        displayName: "Client welcome letter.docx",
        portalDocumentId: "houston-welcome-letter"
      },
      "doc_custom_requirement_manifest__due_diligence_request_manifest": {
        category: "Site Structure / Outline",
        description:
          "Due diligence request manifest covering financials, fleet, real estate, and legal items.",
        displayName: "Due diligence request manifest.docx",
        portalDocumentId: "houston-diligence-manifest"
      },
      "upload_index__portal_file_manifest": {
        category: "Site Structure / Outline",
        description:
          "Portal upload index listing the current client-facing file package.",
        displayName: "Portal upload file manifest.docx",
        portalDocumentId: "houston-upload-index"
      },
      "doc_email_cover_note__seller_document_request_email": {
        category: "Deliverables",
        description:
          "Seller / valuator email draft for requesting the initial diligence package.",
        displayName: "Seller document request email.docx",
        portalDocumentId: "houston-seller-email"
      },
      "tracking_manifest__due_diligence_status_matrix": {
        category: "Deliverables",
        description:
          "Tracking workbook for monitoring received documents and outstanding diligence items.",
        displayName: "Due diligence status matrix.xlsx",
        portalDocumentId: "houston-tracking-workbook"
      },
      "site_visit_handoff__strategic_asset_premium_context": {
        category: "Deliverables",
        description:
          "Site visit handoff and strategic asset premium context summary for the valuation review.",
        displayName: "Strategic asset premium context handoff.docx",
        portalDocumentId: "houston-site-visit-handoff"
      },
      "valuation_methodology__income_asset_blended_review": {
        category: "Deliverables",
        description:
          "Valuation methodology narrative for the income asset blended review.",
        displayName: "Income asset blended review methodology.docx",
        portalDocumentId: "houston-valuation-methodology"
      },
      "valuation_model__income_asset_blended_review": {
        category: "Deliverables",
        description:
          "Valuation model workbook for the income asset blended review.",
        displayName: "Income asset blended review model.xlsx",
        portalDocumentId: "houston-valuation-model"
      }
    }
  },
  "carlos-stephanie-second-business-evaluation": {
    archiveRootFolderName: "Portal_Version_History",
    outboundFolderName: "04_Deliverables",
    packageFolderPattern:
      /^04_Deliverables\/(?<uploadFolder>[^/]+)\/(?<fileName>[^/]+)$/,
    projectName: "Carlos and Stephanie - Second Business Evaluation",
    knownFiles: {
      "README_PACKAGE_INDEX.txt": {
        category: "Site Structure / Outline",
        description: "Plain-text package index describing the current client-facing upload set.",
        displayName: "README package index.txt",
        portalDocumentId: "carlos-stephanie-package-index"
      },
      "client_email_cover_note.docx": {
        category: "Deliverables",
        description: "Client-facing cover note for the engagement package and next-step communication.",
        displayName: "Client email cover note.docx",
        portalDocumentId: "carlos-stephanie-email-cover-note"
      },
      "client_engagement_overview.docx": {
        category: "Scope & Agreements",
        description: "Engagement overview summarizing scope, process, and advisory context for the second business evaluation.",
        displayName: "Client engagement overview.docx",
        portalDocumentId: "carlos-stephanie-engagement-overview"
      },
      "document_request_checklist.docx": {
        category: "Assets",
        description: "Document request checklist outlining the supporting materials requested for the evaluation.",
        displayName: "Document request checklist.docx",
        portalDocumentId: "carlos-stephanie-document-request-checklist"
      },
      "document_request_matrix.xlsx": {
        category: "Assets",
        description: "Tracking matrix for requested documents and engagement intake follow-up.",
        displayName: "Document request matrix.xlsx",
        portalDocumentId: "carlos-stephanie-document-request-matrix"
      },
      "portal_upload_instructions.docx": {
        category: "Site Structure / Outline",
        description: "Portal upload instructions and workflow guidance for the client engagement.",
        displayName: "Portal upload instructions.docx",
        portalDocumentId: "carlos-stephanie-portal-upload-instructions"
      }
    },
    knownDocuments: {}
  }
}

function printUsage() {
  console.log(`Usage:
  node import-portal-package.mjs --project <project-id> --zip <zip-path> [options]

Options:
  --archive-snapshot-name <name>   Snapshot folder name under Portal_Version_History
  --backfill-archive-dir <dir>     Upload an older local file set into the archive snapshot folder
  --backfill-extra-file <path>     Add an extra file to the archive snapshot folder
  --skip-import                    Only backfill the archive snapshot folder
  --help                           Show this message
`)
}

function parseArgs(argv) {
  const options = {
    backfillExtraFiles: [],
    skipImport: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--skip-import") {
      options.skipImport = true
      continue
    }

    if (arg === "--backfill-extra-file") {
      options.backfillExtraFiles.push(argv[index + 1] || "")
      index += 1
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    options[key] = argv[index + 1] || ""
    index += 1
  }

  return options
}

function normalizeString(value) {
  return String(value || "").trim()
}

function slugify(value, fallback = "document") {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return slug || fallback
}

function normalizeDriveFolderKey(value) {
  return slugify(
    normalizeString(value)
      .replaceAll("_", " ")
      .replaceAll("[", " ")
      .replaceAll("]", " "),
    "folder"
  )
}

function titleCaseSlug(value) {
  return normalizeString(value)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function inferContentType(fileName) {
  const extension = extname(fileName).toLowerCase()

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }

  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }

  if (extension === ".pdf") {
    return "application/pdf"
  }

  if (extension === ".zip") {
    return "application/zip"
  }

  if (extension === ".csv") {
    return "text/csv; charset=utf-8"
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg"
  }

  if (extension === ".png") {
    return "image/png"
  }

  if (extension === ".md") {
    return "text/markdown; charset=utf-8"
  }

  if (extension === ".txt") {
    return "text/plain; charset=utf-8"
  }

  return "application/octet-stream"
}

function readEnvLineMap(text) {
  const entries = {}

  for (const line of text.split(/\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    entries[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1)
  }

  return entries
}

async function loadDriveEnv() {
  const envFileText = await readFile(envFilePath, "utf8")
  const fileEnv = readEnvLineMap(envFileText)
  const env = {
    PORTAL_DRIVE_ROOT_FOLDER_ID:
      process.env.PORTAL_DRIVE_ROOT_FOLDER_ID || fileEnv.PORTAL_DRIVE_ROOT_FOLDER_ID || "",
    PORTAL_DRIVE_CLIENT_ID:
      process.env.PORTAL_DRIVE_CLIENT_ID || fileEnv.PORTAL_DRIVE_CLIENT_ID || "",
    PORTAL_DRIVE_CLIENT_SECRET:
      process.env.PORTAL_DRIVE_CLIENT_SECRET || fileEnv.PORTAL_DRIVE_CLIENT_SECRET || "",
    PORTAL_DRIVE_REFRESH_TOKEN:
      process.env.PORTAL_DRIVE_REFRESH_TOKEN || fileEnv.PORTAL_DRIVE_REFRESH_TOKEN || "",
    PORTAL_DRIVE_TOKEN_URL:
      process.env.PORTAL_DRIVE_TOKEN_URL ||
      fileEnv.PORTAL_DRIVE_TOKEN_URL ||
      "https://oauth2.googleapis.com/token",
    PORTAL_DRIVE_API_BASE_URL:
      process.env.PORTAL_DRIVE_API_BASE_URL ||
      fileEnv.PORTAL_DRIVE_API_BASE_URL ||
      "https://www.googleapis.com/drive/v3",
    PORTAL_DRIVE_UPLOAD_BASE_URL:
      process.env.PORTAL_DRIVE_UPLOAD_BASE_URL ||
      fileEnv.PORTAL_DRIVE_UPLOAD_BASE_URL ||
      "https://www.googleapis.com/upload/drive/v3"
  }

  const missing = Object.entries(env)
    .filter(([key, value]) => !value && !key.endsWith("BASE_URL"))
    .map(([key]) => key)

  if (missing.length) {
    throw new Error(`Missing Drive env values: ${missing.join(", ")}`)
  }

  return env
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

function escapeDriveQueryValue(value) {
  return normalizeString(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
}

async function getDriveAccessToken(driveEnv) {
  const response = await fetch(driveEnv.PORTAL_DRIVE_TOKEN_URL, {
    body: new URLSearchParams({
      client_id: driveEnv.PORTAL_DRIVE_CLIENT_ID,
      client_secret: driveEnv.PORTAL_DRIVE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: driveEnv.PORTAL_DRIVE_REFRESH_TOKEN
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  })

  const data = (await response.json().catch(() => null)) || {}
  if (!response.ok || !data.access_token) {
    throw new Error(`Drive token request failed: ${JSON.stringify(data)}`)
  }

  return data.access_token
}

async function driveRequest(accessToken, driveEnv, pathname, {
  baseUrl = driveEnv.PORTAL_DRIVE_API_BASE_URL,
  body,
  headers = {},
  method = "GET",
  query = {}
} = {}) {
  const response = await fetch(buildDriveUrl(baseUrl, pathname, query), {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers
    },
    method
  })

  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(`Drive request failed (${response.status}) ${pathname}: ${message}`)
  }

  return response
}

async function listDriveFiles(accessToken, driveEnv, query) {
  const files = []
  let pageToken = ""

  do {
    const response = await driveRequest(accessToken, driveEnv, "/files", {
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

async function createDriveFolder(accessToken, driveEnv, parentId, name, appProperties = {}) {
  const response = await driveRequest(accessToken, driveEnv, "/files", {
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

async function findDriveChildFolderByName(accessToken, driveEnv, parentId, name) {
  const folders = await listDriveFiles(
    accessToken,
    driveEnv,
    [
      `'${escapeDriveQueryValue(parentId)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`,
      `name = '${escapeDriveQueryValue(name)}'`
    ].join(" and ")
  )

  return folders[0] || null
}

async function findDriveChildFileByName(accessToken, driveEnv, parentId, name) {
  const files = await listDriveFiles(
    accessToken,
    driveEnv,
    [
      `'${escapeDriveQueryValue(parentId)}' in parents`,
      "trashed = false",
      `mimeType != '${portalDriveFolderMimeType}'`,
      `name = '${escapeDriveQueryValue(name)}'`
    ].join(" and ")
  )

  return files[0] || null
}

function mergeDriveAppProperties(existingAppProperties = {}, nextAppProperties = {}) {
  const merged = { ...(existingAppProperties || {}) }
  let changed = false

  for (const [key, value] of Object.entries(nextAppProperties || {})) {
    const normalizedValue = normalizeString(value)
    if (!normalizedValue || merged[key] === normalizedValue) {
      continue
    }

    merged[key] = normalizedValue
    changed = true
  }

  return {
    appProperties: merged,
    changed
  }
}

async function ensureDriveFolder(accessToken, driveEnv, parentId, name, appProperties = {}) {
  const existingFolder = await findDriveChildFolderByName(
    accessToken,
    driveEnv,
    parentId,
    name
  )

  if (!existingFolder) {
    return await createDriveFolder(accessToken, driveEnv, parentId, name, appProperties)
  }

  const { appProperties: mergedAppProperties, changed } = mergeDriveAppProperties(
    existingFolder.appProperties || {},
    appProperties
  )

  if (!changed) {
    return existingFolder
  }

  return await updateDriveFileMetadata(accessToken, driveEnv, existingFolder, {
    appProperties: mergedAppProperties,
    description: existingFolder.description || "",
    name: existingFolder.name
  })
}

function buildMultipartBody(metadata, buffer, contentType) {
  const boundary = `portal-drive-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`
  return {
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
      ),
      Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`)
    ]),
    boundary
  }
}

async function uploadDriveFile(accessToken, driveEnv, {
  appProperties = {},
  buffer,
  contentType,
  description = "",
  name,
  parentId
}) {
  const multipart = buildMultipartBody(
    {
      appProperties,
      description,
      name,
      parents: [parentId]
    },
    buffer,
    contentType
  )
  const response = await driveRequest(accessToken, driveEnv, "/files", {
    baseUrl: driveEnv.PORTAL_DRIVE_UPLOAD_BASE_URL,
    body: multipart.body,
    headers: {
      "Content-Type": `multipart/related; boundary=${multipart.boundary}`
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

async function updateDriveFileContent(accessToken, driveEnv, existingFile, {
  appProperties = {},
  buffer,
  contentType,
  description = "",
  name,
  parentId
}) {
  const multipart = buildMultipartBody(
    {
      appProperties,
      description,
      name
    },
    buffer,
    contentType
  )
  const query = {
    fields:
      "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
    supportsAllDrives: "true",
    uploadType: "multipart"
  }

  if (!existingFile.parents?.includes(parentId)) {
    query.addParents = parentId
    if (existingFile.parents?.length) {
      query.removeParents = existingFile.parents.join(",")
    }
  }

  const response = await driveRequest(
    accessToken,
    driveEnv,
    `/files/${encodeURIComponent(existingFile.id)}`,
    {
      baseUrl: driveEnv.PORTAL_DRIVE_UPLOAD_BASE_URL,
      body: multipart.body,
      headers: {
        "Content-Type": `multipart/related; boundary=${multipart.boundary}`
      },
      method: "PATCH",
      query
    }
  )

  return await response.json()
}

async function updateDriveFileMetadata(accessToken, driveEnv, existingFile, {
  appProperties = {},
  description = "",
  name = existingFile.name,
  parentId = ""
}) {
  const query = {
    fields:
      "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
    supportsAllDrives: "true"
  }

  if (parentId && !existingFile.parents?.includes(parentId)) {
    query.addParents = parentId
    if (existingFile.parents?.length) {
      query.removeParents = existingFile.parents.join(",")
    }
  }

  const response = await driveRequest(
    accessToken,
    driveEnv,
    `/files/${encodeURIComponent(existingFile.id)}`,
    {
      body: JSON.stringify({
        appProperties,
        description,
        name
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PATCH",
      query
    }
  )

  return await response.json()
}

async function copyDriveFile(accessToken, driveEnv, fileId, payload) {
  const response = await driveRequest(
    accessToken,
    driveEnv,
    `/files/${encodeURIComponent(fileId)}/copy`,
    {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      query: {
        fields:
          "id,name,mimeType,description,modifiedTime,appProperties,parents,size",
        supportsAllDrives: "true"
      }
    }
  )

  return await response.json()
}

async function downloadDriveFile(accessToken, driveEnv, fileId) {
  const response = await driveRequest(
    accessToken,
    driveEnv,
    `/files/${encodeURIComponent(fileId)}`,
    {
      query: {
        alt: "media",
        supportsAllDrives: "true"
      }
    }
  )

  return Buffer.from(await response.arrayBuffer())
}

function parseZipSemanticKey(fileName) {
  const extension = extname(fileName)
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName
  const segments = baseName.split("__").filter(Boolean)

  if (segments.length < 3) {
    return ""
  }

  return `${segments[1]}__${segments[2]}`
}

function normalizePackageRelativePath(value) {
  return normalizeString(value).replaceAll("\\", "/")
}

function stripExtension(fileName) {
  const extension = extname(fileName)
  return extension ? fileName.slice(0, -extension.length) : fileName
}

function humanizeFileName(fileName) {
  return `${stripExtension(fileName).replaceAll("_", " ").trim()}${extname(fileName)}`
}

function isIgnoredPackageRelativePath(relativePath) {
  const segments = normalizePackageRelativePath(relativePath)
    .split("/")
    .filter(Boolean)

  if (!segments.length) {
    return true
  }

  return segments.some((segment) => segment === "__MACOSX" || segment.startsWith("."))
}

function deriveUploadFolderName(zipPath) {
  return stripExtension(basename(zipPath))
}

function buildPackageArchiveSpec(zipPath) {
  const fileName = basename(zipPath)
  return {
    category: "Deliverables",
    description: "Downloadable zip package of the current client-facing deliverables.",
    displayName: humanizeFileName(fileName),
    fileName,
    portalDocumentId: `package-${slugify(stripExtension(fileName), "package")}`
  }
}

function parseZipDate(fileName) {
  const extension = extname(fileName)
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName
  return baseName.split("__")[0] || ""
}

function inferDocumentSpec(projectConfig, fileName) {
  const knownFile = projectConfig.knownFiles?.[fileName]
  if (knownFile) {
    return {
      ...knownFile,
      fileName
    }
  }

  const semanticKey = parseZipSemanticKey(fileName)
  const known = projectConfig.knownDocuments[semanticKey]

  if (known) {
    return {
      ...known,
      fileName
    }
  }

  const extension = extname(fileName)
  const extensionSlug = extension.replace(/^\./, "")
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName
  const segments = baseName.split("__").filter(Boolean)
  const stem = segments[2] || baseName

  return {
    category: "Deliverables",
    description: "",
    displayName: humanizeFileName(fileName) || `${titleCaseSlug(stem)}${extension}`,
    fileName,
    portalDocumentId: `auto-${slugify(
      extensionSlug ? `${baseName}-${extensionSlug}` : baseName
    )}`
  }
}

function resolvePackageFiles(projectConfig, extractedPackageFiles, zipPath) {
  const candidateFiles = extractedPackageFiles.filter(
    (entry) => !isIgnoredPackageRelativePath(entry.relativePath)
  )

  const legacyPackageFiles = candidateFiles
    .map((entry) => {
      const match = entry.relativePath.match(projectConfig.packageFolderPattern)
      if (!match?.groups?.uploadFolder || !match?.groups?.fileName) {
        return null
      }

      return {
        ...entry,
        fileName: match.groups.fileName,
        uploadFolderName: match.groups.uploadFolder
      }
    })
    .filter(Boolean)

  if (legacyPackageFiles.length) {
    return legacyPackageFiles
  }

  const normalizedFiles = candidateFiles.map((entry) => ({
    ...entry,
    normalizedRelativePath: normalizePackageRelativePath(entry.relativePath)
  }))
  const sharedTopLevelFolder = normalizedFiles[0]?.normalizedRelativePath.split("/")[0] || ""
  const canUseSingleTopLevelFolder =
    Boolean(sharedTopLevelFolder) &&
    normalizedFiles.every((entry) => {
      const segments = entry.normalizedRelativePath.split("/").filter(Boolean)
      return segments.length === 2 && segments[0] === sharedTopLevelFolder
    })

  if (canUseSingleTopLevelFolder) {
    return normalizedFiles.map((entry) => ({
      ...entry,
      fileName: basename(entry.normalizedRelativePath),
      uploadFolderName: sharedTopLevelFolder
    }))
  }

  const canUseFlatRoot = normalizedFiles.every((entry) => {
    return entry.normalizedRelativePath.split("/").filter(Boolean).length === 1
  })

  if (canUseFlatRoot) {
    const uploadFolderName = deriveUploadFolderName(zipPath)
    return normalizedFiles.map((entry) => ({
      ...entry,
      fileName: basename(entry.normalizedRelativePath),
      uploadFolderName
    }))
  }

  throw new Error("No recognized package files were found in the zip.")
}

async function archiveVisibleDriveFile(accessToken, driveEnv, existingFile, {
  archiveSnapshotFolderId,
  descriptionFallback = "",
  projectId,
  portalDocumentId = ""
}) {
  return await updateDriveFileMetadata(accessToken, driveEnv, existingFile, {
    appProperties: {
      portalArchive: "true",
      portalArchivedAt: new Date().toISOString(),
      portalArchivedFromFileId: existingFile.id,
      portalArchivedPortalDocumentId:
        portalDocumentId || existingFile.appProperties?.portalDocumentId || "",
      portalArchivedProjectId: projectId
    },
    description: existingFile.description || descriptionFallback,
    name: existingFile.name,
    parentId: archiveSnapshotFolderId
  })
}

async function listFilesRecursive(rootDir, prefix = "") {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = prefix ? join(prefix, entry.name) : entry.name
    const absolutePath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath, relativePath)))
      continue
    }

    files.push({
      absolutePath,
      relativePath: relativePath.replaceAll("\\", "/")
    })
  }

  return files
}

async function extractPackage(zipPath) {
  const extractionRoot = await mkdtemp(join(tmpdir(), packageTempPrefix))

  try {
    const { execFile } = await import("node:child_process")
    await new Promise((resolve, reject) => {
      execFile("unzip", ["-oq", zipPath, "-d", extractionRoot], (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    const files = await listFilesRecursive(extractionRoot)
    return {
      cleanup: async () => {
        await rm(extractionRoot, { force: true, recursive: true })
      },
      files
    }
  } catch (error) {
    await rm(extractionRoot, { force: true, recursive: true }).catch(() => {})
    throw error
  }
}

async function findProjectFolder(accessToken, driveEnv, projectId, projectConfig) {
  const taggedFolders = await listDriveFiles(
    accessToken,
    driveEnv,
    [
      `'${escapeDriveQueryValue(driveEnv.PORTAL_DRIVE_ROOT_FOLDER_ID)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`,
      `appProperties has { key='portalProjectId' and value='${escapeDriveQueryValue(projectId)}' }`,
      "appProperties has { key='portalFolderType' and value='project' }"
    ].join(" and ")
  )

  if (taggedFolders[0]) {
    return taggedFolders[0]
  }

  const rootFolders = await listDriveFiles(
    accessToken,
    driveEnv,
    [
      `'${escapeDriveQueryValue(driveEnv.PORTAL_DRIVE_ROOT_FOLDER_ID)}' in parents`,
      "trashed = false",
      `mimeType = '${portalDriveFolderMimeType}'`
    ].join(" and ")
  )
  const searchKeys = new Set(
    [projectConfig.projectName, projectId, `${projectConfig.projectName} [${projectId}]`]
      .filter(Boolean)
      .map(normalizeDriveFolderKey)
  )

  const folder = rootFolders.find((candidate) =>
    searchKeys.has(normalizeDriveFolderKey(candidate.name))
  )

  if (folder) {
    return folder
  }

  return await createDriveFolder(
    accessToken,
    driveEnv,
    driveEnv.PORTAL_DRIVE_ROOT_FOLDER_ID,
    projectConfig.projectName || projectId,
    {
      portalFolderType: "project",
      portalProjectId: projectId
    }
  )
}

function buildArchiveSnapshotName(zipPath, uploadFolderName) {
  return (
    `${parseZipDate(basename(zipPath)) || new Date().toISOString().slice(0, 10)}__pre_${uploadFolderName}`
  )
}

async function refreshLivePortalProject(projectId) {
  const response = await fetch(
    `https://lecrowndevelopment.com/api/portal/projects/${encodeURIComponent(projectId)}`,
    {
      headers: {
        Accept: "application/json"
      }
    }
  ).catch(() => null)

  if (!response || !response.ok) {
    return false
  }

  return true
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const projectId = normalizeString(options.project)
  const zipPath = normalizeString(options.zip)
  const projectConfig = projectConfigs[projectId]

  if (!projectId || !projectConfig) {
    throw new Error("A supported --project value is required.")
  }

  if (!options.skipImport && !zipPath) {
    throw new Error("--zip is required unless --skip-import is set.")
  }

  const driveEnv = await loadDriveEnv()
  const accessToken = await getDriveAccessToken(driveEnv)
  const projectFolder = await findProjectFolder(
    accessToken,
    driveEnv,
    projectId,
    projectConfig
  )
  const archiveRootFolder = await ensureDriveFolder(
    accessToken,
    driveEnv,
    projectFolder.id,
    projectConfig.archiveRootFolderName
  )

  let extractedPackage = null

  try {
    let uploadFolderName = ""
    let uploadFolder = null

    if (!options.skipImport) {
      extractedPackage = await extractPackage(zipPath)
      const packageFiles = resolvePackageFiles(
        projectConfig,
        extractedPackage.files,
        zipPath
      )

      uploadFolderName = packageFiles[0].uploadFolderName
      const outboundRootFolder = await ensureDriveFolder(
        accessToken,
        driveEnv,
        projectFolder.id,
        projectConfig.outboundFolderName,
        {
          portalFolderType: "category",
          portalProjectId: projectId
        }
      )
      uploadFolder = await ensureDriveFolder(
        accessToken,
        driveEnv,
        outboundRootFolder.id,
        uploadFolderName
      )

      const currentProjectFiles = await listDriveFiles(
        accessToken,
        driveEnv,
        [
          "trashed = false",
          `appProperties has { key='portalProjectId' and value='${escapeDriveQueryValue(projectId)}' }`,
          `mimeType != '${portalDriveFolderMimeType}'`
        ].join(" and ")
      )
      const filesByPortalDocumentId = new Map(
        currentProjectFiles.map((file) => [file.appProperties?.portalDocumentId, file])
      )
      const archiveSnapshotName =
        normalizeString(options.archiveSnapshotName) ||
        buildArchiveSnapshotName(zipPath, uploadFolderName)
      const archiveSnapshotFolder = await ensureDriveFolder(
        accessToken,
        driveEnv,
        archiveRootFolder.id,
        archiveSnapshotName
      )
      const importedPortalDocumentIds = new Set()
      const packageArchiveSpec = buildPackageArchiveSpec(zipPath)
      importedPortalDocumentIds.add(packageArchiveSpec.portalDocumentId)

      for (const packageFile of packageFiles.sort((left, right) =>
        left.fileName.localeCompare(right.fileName)
      )) {
        const spec = inferDocumentSpec(projectConfig, packageFile.fileName)
        importedPortalDocumentIds.add(spec.portalDocumentId)
        const existing = filesByPortalDocumentId.get(spec.portalDocumentId)

        if (existing) {
          const archiveName = existing.name
          const archivedCopy = await findDriveChildFileByName(
            accessToken,
            driveEnv,
            archiveSnapshotFolder.id,
            archiveName
          ).catch(() => null)

          if (!archivedCopy) {
            await copyDriveFile(accessToken, driveEnv, existing.id, {
              appProperties: {
                portalArchive: "true",
                portalArchivedAt: new Date().toISOString(),
                portalArchivedFromFileId: existing.id,
                portalArchivedPortalDocumentId: spec.portalDocumentId,
                portalArchivedProjectId: projectId
              },
              description: existing.description || spec.description || "",
              name: archiveName,
              parents: [archiveSnapshotFolder.id]
            })
            console.log(`archived|${spec.portalDocumentId}|${archiveName}`)
          }
        }

        const buffer = await readFile(packageFile.absolutePath)
        const payload = {
          appProperties: {
            portalCategory: spec.category,
            portalDisplayName: spec.displayName,
            portalDocumentId: spec.portalDocumentId,
            portalProjectId: projectId
          },
          buffer,
          contentType: inferContentType(packageFile.fileName),
          description: spec.description || "",
          name: packageFile.fileName,
          parentId: uploadFolder.id
        }

        if (existing) {
          const updated = await updateDriveFileContent(
            accessToken,
            driveEnv,
            existing,
            payload
          )
          console.log(`updated|${spec.portalDocumentId}|${updated.id}|${packageFile.fileName}`)
        } else {
          const created = await uploadDriveFile(accessToken, driveEnv, payload)
          console.log(`created|${spec.portalDocumentId}|${created.id}|${packageFile.fileName}`)
        }
      }

      for (const staleFile of currentProjectFiles) {
        const portalDocumentId = staleFile.appProperties?.portalDocumentId || ""
        if (!portalDocumentId || importedPortalDocumentIds.has(portalDocumentId)) {
          continue
        }

        const archived = await archiveVisibleDriveFile(accessToken, driveEnv, staleFile, {
          archiveSnapshotFolderId: archiveSnapshotFolder.id,
          descriptionFallback: staleFile.description || "",
          projectId,
          portalDocumentId
        })
        console.log(`retired|${portalDocumentId}|${archived.id}|${staleFile.name}`)
      }

      const archiveBuffer = await readFile(zipPath)
      const archiveName = basename(zipPath)
      const existingPackageArchives = await listDriveFiles(
        accessToken,
        driveEnv,
        [
          `'${escapeDriveQueryValue(projectFolder.id)}' in parents`,
          "trashed = false",
          `mimeType != '${portalDriveFolderMimeType}'`,
          `name = '${escapeDriveQueryValue(archiveName)}'`
        ].join(" and ")
      )
      const existingArchive = existingPackageArchives[0] || null
      const archivePayload = {
        appProperties: {
          portalCategory: packageArchiveSpec.category,
          portalDisplayName: packageArchiveSpec.displayName,
          portalDocumentId: packageArchiveSpec.portalDocumentId,
          portalProjectId: projectId
        },
        buffer: archiveBuffer,
        contentType: inferContentType(archiveName),
        description: packageArchiveSpec.description,
        name: archiveName,
        parentId: projectFolder.id
      }

      if (existingArchive) {
        const updatedArchive = await updateDriveFileContent(
          accessToken,
          driveEnv,
          existingArchive,
          archivePayload
        )
        console.log(`archive-updated|${updatedArchive.id}|${archiveName}`)
      } else {
        const createdArchive = await uploadDriveFile(
          accessToken,
          driveEnv,
          archivePayload
        )
        console.log(`archive-created|${createdArchive.id}|${archiveName}`)
      }
    }

    const backfillArchiveDir = normalizeString(options.backfillArchiveDir)
    const backfillExtraFiles = options.backfillExtraFiles
      .map(normalizeString)
      .filter(Boolean)

    if (backfillArchiveDir || backfillExtraFiles.length) {
      const snapshotName =
        normalizeString(options.archiveSnapshotName) ||
        `${new Date().toISOString().slice(0, 10)}__backfill`
      const archiveSnapshotFolder = await ensureDriveFolder(
        accessToken,
        driveEnv,
        archiveRootFolder.id,
        snapshotName
      )

      const backfillFiles = []
      if (backfillArchiveDir) {
        const entries = await readdir(backfillArchiveDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue
          }

          backfillFiles.push(join(backfillArchiveDir, entry.name))
        }
      }

      backfillFiles.push(...backfillExtraFiles)

      for (const backfillFilePath of backfillFiles.sort()) {
        const fileName = basename(backfillFilePath)
        const existingArchiveFiles = await listDriveFiles(
          accessToken,
          driveEnv,
          [
            `'${escapeDriveQueryValue(archiveSnapshotFolder.id)}' in parents`,
            "trashed = false",
            `mimeType != '${portalDriveFolderMimeType}'`,
            `name = '${escapeDriveQueryValue(fileName)}'`
          ].join(" and ")
        )

        if (existingArchiveFiles[0]) {
          console.log(`archive-skip|${fileName}`)
          continue
        }

        const buffer = await readFile(backfillFilePath)
        const uploaded = await uploadDriveFile(accessToken, driveEnv, {
          appProperties: {
            portalArchive: "true",
            portalArchivedAt: new Date().toISOString(),
            portalArchivedProjectId: projectId
          },
          buffer,
          contentType: inferContentType(fileName),
          description: "Historical client package version archived before replacement.",
          name: fileName,
          parentId: archiveSnapshotFolder.id
        })
        console.log(`archive-backfill|${uploaded.id}|${fileName}`)
      }
    }

    const portalRefreshed = await refreshLivePortalProject(projectId)
    console.log(`portal-refresh|${portalRefreshed ? "ok" : "skipped"}`)
  } finally {
    await extractedPackage?.cleanup?.()
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
