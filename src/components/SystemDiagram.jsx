import SectionHeading from "./SectionHeading"

export default function SystemDiagram({ kicker, title, description, steps }) {
  return (
    <section className="section">
      <SectionHeading
        kicker={kicker}
        title={title}
        description={description}
      />
      <div className="panel">
        <div className="diagram-grid">
          {steps.map((step) => (
            <div className="diagram-node" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
