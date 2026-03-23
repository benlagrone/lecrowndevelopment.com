export default function StackCloud({ items }) {
  return (
    <div className="stack-cloud">
      {items.map((item) => (
        <span className="stack-pill" key={item}>
          {item}
        </span>
      ))}
    </div>
  )
}
