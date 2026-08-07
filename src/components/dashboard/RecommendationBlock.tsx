export function RecommendationBlock({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.length ? (
          items.map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>No recommendation signal yet.</li>
        )}
      </ul>
    </div>
  )
}
