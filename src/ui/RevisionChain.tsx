// 页面层：修订链（冻结与复开事件保留旧值、原因、日期）

import type { RevisionEvent } from "../data/types";
import { slotLabel } from "../data/reference";

const ACTION_LABEL: Record<RevisionEvent["action"], string> = {
  register: "登记",
  revise: "资料修订",
  reschedule: "改约",
  release: "释放椅位",
  reinforce: "转加固会诊",
  reactivate: "回到待移交",
  confirm: "确认修复·冻结",
  reopen: "复开",
};

const ACTION_TONE: Record<RevisionEvent["action"], string> = {
  register: "ev-register",
  revise: "ev-revise",
  reschedule: "ev-reschedule",
  release: "ev-release",
  reinforce: "ev-reinforce",
  reactivate: "ev-reactivate",
  confirm: "ev-confirm",
  reopen: "ev-reopen",
};

export default function RevisionChain({
  revisions,
  open,
  onToggle,
}: {
  revisions: RevisionEvent[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="chain">
      <button type="button" className="chain-toggle" onClick={onToggle}>
        {open ? "▾" : "▸"} 修订链 · {revisions.length} 条
      </button>
      {open && (
        <ol className="chain-list">
          {[...revisions].reverse().map((ev) => (
            <li key={ev.seq} className={`chain-event ${ACTION_TONE[ev.action]}`}>
              <div className="chain-event-head">
                <span className="chain-seq">#{ev.seq}</span>
                <span className="chain-action">{ACTION_LABEL[ev.action]}</span>
                <time>{ev.at}</time>
              </div>
              {ev.reason && <p className="chain-reason">原因：{ev.reason}</p>}
              {ev.action === "confirm" && ev.snapshot && (
                <p className="chain-snapshot">
                  冻结旧值：{ev.snapshot.toothCode} · {ev.snapshot.tempSealDays} 天 ·{" "}
                  {ev.snapshot.wallCount} 壁 · {slotLabel(ev.snapshot.slotId)}
                </p>
              )}
              {ev.action === "reopen" && ev.snapshot && (
                <p className="chain-snapshot">
                  保留旧值：{ev.snapshot.toothCode} · {ev.snapshot.tempSealDays} 天 ·{" "}
                  {ev.snapshot.wallCount} 壁 · {slotLabel(ev.snapshot.slotId)}
                </p>
              )}
              {ev.changes && ev.changes.length > 0 && (
                <ul className="chain-changes">
                  {ev.changes.map((c) => (
                    <li key={c.field}>
                      {c.field}：{c.before} → <b>{c.after}</b>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
