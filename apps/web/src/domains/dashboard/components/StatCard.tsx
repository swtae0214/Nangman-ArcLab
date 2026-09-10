interface StatCardProps {
  label: string;
  value: string;
  tone?: "default" | "accent" | "critical";
}

const VALUE_TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-white",
  accent: "text-console-accent",
  critical: "text-console-critical",
};

const BORDER_TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-console-accent/20",
  accent: "border-console-accent/20",
  critical: "border-[#ff5a5a]/30",
};

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className={`rounded-md border ${BORDER_TONE_CLASS[tone]} bg-console-panel px-[18px] py-4`}>
      <div className="mb-2 text-[11.5px] font-medium text-console-muted">{label}</div>
      <div className={`font-jetbrains text-[22px] font-bold ${VALUE_TONE_CLASS[tone]}`}>{value}</div>
    </div>
  );
}
