// 资料层：仅定义数据结构，不含任何判定与界面逻辑

export type BitePain = "none" | "mild" | "severe";

/** 待移交单状态：待移交 / 加固会诊（已转出） / 已确认修复（冻结） */
export type FormStatus = "pending" | "reinforced" | "confirmed";

export type RevisionAction =
  | "register"
  | "revise"
  | "reschedule"
  | "release"
  | "reinforce"
  | "reactivate"
  | "confirm"
  | "reopen";

export interface FormData {
  /** 牙位，FDI 编号，如 #36 */
  toothCode: string;
  /** 暂封天数 */
  tempSealDays: number;
  /** 剩余牙壁数 0-4 */
  wallCount: number;
  /** 咬合痛 */
  bitePain: BitePain;
}

/** 带椅位时段的完整快照 */
export interface SerializedForm extends FormData {
  slotId: string | null;
}

export interface ValueChange {
  /** 字段中文名 */
  field: string;
  /** 原值 */
  before: string;
  /** 新值 */
  after: string;
}

export interface RevisionEvent {
  /** 单张单子内自增的修订序号 */
  seq: number;
  /** 时间戳 YYYY-MM-DD HH:mm */
  at: string;
  action: RevisionAction;
  /** 原因（转会诊 / 复开等必须填写） */
  reason?: string;
  /** 当时的椅位时段（释放前记录） */
  slotId?: string | null;
  /** 原值 → 新值 */
  changes?: ValueChange[];
  /** 冻结时保留的冠部记录快照 */
  snapshot?: SerializedForm;
}

export interface HandoverForm {
  id: string;
  status: FormStatus;
  data: FormData;
  /** 当前占用的椅位时段；一椅一牙，加固会诊与冻结后为 null */
  slotId: string | null;
  /** 冻结日期，复开后清除，原值保留在修订链 */
  frozenAt?: string;
  /** 刷新校验中已自动收敛的重复牙位副本（保留留痕，复检不再报冲突） */
  resolvedDuplicate?: boolean;
  createdAt: string;
  revisions: RevisionEvent[];
}

export interface AppState {
  version: number;
  forms: HandoverForm[];
}

export interface ChairSlot {
  id: string;
  dateLabel: string;
  label: string;
  timeRange: string;
}

export interface Conflict {
  kind: "tooth" | "slot" | "frozen" | "blocked" | "data";
  title: string;
  detail: string;
  toothCode: string;
  wallCount: number | null;
  slotId: string | null;
  /** 阻断原因（牙壁不足 / 暂封超期等） */
  blockers?: string[];
  /** 原值对照 */
  changes?: ValueChange[];
}

export interface OpSuccess {
  ok: true;
  state: AppState;
}

export interface OpFailure {
  ok: false;
  conflict: Conflict;
  /** 改约遇冲突时，已按规则先释放占用后的状态 */
  releasedState?: AppState;
}

export type OpOutcome = OpSuccess | OpFailure;
