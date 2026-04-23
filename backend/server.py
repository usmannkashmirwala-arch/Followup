from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta

from anthropic import AsyncAnthropic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
STAGES = [
    "New",
    "Contacted",
    "Replied",
    "MeetingScheduled",
    "ProposalSent",
    "Negotiation",
    "ClosedWon",
    "ClosedLost",
]
CHANNELS = ["WhatsApp", "Email", "Phone", "SMS", "LinkedIn", "Other"]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    company: Optional[str] = None
    contact_info: Optional[str] = None  # email/phone handle
    stage: str = "New"
    channel: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_info: Optional[str] = None
    stage: Optional[str] = None
    channel: Optional[str] = None
    notes: Optional[str] = None


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    kind: str  # "note" | "stage_change" | "contact" | "ai_update"
    content: str
    channel: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    action: str
    channel: Optional[str] = None
    due_date: str  # ISO
    status: Literal["pending", "done", "snoozed"] = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None


class TaskCreate(BaseModel):
    lead_id: str
    action: str
    channel: Optional[str] = None
    due_date: Optional[str] = None  # ISO; default now+1d


class ChatInput(BaseModel):
    text: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _find_lead_by_name(name: str) -> Optional[dict]:
    if not name:
        return None
    # case-insensitive exact or partial match
    regex = {"$regex": f"^{re.escape(name)}$", "$options": "i"}
    doc = await db.leads.find_one({"name": regex}, {"_id": 0})
    if doc:
        return doc
    # fallback: contains
    regex2 = {"$regex": re.escape(name), "$options": "i"}
    return await db.leads.find_one({"name": regex2}, {"_id": 0})


# ---------------------------------------------------------------------------
# AI Parser (Claude Sonnet 4.5)
# ---------------------------------------------------------------------------
PARSER_SYSTEM = f"""You are a CRM update parser for a solo AI-automation business owner.
Input is a short natural-language status note about a sales lead. Extract a STRUCTURED JSON object.

Allowed pipeline stages (use EXACTLY one of these values, or null):
{STAGES}

Allowed contact channels (use EXACTLY one, or null):
{CHANNELS}

Return ONLY valid JSON (no markdown, no prose) in this exact shape:
{{
  "lead_name": string | null,        // person name mentioned
  "company": string | null,          // company if mentioned
  "contact_info": string | null,     // phone/email/handle if present
  "stage": string | null,            // inferred pipeline stage
  "channel": string | null,          // inferred contact channel
  "note": string,                    // concise summary of the update (one sentence)
  "next_action": string | null,      // what the USER (owner) should do next, imperative, e.g. "Send proposal"
  "due_in_days": number | null,      // how many days until next action is due; null if unknown; 0 = today
  "intent": "create" | "update" | "complete" | "note_only"
}}

Rules:
- If the user says "I messaged/emailed/called them", set stage to at least "Contacted" and intent="update" (or "create" if new).
- If the user says "they replied" / "responded" → stage="Replied".
- If "scheduled meeting/call" → "MeetingScheduled".
- If "sent proposal/quote" → "ProposalSent".
- If "negotiating/discussing price" → "Negotiation".
- If "signed/closed/won" → "ClosedWon". If "not interested/lost" → "ClosedLost".
- If the note indicates an action the user JUST completed (e.g. "I emailed them"), intent="complete" AND set next_action to the logical follow-up (e.g. "Wait 2 days then follow up") with due_in_days~=2 if appropriate.
- If unsure about a new vs existing lead, use intent="update" (the server will create if not found).
- Always produce a `note` field (never null).
"""


async def parse_update(text: str) -> dict:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")
    client_ai = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    message = await client_ai.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=PARSER_SYSTEM,
        messages=[{"role": "user", "content": text}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    try:
        data = json.loads(raw)
    except Exception as e:
        logger.error(f"parse failure: {raw!r}")
        raise HTTPException(502, f"AI parse failed: {e}")
    if data.get("stage") and data["stage"] not in STAGES:
        data["stage"] = None
    if data.get("channel") and data["channel"] not in CHANNELS:
        data["channel"] = None
    data.setdefault("note", text)
    data.setdefault("intent", "update")
    return data


# ---------------------------------------------------------------------------
# Routes: Leads
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"ok": True, "app": "FollowUp CRM"}


@api_router.get("/leads", response_model=List[Lead])
async def list_leads():
    docs = await db.leads.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return [Lead(**d) for d in docs]


@api_router.post("/leads", response_model=Lead)
async def create_lead(payload: LeadUpdate):
    if not payload.name:
        raise HTTPException(400, "name is required")
    if payload.stage and payload.stage not in STAGES:
        raise HTTPException(400, "invalid stage")
    if payload.channel and payload.channel not in CHANNELS:
        raise HTTPException(400, "invalid channel")
    lead = Lead(
        name=payload.name,
        company=payload.company,
        contact_info=payload.contact_info,
        stage=payload.stage or "New",
        channel=payload.channel,
        notes=payload.notes or "",
    )
    await db.leads.insert_one(lead.model_dump())
    await db.activities.insert_one(
        Activity(lead_id=lead.id, kind="note", content="Lead created").model_dump()
    )
    return lead


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "lead not found")
    activities = await db.activities.find({"lead_id": lead_id}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(500)
    tasks = await db.tasks.find({"lead_id": lead_id}, {"_id": 0}).sort(
        "due_date", 1
    ).to_list(500)
    return {"lead": lead, "activities": activities, "tasks": tasks}


@api_router.patch("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, payload: LeadUpdate):
    existing = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "lead not found")
    if payload.stage and payload.stage not in STAGES:
        raise HTTPException(400, "invalid stage")
    if payload.channel and payload.channel not in CHANNELS:
        raise HTTPException(400, "invalid channel")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    # log stage change
    if payload.stage and payload.stage != existing.get("stage"):
        await db.activities.insert_one(
            Activity(
                lead_id=lead_id,
                kind="stage_change",
                content=f"Stage: {existing.get('stage')} → {payload.stage}",
            ).model_dump()
        )
    merged = {**existing, **updates}
    return Lead(**merged)


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    await db.leads.delete_one({"id": lead_id})
    await db.activities.delete_many({"lead_id": lead_id})
    await db.tasks.delete_many({"lead_id": lead_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Tasks
# ---------------------------------------------------------------------------
@api_router.get("/tasks", response_model=List[Task])
async def list_tasks(status: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    docs = await db.tasks.find(q, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return [Task(**d) for d in docs]


@api_router.get("/tasks/overdue")
async def overdue_tasks():
    now = now_iso()
    docs = await db.tasks.find(
        {"status": "pending", "due_date": {"$lte": now}}, {"_id": 0}
    ).sort("due_date", 1).to_list(1000)
    # attach lead name
    out = []
    for t in docs:
        lead = await db.leads.find_one({"id": t["lead_id"]}, {"_id": 0, "name": 1, "company": 1, "stage": 1})
        out.append({**t, "lead": lead})
    return out


@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate):
    lead = await db.leads.find_one({"id": payload.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "lead not found")
    due = payload.due_date or (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    task = Task(
        lead_id=payload.lead_id,
        action=payload.action,
        channel=payload.channel,
        due_date=due,
    )
    await db.tasks.insert_one(task.model_dump())
    return task


@api_router.patch("/tasks/{task_id}/complete", response_model=Task)
async def complete_task(task_id: str):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "task not found")
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": "done", "completed_at": now_iso()}},
    )
    await db.activities.insert_one(
        Activity(
            lead_id=task["lead_id"],
            kind="contact",
            content=f"Completed: {task['action']}",
            channel=task.get("channel"),
        ).model_dump()
    )
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return Task(**updated)


@api_router.patch("/tasks/{task_id}/snooze", response_model=Task)
async def snooze_task(task_id: str, days: int = 1):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(404, "task not found")
    new_due = (datetime.now(timezone.utc) + timedelta(days=max(1, days))).isoformat()
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"due_date": new_due, "status": "pending"}},
    )
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return Task(**updated)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: Stats
# ---------------------------------------------------------------------------
@api_router.get("/stats")
async def stats():
    total = await db.leads.count_documents({})
    now = now_iso()
    overdue = await db.tasks.count_documents({"status": "pending", "due_date": {"$lte": now}})
    pending = await db.tasks.count_documents({"status": "pending"})
    won = await db.leads.count_documents({"stage": "ClosedWon"})
    active = await db.leads.count_documents(
        {"stage": {"$nin": ["ClosedWon", "ClosedLost"]}}
    )
    by_stage = {}
    for s in STAGES:
        by_stage[s] = await db.leads.count_documents({"stage": s})
    return {
        "total_leads": total,
        "active_leads": active,
        "won": won,
        "overdue_tasks": overdue,
        "pending_tasks": pending,
        "by_stage": by_stage,
    }


# ---------------------------------------------------------------------------
# Routes: Chat / AI update
# ---------------------------------------------------------------------------
@api_router.post("/chat/parse")
async def chat_parse(body: ChatInput):
    if not body.text or not body.text.strip():
        raise HTTPException(400, "text required")
    parsed = await parse_update(body.text.strip())

    lead_name = (parsed.get("lead_name") or "").strip()
    lead_doc = await _find_lead_by_name(lead_name) if lead_name else None
    created = False

    if not lead_doc and lead_name:
        lead = Lead(
            name=lead_name,
            company=parsed.get("company"),
            contact_info=parsed.get("contact_info"),
            stage=parsed.get("stage") or "New",
            channel=parsed.get("channel"),
            notes="",
        )
        await db.leads.insert_one(lead.model_dump())
        lead_doc = lead.model_dump()
        created = True
        await db.activities.insert_one(
            Activity(
                lead_id=lead.id,
                kind="ai_update",
                content=f"Created via chat: {parsed.get('note', '')}",
                channel=parsed.get("channel"),
            ).model_dump()
        )

    if lead_doc:
        updates = {"updated_at": now_iso()}
        if parsed.get("stage") and parsed["stage"] != lead_doc.get("stage"):
            updates["stage"] = parsed["stage"]
            await db.activities.insert_one(
                Activity(
                    lead_id=lead_doc["id"],
                    kind="stage_change",
                    content=f"{lead_doc.get('stage')} → {parsed['stage']}",
                ).model_dump()
            )
        if parsed.get("channel"):
            updates["channel"] = parsed["channel"]
        if parsed.get("company") and not lead_doc.get("company"):
            updates["company"] = parsed["company"]
        if parsed.get("contact_info") and not lead_doc.get("contact_info"):
            updates["contact_info"] = parsed["contact_info"]
        await db.leads.update_one({"id": lead_doc["id"]}, {"$set": updates})

        # activity note
        await db.activities.insert_one(
            Activity(
                lead_id=lead_doc["id"],
                kind="ai_update",
                content=parsed.get("note") or body.text,
                channel=parsed.get("channel"),
            ).model_dump()
        )

        # auto-complete latest pending task for this lead if user reports completion
        created_task = None
        if parsed.get("intent") == "complete":
            pending = await db.tasks.find_one(
                {"lead_id": lead_doc["id"], "status": "pending"},
                {"_id": 0},
                sort=[("due_date", 1)],
            )
            if pending:
                await db.tasks.update_one(
                    {"id": pending["id"]},
                    {"$set": {"status": "done", "completed_at": now_iso()}},
                )

        # create next-action task
        if parsed.get("next_action"):
            offset = parsed.get("due_in_days")
            if offset is None:
                offset = 1
            due = (datetime.now(timezone.utc) + timedelta(days=max(0, int(offset)))).isoformat()
            task = Task(
                lead_id=lead_doc["id"],
                action=parsed["next_action"],
                channel=parsed.get("channel"),
                due_date=due,
            )
            await db.tasks.insert_one(task.model_dump())
            created_task = task.model_dump()

        lead_final = await db.leads.find_one({"id": lead_doc["id"]}, {"_id": 0})
        return {
            "ok": True,
            "parsed": parsed,
            "lead": lead_final,
            "created_lead": created,
            "created_task": created_task,
        }

    return {"ok": True, "parsed": parsed, "lead": None, "created_lead": False, "created_task": None}


# ---------------------------------------------------------------------------
# App mount
# ---------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
