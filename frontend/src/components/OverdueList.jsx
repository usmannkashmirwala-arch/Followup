import { api, fmtRelative } from "../lib/api";
import { toast } from "sonner";
import { AlarmClock, Check, ChevronRight, Clock } from "lucide-react";

export default function OverdueList({ items, onOpen, onRefresh }) {
    const handleDone = async (id, e) => {
        e.stopPropagation();
        try {
            await api.patch(`/tasks/${id}/complete`);
            toast.success("Done. One less thing to chase.");
            onRefresh();
        } catch {
            toast.error("Failed");
        }
    };
    const handleSnooze = async (id, e) => {
        e.stopPropagation();
        try {
            await api.patch(`/tasks/${id}/snooze?days=1`);
            toast("Snoozed 1 day");
            onRefresh();
        } catch {
            toast.error("Failed");
        }
    };

    if (!items || items.length === 0) {
        return (
            <section
                className="border border-black/15 p-6 flex items-center justify-between"
                data-testid="overdue-empty"
            >
                <div>
                    <p className="mono text-xs uppercase tracking-[0.25em] text-black/50">
                        Follow-Ups
                    </p>
                    <p className="font-display text-xl sm:text-2xl font-bold tracking-tight mt-1">
                        Inbox zero. Keep it up.
                    </p>
                </div>
                <Check className="h-6 w-6 text-black/30" strokeWidth={1.5} />
            </section>
        );
    }

    return (
        <section data-testid="overdue-list">
            <div className="flex items-end justify-between mb-4">
                <div>
                    <p className="mono text-xs uppercase tracking-[0.25em] text-[#FF3B30] flex items-center gap-2">
                        <AlarmClock className="h-3.5 w-3.5" strokeWidth={2} />
                        Do these now
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
                        <span className="text-[#FF3B30]">{items.length}</span> overdue
                        follow-up{items.length === 1 ? "" : "s"}.
                    </h2>
                </div>
            </div>
            <div className="border border-black/15 divide-y divide-black/10">
                {items.map((t) => (
                    <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(t.lead_id)}
                        onKeyDown={(e) => e.key === "Enter" && onOpen(t.lead_id)}
                        data-testid={`overdue-row-${t.id}`}
                        className="group grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-black/[0.03] transition-colors cursor-pointer"
                    >
                        <div className="col-span-12 sm:col-span-4">
                            <div className="flex items-center gap-2">
                                <span className="h-2 w-2 bg-[#FF3B30] rounded-full pulse-red" />
                                <span className="font-display text-lg font-semibold tracking-tight">
                                    {t.lead?.name || "Unknown"}
                                </span>
                                {t.lead?.company && (
                                    <span className="text-black/50 text-sm">
                                        · {t.lead.company}
                                    </span>
                                )}
                            </div>
                            <span className="mono text-[10px] uppercase tracking-[0.2em] text-black/40">
                                {t.lead?.stage}
                            </span>
                        </div>
                        <div className="col-span-12 sm:col-span-4 text-sm">
                            {t.action}
                            {t.channel && (
                                <span className="ml-2 mono text-[10px] uppercase tracking-[0.2em] border border-black/20 px-1.5 py-0.5">
                                    {t.channel}
                                </span>
                            )}
                        </div>
                        <div className="col-span-6 sm:col-span-2 mono text-xs text-[#FF3B30] flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                            {fmtRelative(t.due_date)}
                        </div>
                        <div className="col-span-6 sm:col-span-2 flex items-center justify-end gap-2">
                            <button
                                onClick={(e) => handleSnooze(t.id, e)}
                                data-testid={`snooze-btn-${t.id}`}
                                className="mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 border border-black/20 hover:border-black hover:bg-black hover:text-white transition-colors"
                            >
                                Snooze
                            </button>
                            <button
                                onClick={(e) => handleDone(t.id, e)}
                                data-testid={`done-btn-${t.id}`}
                                className="mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 bg-black text-white hover:bg-[#002FA7] transition-colors"
                            >
                                Done
                            </button>
                            <ChevronRight
                                className="h-4 w-4 text-black/30 group-hover:text-black transition-colors"
                                strokeWidth={1.5}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
