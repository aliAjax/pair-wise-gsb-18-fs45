// 页面层：待移交单卡片。一张单子一张卡；操作按钮按状态与判定结果启停。

import { useState } from "react";
import type { FormData, HandoverForm } from "../data/types";
import { BITE_PAIN_OPTIONS, CHAIR_SLOTS, bitePainLabel, slotLabel } from "../data/reference";
import {
  MAX_TEMP_SEAL_DAYS,
  MIN_WALLS,
  evaluateEligibility,
} from "../domain/rules";
import RevisionChain from "./RevisionChain";

const STATUS_TEXT: Record<HandoverForm["status"], string> = {
  pending: "待移交",
  reinforced: "加固会诊",
  confirmed: "已确认修复 · 冻结",
};

export interface FormActions {
  onSelect: (id: string) => void;
  onRelease: (id: string) => void;
  onReinforce: (id: string, reason: string) => void;
  onConfirm: (id: string) => void;
  onReopen: (id: string, reason: string) => void;
  onReactivate: (id: string, slotId: string | null) => void;
  onRevise: (id: string, patch: Partial<Omit<FormData, "toothCode">>) => void;
}

export default function FormCard({
  form,
  selected,
  actions,
}: {
  form: HandoverForm;
  selected: boolean;
  actions: FormActions;
}) {
  const [chainOpen, setChainOpen] = useState(false);
  const [showReinforce, setShowReinforce] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [reason, setReason] = useState("");
  const [returnSlot, setReturnSlot] = useState("");
  const [editDays, setEditDays] = useState(String(form.data.tempSealDays));
  const [editWalls, setEditWalls] = useState(String(form.data.wallCount));
  const [editPain, setEditPain] = useState(form.data.bitePain);

  const { canConfirm, blockers } = evaluateEligibility(form.data);
  const frozen = form.status === "confirmed";
  const reinforced = form.status === "reinforced";

  function applyRevise() {
    const days = Number(editDays);
    const walls = Number(editWalls);
    const patch: Partial<Omit<FormData, "toothCode">> = { bitePain: editPain };
    if (Number.isInteger(days) && days >= 0 && days <= 365) patch.tempSealDays = days;
    if (Number.isInteger(walls) && walls >= 0 && walls <= 4) patch.wallCount = walls;
    actions.onRevise(form.id, patch);
  }

  return (
    <article
      className={[
        "form-card",
        `status-${form.status}`,
        selected ? "selected" : "",
        canConfirm && form.status === "pending" ? "eligible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="form-head">
        <div>
          <span className={`form-status status-pill-${form.status}`}>{STATUS_TEXT[form.status]}</span>
          <h3>{form.data.toothCode}</h3>
        </div>
        <div className="form-meta">
          <span>单号 {form.id}</span>
          <span>登记 {form.createdAt}</span>
          {frozen && form.frozenAt && <span className="frozen-date">冻结于 {form.frozenAt}</span>}
        </div>
      </header>

      <div className="form-data">
        <div className="data-item">
          <span>暂封天数</span>
          {reinforced ? (
            <input
              type="number"
              min={0}
              max={365}
              value={editDays}
              onChange={(e) => setEditDays(e.target.value)}
            />
          ) : (
            <strong className={form.data.tempSealDays > MAX_TEMP_SEAL_DAYS ? "bad" : ""}>
              {form.data.tempSealDays} 天
            </strong>
          )}
        </div>
        <div className="data-item">
          <span>牙壁数</span>
          {reinforced ? (
            <input
              type="number"
              min={0}
              max={4}
              value={editWalls}
              onChange={(e) => setEditWalls(e.target.value)}
            />
          ) : (
            <strong className={form.data.wallCount < MIN_WALLS ? "bad" : ""}>
              {form.data.wallCount} 壁
            </strong>
          )}
        </div>
        <div className="data-item">
          <span>咬合痛</span>
          {reinforced ? (
            <select value={editPain} onChange={(e) => setEditPain(e.target.value as typeof editPain)}>
              {BITE_PAIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <strong>{bitePainLabel(form.data.bitePain)}</strong>
          )}
        </div>
        <div className="data-item">
          <span>椅位时段</span>
          <strong className={form.slotId ? "" : "muted-strong"}>{slotLabel(form.slotId)}</strong>
        </div>
      </div>

      {form.status === "pending" && (
        canConfirm ? (
          <p className="form-verdict ok">✓ 牙壁 ≥ {MIN_WALLS} 壁且暂封 ≤ {MAX_TEMP_SEAL_DAYS} 天，可确认修复。</p>
        ) : (
          <p className="form-verdict bad">✕ {blockers.join("；")} —— 只能转加固会诊，不能确认修复。</p>
        )
      )}
      {reinforced && <p className="form-verdict warn">加固会诊中：椅位已释放；补齐牙壁后回单并重新判定。</p>}
      {frozen && (
        <p className="form-verdict frozen">
          冠部记录已冻结，旧值保留在修订链；复开需登记原因，椅位重新预约。
        </p>
      )}

      {reinforced && (
        <div className="inline-bar">
          <button type="button" className="ghost" onClick={applyRevise}>
            保存修订资料
          </button>
          <button type="button" className="ghost" onClick={() => setShowReturn((v) => !v)}>
            {showReturn ? "收起回单" : "加固完成·回到待移交"}
          </button>
        </div>
      )}

      {showReturn && (
        <div className="reason-box">
          <select value={returnSlot} onChange={(e) => setReturnSlot(e.target.value)}>
            <option value="">暂不排班</option>
            {CHAIR_SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.dateLabel.split("（")[0]} {s.label}（{s.timeRange}）
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              actions.onReactivate(form.id, returnSlot || null);
              setShowReturn(false);
              setReturnSlot("");
            }}
          >
            回到待移交
          </button>
        </div>
      )}

      <div className="form-actions">
        {form.status === "pending" && (
          <>
            <button
              type="button"
              className={selected ? "primary-action" : ""}
              onClick={() => actions.onSelect(form.id)}
            >
              {selected ? "已选中·点椅位槽" : "改约 / 排椅位"}
            </button>
            {form.slotId && (
              <button type="button" className="ghost" onClick={() => actions.onRelease(form.id)}>
                释放椅位
              </button>
            )}
            <button type="button" className="warn-action" onClick={() => setShowReinforce((v) => !v)}>
              转加固会诊
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!canConfirm || !form.slotId}
              title={!form.slotId ? "请先排椅位时段" : canConfirm ? "" : blockers.join("；")}
              onClick={() => actions.onConfirm(form.id)}
            >
              确认修复
            </button>
          </>
        )}
        {frozen && (
          <button type="button" className="warn-action" onClick={() => setShowReopen((v) => !v)}>
            复开（保留旧值）
          </button>
        )}
      </div>

      {showReinforce && (
        <div className="reason-box">
          <input
            placeholder="会诊原因：如近中壁缺失需桩核加固 / 暂封超期重新封药"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="warn-action"
            onClick={() => {
              actions.onReinforce(form.id, reason);
              setReason("");
              setShowReinforce(false);
            }}
          >
            确认转出（释放椅位）
          </button>
        </div>
      )}

      {showReopen && (
        <div className="reason-box">
          <input
            placeholder="复开原因：如修复体脱落 / 复查发现继发问题"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="warn-action"
            onClick={() => {
              actions.onReopen(form.id, reason);
              setReason("");
              setShowReopen(false);
            }}
          >
            确认复开
          </button>
        </div>
      )}

      <RevisionChain revisions={form.revisions} open={chainOpen} onToggle={() => setChainOpen((v) => !v)} />
    </article>
  );
}
