import { useEffect } from "react"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import Home from "./pages/Home"
import Solutions from "./pages/Solutions"
import Government from "./pages/Government"
import AIAutomation from "./pages/AIAutomation"
import CustomDevelopment from "./pages/CustomDevelopment"
import AIVideo from "./pages/AIVideo"
import About from "./pages/About"
import Contact from "./pages/Contact"

const pageTitles = {
  "/": "LeCrown Development",
  "/about": "About | LeCrown Development",
  "/ai-automation": "AI Automation | LeCrown Development",
  "/ai-video": "AI Video | LeCrown Development",
  "/contact": "Contact | LeCrown Development",
  "/custom-development": "Custom Development | LeCrown Development",
  "/government": "Government | LeCrown Development",
  "/solutions": "Solutions | LeCrown Development"
}

function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.title =
      pageTitles[location.pathname] || "LeCrown Development"
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-shell">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/government" element={<Government />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/ai-automation" element={<AIAutomation />} />
            <Route
              path="/custom-development"
              element={<CustomDevelopment />}
            />
            <Route path="/ai-video" element={<AIVideo />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
