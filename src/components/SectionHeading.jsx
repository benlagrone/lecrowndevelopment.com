export default function SectionHeading({ kicker, title, description }) {
  return (
    <div className="section-heading">
      {kicker ? <span className="section-kicker">{kicker}</span> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  )
}
