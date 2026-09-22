// 判定层：冠部封闭移交规则。纯函数，不依赖 React / DOM / 存储。
//
// 规则要点：
// 1. 牙位登记暂封天数、牙壁数、咬合痛和椅位时段；
// 2. 牙壁不足或暂封超期 → 只能转加固会诊，不能确认修复；
// 3. 一个牙位只留一张待移交单；一张椅位时段只排一颗牙；改约先释放占用；
// 4. 修复确认后冻结冠部记录；复开保留旧值、原因和日期（修订链）。

import type {
  AppState,
  BitePain,
  Conflict,
  FormData,
  HandoverForm,
  OpOutcome,
  RevisionEvent,
  SerializedForm,
  ValueChange,
} from "../data/types";
import { bitePainLabel, slotLabel, CHAIR_SLOTS } from "../data/reference";
import { stamp, todayKey } from "../data/clock";

/** 修复所需最少剩余牙壁数 */
export const MIN_WALLS = 2;
/** 暂封允许的最大天数，超过即超期 */
export const MAX_TEMP_SEAL_DAYS = 14;

export interface Eligibility {
  canConfirm: boolean;
  blockers: string[];
}

export function evaluateEligibility(data: FormData): Eligibility {
  const blockers: string[] = [];
  if (data.wallCount < MIN_WALLS) {
    blockers.push(`剩余牙壁 ${data.wallCount} 壁，不足 ${MIN_WALLS} 壁，需先加固`);
  }
  if (data.tempSealDays > MAX_TEMP_SEAL_DAYS) {
    blockers.push(`暂封已 ${data.tempSealDays} 天，超过 ${MAX_TEMP_SEAL_DAYS} 天上限`);
  }
  return { canConfirm: blockers.length === 0, blockers };
}

// ---------------------------------------------------------------------------
// 值与差异
// ---------------------------------------------------------------------------

type FieldKey = keyof SerializedForm;

const FIELD_LABELS: Record<FieldKey, string> = {
  toothCode: "牙位",
  tempSealDays: "暂封天数",
  wallCount: "牙壁数",
  bitePain: "咬合痛",
  slotId: "椅位时段",
};

export function formatField(key: FieldKey, value: unknown): string {
  if (key === "slotId") return slotLabel((value as string | null) ?? null);
  if (key === "bitePain") return bitePainLabel(value as BitePain);
  if (key === "tempSealDays") return `${String(value)} 天`;
  if (key === "wallCount") return `${String(value)} 壁`;
  return String(value ?? "");
}

const COMPARE_KEYS: FieldKey[] = ["toothCode", "tempSealDays", "wallCount", "bitePain", "slotId"];

export function serialize(form: HandoverForm): SerializedForm {
  return { ...form.data, slotId: form.slotId };
}

export function diffForms(before: SerializedForm, after: SerializedForm): ValueChange[] {
  const changes: ValueChange[] = [];
  for (const key of COMPARE_KEYS) {
    const rawBefore = before[key];
    const rawAfter = after[key];
    if (JSON.stringify(rawBefore) !== JSON.stringify(rawAfter)) {
      changes.push({
        field: FIELD_LABELS[key],
        before: formatField(key, rawBefore),
        after: formatField(key, rawAfter),
      });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// 查找工具
// ---------------------------------------------------------------------------

export function findForm(state: AppState, formId: string): HandoverForm | undefined {
  return state.forms.find((f) => f.id === formId);
}

function findByTooth(state: AppState, toothCode: string): HandoverForm | undefined {
  return state.forms.find((f) => f.data.toothCode === toothCode);
}

function slotHolder(state: AppState, slotId: string): HandoverForm | undefined {
  return state.forms.find((f) => f.status !== "confirmed" && f.slotId === slotId);
}

export function slotOccupantName(state: AppState, slotId: string): string | null {
  const holder = slotHolder(state, slotId);
  return holder ? holder.data.toothCode : null;
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function nextSeq(form: HandoverForm): number {
  return form.revisions.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
}

function addEvent(
  form: HandoverForm,
  action: RevisionEvent["action"],
  init?: Partial<RevisionEvent>,
): void {
  form.revisions.push({
    seq: nextSeq(form),
    at: stamp(),
    action,
    ...init,
  });
}

function nextFormId(state: AppState): string {
  const max = state.forms.reduce((m, f) => {
    const n = Number(f.id.replace(/^F/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `F${String(max + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// 冲突构造（冲突统一携带：牙位、牙壁数、时段、原值）
// ---------------------------------------------------------------------------

type ConflictInit = Omit<Conflict, "toothCode" | "wallCount" | "slotId"> &
  Partial<Pick<Conflict, "toothCode" | "wallCount" | "slotId">>;

function makeConflict(
  source: { toothCode?: string; wallCount?: number | null; slotId?: string | null },
  init: ConflictInit,
): Conflict {
  return {
    toothCode: source.toothCode ?? "—",
    wallCount: source.wallCount ?? null,
    slotId: source.slotId ?? null,
    ...init,
  };
}

export function frozenSnapshot(form: HandoverForm): SerializedForm | undefined {
  for (let i = form.revisions.length - 1; i >= 0; i -= 1) {
    const ev = form.revisions[i];
    if (ev.action === "confirm") return ev.snapshot;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 登记
// ---------------------------------------------------------------------------

export interface DraftInput {
  toothCode: string;
  tempSealDays: number | null;
  wallCount: number | null;
  bitePain: BitePain;
  slotId: string | null;
}

function validateDraft(draft: DraftInput): FormData | null {
  const toothCode = draft.toothCode.trim().toUpperCase();
  if (!/^#?\d{2}$/.test(toothCode)) return null;
  if (draft.tempSealDays === null || draft.tempSealDays < 0 || draft.tempSealDays > 365) return null;
  if (draft.wallCount === null || !Number.isInteger(draft.wallCount)) return null;
  if (draft.wallCount < 0 || draft.wallCount > 4) return null;
  return {
    toothCode: toothCode.startsWith("#") ? toothCode : `#${toothCode}`,
    tempSealDays: draft.tempSealDays,
    wallCount: draft.wallCount,
    bitePain: draft.bitePain,
  };
}

export function registerForm(state: AppState, draft: DraftInput): OpOutcome {
  const data = validateDraft(draft);
  if (!data) {
    return {
      ok: false,
      conflict: makeConflict(
        { toothCode: draft.toothCode.trim() || "—", wallCount: draft.wallCount, slotId: draft.slotId },
        {
          kind: "data",
          title: "登记资料不完整",
          detail: "牙位（两位数字）、暂封天数（0–365）与牙壁数（0–4 壁）必须填写。",
        },
      ),
    };
  }

  // 牙位只留一张待移交单
  const sameTooth = findByTooth(state, data.toothCode);
  if (sameTooth) {
    if (sameTooth.status === "confirmed") {
      const snap = frozenSnapshot(sameTooth) ?? serialize(sameTooth);
      return {
        ok: false,
        conflict: makeConflict(sameTooth.data, {
          kind: "frozen",
          title: "该牙冠部记录已冻结",
          detail: `${data.toothCode} 已于 ${sameTooth.frozenAt ?? "—"} 确认修复，登记即修改冻结记录。如需处理请走“复开”。`,
          blockers: ["冠部记录冻结中"],
          changes: diffForms(snap, { ...data, slotId: draft.slotId }),
        }),
      };
    }
    return {
      ok: false,
      conflict: makeConflict(sameTooth.data, {
        kind: "tooth",
        title: "牙位已存在待移交单",
        detail: `一个牙位只留一张待移交单，${data.toothCode} 当前为${
          sameTooth.status === "reinforced" ? "加固会诊" : "待移交"
        }状态，请在原单上处理。`,
        slotId: sameTooth.slotId,
        changes: diffForms(serialize(sameTooth), { ...data, slotId: draft.slotId }),
      }),
    };
  }

  // 椅位只排一颗牙
  if (draft.slotId) {
    const holder = slotHolder(state, draft.slotId);
    if (holder) {
      return {
        ok: false,
        conflict: makeConflict(data, {
          kind: "slot",
          title: "椅位时段已被占用",
          detail: `${slotLabel(draft.slotId)} 已排给 ${holder.data.toothCode}，一张椅位只排一颗牙。`,
          slotId: draft.slotId,
          changes: [
            {
              field: "椅位时段",
              before: `${slotLabel(draft.slotId)}（${holder.data.toothCode} 占用）`,
              after: slotLabel(draft.slotId),
            },
          ],
        }),
      };
    }
  }

  const next = cloneState(state);
  const id = nextFormId(next);
  const at = stamp();
  const form: HandoverForm = {
    id,
    status: "pending",
    data,
    slotId: draft.slotId,
    createdAt: at,
    revisions: [{ seq: 1, at, action: "register", slotId: draft.slotId }],
  };
  next.forms.push(form);
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// 改约：先释放占用，再争取新时段
// ---------------------------------------------------------------------------

export function reschedule(
  state: AppState,
  formId: string,
  newSlotId: string,
): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  if (form.status === "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "frozen",
        title: "该牙冠部记录已冻结",
        detail: "冻结记录不能改约，需先复开。",
        slotId: form.slotId,
      }),
    };
  }
  if (form.status === "reinforced") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "该牙在加固会诊中",
        detail: "请使用“回到待移交”重新挂椅位。",
        slotId: form.slotId,
      }),
    };
  }
  if (form.slotId === newSlotId) {
    return { ok: true, state };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  const oldSlotId = target.slotId;

  // 第一步：无论新时段是否可用，先释放当前占用
  if (oldSlotId) {
    addEvent(target, "release", {
      slotId: oldSlotId,
      reason: `改约：先释放 ${slotLabel(oldSlotId)}`,
      changes: [
        { field: "椅位时段", before: slotLabel(oldSlotId), after: "已释放" },
      ],
    });
    target.slotId = null;
  }

  // 第二步：新时段被占则冲突返回，占用已保持释放
  const holder = slotHolder(next, newSlotId);
  if (holder) {
    return {
      ok: false,
      releasedState: next,
      conflict: makeConflict(target.data, {
        kind: "slot",
        title: "改约时段已被占用",
        detail: `${slotLabel(newSlotId)} 已排给 ${holder.data.toothCode}。原时段 ${
          oldSlotId ? slotLabel(oldSlotId) : "—"
        } 已按规则释放，可重新选择时段。`,
        slotId: newSlotId,
        changes: [
          {
            field: "椅位时段",
            before: oldSlotId ? slotLabel(oldSlotId) : "未排班",
            after: `${slotLabel(newSlotId)}（${holder.data.toothCode} 占用）`,
          },
        ],
      }),
    };
  }

  addEvent(target, "reschedule", {
    slotId: newSlotId,
    changes: [
      {
        field: "椅位时段",
        before: oldSlotId ? slotLabel(oldSlotId) : "未排班",
        after: slotLabel(newSlotId),
      },
    ],
  });
  target.slotId = newSlotId;
  return { ok: true, state: next };
}

/** 主动释放椅位占用（改约/暂不排班时先释放） */
export function releaseSlot(state: AppState, formId: string): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  if (form.status === "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "frozen",
        title: "该牙冠部记录已冻结",
        detail: "冻结记录本就不占用椅位。",
      }),
    };
  }
  if (!form.slotId) {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "当前没有占用椅位",
        detail: `${form.data.toothCode} 未排任何时段。`,
      }),
    };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  const oldSlotId = target.slotId!;
  addEvent(target, "release", {
    slotId: oldSlotId,
    reason: "手动释放椅位占用",
    changes: [{ field: "椅位时段", before: slotLabel(oldSlotId), after: "已释放" }],
  });
  target.slotId = null;
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// 转加固会诊（牙壁不足 / 暂封超期时的唯一去向）
// ---------------------------------------------------------------------------

export function reinforce(state: AppState, formId: string, reason: string): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  const trimmed = reason.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "请填写会诊原因",
        detail: "转加固会诊必须记录原因（至少两个字）。",
        slotId: form.slotId,
      }),
    };
  }
  if (form.status === "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "frozen",
        title: "该牙冠部记录已冻结",
        detail: "修复已确认，无需再转加固会诊。",
        slotId: form.slotId,
      }),
    };
  }
  if (form.status === "reinforced") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "已在加固会诊中",
        detail: "该牙已转出，等待加固结果。",
      }),
    };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  const oldSlotId = target.slotId;
  const changes: ValueChange[] = [
    { field: "状态", before: "待移交", after: "加固会诊" },
  ];
  if (oldSlotId) {
    changes.push({ field: "椅位时段", before: slotLabel(oldSlotId), after: "释放椅位" });
  }
  addEvent(target, "reinforce", { reason: trimmed, slotId: oldSlotId, changes });
  target.status = "reinforced";
  target.slotId = null;
  return { ok: true, state: next };
}

/** 加固会诊后修改冠部登记资料（牙位身份不可改） */
export function reviseData(
  state: AppState,
  formId: string,
  patch: Partial<Omit<FormData, "toothCode">>,
): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  if (form.status === "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "frozen",
        title: "该牙冠部记录已冻结",
        detail: "冻结记录不能直接修改，需先复开（旧值保留在修订链）。",
        slotId: form.slotId,
      }),
    };
  }

  const before = serialize(form);
  const merged: FormData = { ...form.data, ...patch };
  if (
    merged.tempSealDays < 0 ||
    merged.tempSealDays > 365 ||
    !Number.isInteger(merged.wallCount) ||
    merged.wallCount < 0 ||
    merged.wallCount > 4
  ) {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "资料超出允许范围",
        detail: "暂封天数 0–365，牙壁数 0–4 壁。",
        slotId: form.slotId,
      }),
    };
  }
  const changes = diffForms(before, { ...merged, slotId: form.slotId });
  if (changes.length === 0) {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "没有变更",
        detail: "资料与当前记录一致。",
        slotId: form.slotId,
      }),
    };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  target.data = merged;
  addEvent(target, "revise", { slotId: target.slotId, changes });
  return { ok: true, state: next };
}

/** 加固会诊完成，凭结果回到待移交并重新挂椅位 */
export function reactivate(state: AppState, formId: string, slotId: string | null): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  if (form.status !== "reinforced") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "该牙不在加固会诊中",
        detail: "只有加固会诊单可以回到待移交。",
        slotId: form.slotId,
      }),
    };
  }
  if (slotId) {
    const holder = slotHolder(state, slotId);
    if (holder) {
      return {
        ok: false,
        conflict: makeConflict(form.data, {
          kind: "slot",
          title: "椅位时段已被占用",
          detail: `${slotLabel(slotId)} 已排给 ${holder.data.toothCode}。`,
          slotId,
          changes: [
            {
              field: "椅位时段",
              before: "未排班（加固会诊）",
              after: `${slotLabel(slotId)}（${holder.data.toothCode} 占用）`,
            },
          ],
        }),
      };
    }
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  target.status = "pending";
  target.slotId = slotId;
  addEvent(target, "reactivate", {
    slotId,
    reason: "加固会诊完成，回到待移交",
    changes: [
      { field: "状态", before: "加固会诊", after: "待移交" },
      { field: "椅位时段", before: "未排班（加固会诊）", after: slotLabel(slotId) },
    ],
  });
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// 修复确认：牙壁足够且暂封未超期才允许；确认即冻结并释放椅位
// ---------------------------------------------------------------------------

export function confirmRestoration(state: AppState, formId: string): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  if (form.status === "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "frozen",
        title: "该牙冠部记录已冻结",
        detail: `已于 ${form.frozenAt ?? "—"} 确认修复。`,
        slotId: form.slotId,
        blockers: ["冠部记录冻结中"],
      }),
    };
  }

  const blockers: string[] = [];
  const { canConfirm, blockers: ruleBlockers } = evaluateEligibility(form.data);
  blockers.push(...ruleBlockers);
  if (form.status === "reinforced") {
    blockers.push("该牙仍在加固会诊中，需先回到待移交重新判定");
  }
  if (!form.slotId) {
    blockers.push("未排椅位时段，无法安排修复确认");
  }
  if (!canConfirm || blockers.length > 0) {
    // 冲突必须展示原值：逐条列出触发字段的现值
    const changes: ValueChange[] = [];
    if (form.data.wallCount < MIN_WALLS) {
      changes.push({
        field: "牙壁数",
        before: formatField("wallCount", form.data.wallCount),
        after: "✕ 不可确认修复",
      });
    }
    if (form.data.tempSealDays > MAX_TEMP_SEAL_DAYS) {
      changes.push({
        field: "暂封天数",
        before: formatField("tempSealDays", form.data.tempSealDays),
        after: "✕ 不可确认修复",
      });
    }
    if (!form.slotId) {
      changes.push({ field: "椅位时段", before: "未排班", after: "✕ 不可确认修复" });
    }
    if (form.status === "reinforced") {
      changes.push({ field: "状态", before: "加固会诊", after: "✕ 不可确认修复" });
    }
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "blocked",
        title: "牙壁不足或暂封超期，只能转加固会诊",
        detail: `${form.data.toothCode} 暂不具备修复确认条件，请转加固会诊；不能直接确认修复。`,
        slotId: form.slotId,
        blockers,
        changes,
      }),
    };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  const snapshot = serialize(target);
  const confirmedAt = todayKey();
  const oldSlotId = target.slotId;
  target.status = "confirmed";
  target.frozenAt = confirmedAt;
  target.slotId = null;
  addEvent(target, "confirm", {
    slotId: oldSlotId,
    reason: "冠部修复确认，冠部记录冻结",
    snapshot,
    changes: [
      { field: "状态", before: "待移交", after: `已确认修复（${confirmedAt}）` },
      { field: "椅位时段", before: slotLabel(oldSlotId), after: "已释放" },
    ],
  });
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// 复开：保留旧值、原因和日期
// ---------------------------------------------------------------------------

export function reopenForm(state: AppState, formId: string, reason: string): OpOutcome {
  const form = findForm(state, formId);
  if (!form) {
    return { ok: false, conflict: makeConflict({}, { kind: "data", title: "单据不存在", detail: formId }) };
  }
  const trimmed = reason.trim();
  if (trimmed.length < 2) {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "请填写复开原因",
        detail: "复开冻结记录必须登记原因（至少两个字）。",
      }),
    };
  }
  if (form.status !== "confirmed") {
    return {
      ok: false,
      conflict: makeConflict(form.data, {
        kind: "data",
        title: "该牙未冻结",
        detail: "只有已确认修复的记录可以复开。",
        slotId: form.slotId,
      }),
    };
  }

  const next = cloneState(state);
  const target = findForm(next, formId)!;
  const frozenDate = target.frozenAt ?? "—";
  const snapshot = frozenSnapshot(target) ?? serialize(target);
  target.status = "pending";
  target.frozenAt = undefined;
  target.slotId = null; // 旧值保留，椅位需重新预约
  addEvent(target, "reopen", {
    reason: trimmed,
    slotId: null,
    snapshot,
    changes: [
      { field: "状态", before: `已确认修复（冻结于 ${frozenDate}）`, after: "待移交（复开）" },
      { field: "冠部记录", before: "冻结旧值", after: "保留旧值，重新判定" },
      { field: "椅位时段", before: "已释放", after: "未排班（需重新预约）" },
    ],
  });
  return { ok: true, state: next };
}

// ---------------------------------------------------------------------------
// 刷新一致性校验：牙位、椅位、暂封（天数合理性）、修订链
// ---------------------------------------------------------------------------

export interface ReconcileResult {
  state: AppState;
  issues: Conflict[];
}

export function reconcile(loaded: AppState): ReconcileResult {
  const state = cloneState(loaded);
  const issues: Conflict[] = [];

  const seenTooth = new Map<string, HandoverForm>();
  const seenSlot = new Map<string, HandoverForm>();
  // 序号断裂的单子：先记录冲突，末尾统一重编号，保证多次校验结果稳定
  const brokenChain = new Set<string>();

  for (const form of state.forms) {
    // 修订链序号断裂：仅记录，末尾统一修复
    if (form.revisions.some((ev, i) => ev.seq !== i + 1)) {
      brokenChain.add(form.id);
      issues.push(
        makeConflict(form.data, {
          kind: "data",
          title: "修订链序号不一致",
          detail: `${form.data.toothCode} 的修订链已在刷新时重新编号。`,
          slotId: form.slotId,
        }),
      );
    }

    // 暂封天数越界
    if (form.data.tempSealDays < 0 || form.data.tempSealDays > 365) {
      issues.push(
        makeConflict(form.data, {
          kind: "data",
          title: "暂封天数异常",
          detail: `${form.data.toothCode} 的暂封天数 ${form.data.tempSealDays} 超出 0–365。`,
          slotId: form.slotId,
        }),
      );
    }

    // 冻结记录不应占用椅位，且必须有冻结日期
    if (form.status === "confirmed") {
      if (form.slotId) {
        const badSlot = form.slotId;
        issues.push(
          makeConflict(form.data, {
            kind: "frozen",
            title: "冻结记录仍占用椅位",
            detail: `${form.data.toothCode} 已冻结，刷新时释放 ${slotLabel(badSlot)}。`,
            slotId: badSlot,
          }),
        );
        addEvent(form, "release", {
          slotId: badSlot,
          reason: "刷新校验：冻结记录释放椅位",
        });
        form.slotId = null;
      }
      if (!form.frozenAt) {
        form.frozenAt = todayKey();
        issues.push(
          makeConflict(form.data, {
            kind: "frozen",
            title: "冻结记录缺少冻结日期",
            detail: `${form.data.toothCode} 已补记为 ${form.frozenAt}，旧值仍在修订链。`,
          }),
        );
      }
      continue;
    }

    // 椅位时段不存在
    if (form.slotId && !CHAIR_SLOTS.some((s) => s.id === form.slotId)) {
      const badSlot = form.slotId;
      issues.push(
        makeConflict(form.data, {
          kind: "slot",
          title: "椅位时段已失效",
          detail: `${form.data.toothCode} 占用的 ${badSlot} 不在当前椅位表，已释放。`,
          slotId: badSlot,
        }),
      );
      addEvent(form, "release", { slotId: badSlot, reason: "刷新校验：时段失效，释放占用" });
      form.slotId = null;
    }

    // 一牙一单（已自动收敛的重复副本只留痕，不再占用牙位身份）
    if (!form.resolvedDuplicate) {
      const toothOwner = seenTooth.get(form.data.toothCode);
      if (toothOwner) {
        const oldSlot = form.slotId;
        issues.push(
          makeConflict(form.data, {
            kind: "tooth",
            title: "同一牙位存在多张单据",
            detail: `${form.data.toothCode} 已有 ${toothOwner.id}，刷新时将 ${form.id} 收敛为加固会诊并释放椅位。`,
            slotId: oldSlot,
            changes: [
              { field: "牙位", before: form.data.toothCode, after: `${form.data.toothCode}（重复）` },
              { field: "椅位时段", before: slotLabel(oldSlot), after: "释放椅位" },
            ],
          }),
        );
        if (oldSlot) {
          addEvent(form, "release", { slotId: oldSlot, reason: "刷新校验：一牙一单冲突，释放椅位" });
          form.slotId = null;
        }
        form.status = "reinforced";
        form.resolvedDuplicate = true;
        addEvent(form, "reinforce", { reason: "刷新校验：同一牙位重复单据，自动收敛" });
        continue;
      }
      seenTooth.set(form.data.toothCode, form);
    }

    // 一椅一牙
    if (form.slotId) {
      const slotOwner = seenSlot.get(form.slotId);
      if (slotOwner) {
        const badSlot = form.slotId;
        issues.push(
          makeConflict(form.data, {
            kind: "slot",
            title: "同一椅位排了两颗牙",
            detail: `${slotLabel(badSlot)} 同时排给 ${slotOwner.data.toothCode} 与 ${form.data.toothCode}，刷新时释放后者。`,
            slotId: badSlot,
            changes: [
              {
                field: "椅位时段",
                before: `${slotLabel(badSlot)}（${slotOwner.data.toothCode} 先占）`,
                after: "释放椅位",
              },
            ],
          }),
        );
        addEvent(form, "release", { slotId: badSlot, reason: "刷新校验：一椅一牙冲突，释放占用" });
        form.slotId = null;
      } else {
        seenSlot.set(form.slotId, form);
      }
    }
  }

  // 统一重编号（本过程新增的收敛事件一并纳入），第二轮校验不再报错
  for (const form of state.forms) {
    if (brokenChain.has(form.id)) {
      form.revisions.forEach((ev, i) => {
        ev.seq = i + 1;
      });
    }
  }

  return { state, issues };
}

// ---------------------------------------------------------------------------
// 汇总指标
// ---------------------------------------------------------------------------

export interface Summary {
  pending: number;
  reinforced: number;
  confirmed: number;
  overdue: number;
  seated: number;
}

export function summarize(state: AppState): Summary {
  const summary: Summary = { pending: 0, reinforced: 0, confirmed: 0, overdue: 0, seated: 0 };
  for (const form of state.forms) {
    summary[form.status] += 1;
    if (form.status !== "confirmed" && form.data.tempSealDays > MAX_TEMP_SEAL_DAYS) {
      summary.overdue += 1;
    }
    if (form.slotId) summary.seated += 1;
  }
  return summary;
}
