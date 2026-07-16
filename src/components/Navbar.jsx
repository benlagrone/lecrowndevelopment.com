import { useState } from "react"
import { NavLink } from "react-router-dom"
import site from "../content/site.json"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  function closeMenu() {
    setIsOpen(false)
  }

  return (
    <header className={`site-nav${isOpen ? " site-nav-open" : ""}`}>
      <NavLink className="brand-lockup" onClick={closeMenu} to="/">
        <img src="/logo-mark.png" alt="LeCrown Development logo" />
        <span>
          <span className="brand-kicker">{site.brand.kicker}</span>
          <span className="brand-name">{site.brand.name}</span>
        </span>
      </NavLink>

      <button
        aria-controls="primary-navigation"
        aria-expanded={isOpen}
        className="nav-menu-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{isOpen ? "Close" : "Menu"}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d={isOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
        </svg>
      </button>

      <div className="site-nav-actions">
        <nav className="nav-links" id="primary-navigation" aria-label="Primary">
          {site.navigation.map((item) => (
            <NavLink
              key={item.to}
              onClick={closeMenu}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {site.portalCta ? (
          <NavLink className="nav-portal-link" onClick={closeMenu} to={site.portalCta.to}>
            {site.portalCta.label}
          </NavLink>
        ) : null}
      </div>
    </header>
  )
}
