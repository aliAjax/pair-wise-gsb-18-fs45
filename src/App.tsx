// 页面层：术后冠部封闭与修复移交台（组装 + 状态调度；规则全部来自 domain）

import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { AppState, Conflict } from "./data/types";
import { loadState, resetState, saveState } from "./data/storage";
import { slotLabel } from "./data/reference";
import {
  confirmRestoration,
  reactivate,
  reconcile,
  registerForm,
  releaseSlot,
  reschedule,
  reopenForm,
  reviseData,
  reinforce,
  summarize,
  type DraftInput,
} from "./domain/rules";
import Metrics from "./ui/Metrics";
import RegisterForm from "./ui/RegisterForm";
import ChairBoard from "./ui/ChairBoard";
import FormCard, { type FormActions } from "./ui/FormCard";
import ConflictView from "./ui/ConflictView";

const project = {
  id: "hxwl-04",
  port: 5104,
  title: "术后冠部封闭与修复移交台",
  subtitle: "牙位登记暂封与牙壁，判定修复或加固会诊；一牙一单、一椅一牙，冻结留痕",
};

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [bootIssues, setBootIssues] = useState<Conflict[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registerNonce, setRegisterNonce] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const reconciledRef = useRef(false);

  // 刷新后一致性校验：牙位、椅位、暂封、修订链
  useEffect(() => {
    if (reconciledRef.current) return;
    reconciledRef.current = true;
    setState((current) => {
      const result = reconcile(current);
      if (result.issues.length > 0) setBootIssues(result.issues);
      return result.state;
    });
  }, []);

  useEffect(() => {
    saveState(state);
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  }, [state]);

  const summary = useMemo(() => summarize(state), [state]);
  const selectedStillExists = selectedId && state.forms.some((f) => f.id === selectedId);

  const sortedForms = useMemo(
    () =>
      [...state.forms].sort((a, b) => {
        const order = { pending: 0, reinforced: 1, confirmed: 2 } as const;
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);
      }),
    [state],
  );

  function applyResult(outcome: ReturnType<typeof registerForm>): boolean {
    if (outcome.ok) {
      setState(outcome.state);
      setConflict(null);
      return true;
    }
    // 改约遇冲突：先落地“已释放”状态，再展示冲突
    if (outcome.releasedState) setState(outcome.releasedState);
    setConflict(outcome.conflict);
    return false;
  }

  const actions: FormActions = {
    onSelect: (id) => setSelectedId((cur) => (cur === id ? null : id)),
    onRelease: (id) => applyResult(releaseSlot(state, id)),
    onReinforce: (id, reason) => {
      if (applyResult(reinforce(state, id, reason))) setSelectedId(null);
    },
    onConfirm: (id) => {
      if (applyResult(confirmRestoration(state, id))) setSelectedId(null);
    },
    onReopen: (id, reason) => {
      if (applyResult(reopenForm(state, id, reason))) setSelectedId(null);
    },
    onReactivate: (id, slotId) => {
      if (applyResult(reactivate(state, id, slotId))) setSelectedId(null);
    },
    onRevise: (id, patch) => applyResult(reviseData(state, id, patch)),
  };

  function handleRegister(draft: DraftInput) {
    const ok = applyResult(registerForm(state, draft));
    if (ok) setRegisterNonce((n) => n + 1);
  }

  function handleOccupy(slotId: string) {
    if (!selectedId) return;
    applyResult(reschedule(state, selectedId, slotId));
  }

  function handleReset() {
    setState(resetState());
    setConflict(null);
    setBootIssues([]);
    setSelectedId(null);
    setRegisterNonce((n) => n + 1);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port} · 牙体牙髓
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
          <div className="rule-strip">
            <span>① 牙壁不足 / 暂封超期 → 仅加固会诊</span>
            <span>② 一牙一张待移交单</span>
            <span>③ 一椅一颗牙，改约先释放</span>
            <span>④ 确认即冻结，复开保留旧值与原因</span>
          </div>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span className="stack-note">资料层 data / 判定层 domain / 页面层 ui，零新增依赖</span>
        </div>
      </section>

      <Metrics summary={summary} />

      <ConflictView conflict={conflict} onDismiss={() => setConflict(null)} />

      {bootIssues.length > 0 && (
        <section className="boot-panel" role="status">
          <div className="boot-head">
            <h3>刷新一致性校验：发现 {bootIssues.length} 处冲突，已自动收敛</h3>
            <button type="button" className="ghost" onClick={() => setBootIssues([])}>
              知道了
            </button>
          </div>
          <ul>
            {bootIssues.map((issue, i) => (
              <li key={i}>
                <b>[{issue.title}]</b> {issue.toothCode} · 牙壁{" "}
                {issue.wallCount === null ? "—" : `${issue.wallCount} 壁`} · 时段{" "}
                {slotLabel(issue.slotId)} — {issue.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="workspace workspace-handover">
        <RegisterForm key={registerNonce} onRegister={handleRegister} />
        <ChairBoard
          state={state}
          selectedId={selectedStillExists ? selectedId : null}
          onSelect={setSelectedId}
          onOccupy={handleOccupy}
        />
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>待移交单 · 一牙一单</p>
            <h2>牙位列（{state.forms.length}）</h2>
          </div>
        </div>
        <div className="form-list">
          {sortedForms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              selected={selectedId === form.id}
              actions={actions}
            />
          ))}
        </div>
      </section>

      <footer className="foot">
        <span>
          持久化：localStorage · 最近保存 {savedAt ?? "—"} · 刷新后牙位、椅位、暂封与修订链自动校验
        </span>
        <button type="button" className="ghost" onClick={handleReset}>
          重置演示资料
        </button>
      </footer>
    </main>
  );
}
