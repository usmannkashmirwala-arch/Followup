export default function MetricsBar({ stats }) {
    const items = [
        { key: "active", label: "Active", value: stats?.active_leads ?? "–" },
        { key: "pending", label: "Pending", value: stats?.pending_tasks ?? "–" },
        {
            key: "overdue",
            label: "Overdue",
            value: stats?.overdue_tasks ?? "–",
            urgent: (stats?.overdue_tasks ?? 0) > 0,
        },
        { key: "won", label: "Won", value: stats?.won ?? "–" },
    ];
    return (
        <div
            className="grid grid-cols-2 border border-black/15"
            data-testid="metrics-bar"
        >
            {items.map((it, i) => (
                <div
                    key={it.key}
                    data-testid={`metric-${it.key}`}
                    className={[
                        "p-5 flex flex-col gap-1",
                        i % 2 === 0 ? "border-r border-black/15" : "",
                        i < 2 ? "border-b border-black/15" : "",
                        it.urgent ? "bg-[#FF3B30] text-white" : "bg-white",
                    ].join(" ")}
                >
                    <span
                        className={[
                            "mono text-[10px] uppercase tracking-[0.25em]",
                            it.urgent ? "text-white/80" : "text-black/50",
                        ].join(" ")}
                    >
                        {it.label}
                    </span>
                    <span className="font-display text-4xl font-black tracking-tighter leading-none">
                        {it.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
