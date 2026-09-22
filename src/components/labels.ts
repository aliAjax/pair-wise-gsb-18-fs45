// 页面层：状态、咬合痛等展示文案（资料/判定不依赖这里）

import type { BitePain, HandoverStatus } from "../data/types";

export const bitePainLabels: Record<BitePain, string> = {
  none: "无咬合痛",
  mild: "轻度",
  moderate: "中度",
  severe: "重度",
};

export const statusLabels: Record<HandoverStatus, string> = {
  pending: "待移交",
  consult: "加固会诊",
  confirmed: "已确认修复",
};

export const bitePainOrder: BitePain[] = ["none", "mild", "moderate", "severe"];
