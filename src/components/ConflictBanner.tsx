import type { RuleConflict } from "../domain/rules";
import { bitePainLabels, statusLabels } from "./labels";

/** 冲突条：显示牙位、牙壁数、时段和原值 */
export function ConflictBanner({
  conflict,
  onDismiss,
}: {
  conflict: RuleConflict | null;
  onDismiss: () => void;
}) {
  if (!conflict) return null;
  const e = conflict.existing;

  return (
    <div className="conflict-banner" role="alert">
      <div className="conflict-title">
        <strong>⚠ 操作被规则拦截</strong>
        <button className="link-button" onClick={onDismiss} aria-label="关闭冲突提示">
          ×
        </button>
      </div>
      <p>{conflict.message}</p>
      <dl className="conflict-grid">
        <div>
          <dt>冲突牙位</dt>
          <dd>{conflict.toothNo}</dd>
        </div>
        <div>
          <dt>牙壁数</dt>
          <dd>{conflict.wallCount === null ? "—" : `${conflict.wallCount} 壁`}</dd>
        </div>
        <div>
          <dt>椅位时段</dt>
          <dd>{conflict.slotLabel ?? "未排椅位"}</dd>
        </div>
        {e && (
          <>
            <div>
              <dt>原状态</dt>
              <dd>{e.status ? statusLabels[e.status] : "—"}</dd>
            </div>
            <div>
              <dt>原暂封天数</dt>
              <dd>{e.temporaryDays === null ? "—" : `${e.temporaryDays} 天`}</dd>
            </div>
            <div>
              <dt>原咬合痛</dt>
              <dd>{e.bitePain ? bitePainLabels[e.bitePain] : "—"}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
