// 页面层：冲突台。冲突统一展示牙位、牙壁数、时段和原值。

import type { Conflict } from "../data/types";
import { slotLabel } from "../data/reference";

const KIND_TEXT: Record<Conflict["kind"], string> = {
  tooth: "牙位冲突",
  slot: "椅位冲突",
  frozen: "冻结冲突",
  blocked: "判定阻断",
  data: "资料问题",
};

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="conflict-meta">
      <b>{label}</b>
      {value}
    </span>
  );
}

export default function ConflictView({
  conflict,
  onDismiss,
}: {
  conflict: Conflict | null;
  onDismiss: () => void;
}) {
  if (!conflict) return null;
  return (
    <section className={`conflict-banner kind-${conflict.kind}`} role="alert">
      <div className="conflict-head">
        <span className="conflict-tag">{KIND_TEXT[conflict.kind]}</span>
        <h3>{conflict.title}</h3>
        <button className="ghost" onClick={onDismiss} aria-label="关闭冲突提示">
          ×
        </button>
      </div>
      <p>{conflict.detail}</p>
      <div className="conflict-metas">
        <Meta label="牙位" value={conflict.toothCode} />
        <Meta label="牙壁数" value={conflict.wallCount === null ? "—" : `${conflict.wallCount} 壁`} />
        <Meta label="时段" value={slotLabel(conflict.slotId)} />
      </div>
      {conflict.blockers && conflict.blockers.length > 0 && (
        <ul className="conflict-blockers">
          {conflict.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {conflict.changes && conflict.changes.length > 0 && (
        <table className="conflict-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>原值</th>
              <th>冲突值 / 结果</th>
            </tr>
          </thead>
          <tbody>
            {conflict.changes.map((c) => (
              <tr key={c.field}>
                <td>{c.field}</td>
                <td className="old-value">{c.before}</td>
                <td className="new-value">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
