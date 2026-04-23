import { useEffect, useState, useCallback, useMemo } from "react";
import { api, STAGES, fmtRelative, isOverdue } from "../lib/api";
import { buildSuggestions } from "../lib/suggestions";
import { toast } from "sonner";
import MetricsBar from "../components/MetricsBar";
import OverdueList from "../components/OverdueList";
import KanbanBoard from "../components/KanbanBoard";
import ChatInput from "../components/ChatInput";
import LeadDetailSheet from "../components/LeadDetailSheet";
import LeadsListDialog from "../components/LeadsListDialog";

export default function Dashboard() {
    const [leads, setLeads] = useState([]);
    const [stats, setStats] = useState(null);
    const [overdue, setOverdue] = useState([]);
    const [pendingTasks, setPendingTasks] = useState([]);
    const [activeLeadId, setActiveLeadId] = useState(null);
    const [listKey, setListKey] = useState(null); // "active" | "pending" | "overdue" | "won"

    const refresh = useCallback(async () => {
        const [l, s, o, p] = await Promise.all([
            api.get("/leads"),
            api.get("/stats"),
            api.get("/tasks/overdue"),
            api.get("/tasks?status=pending"),
        ]);
        setLeads(l.data);
        setStats(s.data);
        setOverdue(o.data);
        setPendingTasks(p.data);
    }, []);

    useEffect(() => {
        refresh().catch((e) => {
            console.error(e);
            toast.error("Failed to load data");
        });
    }, [refresh]);

    const handleChatSubmit = async (text) => {
        try {
            const { data } = await api.post("/chat/parse", { text });
            const lead = data.lead;
            if (data.created_lead) {
                toast.success(`New lead: ${lead?.name}`);
            } else if (lead) {
                toast.success(
                    `${lead.name} → ${lead.stage}`,
                    { description: data.parsed?.note }
                );
            } else {
                toast("Noted.", { description: data.parsed?.note });
            }
            if (data.created_task) {
                toast.message("Next action queued", {
                    description: data.created_task.action,
                });
            }
            // double refresh to defeat any intermediate stale state
            await refresh();
            return data;
        } catch (e) {
            console.error(e);
            toast.error(e?.response?.data?.detail || "AI parse failed");
            throw e;
        }
    };

    const moveLeadStage = async (leadId, stage) => {
        await api.patch(`/leads/${leadId}`, { stage });
        await refresh();
    };

    const suggestions = useMemo(() => buildSuggestions(leads, 4), [leads]);

    // Build list dialog content based on selected metric
    const leadsById = useMemo(() => {
        const map = new Map();
        leads.forEach((l) => map.set(l.id, l));
        return map;
    }, [leads]);

    const listConfig = useMemo(() => {
        if (!listKey) return null;
        if (listKey === "active") {
            const items = leads
                .filter(
                    (l) => l.stage !== "ClosedWon" && l.stage !== "ClosedLost"
                )
                .map((l) => ({
                    key: l.id,
                    leadId: l.id,
                    name: l.name,
                    company: l.company,
                    secondary: l.notes || null,
                    stage: l.stage,
                    when: `updated ${fmtRelative(l.updated_at)}`,
                }));
            return {
                title: "Active leads",
                subtitle: `${items.length} in the pipeline`,
                items,
                variant: "default",
                emptyText: "No active leads.",
            };
        }
        if (listKey === "won") {
            const items = leads
                .filter((l) => l.stage === "ClosedWon")
                .map((l) => ({
                    key: l.id,
                    leadId: l.id,
                    name: l.name,
                    company: l.company,
                    stage: "Won",
                    when: `closed ${fmtRelative(l.updated_at)}`,
                }));
            return {
                title: "Closed won",
                subtitle: `${items.length} deal${items.length === 1 ? "" : "s"} landed`,
                items,
                variant: "success",
                emptyText: "No wins yet — keep pushing.",
            };
        }
        if (listKey === "pending") {
            const items = pendingTasks.map((t) => {
                const lead = leadsById.get(t.lead_id);
                const od = isOverdue(t.due_date);
                return {
                    key: t.id,
                    leadId: t.lead_id,
                    name: lead?.name || "Unknown",
                    company: lead?.company,
                    secondary: t.action,
                    stage: lead?.stage,
                    when: fmtRelative(t.due_date),
                    overdue: od,
                };
            });
            return {
                title: "Pending follow-ups",
                subtitle: `${items.length} reminder${items.length === 1 ? "" : "s"} queued`,
                items,
                variant: "default",
                emptyText: "Nothing queued.",
            };
        }
        if (listKey === "overdue") {
            const items = overdue.map((t) => ({
                key: t.id,
                leadId: t.lead_id,
                name: t.lead?.name || "Unknown",
                company: t.lead?.company,
                secondary: t.action,
                stage: t.lead?.stage,
                when: fmtRelative(t.due_date),
                overdue: true,
            }));
            return {
                title: "Overdue — act now",
                subtitle: `${items.length} need${items.length === 1 ? "s" : ""} your attention`,
                items,
                variant: "danger",
                emptyText: "You're all caught up.",
            };
        }
        return null;
    }, [listKey, leads, pendingTasks, overdue, leadsById]);

    return (
        <div
            className="min-h-screen bg-white text-[#0a0a0a] pb-40"
            data-testid="dashboard-root"
        >
            {/* Header */}
            <header className="border-b border-black/10">
                <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                        <span
                            className="font-display text-2xl sm:text-3xl font-black tracking-tighter"
                            data-testid="app-title"
                        >
                            FOLLOWUP<span className="text-[#FF3B30]">.</span>
                        </span>
                        <span className="mono text-[11px] uppercase tracking-[0.2em] text-black/50">
                            v0.1 — Solo CRM
                        </span>
                    </div>
                    <div className="mono text-xs text-black/60">
                        {new Date().toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                        })}
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-6 md:px-10 py-8 space-y-10">
                {/* Hero */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end">
                    <div className="lg:col-span-8">
                        <p className="mono text-xs uppercase tracking-[0.25em] text-black/50 mb-4">
                            Pipeline · Today
                        </p>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.9]">
                            Don't let another lead
                            <br />
                            <span className="text-[#FF3B30]">go cold.</span>
                        </h1>
                        <p className="mt-5 text-base sm:text-lg text-black/60 max-w-xl leading-relaxed">
                            Type updates like <em>“Priya from Nova replied on WhatsApp, send
                            proposal Friday”</em> — the AI files it under the right lead and
                            nags you until it's done.
                        </p>
                    </div>
                    <div className="lg:col-span-4">
                        <MetricsBar stats={stats} onSelect={(k) => setListKey(k)} />
                    </div>
                </section>

                {/* Overdue */}
                <OverdueList
                    items={overdue}
                    onOpen={(id) => setActiveLeadId(id)}
                    onRefresh={refresh}
                />

                {/* Kanban */}
                <section>
                    <div className="flex items-end justify-between mb-5">
                        <div>
                            <p className="mono text-xs uppercase tracking-[0.25em] text-black/50">
                                Pipeline Board
                            </p>
                            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-1">
                                Every lead, every stage.
                            </h2>
                        </div>
                        <span
                            className="mono text-xs text-black/50"
                            data-testid="leads-count"
                        >
                            {leads.length} LEAD{leads.length === 1 ? "" : "S"}
                        </span>
                    </div>
                    <KanbanBoard
                        leads={leads}
                        stages={STAGES}
                        onOpenLead={(id) => setActiveLeadId(id)}
                        onMoveStage={moveLeadStage}
                    />
                </section>
            </main>

            {/* Sticky AI input */}
            <ChatInput onSubmit={handleChatSubmit} suggestions={suggestions} />

            <LeadDetailSheet
                leadId={activeLeadId}
                open={!!activeLeadId}
                onOpenChange={(v) => !v && setActiveLeadId(null)}
                onChanged={refresh}
            />

            {listConfig && (
                <LeadsListDialog
                    open={!!listKey}
                    onOpenChange={(v) => !v && setListKey(null)}
                    title={listConfig.title}
                    subtitle={listConfig.subtitle}
                    items={listConfig.items}
                    variant={listConfig.variant}
                    emptyText={listConfig.emptyText}
                    onOpenLead={(id) => setActiveLeadId(id)}
                />
            )}
        </div>
    );
}
