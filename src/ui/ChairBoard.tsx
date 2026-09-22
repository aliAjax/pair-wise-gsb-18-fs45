// 页面层：椅位台。一张椅位时段只排一颗牙；选中待移交牙后点空槽改约（先释放后占用）。

import type { AppState, HandoverForm } from "../data/types";
import { CHAIR_SLOTS } from "../data/reference";

export default function ChairBoard({
  state,
  selectedId,
  onSelect,
  onOccupy,
}: {
  state: AppState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOccupy: (slotId: string) => void;
}) {
  const holderMap = new Map<string, HandoverForm>();
  for (const form of state.forms) {
    if (form.slotId) holderMap.set(form.slotId, form);
  }

  const groups = CHAIR_SLOTS.reduce<Record<string, typeof CHAIR_SLOTS>>((acc, s) => {
    (acc[s.dateLabel] ??= []).push(s);
    return acc;
  }, {});

  const selected = selectedId ? state.forms.find((f) => f.id === selectedId) ?? null : null;
  const canPick = selected?.status === "pending";

  return (
    <section className="panel chair-panel">
      <div className="section-heading">
        <div>
          <p>椅位调度</p>
          <h2>椅位台 · 一椅一牙</h2>
        </div>
        {selectedId && (
          <button type="button" className="ghost" onClick={() => onSelect(null)}>
            取消选牙
          </button>
        )}
      </div>

      {selected ? (
        canPick ? (
          <p className="chair-hint hint-active">
            已选中 <b>{selected.data.toothCode}</b>
            {selected.slotId ? `（当前 ${selected.slotId}）` : "（暂未排班）"}
            ：点击空槽位改约，系统将先释放原占用；点击已占槽位会显示冲突。
          </p>
        ) : (
          <p className="chair-hint hint-warn">
            {selected.data.toothCode} 为{selected.status === "confirmed" ? "已冻结" : "加固会诊"}状态，不能直接排椅位。
          </p>
        )
      ) : (
        <p className="chair-hint">在下方待移交单上点“改约/排椅位”选中一颗牙，再点空槽位。</p>
      )}

      <div className="chair-days">
        {Object.entries(groups).map(([day, slots]) => (
          <div key={day} className="chair-day">
            <span className="chair-day-label">{day}</span>
            <div className="chair-grid">
              {slots.map((slot) => {
                const holder = holderMap.get(slot.id);
                const isSelectedSeat = holder?.id === selectedId;
                const classes = [
                  "chair-cell",
                  holder ? "occupied" : "free",
                  isSelectedSeat ? "mine" : "",
                  canPick && !holder ? "pickable" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={classes}
                    disabled={!canPick}
                    onClick={() => onOccupy(slot.id)}
                    title={holder ? `${holder.data.toothCode} 占用（点击仍会先释放本牙占用并报冲突）` : "空槽"}
                  >
                    <span className="chair-time">{slot.label}</span>
                    <small>{slot.timeRange}</small>
                    {holder ? (
                      <strong className="chair-tooth">
                        {holder.data.toothCode}
                        {isSelectedSeat ? "（本牙）" : ""}
                      </strong>
                    ) : (
                      <em className="chair-free">空槽</em>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
