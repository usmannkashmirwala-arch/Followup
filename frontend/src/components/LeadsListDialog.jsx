import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { fmtRelative } from "../lib/api";
import { Clock } from "lucide-react";

export default function LeadsListDialog({
    open,
    onOpenChange,
    title,
    subtitle,
    items,
    emptyText = "Nothing here yet.",
    variant = "default", // default | danger | success
    onOpenLead,
}) {
    const accent =
        variant === "danger"
            ? "text-[#FF3B30]"
            : variant === "success"
            ? "text-black"
            : "text-[#002FA7]";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-testid="leads-list-dialog"
                className="max-w-2xl rounded-sm border-black/20 p-0 overflow-hidden"
            >
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/10 space-y-1">
                    <p
                        className={`mono text-[10px] uppercase tracking-[0.25em] ${accent}`}
                    >
                        {subtitle}
                    </p>
                    <DialogTitle className="font-display text-2xl sm:text-3xl font-black tracking-tighter text-left">
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="p-10 text-center mono text-[10px] uppercase tracking-[0.2em] text-black/40">
                            {emptyText}
                        </div>
                    ) : (
                        <ul className="divide-y divide-black/10">
                            {items.map((it) => (
                                <li
                                    key={it.key}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        onOpenLead(it.leadId);
                                        onOpenChange(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            onOpenLead(it.leadId);
                                            onOpenChange(false);
                                        }
                                    }}
                                    data-testid={`leads-list-row-${it.leadId}`}
                                    className="px-6 py-4 hover:bg-black/[0.03] cursor-pointer flex items-center justify-between gap-4"
                                >
                                    <div className="min-w-0">
                                        <div className="font-display text-base font-semibold tracking-tight truncate">
                                            {it.name}
                                            {it.company && (
                                                <span className="text-black/50 font-normal">
                                                    {" "}
                                                    · {it.company}
                                                </span>
                                            )}
                                        </div>
                                        {it.secondary && (
                                            <div className="text-xs text-black/60 truncate mt-0.5">
                                                {it.secondary}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {it.stage && (
                                            <span className="mono text-[9px] uppercase tracking-[0.2em] border border-black/20 px-1.5 py-0.5 text-black/70">
                                                {it.stage}
                                            </span>
                                        )}
                                        {it.when && (
                                            <span
                                                className={`mono text-[10px] flex items-center gap-1 ${
                                                    it.overdue
                                                        ? "text-[#FF3B30]"
                                                        : "text-black/50"
                                                }`}
                                            >
                                                <Clock
                                                    className="h-3 w-3"
                                                    strokeWidth={2}
                                                />
                                                {it.when}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
