// 资料层：术后冠部封闭与修复移交的领域类型定义

/** 咬合痛程度 */
export type BitePain = "none" | "mild" | "moderate" | "severe";

/** 移交单状态：待移交 / 加固会诊 / 已确认修复（冠部冻结） */
export type HandoverStatus = "pending" | "consult" | "confirmed";

/** 冠部登记（牙位上登记的术后冠部封闭资料） */
export interface CoronalInfo {
  /** 剩余牙壁数 */
  wallCount: number;
  /** 暂封登记日期 ISO yyyy-mm-dd，暂封天数由该日期相对今天推导 */
  sealedOn: string;
  /** 咬合痛 */
  bitePain: BitePain;
}

/** 修复确认时冻结的冠部记录快照 */
export interface FrozenCoronal extends CoronalInfo {
  /** 冻结日期 */
  frozenOn: string;
  /** 冻结当时的暂封天数 */
  temporaryDaysAtFreeze: number;
}

/** 复开修订记录：保留旧值、原因和日期 */
export interface RevisionEntry {
  /** 复开日期 */
  reopenedOn: string;
  /** 复开原因 */
  reason: string;
  /** 复开前冻结的冠部旧值 */
  snapshot: FrozenCoronal;
  /** 复开前占用的椅位时段 */
  slotId: string | null;
}

/** 一张待移交单（同一牙位同时只允许一张未完结的单子） */
export interface Handover {
  id: string;
  /** 牙位，如 #36 */
  toothNo: string;
  diagnosis: string;
  status: HandoverStatus;
  /** 现行冠部登记 */
  coronal: CoronalInfo;
  /** 占用的椅位时段，椅位只排一颗牙 */
  slotId: string | null;
  /** 修复确认后冻结的冠部记录，复开后清空，旧值进修订链 */
  frozen: FrozenCoronal | null;
  confirmedOn: string | null;
  /** 修订链：每次复开追加一条，只增不改 */
  revisions: RevisionEntry[];
  createdAt: string;
}

/** 椅位时段 */
export interface ChairSlot {
  id: string;
  /** 时段标签，如 08:30–09:15 */
  label: string;
  /** 占用牙位，null 表示空闲；一个时段只排一颗牙 */
  toothNo: string | null;
  handoverId: string | null;
}

export interface AppState {
  version: 1;
  handovers: Handover[];
  slots: ChairSlot[];
}
