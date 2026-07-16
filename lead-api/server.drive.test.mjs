import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { after, test } from "node:test"

const fixtureDate = "2026-06-01"
const folderMimeType = "application/vnd.google-apps.folder"
const leadApiDir = fileURLToPath(new URL(".", import.meta.url))
const cleanupTasks = []

function buildHeaders({
  email = "benjaminlagrone@gmail.com",
  id = "kc-admin",
  roles = ["admin"]
} = {}) {
  return {
    Accept: "application/json",
    "X-Portal-Dev-Email": email,
    "X-Portal-Dev-Id": id,
    "X-Portal-Dev-Roles": roles.join(",")
  }
}

function createProject({
  documents = [],
  email = "client@example.com",
  identityId = "kc-client",
  name = "Houston Project",
  projectId = "houston-project"
} = {}) {
  return {
    documents,
    feedback: [],
    highlights: [],
    id: projectId,
    lastUpdated: fixtureDate,
    members: [
      {
        email,
        identityId,
        name,
        role: "client"
      }
    ],
    name,
    phase: "Review",
    preview: {
      notes: "",
      reviewChecklist: [],
      url: "/"
    },
    status: "In Progress",
    summary: `${name} workspace`
  }
}

async function readRequestBuffer(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(payload))
}

function buildDriveFileRecord(record) {
  return {
    appProperties: { ...(record.appProperties || {}) },
    body: record.body || Buffer.alloc(0),
    contentType: record.contentType || "application/octet-stream",
    description: record.description || "",
    id: record.id,
    mimeType: record.mimeType || "application/octet-stream",
    modifiedTime: record.modifiedTime,
    name: record.name,
    parents: Array.isArray(record.parents) ? [...record.parents] : [],
    size: String((record.body || Buffer.alloc(0)).length),
    trashed: record.trashed === true
  }
}

function serializeDriveFile(record) {
  return {
    appProperties: { ...(record.appProperties || {}) },
    description: record.description,
    id: record.id,
    mimeType: record.mimeType,
    modifiedTime: record.modifiedTime,
    name: record.name,
    parents: [...record.parents],
    size: record.size
  }
}

function unescapeDriveLiteral(value) {
  return value.replaceAll("\\'", "'").replaceAll("\\\\", "\\")
}

function splitDriveQuery(query) {
  const terms = []
  let current = ""
  let braceDepth = 0

  for (let index = 0; index < query.length; index += 1) {
    const segment = query.slice(index, index + 5)

    if (query[index] === "{") {
      braceDepth += 1
    } else if (query[index] === "}") {
      braceDepth = Math.max(0, braceDepth - 1)
    }

    if (braceDepth === 0 && segment === " and ") {
      terms.push(current)
      current = ""
      index += 4
      continue
    }

    current += query[index]
  }

  if (current) {
    terms.push(current)
  }

  return terms.map((term) => term.trim()).filter(Boolean)
}

function matchesDriveQuery(record, query) {
  if (!query?.trim()) {
    return true
  }

  return splitDriveQuery(query).every((term) => {
    if (term === "trashed = false") {
      return record.trashed !== true
    }

    const parentMatch = term.match(/^'(.+)' in parents$/)
    if (parentMatch) {
      return record.parents.includes(unescapeDriveLiteral(parentMatch[1]))
    }

    const mimeEqualsMatch = term.match(/^mimeType = '(.+)'$/)
    if (mimeEqualsMatch) {
      return record.mimeType === unescapeDriveLiteral(mimeEqualsMatch[1])
    }

    const mimeNotEqualsMatch = term.match(/^mimeType != '(.+)'$/)
    if (mimeNotEqualsMatch) {
      return record.mimeType !== unescapeDriveLiteral(mimeNotEqualsMatch[1])
    }

    const nameMatch = term.match(/^name = '(.+)'$/)
    if (nameMatch) {
      return record.name === unescapeDriveLiteral(nameMatch[1])
    }

    const appPropertyMatch = term.match(
      /^appProperties has \{ key='(.+)' and value='(.+)' \}$/
    )
    if (appPropertyMatch) {
      const key = unescapeDriveLiteral(appPropertyMatch[1])
      const value = unescapeDriveLiteral(appPropertyMatch[2])
      return record.appProperties?.[key] === value
    }

    throw new Error(`Unsupported fake Drive query term: ${term}`)
  })
}

function parseMultipartRelated(contentType, buffer) {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
  if (!boundaryMatch?.[1]) {
    throw new Error("Missing multipart boundary.")
  }

  const boundary = boundaryMatch[1]
  const raw = buffer.toString("latin1")
  const parts = raw
    .split(`--${boundary}`)
    .map((part) => part.trim())
    .filter((part) => part && part !== "--")

  if (parts.length < 2) {
    throw new Error("Multipart payload is missing expected parts.")
  }

  const [metadataPart, filePart] = parts
  const metadataPayload = metadataPart.split("\r\n\r\n")[1] || "{}"
  const fileHeadersAndBody = filePart.split("\r\n\r\n")
  const fileHeaderBlock = fileHeadersAndBody.shift() || ""
  let fileBodyRaw = fileHeadersAndBody.join("\r\n\r\n")

  if (fileBodyRaw.endsWith("\r\n")) {
    fileBodyRaw = fileBodyRaw.slice(0, -2)
  }

  const fileContentTypeMatch = fileHeaderBlock.match(/Content-Type:\s*([^\r\n]+)/i)

  return {
    fileBuffer: Buffer.from(fileBodyRaw, "latin1"),
    fileContentType:
      fileContentTypeMatch?.[1]?.trim() || "application/octet-stream",
    metadata: JSON.parse(metadataPayload)
  }
}

async function startFakeDriveServer({
  initialFiles = [],
  rootFolderId = "client-projects-root"
} = {}) {
  const files = new Map()
  let idCounter = 1
  const sockets = new Set()

  function nextId(prefix = "drv") {
    const id = `${prefix}-${idCounter}`
    idCounter += 1
    return id
  }

  function nextModifiedTime() {
    const seconds = String(idCounter).padStart(2, "0")
    return `2026-06-01T00:00:${seconds}.000Z`
  }

  function upsertFile(record) {
    files.set(record.id, buildDriveFileRecord(record))
    return files.get(record.id)
  }

  upsertFile({
    id: rootFolderId,
    mimeType: folderMimeType,
    modifiedTime: nextModifiedTime(),
    name: "client_projects",
    parents: []
  })

  initialFiles.forEach((record) => {
    upsertFile({
      ...record,
      id: record.id || nextId(record.mimeType === folderMimeType ? "folder" : "file"),
      modifiedTime: record.modifiedTime || nextModifiedTime()
    })
  })

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1")

    if (request.method === "POST" && url.pathname === "/token") {
      json(response, 200, {
        access_token: "fake-drive-token",
        expires_in: 3600,
        token_type: "Bearer"
      })
      return
    }

    if (request.headers.authorization !== "Bearer fake-drive-token") {
      json(response, 401, {
        error: {
          message: "Unauthorized"
        }
      })
      return
    }

    if (request.method === "GET" && url.pathname === "/drive/v3/files") {
      const query = url.searchParams.get("q") || ""
      const filtered = [...files.values()]
        .filter((record) => matchesDriveQuery(record, query))
        .map(serializeDriveFile)

      json(response, 200, { files: filtered })
      return
    }

    if (request.method === "POST" && url.pathname === "/drive/v3/files") {
      const payload = JSON.parse((await readRequestBuffer(request)).toString("utf8"))
      const record = upsertFile({
        appProperties: payload.appProperties || {},
        body: Buffer.alloc(0),
        description: payload.description || "",
        id: nextId("folder"),
        mimeType: payload.mimeType || folderMimeType,
        modifiedTime: nextModifiedTime(),
        name: payload.name,
        parents: Array.isArray(payload.parents) ? payload.parents : []
      })

      json(response, 200, serializeDriveFile(record))
      return
    }

    if (request.method === "POST" && url.pathname === "/upload/drive/v3/files") {
      const { fileBuffer, fileContentType, metadata } = parseMultipartRelated(
        request.headers["content-type"] || "",
        await readRequestBuffer(request)
      )

      const record = upsertFile({
        appProperties: metadata.appProperties || {},
        body: fileBuffer,
        contentType: fileContentType,
        description: metadata.description || "",
        id: nextId("file"),
        mimeType: fileContentType,
        modifiedTime: nextModifiedTime(),
        name: metadata.name,
        parents: Array.isArray(metadata.parents) ? metadata.parents : []
      })

      json(response, 200, serializeDriveFile(record))
      return
    }

    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/)
    if (fileMatch) {
      const fileId = decodeURIComponent(fileMatch[1])
      const record = files.get(fileId)

      if (!record) {
        json(response, 404, {
          error: {
            message: "Not found"
          }
        })
        return
      }

      if (request.method === "GET" && url.searchParams.get("alt") === "media") {
        response.writeHead(200, {
          "Content-Length": record.body.length,
          "Content-Type": record.contentType
        })
        response.end(record.body)
        return
      }

      if (request.method === "PATCH") {
        const payload = JSON.parse((await readRequestBuffer(request)).toString("utf8"))
        const updatedRecord = upsertFile({
          ...record,
          appProperties: payload.appProperties || record.appProperties,
          description: payload.description ?? record.description,
          id: record.id,
          mimeType: payload.mimeType || record.mimeType,
          modifiedTime: nextModifiedTime(),
          name: payload.name || record.name,
          parents: Array.isArray(payload.parents) ? payload.parents : record.parents
        })

        json(response, 200, serializeDriveFile(updatedRecord))
        return
      }

      if (request.method === "DELETE") {
        files.delete(fileId)
        response.writeHead(204)
        response.end()
        return
      }
    }

    response.writeHead(404)
    response.end("Not found")
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  const baseUrl =
    address && typeof address !== "string"
      ? `http://127.0.0.1:${address.port}`
      : ""

  return {
    addFile(record) {
      const normalizedRecord = upsertFile({
        ...record,
        id: record.id || nextId(record.mimeType === folderMimeType ? "folder" : "file"),
        modifiedTime: record.modifiedTime || nextModifiedTime()
      })
      return serializeDriveFile(normalizedRecord)
    },
    baseUrl,
    files,
    rootFolderId,
    stop: async () => {
      sockets.forEach((socket) => socket.destroy())
      await new Promise((resolve) => server.close(resolve))
    }
  }
}

async function waitForHealth(url, serverOutputRef, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error(`Lead API did not become healthy.\n${serverOutputRef.current}`)
}

async function startLeadApi({
  driveServer,
  portalProjects,
  writeLocalFiles
}) {
  const tempRoot = await mkdtemp(join(tmpdir(), "lecrown-lead-api-drive-"))
  const portalDocumentsDir = join(tempRoot, "portal-documents")
  const portalStorageFile = join(tempRoot, "portal-data.json")
  const leadStorageFile = join(tempRoot, "submissions.ndjson")

  await mkdir(portalDocumentsDir, { recursive: true })
  if (typeof writeLocalFiles === "function") {
    await writeLocalFiles(portalDocumentsDir)
  }

  await writeFile(
    portalStorageFile,
    JSON.stringify({ projects: portalProjects }, null, 2),
    "utf8"
  )

  const port = 40000 + Math.floor(Math.random() * 20000)

  const serverOutputRef = { current: "" }
  const serverProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: leadApiDir,
    env: {
      ...process.env,
      KEYCLOAK_AUTH_ENFORCED: "false",
      LEAD_STORAGE_FILE: leadStorageFile,
      PORT: String(port),
      PORTAL_DOCUMENT_PROVIDER: "drive",
      PORTAL_DOCUMENTS_DIR: portalDocumentsDir,
      PORTAL_DRIVE_API_BASE_URL: `${driveServer.baseUrl}/drive/v3`,
      PORTAL_DRIVE_CLIENT_ID: "fake-client-id",
      PORTAL_DRIVE_CLIENT_SECRET: "fake-client-secret",
      PORTAL_DRIVE_REFRESH_TOKEN: "fake-refresh-token",
      PORTAL_DRIVE_ROOT_FOLDER_ID: driveServer.rootFolderId,
      PORTAL_DRIVE_TOKEN_URL: `${driveServer.baseUrl}/token`,
      PORTAL_DRIVE_UPLOAD_BASE_URL: `${driveServer.baseUrl}/upload/drive/v3`,
      PORTAL_STORAGE_FILE: portalStorageFile
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  serverProcess.stdout?.on("data", (chunk) => {
    serverOutputRef.current += chunk.toString()
  })
  serverProcess.stderr?.on("data", (chunk) => {
    serverOutputRef.current += chunk.toString()
  })

  const baseUrl = `http://127.0.0.1:${port}`
  await waitForHealth(baseUrl, serverOutputRef)

  const cleanup = async () => {
    if (serverProcess.exitCode === null) {
      serverProcess.kill("SIGTERM")
      await Promise.race([
        new Promise((resolve) => serverProcess.once("exit", resolve)),
        new Promise((resolve) => {
          setTimeout(() => {
            if (serverProcess.exitCode === null) {
              serverProcess.kill("SIGKILL")
            }
            resolve()
          }, 2000)
        })
      ])
    }

    await rm(tempRoot, { force: true, recursive: true })
  }

  cleanupTasks.push(cleanup)

  return {
    baseUrl,
    portalDocumentsDir,
    portalStorageFile,
    serverOutputRef,
    stop: cleanup,
    tempRoot
  }
}

after(async () => {
  while (cleanupTasks.length) {
    const cleanup = cleanupTasks.pop()
    await cleanup().catch(() => {})
  }
})

test("drive provider migrates existing local documents into the mapped project folder", async () => {
  const driveServer = await startFakeDriveServer()
  cleanupTasks.push(async () => {
    await driveServer.stop()
  })

  const localDocumentFileName = "2026-06-01_client-welcome_packet.docx"
  const project = createProject({
    documents: [
      {
        category: "Scope & Agreements",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        description: "Client welcome packet",
        fileName: localDocumentFileName,
        id: "welcome-doc",
        name: "Client welcome packet",
        storagePath: "",
        updatedAt: fixtureDate
      }
    ],
    name: "Houston Auto Storage Acquisition Due Diligence",
    projectId: "houston-auto-storage-acquisition"
  })

  const server = await startLeadApi({
    driveServer,
    portalProjects: [project],
    writeLocalFiles: async (portalDocumentsDir) => {
      const projectDir = join(
        portalDocumentsDir,
        "houston-auto-storage-acquisition"
      )
      await mkdir(projectDir, { recursive: true })

      project.documents[0].storagePath = join(
        projectDir,
        `welcome-doc-${localDocumentFileName}`
      )
      await writeFile(project.documents[0].storagePath, "welcome-packet")
    }
  })

  const response = await fetch(
    `${server.baseUrl}/v1/portal/projects/houston-auto-storage-acquisition`,
    {
      headers: buildHeaders()
    }
  )
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.project.documents.length, 1)
  assert.equal(payload.project.documents[0].id, "welcome-doc")
  assert.equal(payload.project.documents[0].fileName, localDocumentFileName)
  assert.equal(payload.project.documents[0].name, "Client welcome packet")

  const driveRecords = [...driveServer.files.values()]
  const projectFolder = driveRecords.find((record) => {
    return (
      record.mimeType === folderMimeType &&
      record.appProperties?.portalFolderType === "project" &&
      record.appProperties?.portalProjectId === "houston-auto-storage-acquisition"
    )
  })
  assert.ok(projectFolder)
  assert.equal(projectFolder.parents[0], driveServer.rootFolderId)

  const categoryFolder = driveRecords.find((record) => {
    return (
      record.mimeType === folderMimeType &&
      record.appProperties?.portalFolderType === "category" &&
      record.appProperties?.portalProjectId === "houston-auto-storage-acquisition" &&
      record.appProperties?.portalCategory === "Scope & Agreements"
    )
  })
  assert.ok(categoryFolder)
  assert.equal(categoryFolder.parents[0], projectFolder.id)

  const migratedFile = driveRecords.find((record) => {
    return record.appProperties?.portalDocumentId === "welcome-doc"
  })
  assert.ok(migratedFile)
  assert.equal(migratedFile.parents[0], categoryFolder.id)
  assert.equal(migratedFile.name, localDocumentFileName)
  assert.equal(migratedFile.body.toString("utf8"), "welcome-packet")

  const persistedState = JSON.parse(
    await readFile(server.portalStorageFile, "utf8")
  )
  const persistedProject = persistedState.projects[0]
  assert.equal(persistedProject.driveFolderId, projectFolder.id)
  assert.equal(
    persistedProject.driveCategoryFolderIds["Scope & Agreements"],
    categoryFolder.id
  )
  assert.equal(persistedProject.documents[0].driveFileId, migratedFile.id)

  driveServer.addFile({
    appProperties: {
      portalCategory: "Scope & Agreements",
      portalDisplayName: "Seller follow-up list",
      portalDocumentId: "seller-list-doc",
      portalProjectId: "houston-auto-storage-acquisition"
    },
    body: Buffer.from("seller-follow-up"),
    contentType: "text/plain; charset=utf-8",
    description: "Seller follow-up requirements",
    mimeType: "text/plain; charset=utf-8",
    name: "seller-follow-up-list.txt",
    parents: [categoryFolder.id]
  })

  const syncedResponse = await fetch(
    `${server.baseUrl}/v1/portal/projects/houston-auto-storage-acquisition`,
    {
      headers: buildHeaders()
    }
  )
  assert.equal(syncedResponse.status, 200)

  const syncedPayload = await syncedResponse.json()
  assert.deepEqual(
    syncedPayload.project.documents.map((document) => document.id).sort(),
    ["seller-list-doc", "welcome-doc"]
  )
  assert.equal(
    syncedPayload.project.documents.find((document) => document.id === "seller-list-doc")
      ?.fileName,
    "seller-follow-up-list.txt"
  )
})

test("drive migration links old share-site documents that already exist in Drive instead of duplicating them", async () => {
  const driveServer = await startFakeDriveServer({
    initialFiles: [
      {
        id: "project-folder-1",
        mimeType: folderMimeType,
        name: "Northstar_Automation",
        parents: ["client-projects-root"]
      },
      {
        id: "legacy-folder-1",
        mimeType: folderMimeType,
        name: "06_Client_Outbound_Portal 4",
        parents: ["project-folder-1"]
      },
      {
        id: "legacy-folder-2",
        mimeType: folderMimeType,
        name: "Office_Uploads_v02",
        parents: ["legacy-folder-1"]
      },
      {
        body: Buffer.from("already-in-drive"),
        contentType: "text/plain; charset=utf-8",
        id: "existing-drive-file",
        mimeType: "text/plain; charset=utf-8",
        name: "client-handoff.txt",
        parents: ["legacy-folder-2"]
      }
    ]
  })
  cleanupTasks.push(async () => {
    await driveServer.stop()
  })

  const project = createProject({
    documents: [
      {
        category: "Deliverables",
        contentType: "text/plain; charset=utf-8",
        description: "Client handoff",
        fileName: "client-handoff.txt",
        id: "handoff-doc",
        name: "Client handoff",
        storagePath: "",
        updatedAt: fixtureDate
      }
    ],
    name: "Northstar Automation",
    projectId: "northstar-automation"
  })

  const server = await startLeadApi({
    driveServer,
    portalProjects: [project],
    writeLocalFiles: async (portalDocumentsDir) => {
      const projectDir = join(portalDocumentsDir, "northstar-automation")
      await mkdir(projectDir, { recursive: true })

      project.documents[0].storagePath = join(
        projectDir,
        "handoff-doc-client-handoff.txt"
      )
      await writeFile(project.documents[0].storagePath, "legacy-local-copy")
    }
  })

  const response = await fetch(
    `${server.baseUrl}/v1/portal/projects/northstar-automation`,
    {
      headers: buildHeaders()
    }
  )
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.project.documents.length, 1)
  assert.equal(payload.project.documents[0].id, "handoff-doc")
  assert.equal(payload.project.documents[0].fileName, "client-handoff.txt")

  const persistedState = JSON.parse(
    await readFile(server.portalStorageFile, "utf8")
  )
  assert.equal(
    persistedState.projects[0].documents[0].driveFileId,
    "existing-drive-file"
  )

  const nonFolderFiles = [...driveServer.files.values()].filter((record) => {
    return record.mimeType !== folderMimeType
  })
  assert.equal(nonFolderFiles.length, 1)
  assert.equal(nonFolderFiles[0].id, "existing-drive-file")
  assert.equal(nonFolderFiles[0].appProperties.portalDocumentId, "handoff-doc")
  assert.equal(
    nonFolderFiles[0].appProperties.portalProjectId,
    "northstar-automation"
  )

  assert.equal(persistedState.projects[0].driveFolderId, "project-folder-1")
})

test("drive migration matches legacy prefixed filenames to client-facing portal document names", async () => {
  const driveServer = await startFakeDriveServer({
    initialFiles: [
      {
        id: "project-folder-1",
        mimeType: folderMimeType,
        name: "Houston_Auto_Storage_Acquisition_Due_Diligence",
        parents: ["client-projects-root"]
      },
      {
        id: "legacy-folder-1",
        mimeType: folderMimeType,
        name: "06_Client_Outbound_Portal 4",
        parents: ["project-folder-1"]
      },
      {
        id: "legacy-folder-2",
        mimeType: folderMimeType,
        name: "Office_Uploads_v02",
        parents: ["legacy-folder-1"]
      },
      {
        id: "internal-folder-1",
        mimeType: folderMimeType,
        name: "01_Financial_and_Tax",
        parents: ["project-folder-1"]
      },
      {
        body: Buffer.from("already-in-drive"),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        id: "existing-drive-file",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name:
          "2026-05-29__doc_onboarding_welcome__client_welcome_letter__lecrown__v02.docx",
        parents: ["legacy-folder-2"]
      },
      {
        body: Buffer.from("not-client-visible"),
        contentType: "application/pdf",
        id: "internal-drive-file",
        mimeType: "application/pdf",
        name: "seller-tax-return.pdf",
        parents: ["internal-folder-1"]
      }
    ]
  })
  cleanupTasks.push(async () => {
    await driveServer.stop()
  })

  const project = createProject({
    documents: [
      {
        category: "Scope & Agreements",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        description: "Client welcome letter",
        fileName: "Client welcome letter.docx",
        id: "welcome-doc",
        name: "Client welcome letter.docx",
        storagePath: "",
        updatedAt: fixtureDate
      }
    ],
    name: "Houston Auto Storage Acquisition Due Diligence",
    projectId: "houston-auto-storage-acquisition"
  })

  const server = await startLeadApi({
    driveServer,
    portalProjects: [project],
    writeLocalFiles: async (portalDocumentsDir) => {
      const projectDir = join(
        portalDocumentsDir,
        "houston-auto-storage-acquisition"
      )
      await mkdir(projectDir, { recursive: true })

      project.documents[0].storagePath = join(
        projectDir,
        "welcome-doc-Client welcome letter.docx"
      )
      await writeFile(project.documents[0].storagePath, "legacy-local-copy")
    }
  })

  const response = await fetch(
    `${server.baseUrl}/v1/portal/projects/houston-auto-storage-acquisition`,
    {
      headers: buildHeaders()
    }
  )
  assert.equal(response.status, 200)

  const payload = await response.json()
  assert.equal(payload.project.documents.length, 1)
  assert.equal(payload.project.documents[0].id, "welcome-doc")
  assert.equal(payload.project.documents[0].name, "Client welcome letter.docx")

  const persistedState = JSON.parse(
    await readFile(server.portalStorageFile, "utf8")
  )
  assert.equal(
    persistedState.projects[0].documents[0].driveFileId,
    "existing-drive-file"
  )

  const nonFolderFiles = [...driveServer.files.values()].filter((record) => {
    return record.mimeType !== folderMimeType
  })
  assert.equal(nonFolderFiles.length, 2)
  assert.equal(
    nonFolderFiles.find((record) => record.id === "existing-drive-file")
      ?.appProperties.portalDocumentId,
    "welcome-doc"
  )
  assert.equal(
    nonFolderFiles.find((record) => record.id === "existing-drive-file")
      ?.appProperties.portalProjectId,
    "houston-auto-storage-acquisition"
  )
})

test("drive provider uploads, downloads, and deletes portal documents through Drive", async () => {
  const driveServer = await startFakeDriveServer()
  cleanupTasks.push(async () => {
    await driveServer.stop()
  })

  const server = await startLeadApi({
    driveServer,
    portalProjects: [
      createProject({
        documents: [],
        name: "Northstar Automation",
        projectId: "northstar-automation"
      })
    ]
  })

  const uploadResponse = await fetch(
    `${server.baseUrl}/v1/portal/projects/northstar-automation/documents`,
    {
      body: JSON.stringify({
        category: "Deliverables",
        contentBase64: Buffer.from("signed-term-sheet").toString("base64"),
        contentType: "text/plain; charset=utf-8",
        description: "Signed term sheet",
        fileName: "signed-term-sheet.txt",
        name: "Signed term sheet"
      }),
      headers: {
        ...buildHeaders(),
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  )
  assert.equal(uploadResponse.status, 201)

  const uploadPayload = await uploadResponse.json()
  assert.equal(uploadPayload.document.name, "Signed term sheet")
  assert.equal(uploadPayload.document.fileName, "Signed-term-sheet.txt")

  const driveRecord = [...driveServer.files.values()].find((record) => {
    return record.appProperties?.portalDocumentId === uploadPayload.document.id
  })
  assert.ok(driveRecord)
  assert.equal(driveRecord.body.toString("utf8"), "signed-term-sheet")
  assert.equal(driveRecord.appProperties.portalCategory, "Deliverables")

  const downloadResponse = await fetch(
    `${server.baseUrl}/v1/portal/projects/northstar-automation/documents/${encodeURIComponent(uploadPayload.document.id)}/download`,
    {
      headers: buildHeaders({
        email: "client@example.com",
        id: "kc-client",
        roles: ["client"]
      })
    }
  )
  assert.equal(downloadResponse.status, 200)
  assert.equal(
    downloadResponse.headers.get("content-disposition"),
    'attachment; filename="Signed-term-sheet.txt"'
  )
  assert.equal(await downloadResponse.text(), "signed-term-sheet")

  const deleteResponse = await fetch(
    `${server.baseUrl}/v1/portal/projects/northstar-automation/documents/${encodeURIComponent(uploadPayload.document.id)}`,
    {
      headers: buildHeaders(),
      method: "DELETE"
    }
  )
  assert.equal(deleteResponse.status, 200)
  assert.equal(driveServer.files.has(driveRecord.id), false)

  const deletePayload = await deleteResponse.json()
  assert.equal(deletePayload.project.documents.length, 0)
})
