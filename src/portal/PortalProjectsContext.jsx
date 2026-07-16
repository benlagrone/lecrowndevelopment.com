import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react"
import { usePortalAuth } from "./PortalAuthContext"
import { fetchPortalProjects, summarizePortalProject } from "./portalApi"

const PortalProjectsContext = createContext(null)

function upsertProjectSummary(projects, nextProject) {
  const nextSummary = summarizePortalProject(nextProject)
  const filteredProjects = projects.filter((project) => project.id !== nextSummary.id)

  return [nextSummary, ...filteredProjects]
}

export function PortalProjectsProvider({ children }) {
  const auth = usePortalAuth()
  const [state, setState] = useState({
    error: "",
    loading: false,
    projects: []
  })

  useEffect(() => {
    let cancelled = false

    if (!auth.ready) {
      return () => {
        cancelled = true
      }
    }

    if (!auth.isAuthenticated) {
      setState({
        error: "",
        loading: false,
        projects: []
      })

      return () => {
        cancelled = true
      }
    }

    setState((currentState) => ({
      ...currentState,
      error: "",
      loading: true
    }))

    fetchPortalProjects(auth)
      .then((projects) => {
        if (cancelled) {
          return
        }

        setState({
          error: "",
          loading: false,
          projects
        })
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setState({
          error: error.message,
          loading: false,
          projects: []
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    auth.authDisabled,
    auth.isAuthenticated,
    auth.ready,
    auth.user?.email,
    auth.user?.id
  ])

  const value = useMemo(() => {
    return {
      ...state,
      async refreshProjects() {
        if (!auth.isAuthenticated) {
          setState({
            error: "",
            loading: false,
            projects: []
          })
          return []
        }

        setState((currentState) => ({
          ...currentState,
          error: "",
          loading: true
        }))

        try {
          const projects = await fetchPortalProjects(auth)
          setState({
            error: "",
            loading: false,
            projects
          })
          return projects
        } catch (error) {
          setState({
            error: error.message,
            loading: false,
            projects: []
          })
          throw error
        }
      },
      upsertProject(project) {
        setState((currentState) => ({
          ...currentState,
          projects: upsertProjectSummary(currentState.projects, project)
        }))
      }
    }
  }, [auth, state])

  return (
    <PortalProjectsContext.Provider value={value}>
      {children}
    </PortalProjectsContext.Provider>
  )
}

export function usePortalProjects() {
  const context = useContext(PortalProjectsContext)

  if (!context) {
    throw new Error(
      "usePortalProjects must be used inside PortalProjectsProvider."
    )
  }

  return context
}
