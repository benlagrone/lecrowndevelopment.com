import { Link } from "react-router-dom"
import SectionHeading from "./SectionHeading"

function CTAAction({ action, secondary = false }) {
  const className = secondary ? "button-secondary" : "button"

  if (action.href) {
    return (
      <a className={className} href={action.href}>
        {action.label}
      </a>
    )
  }

  return (
    <Link className={className} to={action.to}>
      {action.label}
    </Link>
  )
}

export default function CTASection({ kicker, title, description, primary, secondary }) {
  return (
    <section className="section">
      <div className="cta-panel">
        <SectionHeading kicker={kicker} title={title} description={description} />
        <div className="cta-actions">
          <CTAAction action={primary} />
          {secondary ? <CTAAction action={secondary} secondary /> : null}
        </div>
      </div>
    </section>
  )
}
