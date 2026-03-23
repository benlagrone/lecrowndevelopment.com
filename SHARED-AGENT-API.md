# Shared Agent API

This frontend can post qualified leads to a shared browser-facing API such as `https://chat.askmortgageauthority.com`.

The intent is to let multiple sites reuse the same backend agent while identifying which site originated the conversation.

## Frontend config

Set these build-time variables:

```bash
VITE_AGENT_API_BASE_URL=https://chat.askmortgageauthority.com
VITE_AGENT_SITE_ID=lecrowndevelopment.com
VITE_AGENT_BOT_ID=benjamin-lagrone
```

For `benjaminlagrone.com`, keep the same API base URL and bot id, but change:

```bash
VITE_AGENT_SITE_ID=benjaminlagrone.com
```

No extra frontend secret is needed for LinkedIn sign-in. The browser should only know the shared agent base URL; the backend owns the LinkedIn client secret and callback exchange.

## Optional LinkedIn auth broker

The contact chat can launch a LinkedIn sign-in flow through the shared agent API in order to prefill the visitor's name and email.

Recommended flow:

1. Browser redirects to `GET /v1/auth/linkedin/start?siteId=...&agentId=...&returnTo=https://.../contact#agent-chat`
2. Backend starts LinkedIn OIDC with `openid profile email`
3. Backend handles LinkedIn's callback and exchanges the code server-side
4. Backend redirects the browser back to `returnTo` with `linkedin_auth=success&linkedin_session=session_123`
5. Browser calls `GET /v1/auth/linkedin/session?session=session_123&siteId=...`

Recommended session response:

```json
{
  "member": {
    "name": "Jane Doe",
    "givenName": "Jane",
    "familyName": "Doe",
    "email": "jane@example.com",
    "headline": "Founder at Acme",
    "picture": "https://media.licdn.com/...",
    "profileUrl": "https://www.linkedin.com/in/janedoe/"
  }
}
```

The frontend also accepts direct callback fields such as `linkedin_name`, `linkedin_email`, and `linkedin_profile`, but the opaque `linkedin_session` redirect is preferred so profile data is not exposed in the URL.

## Request contract

The site posts `POST /v1/intake` with JSON like:

```json
{
  "agentId": "benjamin-lagrone",
  "siteId": "lecrowndevelopment.com",
  "submittedAt": "2026-03-16T22:00:00.000Z",
  "page": {
    "path": "/contact",
    "referrer": "",
    "url": "https://lecrowndevelopment.com/contact"
  },
  "lead": {
    "contact": {
      "name": "Jane Doe",
      "organization": "Acme",
      "email": "jane@example.com",
      "linkedin": {
        "provider": "linkedin",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "headline": "Founder at Acme",
        "profileUrl": "https://www.linkedin.com/in/janedoe/"
      }
    },
    "details": {
      "projectType": "AI Automation",
      "timeline": "30-60 days",
      "goals": "Automate proposal triage."
    },
    "recommendedNextStep": "a workflow review and pilot scoping call"
  },
  "context": {
    "experienceMatch": {
      "headline": "Strong fit for AI workflow and automation work.",
      "bullets": [
        "AI and machine learning background applied to automation, chatbots, and decision-support systems."
      ]
    }
  },
  "transcript": [
    {
      "role": "agent",
      "name": "LeCrown Agent",
      "text": "I can qualify the opportunity..."
    }
  ]
}
```

## Expected response

Return JSON in this shape:

```json
{
  "leadId": "lead_123",
  "reply": "Thanks. Benjamin's agent has your intake and will follow up shortly.",
  "followUp": {
    "label": "Book a call",
    "href": "https://cal.com/example"
  }
}
```

Only `reply` is effectively required by the current UI. `leadId` and `followUp` are optional.

## Backend guidance

- The backend should own the canonical resume, experience corpus, and agent instructions for `benjamin-lagrone`.
- The browser should not carry private API secrets. `VITE_*` values are public at build time.
- LinkedIn auth should use the backend as the OAuth/OpenID client. Do not exchange LinkedIn authorization codes in the browser.
- Restrict allowed origins, apply rate limiting, and validate `siteId` server-side.
- If the API is unavailable, the frontend falls back to a drafted email handoff.
