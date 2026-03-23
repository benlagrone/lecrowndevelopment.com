import { Link } from "react-router-dom"
import site from "../content/site.json"

export default function Footer() {
  return (
    <footer className="footer-shell">
      <div className="footer-panel">
        <div>
          <span className="section-kicker">LeCrown Development</span>
          <h2>Build what earns attention, trust, and momentum.</h2>
          <p>
            LeCrown is structured to help companies, public-sector teams, and
            incubated products move from scattered opportunity to shipped
            systems.
          </p>
          <div className="footer-meta">
            <span className="chip">AI consultancy</span>
            <span className="chip">Project incubator</span>
            <span className="chip">Government-ready delivery</span>
          </div>
        </div>

        <div>
          <ul className="footer-links">
            {site.navigation.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <p>
            <strong>Email:</strong>{" "}
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
          </p>
          <p>
            <strong>Phone:</strong>{" "}
            <a href={`tel:${site.contact.phoneDigits}`}>{site.contact.phone}</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
