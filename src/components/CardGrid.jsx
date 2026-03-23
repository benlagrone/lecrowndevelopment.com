import { Link } from "react-router-dom"

function CardAction({ item }) {
  if (!item.linkLabel) {
    return null
  }

  if (item.href) {
    return (
      <a className="card-link" href={item.href} target="_blank" rel="noreferrer">
        {item.linkLabel}
      </a>
    )
  }

  if (item.to) {
    return (
      <Link className="card-link" to={item.to}>
        {item.linkLabel}
      </Link>
    )
  }

  return null
}

export default function CardGrid({ items }) {
  return (
    <div className="card-grid">
      {items.map((item) => (
        <article className="card" key={item.title}>
          <h3>{item.title}</h3>
          {item.text ? <p>{item.text}</p> : null}
          {item.bullets?.length ? (
            <ul>
              {item.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          <CardAction item={item} />
        </article>
      ))}
    </div>
  )
}
