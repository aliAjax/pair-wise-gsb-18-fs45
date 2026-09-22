// 判定层：术后冠部封闭与修复移交的业务规则（纯函数，不依赖 React / 存储 / DOM）

import type {
  AppState,
  BitePain,
  CoronalInfo,
  FrozenCoronal,
  Handover,
  HandoverStatus,
} from "../data/types";

/** 暂封允许的最大天数，超期只能转加固会诊 */
export const MAX_TEMPORARY_DAYS = 14;
/** 最少剩余牙壁数，不足只能转加固会诊，不能确认修复 */
export const MIN_WALLS = 2;

/* ---------------- 基础日期 ---------------- */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 暂封天数：今天 - 暂封登记日期（整天，今天登记为 0 天） */
export function temporaryDays(sealedOn: string, today: Date = new Date()): number {
  const start = new Date(`${sealedOn}T00:00:00`).getTime();
  const now = new Date(`${toISO(today)}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - start) / 86_400_000));
}

/* ---------------- 冠部判定 ---------------- */

export function isTemporaryOverdue(info: CoronalInfo, today: Date = new Date()): boolean {
  return temporaryDays(info.sealedOn, today) > MAX_TEMPORARY_DAYS;
}

export function isWallInsufficient(info: CoronalInfo): boolean {
  return info.wallCount < MIN_WALLS;
}

export type BlockerCode = "walls" | "temporary";

/**
 * 判定能否确认修复：
 * 牙壁不足或暂封超期 → 只能转加固会诊，不能确认修复。
 * 咬合痛只登记展示，不阻断。
 */
export function restorationBlockers(
  info: CoronalInfo,
  today: Date = new Date(),
): BlockerCode[] {
  const blockers: BlockerCode[] = [];
  if (isWallInsufficient(info)) blockers.push("walls");
  if (isTemporaryOverdue(info, today)) blockers.push("temporary");
  return blockers;
}

export function canConfirmRestoration(
  info: CoronalInfo,
  today: Date = new Date(),
): boolean {
  return restorationBlockers(info, today).length === 0;
}

/* ---------------- 冲突描述 ---------------- */

export type ConflictType =
  | "duplicate-tooth"
  | "slot-busy"
  | "must-release-first";

/**
 * 冲突资料：冲突提示统一携带牙位、牙壁数、时段和原值。
 */
export interface RuleConflict {
  type: ConflictType;
  message: string;
  toothNo: string;
  wallCount: number | null;
  slotId: string | null;
  slotLabel: string | null;
  /** 原值：冲突牙位已有单 / 椅位已排牙的快照 */
  existing: {
    toothNo: string;
    wallCount: number | null;
    status: HandoverStatus | null;
    slotId: string | null;
    bitePain: BitePain | null;
    temporaryDays: number | null;
  } | null;
}

export type OpResult = { ok: true; handoverId?: string } | { ok: false; conflict: RuleConflict };

/* ---------------- 查找 ---------------- */

export function findSlot(state: AppState, slotId: string | null) {
  if (!slotId) return undefined;
  return state.slots.find((s) => s.id === slotId);
}

export function findHandover(state: AppState, id: string) {
  return state.handovers.find((h) => h.id === id);
}

/** 椅位时段标签，找不到时给回 id */
export function slotLabelOf(state: AppState, slotId: string | null): string | null {
  return findSlot(state, slotId)?.label ?? slotId;
}

/**
 * 同一牙位只留一张待移交单：confirmed（已确认冻结）之外，
 * pending / consult 都是未完结单子，再次登记即冲突。
 */
export function findActiveForTooth(state: AppState, toothNo: string) {
  return state.handovers.find(
    (h) => h.status !== "confirmed" && h.toothNo === toothNo,
  );
}

/* ---------------- 冲突构造 ---------------- */

function handoverConflict(
  type: ConflictType,
  message: string,
  holder: Handover,
  state: AppState,
  today: Date,
): RuleConflict {
  return {
    type,
    message,
    toothNo: holder.toothNo,
    wallCount: holder.coronal.wallCount,
    slotId: holder.slotId,
    slotLabel: slotLabelOf(state, holder.slotId),
    existing: {
      toothNo: holder.toothNo,
      wallCount: holder.coronal.wallCount,
      status: holder.status,
      slotId: holder.slotId,
      bitePain: holder.coronal.bitePain,
      temporaryDays: temporaryDays(holder.coronal.sealedOn, today),
    },
  };
}

function slotConflict(
  message: string,
  state: AppState,
  slotId: string,
  today: Date,
): RuleConflict {
  const slot = findSlot(state, slotId);
  const holder = slot?.handoverId ? findHandover(state, slot.handoverId) : undefined;
  return {
    type: "slot-busy",
    message,
    toothNo: holder?.toothNo ?? slot?.toothNo ?? "—",
    wallCount: holder ? holder.coronal.wallCount : null,
    slotId,
    slotLabel: slot?.label ?? slotId,
    existing: holder
      ? {
          toothNo: holder.toothNo,
          wallCount: holder.coronal.wallCount,
          status: holder.status,
          slotId: holder.slotId,
          bitePain: holder.coronal.bitePain,
          temporaryDays: temporaryDays(holder.coronal.sealedOn, today),
        }
      : null,
  };
}

/* ---------------- 纯规则操作（返回新状态，永不就地修改） ---------------- */

export interface CreateInput {
  toothNo: string;
  diagnosis: string;
  wallCount: number;
  temporaryDays: number;
  bitePain: BitePain;
  slotId: string | null;
}

/** 新牙位登记：一牙一单 + 椅位一槽一颗牙 */
export function createHandover(
  state: AppState,
  input: CreateInput,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const toothNo = input.toothNo.trim().toUpperCase();
  const today = toISO(now);

  const duplicate = findActiveForTooth(state, toothNo);
  if (duplicate) {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "duplicate-tooth",
          `牙位 ${toothNo} 已有一张未完结待移交单，同一牙位只留一张待移交单。`,
          duplicate,
          state,
          now,
        ),
      },
    };
  }

  if (input.slotId) {
    const slot = findSlot(state, input.slotId);
    if (slot && slot.handoverId) {
      return {
        state,
        result: {
          ok: false,
          conflict: slotConflict(
            `椅位时段 ${slot.label} 已排 ${slot.toothNo}，一个时段只排一颗牙。`,
            state,
            input.slotId,
            now,
          ),
        },
      };
    }
  }

  const sealedOn = toISO(new Date(now.getTime() - input.temporaryDays * 86_400_000));
  const id = `h${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const handover: Handover = {
    id,
    toothNo,
    diagnosis: input.diagnosis.trim(),
    status: "pending",
    coronal: { wallCount: input.wallCount, sealedOn, bitePain: input.bitePain },
    slotId: input.slotId,
    frozen: null,
    confirmedOn: null,
    revisions: [],
    createdAt: new Date(now.getTime()).toISOString(),
  };

  const slots = input.slotId
    ? state.slots.map((s) =>
        s.id === input.slotId ? { ...s, toothNo, handoverId: id } : s,
      )
    : state.slots;

  return {
    state: { ...state, handovers: [...state.handovers, handover], slots },
    result: { ok: true, handoverId: id },
  };
}

/** 更新待移交牙位的冠部登记（仅 pending 可改；暂封天数重算登记日期） */
export function updateCoronal(
  state: AppState,
  id: string,
  patch: Partial<Pick<CoronalInfo, "wallCount" | "bitePain">> & { temporaryDays?: number },
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (h.status !== "pending") {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "冠部记录已冻结或已转加固会诊，不能直接修改。",
          h,
          state,
          now,
        ),
      },
    };
  }

  const sealedOn =
    patch.temporaryDays === undefined
      ? h.coronal.sealedOn
      : toISO(new Date(now.getTime() - patch.temporaryDays * 86_400_000));

  const updated: Handover = {
    ...h,
    coronal: {
      wallCount: patch.wallCount ?? h.coronal.wallCount,
      bitePain: patch.bitePain ?? h.coronal.bitePain,
      sealedOn,
    },
  };

  return {
    state: replaceHandover(state, updated),
    result: { ok: true, handoverId: id },
  };
}

/** 转加固会诊（牙壁不足或暂封超期时的唯一出路；符合条件也可提前转） */
export function referToConsult(
  state: AppState,
  id: string,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (h.status !== "pending") {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "只有待移交单可以转加固会诊。",
          h,
          state,
          now,
        ),
      },
    };
  }
  return {
    state: replaceHandover(state, { ...h, status: "consult" }),
    result: { ok: true, handoverId: id },
  };
}

/** 加固会诊完成：牙壁处理后的新值随会诊结果回到待移交单 */
export function completeConsult(
  state: AppState,
  id: string,
  patch: { wallCount: number; bitePain: BitePain; temporaryDays: number },
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (h.status !== "consult") {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "只有加固会诊中的单子可以登记会诊结果。",
          h,
          state,
          now,
        ),
      },
    };
  }

  const sealedOn = toISO(new Date(now.getTime() - patch.temporaryDays * 86_400_000));
  const updated: Handover = {
    ...h,
    status: "pending",
    coronal: { wallCount: patch.wallCount, bitePain: patch.bitePain, sealedOn },
  };
  return {
    state: replaceHandover(state, updated),
    result: { ok: true, handoverId: id },
  };
}

/** 释放椅位占用（改约前必须先释放） */
export function releaseSlot(
  state: AppState,
  id: string,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (!h.slotId) return { state, result: { ok: true, handoverId: id } };

  const slotId = h.slotId;
  const slots = state.slots.map((s) =>
    s.id === slotId ? { ...s, toothNo: null, handoverId: null } : s,
  );
  return {
    state: { ...state, slots, handovers: state.handovers.map((x) =>
      x.id === id ? { ...x, slotId: null } : x,
    ) },
    result: { ok: true, handoverId: id },
  };
}

/** 排入空闲椅位时段（占用中即冲突） */
export function bookSlot(
  state: AppState,
  id: string,
  slotId: string,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };

  // 单子仍占用该时段视为已在排，不冲突；排其它时段必须先释放占用
  if (h.slotId && h.slotId !== slotId) {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          `该牙位已占用其它椅位时段，改约须先释放原占用。`,
          h,
          state,
          now,
        ),
      },
    };
  }

  const slot = findSlot(state, slotId);
  if (!slot) return { state, result: { ok: false, conflict: missingConflict(slotId) } };
  if (slot.handoverId && slot.handoverId !== id) {
    return {
      state,
      result: {
        ok: false,
        conflict: slotConflict(
          `椅位时段 ${slot.label} 已排 ${slot.toothNo}，一个时段只排一颗牙。`,
          state,
          slotId,
          now,
        ),
      },
    };
  }

  const slots = state.slots.map((s) =>
    s.id === slotId ? { ...s, toothNo: h.toothNo, handoverId: id } : s,
  );
  return {
    state: { ...state, slots, handovers: state.handovers.map((x) =>
      x.id === id ? { ...x, slotId } : x,
    ) },
    result: { ok: true, handoverId: id },
  };
}

/**
 * 修复确认：牙壁不足或暂封超期只能转加固会诊，不能确认修复。
 * 通过后冻结冠部记录（含确认日期与当时暂封天数）。
 */
export function confirmRestoration(
  state: AppState,
  id: string,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (h.status !== "pending") {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "只有待移交单可以确认修复。",
          h,
          state,
          now,
        ),
      },
    };
  }

  const blockers = restorationBlockers(h.coronal, now);
  if (blockers.length > 0) {
    const reasons: string[] = [];
    if (blockers.includes("walls"))
      reasons.push(`剩余牙壁 ${h.coronal.wallCount} 壁，少于 ${MIN_WALLS} 壁`);
    if (blockers.includes("temporary"))
      reasons.push(`暂封 ${temporaryDays(h.coronal.sealedOn, now)} 天，超过 ${MAX_TEMPORARY_DAYS} 天上限`);
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          `不能确认修复：${reasons.join("；")}。只能转加固会诊。`,
          h,
          state,
          now,
        ),
      },
    };
  }

  const frozen: FrozenCoronal = {
    ...h.coronal,
    frozenOn: toISO(now),
    temporaryDaysAtFreeze: temporaryDays(h.coronal.sealedOn, now),
  };
  const updated: Handover = {
    ...h,
    status: "confirmed",
    frozen,
    confirmedOn: frozen.frozenOn,
  };
  return {
    state: replaceHandover(state, updated),
    result: { ok: true, handoverId: id },
  };
}

/**
 * 复开：保留旧值（冻结快照）、原因和日期，追加到修订链（只增不改）。
 * 冠部现行值沿用冻结旧值，单子回到待移交，椅位占用不动。
 */
export function reopenHandover(
  state: AppState,
  id: string,
  reason: string,
  now: Date = new Date(),
): { state: AppState; result: OpResult } {
  const h = findHandover(state, id);
  if (!h) return { state, result: { ok: false, conflict: missingConflict(id) } };
  if (h.status !== "confirmed" || !h.frozen) {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "只有已确认冻结的单子可以复开。",
          h,
          state,
          now,
        ),
      },
    };
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      state,
      result: {
        ok: false,
        conflict: handoverConflict(
          "must-release-first",
          "复开必须填写原因。",
          h,
          state,
          now,
        ),
      },
    };
  }

  const entry = {
    reopenedOn: toISO(now),
    reason: trimmed,
    snapshot: h.frozen,
    slotId: h.slotId,
  };
  const updated: Handover = {
    ...h,
    status: "pending",
    frozen: null,
    confirmedOn: null,
    revisions: [...h.revisions, entry],
  };
  return {
    state: replaceHandover(state, updated),
    result: { ok: true, handoverId: id },
  };
}

/* ---------------- 内部工具 ---------------- */

function replaceHandover(state: AppState, updated: Handover): AppState {
  return {
    ...state,
    handovers: state.handovers.map((h) => (h.id === updated.id ? updated : h)),
  };
}

function missingConflict(ref: string): RuleConflict {
  return {
    type: "must-release-first",
    message: `找不到对应记录（${ref}）。`,
    toothNo: "—",
    wallCount: null,
    slotId: null,
    slotLabel: null,
    existing: null,
  };
}
