export function StatusChip({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={accent ? "status-chip accent" : "status-chip"}>
      <span className="status-chip-label">{label}</span>
      <strong className="status-chip-value">{value}</strong>
    </span>
  );
}
