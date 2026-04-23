import { useEffect, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "../components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { api, STAGES, CHANNELS, fmtRelative, isOverdue } from "../lib/api";
import { toast } from "sonner";
import { Check, Clock, Trash2, Plus, AlarmClock } from "lucide-react";

export default function LeadDetailSheet({ leadId, open, onOpenChange, onChanged }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [newAction, setNewAction] = useState("");
    const [newDays, setNewDays] = useState(1);
    const [newChannel, setNewChannel] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    const load = async () => {
        if (!leadId) return;
        setLoading(true);
        try {
            const res = await api.get(`/leads/${leadId}`);
            setData(res.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && leadId) load();
        if (!open) {
            setData(null);
            setConfirmDelete(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, leadId]);

    const updateField = async (patch) => {
        await api.patch(`/leads/${leadId}`, patch);
        await load();
        onChanged?.();
    };

    const completeTask = async (id) => {
        await api.patch(`/tasks/${id}/complete`);
        await load();
        onChanged?.();
        toast.success("Task completed");
    };
    const snoozeTask = async (id) => {
        await api.patch(`/tasks/${id}/snooze?days=1`);
        await load();
        onChanged?.();
        toast("Snoozed 1 day");
    };
    const deleteTask = async (id) => {
        await api.delete(`/tasks/${id}`);
        await load();
        onChanged?.();
    };

    const addTask = async () => {
        if (!newAction.trim()) return;
        const due = new Date(
            Date.now() + Math.max(0, Number(newDays) || 0) * 24 * 3600 * 1000
        ).toISOString();
        await api.post("/tasks", {
            lead_id: leadId,
            action: newAction.trim(),
            channel: newChannel || null,
            due_date: due,
        });
        setNewAction("");
        setNewDays(1);
        setNewChannel("");
        await load();
        onChanged?.();
        toast.success("Reminder set");
    };

    const deleteLead = async () => {
        try {
            await api.delete(`/leads/${leadId}`);
            setConfirmDelete(false);
            onOpenChange(false);
            onChanged?.();
            toast("Lead deleted");
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete lead");
        }
    };

    const lead = data?.lead;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl overflow-y-auto bg-white border-l border-black/15 p-0"
                data-testid="lead-detail-sheet"
            >
                {loading || !lead ? (
                    <div className="p-8 mono text-xs uppercase tracking-[0.2em] text-black/40">
                        Loading…
                    </div>
                ) : (
                    <>
                        <SheetHeader className="p-6 border-b border-black/10 space-y-1">
                            <p className="mono text-[10px] uppercase tracking-[0.25em] text-black/50">
                                Lead
                            </p>
                            <SheetTitle
                                className="font-display text-3xl font-black tracking-tighter text-left"
                                data-testid="lead-detail-name"
                            >
                                {lead.name}
                            </SheetTitle>
                            {lead.company && (
                                <p className="text-sm text-black/60">{lead.company}</p>
                            )}
                            {lead.contact_info && (
                                <p className="mono text-xs text-black/50">
                                    {lead.contact_info}
                                </p>
                            )}
                        </SheetHeader>

                        <div className="p-6 space-y-8">
                            {/* Stage & channel */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mono text-[10px] uppercase tracking-[0.2em] text-black/50 block mb-2">
                                        Stage
                                    </label>
                                    <Select
                                        value={lead.stage}
                                        onValueChange={(v) => updateField({ stage: v })}
                                    >
                                        <SelectTrigger
                                            data-testid="stage-select"
                                            className="rounded-sm border-black/20"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STAGES.map((s) => (
                                                <SelectItem key={s.key} value={s.key}>
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="mono text-[10px] uppercase tracking-[0.2em] text-black/50 block mb-2">
                                        Channel
                                    </label>
                                    <Select
                                        value={lead.channel || ""}
                                        onValueChange={(v) => updateField({ channel: v })}
                                    >
                                        <SelectTrigger
                                            data-testid="channel-select"
                                            className="rounded-sm border-black/20"
                                        >
                                            <SelectValue placeholder="—" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CHANNELS.map((c) => (
                                                <SelectItem key={c} value={c}>
                                                    {c}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Tasks */}
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="mono text-[10px] uppercase tracking-[0.25em] text-black/70 flex items-center gap-2">
                                        <AlarmClock className="h-3.5 w-3.5" strokeWidth={2} />
                                        Reminders
                                    </h3>
                                    <span className="mono text-[10px] text-black/40">
                                        {data.tasks?.filter((t) => t.status === "pending").length}{" "}
                                        pending
                                    </span>
                                </div>
                                <div className="border border-black/15 divide-y divide-black/10">
                                    {data.tasks.length === 0 && (
                                        <div className="p-4 mono text-[10px] uppercase tracking-[0.2em] text-black/30 text-center">
                                            No reminders yet
                                        </div>
                                    )}
                                    {data.tasks.map((t) => {
                                        const od =
                                            t.status === "pending" && isOverdue(t.due_date);
                                        return (
                                            <div
                                                key={t.id}
                                                className={[
                                                    "flex items-center gap-3 px-4 py-3",
                                                    t.status === "done"
                                                        ? "opacity-40 line-through"
                                                        : "",
                                                ].join(" ")}
                                                data-testid={`task-row-${t.id}`}
                                            >
                                                <span
                                                    className={[
                                                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                                                        od
                                                            ? "bg-[#FF3B30] pulse-red"
                                                            : t.status === "done"
                                                            ? "bg-black/30"
                                                            : "bg-[#002FA7]",
                                                    ].join(" ")}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm truncate">
                                                        {t.action}
                                                    </div>
                                                    <div className="mono text-[10px] uppercase tracking-[0.15em] text-black/50 flex items-center gap-2">
                                                        <Clock
                                                            className="h-3 w-3"
                                                            strokeWidth={2}
                                                        />
                                                        <span
                                                            className={
                                                                od ? "text-[#FF3B30]" : ""
                                                            }
                                                        >
                                                            {fmtRelative(t.due_date)}
                                                        </span>
                                                        {t.channel && (
                                                            <span className="border border-black/20 px-1">
                                                                {t.channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {t.status === "pending" && (
                                                    <>
                                                        <button
                                                            onClick={() => snoozeTask(t.id)}
                                                            data-testid={`task-snooze-${t.id}`}
                                                            className="mono text-[9px] uppercase tracking-[0.15em] px-2 py-1 border border-black/20 hover:border-black"
                                                        >
                                                            +1d
                                                        </button>
                                                        <button
                                                            onClick={() => completeTask(t.id)}
                                                            data-testid={`task-done-${t.id}`}
                                                            className="bg-black text-white p-1.5 hover:bg-[#002FA7]"
                                                        >
                                                            <Check
                                                                className="h-3 w-3"
                                                                strokeWidth={3}
                                                            />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => deleteTask(t.id)}
                                                    data-testid={`task-delete-${t.id}`}
                                                    className="text-black/30 hover:text-[#FF3B30]"
                                                >
                                                    <Trash2
                                                        className="h-3.5 w-3.5"
                                                        strokeWidth={1.5}
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Add task */}
                                <div className="mt-3 border border-black/15 p-3 flex flex-col sm:flex-row gap-2">
                                    <input
                                        value={newAction}
                                        onChange={(e) => setNewAction(e.target.value)}
                                        placeholder="New reminder…"
                                        data-testid="new-task-input"
                                        className="flex-1 outline-none border border-black/15 px-2.5 py-1.5 text-sm focus:border-black"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        value={newDays}
                                        onChange={(e) => setNewDays(e.target.value)}
                                        data-testid="new-task-days"
                                        className="w-20 outline-none border border-black/15 px-2.5 py-1.5 text-sm focus:border-black mono"
                                        title="Days from now"
                                    />
                                    <Select
                                        value={newChannel}
                                        onValueChange={(v) => setNewChannel(v)}
                                    >
                                        <SelectTrigger
                                            data-testid="new-task-channel"
                                            className="w-32 rounded-sm border-black/15"
                                        >
                                            <SelectValue placeholder="Channel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CHANNELS.map((c) => (
                                                <SelectItem key={c} value={c}>
                                                    {c}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <button
                                        onClick={addTask}
                                        data-testid="new-task-add"
                                        className="bg-black text-white px-3 py-1.5 hover:bg-[#002FA7] flex items-center gap-1 mono text-[10px] uppercase tracking-[0.15em]"
                                    >
                                        <Plus className="h-3 w-3" strokeWidth={3} /> Add
                                    </button>
                                </div>
                            </section>

                            {/* Activity timeline */}
                            <section>
                                <h3 className="mono text-[10px] uppercase tracking-[0.25em] text-black/70 mb-3">
                                    Activity
                                </h3>
                                <div className="relative border-l border-black/15 ml-2 pl-6 py-1 space-y-5">
                                    {data.activities.length === 0 && (
                                        <div className="mono text-[10px] uppercase tracking-[0.2em] text-black/30">
                                            No activity
                                        </div>
                                    )}
                                    {data.activities.map((a) => (
                                        <div
                                            key={a.id}
                                            className="relative"
                                            data-testid={`activity-${a.id}`}
                                        >
                                            <span className="absolute -left-[29px] top-1 w-3 h-3 bg-white border-2 border-black rounded-full" />
                                            <div className="mono text-[9px] uppercase tracking-[0.2em] text-black/40">
                                                {a.kind.replace("_", " ")} ·{" "}
                                                {fmtRelative(a.created_at)}
                                            </div>
                                            <div className="text-sm mt-0.5">{a.content}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="pt-4 border-t border-black/10 flex justify-end gap-2">
                                {confirmDelete ? (
                                    <>
                                        <button
                                            onClick={() => setConfirmDelete(false)}
                                            data-testid="delete-lead-cancel"
                                            className="mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-black/20 hover:border-black"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={deleteLead}
                                            data-testid="delete-lead-confirm"
                                            className="mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 bg-[#FF3B30] text-white hover:bg-[#D32F2F] flex items-center gap-1"
                                        >
                                            <Trash2 className="h-3 w-3" /> Confirm delete
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        data-testid="delete-lead-btn"
                                        className="mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-[#FF3B30]/40 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        <Trash2 className="h-3 w-3" /> Delete lead
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
