import { useEffect } from "react"
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from "react-router-dom"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import Home from "./pages/Home"
import Solutions from "./pages/Solutions"
import Government from "./pages/Government"
import AIAutomation from "./pages/AIAutomation"
import CustomDevelopment from "./pages/CustomDevelopment"
import AIVideo from "./pages/AIVideo"
import StrategicAdvisory from "./pages/StrategicAdvisory"
import About from "./pages/About"
import Contact from "./pages/Contact"
import PortalRoot, {
  PortalIndexRedirect,
  PortalLoginPage,
  PortalProtectedRoute
} from "./portal/PortalRoot"
import PortalWorkspace from "./portal/PortalWorkspace"

const pageTitles = {
  "/": "LeCrown Development",
  "/about": "About | LeCrown Development",
  "/ai-automation": "AI Automation | LeCrown Development",
  "/ai-video": "AI Video | LeCrown Development",
  "/contact": "Contact | LeCrown Development",
  "/custom-development": "Custom Development | LeCrown Development",
  "/government": "Government | LeCrown Development",
  "/services": "Services | LeCrown Development",
  "/services/strategic-advisory":
    "Strategic Advisory & Corporate Consulting | LeCrown Development",
  "/solutions": "Solutions | LeCrown Development"
}

const pageDescriptions = {
  "/services/strategic-advisory":
    "Strategic advisory, corporate consulting, business evaluation, economics consulting, M&A advisory, due diligence, and commercial property evaluation for business and transaction decisions."
}

const pageKeywords = {
  "/services/strategic-advisory":
    "strategic advisory consulting, corporate consulting services, business evaluation consulting, economics consulting, mergers and acquisitions advisory, due diligence consulting, commercial property evaluation, business assessment services, transaction advisory services, investment analysis consulting, Houston business consulting, Texas strategic advisory"
}

function upsertMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`)

  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute("name", name)
    document.head.appendChild(tag)
  }

  tag.setAttribute("content", content)
}

function getPageTitle(pathname) {
  if (pathname === "/portal/login") {
    return "Portal Login | LeCrown Development"
  }

  if (pathname.startsWith("/portal")) {
    return "Client Portal | LeCrown Development"
  }

  return pageTitles[pathname] || "LeCrown Development"
}

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.title = getPageTitle(location.pathname)
    upsertMeta("description", pageDescriptions[location.pathname] || "")
    upsertMeta("keywords", pageKeywords[location.pathname] || "")
  }, [location.pathname])

  return null
}

function MarketingShell() {
  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<MarketingShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/government" element={<Government />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/ai-automation" element={<AIAutomation />} />
            <Route
              path="/custom-development"
              element={<CustomDevelopment />}
            />
            <Route path="/ai-video" element={<AIVideo />} />
            <Route path="/services" element={<Solutions />} />
            <Route
              path="/services/strategic-advisory"
              element={<StrategicAdvisory />}
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
        </Route>

        <Route path="/portal" element={<PortalRoot />}>
          <Route index element={<PortalIndexRedirect />} />
          <Route path="login" element={<PortalLoginPage />} />
          <Route element={<PortalProtectedRoute />}>
            <Route path=":projectId" element={<PortalWorkspace />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/portal" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
