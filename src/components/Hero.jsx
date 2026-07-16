import { Link } from "react-router-dom"

function HeroAction({ action, secondary = false }) {
  if (!action) {
    return null
  }

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

export default function Hero({
  eyebrow,
  title,
  summary,
  primaryCta,
  secondaryCta,
  highlights = [],
  visual
}) {
  const heroClassName = title.length > 64 ? "hero hero-long-title" : "hero"

  return (
    <section className={heroClassName}>
      <div className="hero-copy">
        <span className="hero-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="hero-summary">{summary}</p>

        <div className="hero-actions">
          <HeroAction action={primaryCta} />
          <HeroAction action={secondaryCta} secondary />
        </div>

        {highlights.length > 0 && (
          <div className="hero-notes">
            {highlights.map((item) => (
              <span className="chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {visual && (
        <div className="hero-visual">
          <span className="visual-tag">{visual.eyebrow}</span>
          <div className="visual-title">{visual.title}</div>
          <div className="visual-grid">
            {visual.items.map((item) => (
              <div className="visual-grid-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
