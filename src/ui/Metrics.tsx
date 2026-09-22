// 页面层：指标卡

const CARDS = [
  { key: "pending", label: "待移交", tone: "tone-primary" },
  { key: "reinforced", label: "加固会诊", tone: "tone-warn" },
  { key: "confirmed", label: "已确认修复", tone: "tone-ok" },
  { key: "seated", label: "已排椅位", tone: "tone-accent" },
  { key: "overdue", label: "暂封超期", tone: "tone-danger" },
] as const;

export default function Metrics({
  summary,
}: {
  summary: { pending: number; reinforced: number; confirmed: number; overdue: number; seated: number };
}) {
  return (
    <section className="metrics-grid metrics-five">
      {CARDS.map((card) => (
        <article key={card.key} className={`metric-card ${card.tone}`}>
          <span>{card.label}</span>
          <strong>{summary[card.key]}</strong>
        </article>
      ))}
    </section>
  );
}
