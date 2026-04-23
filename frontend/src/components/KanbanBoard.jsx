import { useState } from "react";
import { fmtRelative } from "../lib/api";

const channelSymbol = (c) => {
    switch (c) {
        case "WhatsApp":
            return "WA";
        case "Email":
            return "EM";
        case "Phone":
            return "PH";
        case "SMS":
            return "SMS";
        case "LinkedIn":
            return "LI";
        default:
            return c ? c.slice(0, 2).toUpperCase() : "";
    }
};

export default function KanbanBoard({ leads, stages, onOpenLead, onMoveStage }) {
    const [dragId, setDragId] = useState(null);
    const [overStage, setOverStage] = useState(null);

    const byStage = (s) => leads.filter((l) => l.stage === s);

    const onDragStart = (id) => setDragId(id);
    const onDragEnd = () => {
        setDragId(null);
        setOverStage(null);
    };
    const onDrop = (stage) => {
        if (dragId) onMoveStage(dragId, stage);
        onDragEnd();
    };

    return (
        <div
            className="kanban-scroll flex gap-4 overflow-x-auto pb-6 -mx-6 px-6 md:-mx-10 md:px-10 snap-x"
            data-testid="kanban-board"
        >
            {stages.map((s) => {
                const list = byStage(s.key);
                const isOver = overStage === s.key;
                const won = s.key === "ClosedWon";
                const lost = s.key === "ClosedLost";
                return (
                    <div
                        key={s.key}
                        data-testid={`kanban-col-${s.key}`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setOverStage(s.key);
                        }}
                        onDragLeave={() => setOverStage(null)}
                        onDrop={() => onDrop(s.key)}
                        className={[
                            "w-72 flex-shrink-0 flex flex-col snap-start border",
                            isOver ? "border-[#002FA7] bg-[#002FA7]/5" : "border-black/15",
                        ].join(" ")}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-black/15">
                            <div className="flex items-center gap-2">
                                <span
                                    className={[
                                        "h-1.5 w-1.5 rounded-full",
                                        won
                                            ? "bg-black"
                                            : lost
                                            ? "bg-black/30"
                                            : "bg-[#002FA7]",
                                    ].join(" ")}
                                />
                                <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/70">
                                    {s.label}
                                </span>
                            </div>
                            <span className="mono text-xs text-black/50">{list.length}</span>
                        </div>
                        <div className="p-3 space-y-3 min-h-[120px]">
                            {list.length === 0 && (
                                <div className="mono text-[10px] uppercase tracking-[0.2em] text-black/30 text-center py-6">
                                    Empty
                                </div>
                            )}
                            {list.map((l) => (
                                <article
                                    key={l.id}
                                    draggable
                                    onDragStart={() => onDragStart(l.id)}
                                    onDragEnd={onDragEnd}
                                    onClick={() => onOpenLead(l.id)}
                                    data-testid={`lead-card-${l.id}`}
                                    className={[
                                        "group border border-black/15 bg-white p-3 cursor-pointer",
                                        "hover:border-black transition-colors flex flex-col gap-2",
                                        dragId === l.id ? "opacity-50" : "",
                                    ].join(" ")}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-display text-base font-semibold tracking-tight leading-tight">
                                                {l.name}
                                            </div>
                                            {l.company && (
                                                <div className="text-xs text-black/60">
                                                    {l.company}
                                                </div>
                                            )}
                                        </div>
                                        {l.channel && (
                                            <span
                                                className="mono text-[9px] uppercase tracking-[0.15em] border border-black/30 px-1.5 py-0.5 text-black/70"
                                                title={l.channel}
                                            >
                                                {channelSymbol(l.channel)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mono text-[10px] uppercase tracking-[0.2em] text-black/40">
                                        Updated {fmtRelative(l.updated_at)}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
