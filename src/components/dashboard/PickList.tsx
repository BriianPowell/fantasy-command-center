import type { DraftPick } from "../../domain/types";

export function PickList({ title, picks }: { title: string; picks: DraftPick[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="pick-list compact">
        {picks.length ? (
          picks.map((pick) => (
            <div key={`${title}-${pick.pickNo}`} className="pick-row">
              <strong>{pick.pickNo}</strong>
              <span>{formatPickName(pick)}</span>
              <span>{pick.metadata?.position ?? ""}</span>
            </div>
          ))
        ) : (
          <p>No picks yet.</p>
        )}
      </div>
    </div>
  );
}

function formatPickName(pick: DraftPick): string {
  return [pick.metadata?.firstName, pick.metadata?.lastName].filter(Boolean).join(" ") || pick.playerId || "Unknown player";
}
