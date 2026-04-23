// Generate smart suggestion prompts based on the user's actual leads.
// Returns an empty array when there are no leads.

const NEXT_PROMPTS = {
    New: (name) => `I messaged ${name} on WhatsApp`,
    Contacted: (name) => `${name} replied — schedule a call`,
    Replied: (name) => `Meeting scheduled with ${name} Friday`,
    MeetingScheduled: (name) => `Sent proposal to ${name}`,
    ProposalSent: (name) => `${name} is negotiating on price`,
    Negotiation: (name) => `${name} signed — closed won`,
    ClosedWon: (name) => `Follow up with ${name} for a referral`,
    ClosedLost: (name) => `Re-engage ${name} next quarter`,
};

export function buildSuggestions(leads, limit = 4) {
    if (!leads || leads.length === 0) return [];
    // Prioritise active leads, most recently updated first.
    const active = leads
        .filter((l) => l.stage !== "ClosedWon" && l.stage !== "ClosedLost")
        .sort(
            (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
    const pool = active.length > 0 ? active : leads;
    const picked = pool.slice(0, limit);
    const out = [];
    const seen = new Set();
    for (const l of picked) {
        const tmpl = NEXT_PROMPTS[l.stage] || NEXT_PROMPTS.New;
        const s = tmpl(l.name);
        if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
        }
    }
    return out;
}
