export function ModuleTrimToggle({
  isMinimized,
  moduleName,
  onToggle,
}: {
  isMinimized: boolean
  moduleName: string
  onToggle: () => void
}) {
  return (
    <button
      aria-expanded={!isMinimized}
      aria-label={`${isMinimized ? 'Expand' : 'Minimize'} ${moduleName}`}
      className="module-trim-toggle"
      onClick={onToggle}
      type="button"
    />
  )
}
