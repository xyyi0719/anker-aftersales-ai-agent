"""Persistent, idempotent mock handoffs; no promise of actual human dispatch."""
import hashlib
import json
import os
import sqlite3
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel, Field
router = APIRouter(prefix='/api/tickets',tags=['tickets'])

def ticket(session, summary):
    ident = 'MOCK-' + hashlib.sha256(session.encode()).hexdigest()[:16].upper()
    path = Path(os.environ.get('TICKET_DB',str(Path(__file__).resolve().parents[1]/'data/tickets.sqlite3')))
    path.parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(path, timeout=10) as db:
        db.execute('CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, summary TEXT NOT NULL)')
        db.execute('INSERT INTO tickets VALUES (?,?) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary',(ident,json.dumps(summary,ensure_ascii=False)))
    return dict(ticket_id=ident,status='mock_pending',mock=True,dispatched=False)
class TicketRequest(BaseModel):
    conversation_id: str = Field(min_length=1,max_length=200)
    summary: dict = Field(default_factory=dict)
@router.post('')
def create(req: TicketRequest):
    return ticket(req.conversation_id,req.summary)
