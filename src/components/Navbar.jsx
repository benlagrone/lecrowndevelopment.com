import { NavLink } from "react-router-dom"
import site from "../content/site.json"

export default function Navbar() {
  return (
    <header className="site-nav">
      <NavLink className="brand-lockup" to="/">
        <img src="/logo-mark.png" alt="LeCrown Development logo" />
        <span>
          <span className="brand-kicker">{site.brand.kicker}</span>
          <span className="brand-name">{site.brand.name}</span>
        </span>
      </NavLink>

      <nav className="nav-links" aria-label="Primary">
        {site.navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
