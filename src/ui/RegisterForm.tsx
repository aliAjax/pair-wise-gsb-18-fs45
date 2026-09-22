// 页面层：牙位登记表。登记暂封天数、牙壁数、咬合痛、椅位时段；
// 牙壁不足 / 暂封超期时仅提示“只能转加固会诊”，登记本身不被阻断（确认才阻断）。

import { useMemo, useState } from "react";
import type { BitePain } from "../data/types";
import { BITE_PAIN_OPTIONS, CHAIR_SLOTS } from "../data/reference";
import { MAX_TEMP_SEAL_DAYS, MIN_WALLS, evaluateEligibility, type DraftInput } from "../domain/rules";

export default function RegisterForm({
  onRegister,
}: {
  onRegister: (draft: DraftInput) => void;
}) {
  const [toothCode, setToothCode] = useState("");
  const [tempSealDays, setTempSealDays] = useState("");
  const [wallCount, setWallCount] = useState("");
  const [bitePain, setBitePain] = useState<BitePain>("none");
  const [slotId, setSlotId] = useState<string>("");

  const daysNum = tempSealDays === "" ? null : Number(tempSealDays);
  const wallsNum = wallCount === "" ? null : Number(wallCount);

  const eligibility = useMemo(
    () =>
      evaluateEligibility({
        toothCode: toothCode || "#00",
        tempSealDays: daysNum ?? 0,
        wallCount: wallsNum ?? 0,
        bitePain,
      }),
    [toothCode, daysNum, wallsNum, bitePain],
  );

  const daysTouched = daysNum !== null;
  const wallsTouched = wallsNum !== null;
  const toothValid = /^#?\d{2}$/.test(toothCode.trim());

  function reset() {
    setToothCode("");
    setTempSealDays("");
    setWallCount("");
    setBitePain("none");
    setSlotId("");
  }

  function submit() {
    onRegister({
      toothCode,
      tempSealDays: daysNum,
      wallCount: wallsNum,
      bitePain,
      slotId: slotId || null,
    });
    // 成功后由 App 通过 key 重挂载清空；冲突时保留输入
  }

  const dayGroups = CHAIR_SLOTS.reduce<Record<string, typeof CHAIR_SLOTS>>((acc, s) => {
    (acc[s.dateLabel] ??= []).push(s);
    return acc;
  }, {});

  return (
    <section className="panel register-panel">
      <div className="section-heading">
        <div>
          <p>术后冠部封闭</p>
          <h2>牙位登记</h2>
        </div>
        <button type="button" className="ghost" onClick={reset}>
          清空
        </button>
      </div>

      <div className="field-grid">
        <label className={toothCode && !toothValid ? "invalid" : ""}>
          <span>牙位（FDI 两位数字）</span>
          <input
            value={toothCode}
            placeholder="如 36 或 #36"
            maxLength={3}
            onChange={(e) => setToothCode(e.target.value)}
          />
        </label>

        <label className={daysTouched && (daysNum! < 0 || daysNum! > 365) ? "invalid" : ""}>
          <span>暂封天数（0–365，上限 {MAX_TEMP_SEAL_DAYS} 天）</span>
          <input
            type="number"
            min={0}
            max={365}
            value={tempSealDays}
            placeholder="如 7"
            onChange={(e) => setTempSealDays(e.target.value)}
          />
        </label>

        <label className={wallsTouched && (wallsNum! < 0 || wallsNum! > 4) ? "invalid" : ""}>
          <span>剩余牙壁数（0–4，修复至少 {MIN_WALLS} 壁）</span>
          <input
            type="number"
            min={0}
            max={4}
            value={wallCount}
            placeholder="如 3"
            onChange={(e) => setWallCount(e.target.value)}
          />
        </label>

        <label>
          <span>咬合痛</span>
          <select value={bitePain} onChange={(e) => setBitePain(e.target.value as BitePain)}>
            {BITE_PAIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="slot-pick">
        <legend>椅位时段（一椅一牙，可暂不排班）</legend>
        <label className="slot-none">
          <input type="radio" checked={slotId === ""} onChange={() => setSlotId("")} />
          暂不排班
        </label>
        <div className="slot-days">
          {Object.entries(dayGroups).map(([day, slots]) => (
            <div key={day} className="slot-day">
              <span className="slot-day-label">{day}</span>
              <div className="slot-buttons">
                {slots.map((s) => (
                  <label key={s.id} className={slotId === s.id ? "slot chosen" : "slot"}>
                    <input
                      type="radio"
                      name="register-slot"
                      checked={slotId === s.id}
                      onChange={() => setSlotId(s.id)}
                    />
                    <span>{s.label}</span>
                    <small>{s.timeRange}</small>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {wallsTouched || daysTouched ? (
        eligibility.canConfirm ? (
          <p className="verdict verdict-ok">
            ✓ 牙壁与暂封符合修复条件；登记后可预约并确认修复。
          </p>
        ) : (
          <div className="verdict verdict-bad">
            <strong>✕ {eligibility.blockers.join("；")}</strong>
            <span>该牙登记后只能转加固会诊，不能确认修复。</span>
          </div>
        )
      ) : (
        <p className="verdict verdict-idle">填写暂封天数与牙壁数后即时判定。</p>
      )}

      <button type="button" className="primary-action wide" onClick={submit}>
        登记待移交单
      </button>
    </section>
  );
}
