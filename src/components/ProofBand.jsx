export default function ProofBand({ items }) {
  return (
    <div className="proof-band">
      {items.map((item) => (
        <article className="proof-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  )
}
