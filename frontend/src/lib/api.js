import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    headers: { "Content-Type": "application/json" },
});

export const STAGES = [
    { key: "New", label: "New" },
    { key: "Contacted", label: "Contacted" },
    { key: "Replied", label: "Replied" },
    { key: "MeetingScheduled", label: "Meeting" },
    { key: "ProposalSent", label: "Proposal" },
    { key: "Negotiation", label: "Negotiation" },
    { key: "ClosedWon", label: "Won" },
    { key: "ClosedLost", label: "Lost" },
];

export const CHANNELS = ["WhatsApp", "Email", "Phone", "SMS", "LinkedIn", "Other"];

export const fmtRelative = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diffMs = d.getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const min = 60 * 1000;
    const hr = 60 * min;
    const day = 24 * hr;
    const sign = diffMs < 0 ? "ago" : "in";
    if (abs < hr) {
        const n = Math.max(1, Math.round(abs / min));
        return sign === "ago" ? `${n}m ago` : `in ${n}m`;
    }
    if (abs < day) {
        const n = Math.round(abs / hr);
        return sign === "ago" ? `${n}h ago` : `in ${n}h`;
    }
    const n = Math.round(abs / day);
    return sign === "ago" ? `${n}d ago` : `in ${n}d`;
};

export const isOverdue = (iso) => new Date(iso).getTime() <= Date.now();
