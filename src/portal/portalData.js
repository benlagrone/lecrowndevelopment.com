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
        fileUrl: "",
        name: "Statement of work.pdf",
        updatedAt: "2026-04-08"
      },
      {
        id: "northstar-outline",
        category: "Site Structure / Outline",
        description: "Approved page map and content structure.",
        fileUrl: "",
        name: "Site outline.md",
        updatedAt: "2026-04-10"
      },
      {
        id: "northstar-assets",
        category: "Assets",
        description: "Primary brand assets and working copy pack.",
        fileUrl: "",
        name: "Brand assets.zip",
        updatedAt: "2026-04-11"
      },
      {
        id: "northstar-deliverable",
        category: "Deliverables",
        description: "Latest build snapshot and implementation notes.",
        fileUrl: "",
        name: "Sprint handoff.txt",
        updatedAt: "2026-04-14"
      }
    ],
    feedback: [
      {
        id: "northstar-comment-1",
        authorName: "Sarah Reed",
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
        fileUrl: "",
        name: "Proposal.pdf",
        updatedAt: "2026-04-05"
      },
      {
        id: "civic-assets",
        category: "Assets",
        description: "Current logo set and draft copy pack.",
        fileUrl: "",
        name: "Asset bundle.zip",
        updatedAt: "2026-04-09"
      }
    ],
    feedback: [
      {
        id: "civic-comment-1",
        authorName: "LeCrown Delivery",
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
  }
]

function cloneProject(project) {
  return JSON.parse(JSON.stringify(project))
}

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || ""
}

export function getPortalProject(projectId) {
  const project = seededProjects.find((entry) => entry.id === projectId)
  return project ? cloneProject(project) : null
}

export function listPortalProjects() {
  return seededProjects.map(cloneProject)
}

export function canAccessProject(project, user) {
  if (!project || !user) {
    return false
  }

  if (user.roles?.includes("admin")) {
    return true
  }

  const userEmail = normalizeEmail(user.email)
  return project.members.some((member) => normalizeEmail(member.email) === userEmail)
}

export function getVisibleProjects(user) {
  return listPortalProjects().filter((project) => canAccessProject(project, user))
}
