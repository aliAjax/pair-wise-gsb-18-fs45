import { useMemo, useState } from "react";
import "./styles.css";
import type { RuleConflict } from "./domain/rules";
import {
  MAX_TEMPORARY_DAYS,
  MIN_WALLS,
  isTemporaryOverdue,
  isWallInsufficient,
  slotLabelOf,
  temporaryDays,
} from "./domain/rules";
import { useHandoverStore } from "./state/useHandoverStore";
import { ConflictBanner } from "./components/ConflictBanner";
import { ChairBoard } from "./components/ChairBoard";
import { HandoverList } from "./components/HandoverList";
import { HandoverDetail } from "./components/HandoverDetail";
import { NewHandoverForm } from "./components/NewHandoverForm";

function MetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "ok" | "watch" | "danger";
  hint: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={`status-${tone}`} />
      <p className="metric-hint">{hint}</p>
    </article>
  );
}

function App() {
  const store = useHandoverStore();
  const { state } = store;
  const [selectedId, setSelectedId] = useState<string | null>(state.handovers[0]?.id ?? null);
  const [conflict, setConflict] = useState<RuleConflict | null>(null);

  const metrics = useMemo(() => {
    const active = state.handovers.filter((h) => h.status !== "confirmed");
    const blocked = active.filter(
      (h) => isWallInsufficient(h.coronal) || isTemporaryOverdue(h.coronal),
    );
    const overdue = active.filter((h) => isTemporaryOverdue(h.coronal));
    const occupied = state.slots.filter((s) => s.handoverId).length;
    return { active: active.length, blocked: blocked.length, overdue: overdue.length, occupied };
  }, [state]);

  const selected = state.handovers.find((h) => h.id === selectedId) ?? null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104 · 牙体牙髓</p>
          <h1>术后冠部封闭与修复移交台</h1>
          <p className="subtitle">
            按牙位登记暂封天数、剩余牙壁数、咬合痛与椅位时段。牙壁不足或暂封超期只能转加固会诊，
            不能确认修复；同一牙位只留一张待移交单，椅位一时段只排一颗牙，改约先释放占用。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>资料 / 判定 / 页面分层，无新增依赖，localStorage 持久化</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="待移交牙位"
          value={String(metrics.active)}
          tone="ok"
          hint="待移交 + 加固会诊（未确认修复）"
        />
        <MetricCard
          label="只能加固会诊"
          value={String(metrics.blocked)}
          tone="danger"
          hint={`牙壁不足或暂封超 ${MAX_TEMPORARY_DAYS} 天`}
        />
        <MetricCard
          label="暂封超期"
          value={String(metrics.overdue)}
          tone="watch"
          hint={`暂封超过 ${MAX_TEMPORARY_DAYS} 天`}
        />
        <MetricCard
          label="椅位占用"
          value={`${metrics.occupied}/${state.slots.length}`}
          tone="ok"
          hint="每个时段只排一颗牙"
        />
      </section>

      <ConflictBanner conflict={conflict} onDismiss={() => setConflict(null)} />

      <NewHandoverForm
        state={state}
        store={store}
        onCreated={(id) => setSelectedId(id)}
        onConflict={setConflict}
      />

      <section className="workspace handover-workspace">
        <HandoverList state={state} selectedId={selectedId} onSelect={setSelectedId} />
        <HandoverDetail
          state={state}
          handover={selected}
          store={store}
          onConflict={setConflict}
        />
      </section>

      <ChairBoard state={state} selectedHandoverId={selectedId} />

      <footer className="panel rules-note">
        <h2>规则速览</h2>
        <ul>
          <li>
            牙位登记：暂封天数、剩余牙壁数、咬合痛、椅位时段；暂封天数按登记日期每日推导，
            当前阈值为暂封 {MAX_TEMPORARY_DAYS} 天、剩余牙壁 ≥ {MIN_WALLS} 壁。
          </li>
          <li>牙壁不足或暂封超期：只能转加固会诊，「确认修复」按钮禁用。</li>
          <li>同一牙位只留一张未完结待移交单；重复登记会提示牙位、牙壁数、时段和原值。</li>
          <li>椅位一时段只排一颗牙；占用冲突会提示牙位、牙壁数、时段和原值。</li>
          <li>改约必须先「释放占用」，再排入新时段。</li>
          <li>修复确认后冻结冠部记录；复开保留旧值、原因和日期，修订链只增不改。</li>
          <li>
            {selected
              ? `当前选中：${selected.toothNo} · 暂封 ${temporaryDays(selected.coronal.sealedOn)} 天 · ${
                  slotLabelOf(state, selected.slotId) ?? "未排椅位"
                }`
              : "未选择牙位"}
          </li>
        </ul>
      </footer>
    </main>
  );
}

export default App;
