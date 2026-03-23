const leadApiBase = "/api/lead"

export async function submitLead(payload) {
  const response = await fetch(`${leadApiBase}/v1/intake`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    method: "POST"
  })

  let data = null

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Lead submission failed with ${response.status}.`
    )
  }

  return data
}
