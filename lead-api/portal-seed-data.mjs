import { copyFile, mkdir, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const moduleDir = dirname(fileURLToPath(import.meta.url))

const seededProjects = [
  {
    id: "northstar-automation",
    name: "Northstar Automation Rollout",
    status: "Review",
    phase: "Homepage + intake review",
    lastUpdated: "2026-04-14",
    summary:
      "LeCrown is shipping the first portal-ready website and intake workflow for Northstar's operations team.",
    highlights: [
      "Homepage and solutions pages are ready for stakeholder review.",
      "The intake flow is collecting the right client qualification fields.",
      "Document delivery is being moved into one client-visible workspace."
    ],
    timeline: [
      {
        id: "northstar-kickoff",
        date: "2026-04-08",
        title: "Scope approved and portal opened",
        description:
          "Statement of work was confirmed and the project workspace was provisioned.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "northstar-review-ready",
        date: "2026-04-14",
        title: "Homepage and intake flow prepared for review",
        description:
          "The current build is ready for stakeholder feedback on messaging and qualification fields.",
        badge: "Review",
        tone: "review"
      }
    ],
    preview: {
      notes:
        "Homepage, service blocks, and project intake flow are ready for review. Final polish and copy tightening remain open.",
      reviewChecklist: [
        "Confirm the homepage headline and CTA hierarchy.",
        "Validate intake fields against the scoping call notes.",
        "Flag any content gaps in the service comparison section."
      ],
      url: "/ai-automation"
    },
    documents: [
      {
        id: "northstar-sow",
        category: "Scope & Agreements",
        description: "Signed statement of work and delivery assumptions.",
        name: "statement-of-work-summary.md",
        updatedAt: "2026-04-08",
        seedContent: `# Northstar Statement Of Work Summary

- Delivery scope: marketing site rebuild plus guided intake flow
- Current review focus: homepage message hierarchy and intake qualification fields
- Delivery mode: staged preview plus client portal handoff`
      },
      {
        id: "northstar-outline",
        category: "Site Structure / Outline",
        description: "Approved page map and content structure.",
        name: "site-outline.md",
        updatedAt: "2026-04-10",
        seedContent: `# Site Outline

1. Homepage
2. Solutions
3. Intake
4. Client Portal

Primary CTA remains request-based rather than self-serve.`
      },
      {
        id: "northstar-assets",
        category: "Assets",
        description: "Primary brand assets and working copy pack.",
        name: "brand-assets-notes.txt",
        updatedAt: "2026-04-11",
        seedContent: `Brand asset bundle notes

- Logo pack confirmed
- Working copy pack imported
- Final photography still pending`
      },
      {
        id: "northstar-deliverable",
        category: "Deliverables",
        description: "Latest build snapshot and implementation notes.",
        name: "sprint-handoff.txt",
        updatedAt: "2026-04-14",
        seedContent: `Sprint handoff

Homepage and service blocks are ready for stakeholder review.
Portal shell is live. Backend API and secure document delivery are in progress.`
      }
    ],
    feedback: [
      {
        id: "northstar-comment-1",
        authorName: "Sarah Reed",
        authorEmail: "sarah@northstar.example",
        message:
          "Please tighten the hero copy so the first sentence is more operations-focused than marketing-focused.",
        role: "client",
        status: "open",
        tags: [],
        timestamp: "2026-04-14T13:20:00.000Z"
      },
      {
        id: "northstar-comment-2",
        authorName: "LeCrown Delivery",
        authorEmail: "admin@lecrowndevelopment.com",
        message:
          "Adjusted the service comparison section and grouped the next revision items under one review pass.",
        role: "admin",
        status: "addressed",
        tags: ["copy"],
        timestamp: "2026-04-14T15:05:00.000Z"
      }
    ],
    members: [
      {
        email: "admin@lecrowndevelopment.com",
        name: "LeCrown Delivery",
        role: "admin"
      },
      {
        email: "sarah@northstar.example",
        name: "Sarah Reed",
        role: "client"
      }
    ]
  },
  {
    id: "civic-landing-page",
    name: "Civic Contracting Landing Page",
    status: "In Progress",
    phase: "Build",
    lastUpdated: "2026-04-12",
    summary:
      "This project is in active build with document intake and first-pass content assembly underway.",
    highlights: [
      "Navigation and content grouping are approved.",
      "Client assets are partially uploaded.",
      "The next milestone is a first working preview."
    ],
    timeline: [
      {
        id: "civic-scope-approved",
        date: "2026-04-05",
        title: "Proposal approved",
        description:
          "Signed proposal and delivery timeline were confirmed for the landing page build.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "civic-build-in-progress",
        date: "2026-04-12",
        title: "Build in progress",
        description:
          "Navigation and content grouping are set while final service copy is still pending.",
        badge: "In Progress",
        tone: "in-progress"
      }
    ],
    preview: {
      notes:
        "A working preview is being prepared. Use this area once the first deploy is ready.",
      reviewChecklist: [
        "Upload any missing brand assets.",
        "Confirm the case-study ordering.",
        "Decide whether the CTA should book directly or route through intake."
      ],
      url: "/custom-development"
    },
    documents: [
      {
        id: "civic-scope",
        category: "Scope & Agreements",
        description: "Signed proposal and approved timeline.",
        name: "proposal-summary.md",
        updatedAt: "2026-04-05",
        seedContent: `# Proposal Summary

- Landing page scope approved
- Build is in progress
- First preview pending final service copy`
      },
      {
        id: "civic-assets",
        category: "Assets",
        description: "Current logo set and draft copy pack.",
        name: "asset-bundle-notes.txt",
        updatedAt: "2026-04-09",
        seedContent: `Asset bundle notes

- Logo set received
- Draft copy is partial
- Case study ordering still open`
      }
    ],
    feedback: [
      {
        id: "civic-comment-1",
        authorName: "LeCrown Delivery",
        authorEmail: "admin@lecrowndevelopment.com",
        message:
          "Waiting on final service copy before the first preview can be published.",
        role: "admin",
        status: "open",
        tags: ["blocking"],
        timestamp: "2026-04-12T16:35:00.000Z"
      }
    ],
    members: [
      {
        email: "admin@lecrowndevelopment.com",
        name: "LeCrown Delivery",
        role: "admin"
      },
      {
        email: "ops@civic.example",
        name: "Civic Ops",
        role: "client"
      }
    ]
  },
  {
    id: "houston-auto-storage-acquisition",
    name: "Houston Auto Storage Acquisition Due Diligence",
    status: "Completed",
    phase: "Submitted",
    lastUpdated: "2026-06-12",
    summary:
      "LeCrown completed and submitted the Houston auto storage valuation review package. The final report and supporting deliverables are available in the portal.",
    highlights: [
      "The valuation review package has been completed and submitted.",
      "The final valuation report and supporting files are available in the Documents tab.",
      "The project is closed pending any follow-up questions or requested revisions."
    ],
    timeline: [
      {
        id: "houston-portal-opened",
        date: "2026-05-29",
        title: "Portal opened and intake package loaded",
        description:
          "The client workspace, onboarding packet, and diligence request materials were provisioned.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "houston-start-here-shared",
        date: "2026-06-02",
        title: "Client start-here package published",
        description:
          "The starter package and early supporting scans were posted for client access.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "houston-valuation-package-assembled",
        date: "2026-06-10",
        title: "Valuation review package assembled",
        description:
          "The final deliverable set was compiled into the client-facing zip package and individual portal files.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "houston-final-submission",
        date: "2026-06-12",
        title: "Final submission posted in portal",
        description:
          "The final valuation report and supporting deliverables were uploaded and marked submitted.",
        badge: "Submitted",
        tone: "completed"
      }
    ],
    preview: {
      notes:
        "This workspace now holds the submitted valuation review package and final supporting deliverables. There is no separate public web preview for this project.",
      reviewChecklist: [
        "Download the submitted valuation review package and final report.",
        "Review the supporting evidence, workpapers, and inventories in the Documents tab.",
        "Use the Feedback tab for any follow-up questions or requested revisions."
      ],
      url: "/portal/houston-auto-storage-acquisition?tab=documents"
    },
    documents: [
      {
        id: "houston-retainer-receipt",
        category: "Scope & Agreements",
        description:
          "Retainer payment acknowledgment for the acquisition diligence engagement.",
        name: "Asset valuation retainer receipt.docx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__doc_retainer_receipt__asset_valuation_retainer_receipt__lecrown__v02.docx",
        updatedAt: "2026-05-29"
      },
      {
        id: "houston-welcome-letter",
        category: "Scope & Agreements",
        description:
          "Client welcome letter outlining the diligence kickoff and communication path.",
        name: "Client welcome letter.docx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__doc_onboarding_welcome__client_welcome_letter__lecrown__v02.docx",
        updatedAt: "2026-05-29"
      },
      {
        id: "houston-diligence-manifest",
        category: "Site Structure / Outline",
        description:
          "Due diligence request manifest covering financials, fleet, real estate, and legal items.",
        name: "Due diligence request manifest.docx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__doc_custom_requirement_manifest__due_diligence_request_manifest__lecrown__v02.docx",
        updatedAt: "2026-05-29"
      },
      {
        id: "houston-upload-index",
        category: "Site Structure / Outline",
        description:
          "Portal upload index listing the current client-facing file package.",
        name: "Portal upload file manifest.docx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__upload_index__portal_file_manifest__lecrown__v02.docx",
        updatedAt: "2026-05-29"
      },
      {
        id: "houston-seller-email",
        category: "Deliverables",
        description:
          "Seller / valuator email draft for requesting the initial diligence package.",
        name: "Seller document request email.docx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__doc_email_cover_note__seller_document_request_email__lecrown__v02.docx",
        updatedAt: "2026-05-29"
      },
      {
        id: "houston-tracking-workbook",
        category: "Deliverables",
        description:
          "Tracking workbook for monitoring received documents and outstanding diligence items.",
        name: "Due diligence status matrix.xlsx",
        seedFile:
          "houston-auto-storage-acquisition/2026-05-29__tracking_manifest__due_diligence_status_matrix__lecrown__v02.xlsx",
        updatedAt: "2026-05-29"
      }
    ],
    feedback: [
      {
        id: "houston-comment-1",
        authorName: "LeCrown Delivery",
        authorEmail: "admin@lecrowndevelopment.com",
        message:
          "Initial onboarding and due diligence documents have been loaded into the portal. Use the tracking workbook to log received files and follow-up status.",
        role: "admin",
        status: "open",
        tags: ["handoff"],
        timestamp: "2026-05-29T21:30:00.000Z"
      }
    ],
    members: [
      {
        email: "admin@lecrowndevelopment.com",
        name: "LeCrown Delivery",
        role: "admin"
      },
      {
        email: "stephaniebenitez1981@yahoo.com",
        name: "Stephanie Benitez",
        role: "client"
      },
      {
        email: "info@garcialaw.com",
        name: "Judge Israel Garcia",
        role: "client"
      }
    ]
  },
  {
    id: "carlos-stephanie-second-business-evaluation",
    name: "Carlos and Stephanie - Second Business Evaluation",
    status: "In Progress",
    phase: "Engagement package posted",
    lastUpdated: "2026-06-14",
    summary:
      "LeCrown opened the second-business evaluation workspace and posted the engagement package, upload instructions, and intake materials for client review.",
    highlights: [
      "The engagement overview and portal instructions are posted in the Documents tab.",
      "The document request checklist and tracking matrix are ready for intake follow-up.",
      "Workspace access is limited to the assigned client, judge, Jessica, and LeCrown."
    ],
    timeline: [
      {
        id: "second-business-portal-opened",
        date: "2026-06-14",
        title: "Workspace opened",
        description:
          "The second-business evaluation workspace was created and restricted to the assigned members.",
        badge: "Completed",
        tone: "completed"
      },
      {
        id: "second-business-package-posted",
        date: "2026-06-14",
        title: "Engagement package posted",
        description:
          "The client-facing overview, upload instructions, document checklist, and tracking matrix were uploaded for intake.",
        badge: "In Progress",
        tone: "in-progress"
      }
    ],
    preview: {
      notes:
        "Use the Documents tab for the engagement overview, upload instructions, and intake checklist for the second-business evaluation.",
      reviewChecklist: [
        "Review the engagement overview and portal upload instructions.",
        "Use the checklist and matrix to gather the requested materials.",
        "Post any questions in Feedback or reply by email for clarification."
      ],
      url: "/portal/carlos-stephanie-second-business-evaluation?tab=documents"
    },
    documents: [],
    feedback: [
      {
        id: "second-business-comment-1",
        authorName: "LeCrown Delivery",
        authorEmail: "admin@lecrowndevelopment.com",
        message:
          "The second-business evaluation workspace is open and the intake package has been uploaded for review.",
        role: "admin",
        status: "open",
        tags: ["handoff"],
        timestamp: "2026-06-14T18:45:00.000Z"
      }
    ],
    members: [
      {
        email: "admin@lecrowndevelopment.com",
        name: "LeCrown Delivery",
        role: "admin"
      },
      {
        email: "benjamin@lecrownproperties.com",
        name: "Benjamin LaGrone",
        role: "admin"
      },
      {
        email: "benjamin.lagrone@lecrowndevelopment.com",
        name: "Benjamin LaGrone",
        role: "admin"
      },
      {
        email: "stephaniebenitez1981@yahoo.com",
        name: "Stephanie Benitez",
        role: "client"
      },
      {
        email: "info@garcialaw.com",
        name: "Judge Israel Garcia",
        role: "client"
      },
      {
        email: "jessica@lecrownproperties.com",
        name: "Jessica Huang",
        role: "client"
      }
    ]
  }
]

function inferContentType(fileName) {
  if (fileName.endsWith(".md")) {
    return "text/markdown; charset=utf-8"
  }

  if (fileName.endsWith(".txt")) {
    return "text/plain; charset=utf-8"
  }

  if (fileName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }

  if (fileName.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }

  if (fileName.endsWith(".html")) {
    return "text/html; charset=utf-8"
  }

  return "application/octet-stream"
}

function resolveSeedFile(seedFile) {
  return join(moduleDir, "seed-documents", seedFile)
}

async function materializeSeedDocument(document, storagePath) {
  if (document.seedFile) {
    await copyFile(resolveSeedFile(document.seedFile), storagePath)
    return
  }

  if (typeof document.seedContent === "string") {
    await writeFile(storagePath, document.seedContent, "utf8")
    return
  }

  throw new Error(`Seed document ${document.id} is missing seed content.`)
}

export async function createSeedPortalState(documentsRoot) {
  const projects = []

  for (const project of seededProjects) {
    const nextProject = structuredClone(project)
    nextProject.documents = []

    for (const document of project.documents) {
      const projectDir = join(documentsRoot, project.id)
      await mkdir(projectDir, { recursive: true })

      const storedFileName = `${document.id}-${document.name}`
      const storagePath = join(projectDir, storedFileName)
      await materializeSeedDocument(document, storagePath)

      nextProject.documents.push({
        id: document.id,
        category: document.category,
        contentType: inferContentType(document.name),
        description: document.description,
        fileName: document.name,
        name: document.name,
        sourceFileName: document.seedFile ? basename(document.seedFile) : document.name,
        storagePath,
        updatedAt: document.updatedAt
      })
    }

    projects.push(nextProject)
  }

  return { projects }
}
