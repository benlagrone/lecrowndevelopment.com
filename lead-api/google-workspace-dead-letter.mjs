import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"

import { SignJWT, importPKCS8 } from "jose"

const envFilePath = new URL("../.env.local", import.meta.url)
const defaultScopeList = [
  "https://www.googleapis.com/auth/admin.directory.group",
  "https://www.googleapis.com/auth/admin.directory.group.member",
  "https://www.googleapis.com/auth/apps.groups.settings"
]

function printUsage() {
  console.log(`Usage:
  node google-workspace-dead-letter.mjs --group <group-email> --member <member-email> [options]

Options:
  --group <email>            Group email to create or update
  --member <email>           Member to add to the dead-letter group (repeatable)
  --name <display-name>      Group display name
  --description <text>       Group description
  --admin <email>            Delegated Google Workspace admin email
  --check                    Show local credential status and planned defaults
  --skip-settings            Skip Google Groups settings update
  --help                     Show this message
`)
}

function parseArgs(argv) {
  const options = {
    check: false,
    help: false,
    members: [],
    skipSettings: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--check") {
      options.check = true
      continue
    }

    if (arg === "--skip-settings") {
      options.skipSettings = true
      continue
    }

    if (arg === "--member") {
      options.members.push(normalizeString(argv[index + 1]))
      index += 1
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`)
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    options[key] = normalizeString(argv[index + 1])
    index += 1
  }

  return options
}

function normalizeString(value) {
  return String(value || "").trim()
}

function stripWrappingQuotes(value) {
  const text = normalizeString(value)
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1)
  }
  return text
}

function readEnvLineMap(text) {
  const entries = {}

  for (const line of text.split(/\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    const key = line.slice(0, separatorIndex).trim()
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1))
    entries[key] = value
  }

  return entries
}

async function loadFileEnv() {
  try {
    const raw = await readFile(envFilePath, "utf8")
    return readEnvLineMap(raw)
  } catch {
    return {}
  }
}

function mergeEnv(fileEnv) {
  const merged = { ...fileEnv }
  for (const [key, value] of Object.entries(process.env)) {
    merged[key] = stripWrappingQuotes(value)
  }
  return merged
}

function envValue(env, ...keys) {
  for (const key of keys) {
    const value = stripWrappingQuotes(env[key] || "")
    if (value) {
      return value
    }
  }
  return ""
}

function splitCsv(value) {
  return normalizeString(value)
    .split(",")
    .map((entry) => normalizeString(entry))
    .filter(Boolean)
}

function unique(values) {
  return [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))]
}

async function loadServiceAccountInfo(env) {
  const rawB64 = envValue(env, "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON_B64")
  if (rawB64) {
    return JSON.parse(Buffer.from(rawB64, "base64").toString("utf8"))
  }

  const rawJson = envValue(env, "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON")
  if (rawJson) {
    return JSON.parse(rawJson)
  }

  const filePath = envValue(env, "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_FILE")
  if (filePath) {
    const absolutePath = resolve(filePath)
    const raw = await readFile(absolutePath, "utf8")
    return JSON.parse(raw)
  }

  return null
}

function resolveConfig(options, env) {
  const adminEmail =
    normalizeString(options.admin) || envValue(env, "GOOGLE_WORKSPACE_ADMIN_EMAIL")
  const groupEmail =
    normalizeString(options.group) || envValue(env, "GOOGLE_WORKSPACE_DEAD_LETTER_GROUP")
  const memberEmails = unique([
    ...options.members,
    ...splitCsv(envValue(env, "GOOGLE_WORKSPACE_DEAD_LETTER_MEMBERS"))
  ])

  return {
    adminEmail,
    description:
      normalizeString(options.description) ||
      "Catch-all target for misaddressed inbound email.",
    groupEmail,
    groupName:
      normalizeString(options.name) || "LeCrown Dead Letter Office",
    memberEmails,
    skipSettings: Boolean(options.skipSettings)
  }
}

function assertActionConfig(config) {
  if (!config.adminEmail) {
    throw new Error(
      "Missing GOOGLE_WORKSPACE_ADMIN_EMAIL or --admin. A delegated Workspace admin email is required."
    )
  }

  if (!config.groupEmail) {
    throw new Error(
      "Missing GOOGLE_WORKSPACE_DEAD_LETTER_GROUP or --group. Example: deadletters@lecrownproperties.com"
    )
  }

  if (!config.memberEmails.length) {
    throw new Error(
      "At least one dead-letter recipient is required. Use --member or GOOGLE_WORKSPACE_DEAD_LETTER_MEMBERS."
    )
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  const data = text ? safeJsonParse(text) : null

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.error_description ||
      data?.error ||
      data?.message ||
      text ||
      response.statusText
    const error = new Error(`HTTP ${response.status} ${response.statusText}: ${detail}`)
    error.status = response.status
    error.body = data ?? text
    throw error
  }

  return data
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function getAccessToken(env, adminEmail) {
  const serviceAccountInfo = await loadServiceAccountInfo(env)

  if (serviceAccountInfo) {
    return getServiceAccountAccessToken(serviceAccountInfo, adminEmail)
  }

  const clientId = envValue(
    env,
    "GOOGLE_WORKSPACE_OAUTH_CLIENT_ID",
    "PORTAL_DRIVE_CLIENT_ID"
  )
  const clientSecret = envValue(
    env,
    "GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET",
    "PORTAL_DRIVE_CLIENT_SECRET"
  )
  const refreshToken = envValue(
    env,
    "GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN",
    "PORTAL_DRIVE_REFRESH_TOKEN"
  )

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "No Admin SDK-capable credential was found locally. Add a delegated service account JSON or an OAuth refresh token with Admin SDK scopes."
    )
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  })

  const data = await fetchJson("https://oauth2.googleapis.com/token", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  })

  if (!data?.access_token) {
    throw new Error("OAuth refresh-token exchange succeeded without an access token.")
  }

  return {
    accessToken: data.access_token,
    authMode: "oauth_refresh_token"
  }
}

async function getServiceAccountAccessToken(serviceAccountInfo, adminEmail) {
  const privateKey = await importPKCS8(serviceAccountInfo.private_key, "RS256")
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({ scope: defaultScopeList.join(" ") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setAudience("https://oauth2.googleapis.com/token")
    .setExpirationTime(now + 3600)
    .setIssuedAt(now)
    .setIssuer(serviceAccountInfo.client_email)
    .setSubject(adminEmail)
    .sign(privateKey)

  const body = new URLSearchParams({
    assertion,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"
  })

  const data = await fetchJson("https://oauth2.googleapis.com/token", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  })

  if (!data?.access_token) {
    throw new Error("Service-account token exchange succeeded without an access token.")
  }

  return {
    accessToken: data.access_token,
    authMode: "delegated_service_account"
  }
}

async function workspaceRequest(accessToken, url, init = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers || {})
  }
  return fetchJson(url, { ...init, headers })
}

async function getGroup(accessToken, groupEmail) {
  try {
    return await workspaceRequest(
      accessToken,
      `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}`
    )
  } catch (error) {
    if (error?.status === 404) {
      return null
    }
    throw error
  }
}

async function ensureGroup(accessToken, config) {
  const existingGroup = await getGroup(accessToken, config.groupEmail)
  if (existingGroup) {
    return { group: existingGroup, status: "existing" }
  }

  const createdGroup = await workspaceRequest(
    accessToken,
    "https://admin.googleapis.com/admin/directory/v1/groups",
    {
      body: JSON.stringify({
        description: config.description,
        email: config.groupEmail,
        name: config.groupName
      }),
      method: "POST"
    }
  )

  return { group: createdGroup, status: "created" }
}

async function ensureMember(accessToken, groupEmail, memberEmail) {
  try {
    const created = await workspaceRequest(
      accessToken,
      `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`,
      {
        body: JSON.stringify({
          email: memberEmail,
          role: "MEMBER"
        }),
        method: "POST"
      }
    )
    return { member: created, status: "added" }
  } catch (error) {
    if (error?.status === 409) {
      return { member: { email: memberEmail }, status: "existing" }
    }
    throw error
  }
}

async function applyGroupSettings(accessToken, groupEmail) {
  return workspaceRequest(
    accessToken,
    `https://www.googleapis.com/groups/v1/groups/${encodeURIComponent(groupEmail)}`,
    {
      body: JSON.stringify({
        allowExternalMembers: "false",
        includeInGlobalAddressList: "false",
        isArchived: "true",
        messageModerationLevel: "MODERATE_NON_MEMBERS",
        showInGroupDirectory: "false",
        whoCanPostMessage: "ANYONE_CAN_POST"
      }),
      method: "PATCH"
    }
  )
}

function printCheck(config, env) {
  console.log("Dead-letter office check")
  console.log(`admin email: ${config.adminEmail ? "present" : "missing"}`)
  console.log(`group email: ${config.groupEmail || "(unset)"}`)
  console.log(
    `members: ${config.memberEmails.length ? config.memberEmails.join(", ") : "(unset)"}`
  )
  console.log(
    `service account credential: ${hasServiceAccountCredential(env) ? "present" : "missing"}`
  )
  console.log(
    `oauth refresh token credential: ${hasOauthRefreshCredential(env) ? "present (scope may still be insufficient)" : "missing"}`
  )
  console.log("")
  console.log(
    "Recommended group for the current alias-domain setup: deadletters@lecrownproperties.com"
  )
  console.log(
    "If lecrowndevelopment.com is a Workspace user-alias domain, that group should also receive the alias deadletters@lecrowndevelopment.com."
  )
}

function hasServiceAccountCredential(env) {
  return Boolean(
    envValue(
      env,
      "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON_B64",
      "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_WORKSPACE_SERVICE_ACCOUNT_FILE"
    )
  )
}

function hasOauthRefreshCredential(env) {
  return Boolean(
    envValue(
      env,
      "GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN",
      "PORTAL_DRIVE_REFRESH_TOKEN"
    ) &&
      envValue(env, "GOOGLE_WORKSPACE_OAUTH_CLIENT_ID", "PORTAL_DRIVE_CLIENT_ID") &&
      envValue(env, "GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET", "PORTAL_DRIVE_CLIENT_SECRET")
  )
}

function printCompletion(config, authMode, groupResult, memberResults, settingsApplied) {
  console.log(`Auth mode: ${authMode}`)
  console.log(`Group: ${config.groupEmail} (${groupResult.status})`)
  console.log(
    `Members: ${memberResults
      .map((result) => `${result.member.email}:${result.status}`)
      .join(", ")}`
  )
  console.log(`Group settings: ${settingsApplied ? "updated" : "skipped"}`)
  console.log("")
  console.log("Next manual Google Workspace step")
  console.log(
    "Admin console -> Apps -> Google Workspace -> Gmail -> Routing -> Add rule"
  )
  console.log("Rule applies to: Inbound messages")
  console.log("Action: Modify message -> Change envelope recipient -> Replace recipient")
  console.log(`Target recipient: ${config.groupEmail}`)
  console.log("Account types: select All inactive and unrecognized accounts")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const fileEnv = await loadFileEnv()
  const env = mergeEnv(fileEnv)
  const config = resolveConfig(options, env)

  if (options.check) {
    printCheck(config, env)
    return
  }

  assertActionConfig(config)
  const { accessToken, authMode } = await getAccessToken(env, config.adminEmail)
  const groupResult = await ensureGroup(accessToken, config)
  const memberResults = []

  for (const memberEmail of config.memberEmails) {
    memberResults.push(await ensureMember(accessToken, config.groupEmail, memberEmail))
  }

  let settingsApplied = false
  if (!config.skipSettings) {
    await applyGroupSettings(accessToken, config.groupEmail)
    settingsApplied = true
  }

  printCompletion(config, authMode, groupResult, memberResults, settingsApplied)
}

main().catch((error) => {
  const message = normalizeString(error?.message || String(error))
  if (message.includes("insufficient authentication scopes")) {
    console.error(
      `${message}\nProvide either a delegated service account or an OAuth refresh token that includes Admin SDK group scopes and Google Groups Settings scope.`
    )
  } else {
    console.error(message)
  }
  process.exitCode = 1
})
