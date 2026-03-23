export default function VideoGrid({ items }) {
  return (
    <div className="video-grid">
      {items.map((item) => (
        <a
          className="video-card"
          key={item.title}
          href={item.href}
          target="_blank"
          rel="noreferrer"
        >
          <span>{item.label}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </a>
      ))}
    </div>
  )
}
