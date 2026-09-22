import { useState } from "react";
import type { AppState, BitePain } from "../data/types";
import type { HandoverStore } from "../state/useHandoverStore";
import type { RuleConflict } from "../domain/rules";
import { MAX_TEMPORARY_DAYS, MIN_WALLS } from "../domain/rules";
import { bitePainLabels, bitePainOrder } from "./labels";

function parseInt10(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  if (n < min || n > max) return null;
  return n;
}

/** 新牙位登记：暂封天数、牙壁数、咬合痛、椅位时段；一牙一单，椅位只排一颗 */
export function NewHandoverForm({
  state,
  store,
  onCreated,
  onConflict,
}: {
  state: AppState;
  store: HandoverStore;
  onCreated: (id: string) => void;
  onConflict: (c: RuleConflict) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toothNo, setToothNo] = useState("#");
  const [diagnosis, setDiagnosis] = useState("");
  const [wallRaw, setWallRaw] = useState("3");
  const [daysRaw, setDaysRaw] = useState("0");
  const [bite, setBite] = useState<BitePain>("none");
  const [slotId, setSlotId] = useState(
    state.slots.find((s) => !s.handoverId)?.id ?? "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="new-handover-closed">
        <button className="primary-action" onClick={() => setOpen(true)}>
          登记新牙位
        </button>
      </div>
    );
  }

  const reset = () => {
    setToothNo("#");
    setDiagnosis("");
    setWallRaw("3");
    setDaysRaw("0");
    setBite("none");
    setSlotId(state.slots.find((s) => !s.handoverId)?.id ?? "");
    setFormError(null);
  };

  const submit = () => {
    const tooth = toothNo.trim().toUpperCase();
    if (!/^#?\d{1,2}$/.test(tooth)) {
      setFormError("牙位格式应为 # 加 1–2 位数字，如 #36。");
      return;
    }
    const wall = parseInt10(wallRaw, 0, 4);
    const days = parseInt10(daysRaw, 0, 99);
    if (wall === null) {
      setFormError(`牙壁数需为 0–4 的整数；少于 ${MIN_WALLS} 壁将只能转加固会诊。`);
      return;
    }
    if (days === null) {
      setFormError(`暂封天数需为 0–99 的整数；超过 ${MAX_TEMPORARY_DAYS} 天将只能转加固会诊。`);
      return;
    }

    const result = store.createHandover({
      toothNo: tooth,
      diagnosis: diagnosis || "术后冠部封闭待修复",
      wallCount: wall,
      temporaryDays: days,
      bitePain: bite,
      slotId: slotId || null,
    });

    if (result.ok) {
      reset();
      setOpen(false);
      if (result.handoverId) onCreated(result.handoverId);
    } else {
      onConflict(result.conflict);
    }
  };

  return (
    <section className="panel new-handover-form">
      <div className="section-heading">
        <div>
          <p>新牙位登记</p>
          <h2>登记术后冠部封闭</h2>
        </div>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          收起
        </button>
      </div>
      <div className="field-grid">
        <label>
          <span>牙位（同一牙位只留一张待移交单）</span>
          <input value={toothNo} onChange={(e) => setToothNo(e.target.value)} placeholder="#36" />
        </label>
        <label>
          <span>诊断 / 备注</span>
          <input
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="如：慢性根尖周炎，封药后"
          />
        </label>
        <label>
          <span>剩余牙壁数（少于 {MIN_WALLS} 壁需加固）</span>
          <input inputMode="numeric" value={wallRaw} onChange={(e) => setWallRaw(e.target.value)} />
        </label>
        <label>
          <span>暂封天数（{">"} {MAX_TEMPORARY_DAYS} 天超期）</span>
          <input inputMode="numeric" value={daysRaw} onChange={(e) => setDaysRaw(e.target.value)} />
        </label>
        <label>
          <span>咬合痛</span>
          <select value={bite} onChange={(e) => setBite(e.target.value as BitePain)}>
            {bitePainOrder.map((v) => (
              <option key={v} value={v}>
                {bitePainLabels[v]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>椅位时段（只排一颗牙）</span>
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
            <option value="">暂不排椅位</option>
            {state.slots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.handoverId !== null}>
                {s.label}
                {s.handoverId ? `（已排 ${s.toothNo}）` : "（空闲）"}
              </option>
            ))}
          </select>
        </label>
      </div>
      {formError && <p className="inline-error">{formError}</p>}
      <div className="action-row">
        <button className="primary-action" onClick={submit}>
          建立待移交单
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          取消
        </button>
      </div>
    </section>
  );
}
