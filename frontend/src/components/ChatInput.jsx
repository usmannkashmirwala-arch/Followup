import { useState, useRef, useEffect } from "react";
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";

export default function ChatInput({ onSubmit, suggestions = [] }) {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const submit = async (e) => {
        e?.preventDefault?.();
        const t = text.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            await onSubmit(t);
            setText("");
        } catch {
            /* toast handled by parent */
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
            data-testid="chat-input-wrapper"
        >
            <div className="max-w-3xl mx-auto px-4 pb-6 pointer-events-auto">
                {suggestions.length > 0 && (
                    <div
                        className="mb-2 flex flex-wrap gap-1.5"
                        data-testid="chat-suggestions"
                    >
                        {suggestions.map((ex, i) => (
                            <button
                                key={`${ex}-${i}`}
                                type="button"
                                onClick={() => {
                                    setText(ex);
                                    inputRef.current?.focus();
                                }}
                                data-testid="chat-example-btn"
                                className="mono text-[10px] uppercase tracking-[0.15em] bg-white border border-black/15 hover:border-black px-2.5 py-1.5 transition-colors"
                            >
                                {ex.length > 42 ? ex.slice(0, 42) + "…" : ex}
                            </button>
                        ))}
                    </div>
                )}
                <form
                    onSubmit={submit}
                    className="relative bg-white border border-black/20 shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex items-center gap-2 p-2"
                >
                    {busy && (
                        <div className="absolute inset-x-0 top-0 h-[2px] ai-beam" />
                    )}
                    <Sparkles
                        className="h-4 w-4 ml-2 text-[#002FA7] flex-shrink-0"
                        strokeWidth={2}
                    />
                    <input
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Tell me what happened… e.g. 'John from Acme replied, send proposal Fri'"
                        disabled={busy}
                        data-testid="chat-input"
                        className="flex-1 bg-transparent outline-none text-base placeholder:text-black/40 px-2 py-2"
                    />
                    <span className="hidden sm:block mono text-[10px] uppercase tracking-[0.15em] text-black/40">
                        ⌘K
                    </span>
                    <button
                        type="submit"
                        disabled={busy || !text.trim()}
                        data-testid="chat-submit-btn"
                        className="bg-black text-white p-2.5 hover:bg-[#002FA7] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        ) : (
                            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
