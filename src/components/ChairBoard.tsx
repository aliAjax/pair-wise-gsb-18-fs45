import type { AppState } from "../data/types";

/** 椅位时段板：一个时段只排一颗牙；在详情中改约前先释放占用 */
export function ChairBoard({
  state,
  selectedHandoverId,
}: {
  state: AppState;
  selectedHandoverId: string | null;
}) {
  return (
    <section className="panel chair-board">
      <div className="section-heading">
        <div>
          <p>椅位排程</p>
          <h2>椅位时段</h2>
        </div>
        <span className="hint">每个时段只排一颗牙</span>
      </div>
      <div className="slot-list">
        {state.slots.map((slot) => {
          const occupiedHere =
            slot.handoverId !== null && slot.handoverId === selectedHandoverId;
          return (
            <article
              key={slot.id}
              className={`slot-card ${slot.handoverId ? "taken" : "free"} ${
                occupiedHere ? "mine" : ""
              }`}
            >
              <div className="slot-label">{slot.label}</div>
              <div className="slot-tooth">
                {slot.toothNo ? (
                  <>
                    <strong>{slot.toothNo}</strong>
                    <span>{occupiedHere ? "当前单占用" : "已排牙"}</span>
                  </>
                ) : (
                  <>
                    <strong className="muted">空闲</strong>
                    <span>可排入</span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
