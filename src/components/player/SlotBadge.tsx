import "./playerReference.css";

export function SlotBadge({ slotLabel }: { slotLabel: string }) {
  const labels = getSlotBadgeLabels(slotLabel);

  return (
    <span className="slot-label-segments">
      {labels.map((label) => (
        <span className={`slot-segment ${label.toLowerCase()}`} key={label}>
          {label}
        </span>
      ))}
    </span>
  );
}

function getSlotBadgeLabels(slotLabel: string): string[] {
  if (slotLabel === "FLEX") {
    return ["W", "R", "T"];
  }

  if (slotLabel === "SUPER_FLEX") {
    return ["W", "R", "T", "Q"];
  }

  return [slotLabel];
}
