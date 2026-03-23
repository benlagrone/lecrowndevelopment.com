import { createServer } from "node:http"
import { mkdir, appendFile } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"

const port = Number(process.env.PORT || 8081)
const storageFile = process.env.LEAD_STORAGE_FILE || "/data/submissions.ndjson"
const maxBodyBytes = 1024 * 1024

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  return await new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0

    request.on("data", (chunk) => {
      bytes += chunk.length

      if (bytes > maxBodyBytes) {
        reject(new Error("Payload too large."))
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
        reject(new Error("Request body must be valid JSON."))
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

await mkdir(dirname(storageFile), { recursive: true })

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Origin": "*"
    })
    response.end()
    return
  }

  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, { ok: true })
    return
  }

  if (request.method === "POST" && request.url === "/v1/intake") {
    try {
      const payload = await readBody(request)
      const validationError = validateLead(payload)

      if (validationError) {
        json(response, 400, { error: validationError })
        return
      }

      const record = buildLeadRecord(request, payload)
      await appendFile(storageFile, `${JSON.stringify(record)}\n`, "utf8")

      json(response, 201, {
        leadId: record.id,
        ok: true,
        reply: "Lead captured."
      })
    } catch (error) {
      json(response, 500, {
        error:
          error?.message || "Lead intake failed before the record could be stored."
      })
    }
    return
  }

  json(response, 404, { error: "Not found." })
})

server.listen(port, "0.0.0.0", () => {
  console.log(`lead-api listening on ${port}`)
})
