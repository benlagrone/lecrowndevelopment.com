import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { createServer } from "node:net"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { after, before, test } from "node:test"

const fixtureDate = "2026-05-30"
const leadApiDir = fileURLToPath(new URL(".", import.meta.url))

let baseUrl = ""
let serverProcess = null
let tempRoot = ""
let serverOutput = ""

function createProject({
  description,
  documentId,
  documentName,
  email,
  identityId,
  name,
  projectId
}) {
  return {
    documents: [
      {
        category: "Deliverables",
        contentType: "text/plain; charset=utf-8",
        description,
        id: documentId,
        name: documentName,
        storagePath: "",
        updatedAt: fixtureDate
      }
    ],
    feedback: [],
    highlights: [],
    id: projectId,
    lastUpdated: fixtureDate,
    members: [
      {
        email: "admin@lecrowndevelopment.com",
        identityId: "kc-admin",
        name: "LeCrown Delivery",
        role: "admin"
      },
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

async function getAvailablePort() {
  const port = await new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve an ephemeral port."))
        return
      }

      resolve(address.port)
      server.close()
    })
    server.on("error", reject)
  })

  return port
}

async function waitForHealth(url, attempts = 40) {
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

  throw new Error(`Lead API did not become healthy.\n${serverOutput}`)
}

function buildHeaders({ email, id, roles = ["client"] }) {
  return {
    Accept: "application/json",
    "X-Portal-Dev-Email": email,
    "X-Portal-Dev-Id": id,
    "X-Portal-Dev-Roles": roles.join(",")
  }
}

before(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "lecrown-lead-api-"))

  const portalDocumentsDir = join(tempRoot, "portal-documents")
  const alphaDir = join(portalDocumentsDir, "alpha-project")
  const bravoDir = join(portalDocumentsDir, "bravo-project")
  const pendingDir = join(portalDocumentsDir, "pending-project")
  const portalStorageFile = join(tempRoot, "portal-data.json")
  const leadStorageFile = join(tempRoot, "submissions.ndjson")

  await mkdir(alphaDir, { recursive: true })
  await mkdir(bravoDir, { recursive: true })
  await mkdir(pendingDir, { recursive: true })

  const alphaProject = createProject({
    description: "Alpha client deliverable",
    documentId: "alpha-doc",
    documentName: "Alpha memo.txt",
    email: "alice@example.com",
    identityId: "kc-alice",
    name: "Alpha Project",
    projectId: "alpha-project"
  })
  const bravoProject = createProject({
    description: "Bravo client deliverable",
    documentId: "bravo-doc",
    documentName: "Bravo memo.txt",
    email: "bravo@example.com",
    identityId: "kc-bravo",
    name: "Bravo Project",
    projectId: "bravo-project"
  })
  const pendingProject = createProject({
    description: "Pending client deliverable",
    documentId: "pending-doc",
    documentName: "Pending memo.txt",
    email: "pending@example.com",
    identityId: "",
    name: "Pending Project",
    projectId: "pending-project"
  })

  alphaProject.documents[0].storagePath = join(alphaDir, "alpha-doc-Alpha-memo.txt")
  bravoProject.documents[0].storagePath = join(bravoDir, "bravo-doc-Bravo-memo.txt")
  pendingProject.documents[0].storagePath = join(
    pendingDir,
    "pending-doc-Pending-memo.txt"
  )

  await writeFile(alphaProject.documents[0].storagePath, "alpha")
  await writeFile(bravoProject.documents[0].storagePath, "bravo")
  await writeFile(pendingProject.documents[0].storagePath, "pending")

  await writeFile(
    portalStorageFile,
    JSON.stringify(
      {
        projects: [alphaProject, bravoProject, pendingProject]
      },
      null,
      2
    ),
    "utf8"
  )

  const port = await getAvailablePort()
  baseUrl = `http://127.0.0.1:${port}`

  serverProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: leadApiDir,
    env: {
      ...process.env,
      KEYCLOAK_AUTH_ENFORCED: "false",
      LEAD_STORAGE_FILE: leadStorageFile,
      PORT: String(port),
      PORTAL_DOCUMENTS_DIR: portalDocumentsDir,
      PORTAL_STORAGE_FILE: portalStorageFile
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  serverProcess.stdout?.on("data", (chunk) => {
    serverOutput += chunk.toString()
  })
  serverProcess.stderr?.on("data", (chunk) => {
    serverOutput += chunk.toString()
  })

  await waitForHealth(baseUrl)
})

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM")
    await new Promise((resolve) => {
      serverProcess.once("exit", () => resolve())
    })
  }

  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true })
  }
})

test("client project list only includes assigned project when memberships are identity-bound", async () => {
  const response = await fetch(`${baseUrl}/v1/portal/projects`, {
    headers: buildHeaders({
      email: "alice@example.com",
      id: "kc-alice"
    })
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual(payload.projects.map((project) => project.id), ["alpha-project"])
})

test("direct project and document routes reject a client even if the email claim changes", async () => {
  const spoofedHeaders = buildHeaders({
    email: "bravo@example.com",
    id: "kc-alice"
  })

  const listResponse = await fetch(`${baseUrl}/v1/portal/projects`, {
    headers: spoofedHeaders
  })
  assert.equal(listResponse.status, 200)
  const listPayload = await listResponse.json()
  assert.deepEqual(listPayload.projects.map((project) => project.id), ["alpha-project"])

  const projectResponse = await fetch(`${baseUrl}/v1/portal/projects/bravo-project`, {
    headers: spoofedHeaders
  })
  assert.equal(projectResponse.status, 403)
  assert.match(await projectResponse.text(), /not assigned/i)

  const documentResponse = await fetch(
    `${baseUrl}/v1/portal/projects/bravo-project/documents/bravo-doc/download`,
    {
      headers: spoofedHeaders
    }
  )
  assert.equal(documentResponse.status, 403)
  assert.match(await documentResponse.text(), /not assigned/i)
})

test("project billing checkout returns configured Stripe-hosted payment link", async () => {
  const adminHeaders = {
    ...buildHeaders({
      email: "admin@lecrowndevelopment.com",
      id: "kc-admin",
      roles: ["admin"]
    }),
    "Content-Type": "application/json"
  }

  const updateResponse = await fetch(`${baseUrl}/v1/portal/projects/alpha-project`, {
    body: JSON.stringify({
      billing: {
        amountLabel: "$2,500.00",
        checkoutUrl: "https://invoice.stripe.com/i/acct_test/invst_test",
        description: "Next engagement invoice",
        dueDate: "2026-06-30",
        enabled: true,
        status: "Invoice ready"
      }
    }),
    headers: adminHeaders,
    method: "PATCH"
  })
  assert.equal(updateResponse.status, 200)

  const checkoutResponse = await fetch(
    `${baseUrl}/v1/portal/projects/alpha-project/billing/checkout`,
    {
      headers: buildHeaders({
        email: "alice@example.com",
        id: "kc-alice"
      }),
      method: "POST"
    }
  )
  assert.equal(checkoutResponse.status, 200)

  const checkoutPayload = await checkoutResponse.json()
  assert.equal(checkoutPayload.provider, "stripe-hosted-link")
  assert.equal(
    checkoutPayload.url,
    "https://invoice.stripe.com/i/acct_test/invst_test"
  )
})

test("admins still have full project visibility", async () => {
  const response = await fetch(`${baseUrl}/v1/portal/projects`, {
    headers: buildHeaders({
      email: "admin@lecrowndevelopment.com",
      id: "kc-admin",
      roles: ["admin"]
    })
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.deepEqual(
    payload.projects.map((project) => project.id),
    ["alpha-project", "bravo-project", "pending-project"]
  )
})

test("auth-disabled local previews still work for members that have not been identity-bound yet", async () => {
  const response = await fetch(`${baseUrl}/v1/portal/projects/pending-project`, {
    headers: buildHeaders({
      email: "pending@example.com",
      id: "kc-random"
    })
  })

  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.project.id, "pending-project")
})
