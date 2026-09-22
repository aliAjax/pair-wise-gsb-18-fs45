import { useMemo, useState } from "react";
import type { AppState, BitePain, Handover } from "../data/types";
import type { HandoverStore } from "../state/useHandoverStore";
import type { RuleConflict } from "../domain/rules";
import {
  MAX_TEMPORARY_DAYS,
  MIN_WALLS,
  restorationBlockers,
  slotLabelOf,
  temporaryDays,
} from "../domain/rules";
import { bitePainLabels, bitePainOrder, statusLabels } from "./labels";

function parseBoundedInt(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  if (n < min || n > max) return null;
  return n;
}

/** 冠部登记表单字段：牙壁数、暂封天数、咬合痛 */
function CoronalFields({
  wallRaw,
  daysRaw,
  bite,
  onWall,
  onDays,
  onBite,
  disabled,
}: {
  wallRaw: string;
  daysRaw: string;
  bite: BitePain;
  onWall: (v: string) => void;
  onDays: (v: string) => void;
  onBite: (v: BitePain) => void;
  disabled?: boolean;
}) {
  return (
    <div className="field-grid">
      <label>
        <span>剩余牙壁数（少于 {MIN_WALLS} 壁需加固会诊）</span>
        <input
          inputMode="numeric"
          value={wallRaw}
          disabled={disabled}
          onChange={(e) => onWall(e.target.value)}
          placeholder="0–4 壁"
        />
      </label>
      <label>
        <span>暂封天数（上限 {MAX_TEMPORARY_DAYS} 天）</span>
        <input
          inputMode="numeric"
          value={daysRaw}
          disabled={disabled}
          onChange={(e) => onDays(e.target.value)}
          placeholder="0–99 天"
        />
      </label>
      <label>
        <span>咬合痛</span>
        <select
          value={bite}
          disabled={disabled}
          onChange={(e) => onBite(e.target.value as BitePain)}
        >
          {bitePainOrder.map((v) => (
            <option key={v} value={v}>
              {bitePainLabels[v]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function RevisionChain({ handover }: { handover: Handover }) {
  if (handover.revisions.length === 0) {
    return <p className="hint">暂无复开修订。</p>;
  }
  return (
    <ol className="revision-chain">
      {handover.revisions.map((r, i) => (
        <li key={`${r.reopenedOn}-${i}`}>
          <div className="revision-head">
            <strong>第 {i + 1} 次复开</strong>
            <span>{r.reopenedOn}</span>
          </div>
          <p className="revision-reason">原因：{r.reason}</p>
          <dl className="revision-old">
            <div>
              <dt>原牙壁数</dt>
              <dd>{r.snapshot.wallCount} 壁</dd>
            </div>
            <div>
              <dt>原暂封天数</dt>
              <dd>{r.snapshot.temporaryDaysAtFreeze} 天</dd>
            </div>
            <div>
              <dt>原暂封登记日</dt>
              <dd>{r.snapshot.sealedOn}</dd>
            </div>
            <div>
              <dt>原咬合痛</dt>
              <dd>{bitePainLabels[r.snapshot.bitePain]}</dd>
            </div>
            <div>
              <dt>原确认日期</dt>
              <dd>{r.snapshot.frozenOn}</dd>
            </div>
            <div>
              <dt>原椅位时段</dt>
              <dd>{r.slotId ?? "未排椅位"}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function HandoverDetail({
  state,
  handover,
  store,
  onConflict,
}: {
  state: AppState;
  handover: Handover | null;
  store: HandoverStore;
  onConflict: (c: RuleConflict) => void;
}) {
  if (!handover) {
    return (
      <section className="panel detail-panel empty-detail">
        <p className="hint">从左侧选择一张待移交单，或登记新牙位。</p>
      </section>
    );
  }

  return (
    <DetailInner
      key={handover.id}
      state={state}
      handover={handover}
      store={store}
      onConflict={onConflict}
    />
  );
}

function DetailInner({
  state,
  handover,
  store,
  onConflict,
}: {
  state: AppState;
  handover: Handover;
  store: HandoverStore;
  onConflict: (c: RuleConflict) => void;
}) {
  const daysNow = temporaryDays(handover.coronal.sealedOn);

  const [wallRaw, setWallRaw] = useState(String(handover.coronal.wallCount));
  const [daysRaw, setDaysRaw] = useState(String(daysNow));
  const [bite, setBite] = useState<BitePain>(handover.coronal.bitePain);
  const [notice, setNotice] = useState<string | null>(null);

  const [consultWallRaw, setConsultWallRaw] = useState(
    String(Math.max(handover.coronal.wallCount, MIN_WALLS)),
  );
  const [consultDaysRaw, setConsultDaysRaw] = useState("0");
  const [consultBite, setConsultBite] = useState<BitePain>(handover.coronal.bitePain);

  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [targetSlot, setTargetSlot] = useState(
    state.slots.find((s) => !s.handoverId)?.id ?? "",
  );

  const blockers = useMemo(
    () => (handover.status === "pending" ? restorationBlockers(handover.coronal) : []),
    [handover],
  );

  const wall = parseBoundedInt(wallRaw, 0, 4);
  const days = parseBoundedInt(daysRaw, 0, 99);
  const consultWall = parseBoundedInt(consultWallRaw, 0, 4);
  const consultDays = parseBoundedInt(consultDaysRaw, 0, 99);

  const flag = (result: ReturnType<HandoverStore["bookSlot"]>, okText?: string) => {
    if (result.ok) {
      if (okText) setNotice(okText);
    } else {
      onConflict(result.conflict);
    }
  };

  const freeSlots = state.slots.filter((s) => !s.handoverId);
  const currentSlotLabel = slotLabelOf(state, handover.slotId);

  const saveCoronal = () => {
    if (wall === null || days === null) {
      setNotice("请填写有效的牙壁数（0–4）和暂封天数（0–99）。");
      return;
    }
    flag(
      store.updateCoronal(handover.id, { wallCount: wall, temporaryDays: days, bitePain: bite }),
      "冠部登记已更新。",
    );
  };

  const doConsultComplete = () => {
    if (consultWall === null || consultDays === null) {
      setNotice("请填写会诊后有效的牙壁数（0–4）和暂封天数（0–99）。");
      return;
    }
    flag(
      store.completeConsult(handover.id, {
        wallCount: consultWall,
        temporaryDays: consultDays,
        bitePain: consultBite,
      }),
      "加固会诊结果已登记，单子回到待移交。",
    );
  };

  const doReopen = () => {
    if (!reopenReason.trim()) {
      setReopenError("复开必须填写原因，旧值、原因和日期将记入修订链。");
      return;
    }
    const result = store.reopenHandover(handover.id, reopenReason);
    if (result.ok) {
      setReopenError(null);
      setReopenReason("");
      setNotice("已复开，旧值与原因已保留进修订链。");
    } else {
      onConflict(result.conflict);
    }
  };

  return (
    <section className="panel detail-panel">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{handover.toothNo}</p>
          <h2>术后冠部封闭与修复移交</h2>
          <p className="handover-diagnosis">{handover.diagnosis}</p>
        </div>
        <span className={`badge badge-${handover.status}`}>{statusLabels[handover.status]}</span>
      </div>

      {notice && <p className="inline-notice">{notice}</p>}

      {/* 椅位排程：只排一颗牙；改约先释放占用 */}
      <div className="slot-control">
        <div className="slot-current">
          <span>椅位时段</span>
          <strong>{currentSlotLabel ?? "未排椅位（待排入）"}</strong>
        </div>
        {handover.slotId && (
          <button
            onClick={() => flag(store.releaseSlot(handover.id), "已释放椅位占用，可改排其它时段。")}
          >
            释放占用
          </button>
        )}
        {!handover.slotId && (
          <div className="slot-booking">
            <select value={targetSlot} onChange={(e) => setTargetSlot(e.target.value)}>
              {freeSlots.length === 0 && <option value="">暂无空闲时段</option>}
              {freeSlots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}（空闲）
                </option>
              ))}
            </select>
            <button
              disabled={!targetSlot}
              onClick={() => flag(store.bookSlot(handover.id, targetSlot), "已排入该椅位时段。")}
            >
              排入时段
            </button>
          </div>
        )}
        {handover.slotId && <span className="hint">改约请先点「释放占用」，再排入新时段</span>}
      </div>

      {handover.status === "pending" && (
        <>
          <CoronalFields
            wallRaw={wallRaw}
            daysRaw={daysRaw}
            bite={bite}
            onWall={setWallRaw}
            onDays={setDaysRaw}
            onBite={setBite}
          />
          {blockers.length > 0 ? (
            <div className="rule-block">
              <strong>不能确认修复：</strong>
              <ul>
                {blockers.includes("walls") && (
                  <li>剩余牙壁 {handover.coronal.wallCount} 壁，少于 {MIN_WALLS} 壁，需加固</li>
                )}
                {blockers.includes("temporary") && (
                  <li>暂封 {daysNow} 天，超过 {MAX_TEMPORARY_DAYS} 天上限</li>
                )}
              </ul>
              <p>只能转加固会诊，不能确认修复。</p>
            </div>
          ) : (
            <p className="rule-ok">
              牙壁 {handover.coronal.wallCount} 壁、暂封 {daysNow} 天，满足修复确认条件。
            </p>
          )}
          <div className="action-row">
            <button onClick={saveCoronal}>保存冠部登记</button>
            <button
              className="warn-action"
              onClick={() => flag(store.referToConsult(handover.id), "已转加固会诊。")}
            >
              转加固会诊
            </button>
            <button
              className="primary-action"
              disabled={blockers.length > 0}
              onClick={() =>
                flag(store.confirmRestoration(handover.id), "修复已确认，冠部记录冻结。")
              }
            >
              确认修复并冻结
            </button>
          </div>
        </>
      )}

      {handover.status === "consult" && (
        <>
          <div className="rule-block">
            <strong>加固会诊中</strong>
            <p>
              冠部登记只读：剩余 {handover.coronal.wallCount} 壁、暂封 {daysNow} 天、
              {bitePainLabels[handover.coronal.bitePain]}。
            </p>
            <p>会诊加固完成后登记新牙壁数，通过判定再确认修复。</p>
          </div>
          <h3>登记加固会诊结果</h3>
          <CoronalFields
            wallRaw={consultWallRaw}
            daysRaw={consultDaysRaw}
            bite={consultBite}
            onWall={setConsultWallRaw}
            onDays={setConsultDaysRaw}
            onBite={setConsultBite}
          />
          <div className="action-row">
            <button
              className="primary-action"
              onClick={doConsultComplete}
            >
              会诊完成，回到待移交
            </button>
          </div>
        </>
      )}

      {handover.status === "confirmed" && handover.frozen && (
        <>
          <div className="frozen-box">
            <div className="frozen-head">
              <strong>冠部记录已冻结</strong>
              <span>确认日期 {handover.confirmedOn}</span>
            </div>
            <dl className="revision-old">
              <div>
                <dt>牙壁数</dt>
                <dd>{handover.frozen.wallCount} 壁</dd>
              </div>
              <div>
                <dt>暂封天数</dt>
                <dd>{handover.frozen.temporaryDaysAtFreeze} 天</dd>
              </div>
              <div>
                <dt>暂封登记日</dt>
                <dd>{handover.frozen.sealedOn}</dd>
              </div>
              <div>
                <dt>咬合痛</dt>
                <dd>{bitePainLabels[handover.frozen.bitePain]}</dd>
              </div>
            </dl>
          </div>

          <h3>复开（保留旧值、原因和日期）</h3>
          <label>
            <span>复开原因（必填）</span>
            <input
              value={reopenReason}
              onChange={(e) => {
                setReopenReason(e.target.value);
                setReopenError(null);
              }}
              placeholder="如：修复体边缘渗漏需复查"
            />
          </label>
          {reopenError && <p className="inline-error">{reopenError}</p>}
          <div className="action-row">
            <button className="warn-action" onClick={doReopen}>
              复开冠部记录
            </button>
          </div>
        </>
      )}

      <div className="revisions">
        <h3>修订链</h3>
        <RevisionChain handover={handover} />
      </div>
    </section>
  );
}
