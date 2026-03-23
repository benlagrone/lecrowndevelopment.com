import { Link } from "react-router-dom"
import Hero from "../components/Hero"
import SectionHeading from "../components/SectionHeading"
import CardGrid from "../components/CardGrid"
import StackCloud from "../components/StackCloud"
import CTASection from "../components/CTASection"
import about from "../content/about.json"

export default function About() {
  return (
    <div className="page">
      <Hero {...about.hero} />

      <section className="section">
        <SectionHeading
          kicker="Company overview"
          title="Built for execution-heavy situations."
          description="LeCrown is strongest when the work needs technical depth, a sharper market story, or a fast path from concept to visible output."
        />
        <div className="panel">
          {about.overview.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Founder"
          title={about.founder.name}
          description={about.founder.title}
        />
        <div className="panel">
          <p>{about.founder.summary}</p>
          <div className="hero-actions">
            <a className="button" href={about.founder.linkedin} target="_blank" rel="noreferrer">
              View LinkedIn profile
            </a>
            <Link className="button-secondary" to="/contact">
              Contact LeCrown
            </Link>
          </div>
          <StackCloud items={about.founder.skills} />
        </div>
      </section>

      <section className="section">
        <SectionHeading
          kicker="Principles"
          title="How LeCrown approaches the work."
          description="These principles keep the site aligned with the actual operating model."
        />
        <CardGrid items={about.principles} />
      </section>

      <section className="section">
        <SectionHeading
          kicker="Company strengths"
          title="Why this company structure makes sense."
          description="The mix of engineering, incubation, and visible proof is deliberate."
        />
        <CardGrid items={about.strengths} />
      </section>

      <CTASection {...about.cta} />
    </div>
  )
}
