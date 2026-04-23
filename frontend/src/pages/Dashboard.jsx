import { useEffect, useState, useCallback } from "react";
import { api, STAGES } from "../lib/api";
import { toast } from "sonner";
import MetricsBar from "../components/MetricsBar";
import OverdueList from "../components/OverdueList";
import KanbanBoard from "../components/KanbanBoard";
import ChatInput from "../components/ChatInput";
import LeadDetailSheet from "../components/LeadDetailSheet";

export default function Dashboard() {
    const [leads, setLeads] = useState([]);
    const [stats, setStats] = useState(null);
    const [overdue, setOverdue] = useState([]);
    const [activeLeadId, setActiveLeadId] = useState(null);

    const refresh = useCallback(async () => {
        const [l, s, o] = await Promise.all([
            api.get("/leads"),
            api.get("/stats"),
            api.get("/tasks/overdue"),
        ]);
        setLeads(l.data);
        setStats(s.data);
        setOverdue(o.data);
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
                toast.success(`Updated ${lead.name}`);
            } else {
                toast("Noted.", { description: data.parsed?.note });
            }
            if (data.created_task) {
                toast.message("Next action queued", {
                    description: data.created_task.action,
                });
            }
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
                        <MetricsBar stats={stats} />
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
            <ChatInput onSubmit={handleChatSubmit} />

            <LeadDetailSheet
                leadId={activeLeadId}
                open={!!activeLeadId}
                onOpenChange={(v) => !v && setActiveLeadId(null)}
                onChanged={refresh}
            />
        </div>
    );
}
