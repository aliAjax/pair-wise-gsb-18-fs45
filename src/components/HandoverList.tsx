import type { AppState, Handover } from "../data/types";
import {
  MAX_TEMPORARY_DAYS,
  MIN_WALLS,
  restorationBlockers,
  slotLabelOf,
  temporaryDays,
} from "../domain/rules";
import { bitePainLabels, statusLabels } from "./labels";

const statusOrder: Record<Handover["status"], number> = {
  pending: 0,
  consult: 1,
  confirmed: 2,
};

/** 待移交单列表：同一牙位只留一张未完结单 */
export function HandoverList({
  state,
  selectedId,
  onSelect,
}: {
  state: AppState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ordered = [...state.handovers].sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <section className="panel handover-list-panel">
      <div className="section-heading">
        <div>
          <p>牙位待移交单</p>
          <h2>移交队列</h2>
        </div>
        <span className="hint">同一牙位只留一张待移交单</span>
      </div>
      <div className="handover-list">
        {ordered.map((h) => {
          const days = temporaryDays(h.coronal.sealedOn);
          const blockers =
            h.status === "pending" ? restorationBlockers(h.coronal) : [];
          return (
            <button
              key={h.id}
              type="button"
              className={`handover-card status-${h.status} ${
                selectedId === h.id ? "selected" : ""
              }`}
              onClick={() => onSelect(h.id)}
            >
              <div className="handover-head">
                <strong className="tooth-no">{h.toothNo}</strong>
                <span className={`badge badge-${h.status}`}>{statusLabels[h.status]}</span>
              </div>
              <p className="handover-diagnosis">{h.diagnosis}</p>
              <div className="handover-meta">
                <span className={blockers.includes("walls") ? "flag" : ""}>
                  {h.coronal.wallCount} 壁{blockers.includes("walls") ? `（< ${MIN_WALLS}）` : ""}
                </span>
                <span className={blockers.includes("temporary") ? "flag" : ""}>
                  暂封 {days} 天{blockers.includes("temporary") ? `（> ${MAX_TEMPORARY_DAYS}）` : ""}
                </span>
                <span>{bitePainLabels[h.coronal.bitePain]}</span>
                <span>{slotLabelOf(state, h.slotId) ?? "未排椅位"}</span>
              </div>
              {h.revisions.length > 0 && (
                <p className="revision-count">修订链 {h.revisions.length} 次复开</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
