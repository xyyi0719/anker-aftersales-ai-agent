"""Persistent, idempotent mock handoffs; no promise of actual human dispatch."""
import hashlib
import json
import os
import sqlite3
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel, Field
router = APIRouter(prefix='/api/tickets',tags=['tickets'])
ALLOWED_ACTIONS = frozenset({'transfer_to_agent'})


def ticket_id_for(session):
    """工单 ID 由会话派生：它同时是归属凭证，因此不需要额外存 session。"""
    return 'MOCK-' + hashlib.sha256(session.encode()).hexdigest()[:16].upper()


def _db_path():
    return Path(os.environ.get('TICKET_DB',str(Path(__file__).resolve().parents[1]/'data/tickets.sqlite3')))


def _connect(path):
    path.parent.mkdir(parents=True,exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.execute('CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, summary TEXT NOT NULL)')
    # 旧库是 (id, summary) 两列；CREATE TABLE IF NOT EXISTS 不会补列，所以显式迁移一次。
    columns = {row[1] for row in db.execute('PRAGMA table_info(tickets)')}
    if 'status' not in columns:
        db.execute('ALTER TABLE tickets ADD COLUMN status TEXT')
    return db


def ticket(session, summary, status=None):
    ident = ticket_id_for(session)
    with _connect(_db_path()) as db:
        db.execute('INSERT INTO tickets (id,summary) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary',
                   (ident,json.dumps(summary,ensure_ascii=False)))
        if status:
            db.execute('UPDATE tickets SET status=? WHERE id=?',(status,ident))
        row = db.execute('SELECT status FROM tickets WHERE id=?',(ident,)).fetchone()
    return dict(ticket_id=ident,status=(row[0] if row and row[0] else 'mock_pending'),mock=True,dispatched=False)


def transfer(session, ticket_id, action='transfer_to_agent'):
    """把工单标记为已提交转派。权限锁：只认白名单动作，且只认本会话自己的工单。"""
    if action not in ALLOWED_ACTIONS:
        return dict(ok=False,error='action_not_allowed',http_status=400)
    # 先验归属：工单 ID 是本会话哈希，对不上就是越权，不泄露其它工单是否存在。
    if ticket_id_for(session) != (ticket_id or '').upper():
        return dict(ok=False,error='forbidden',http_status=403)
    with _connect(_db_path()) as db:
        row = db.execute('SELECT status FROM tickets WHERE id=?',(ticket_id,)).fetchone()
        if not row:
            return dict(ok=False,error='ticket_not_found',http_status=404)
        # 幂等：重复调用不报错，状态保持不变。
        db.execute('UPDATE tickets SET status=? WHERE id=?',('transfer_requested',ticket_id))
    return dict(ok=True,ticket=dict(ticket_id=ticket_id,status='transfer_requested',dispatched=False))


class TicketRequest(BaseModel):
    conversation_id: str = Field(min_length=1,max_length=200)
    summary: dict = Field(default_factory=dict)
@router.post('')
def create(req: TicketRequest):
    return ticket(req.conversation_id,req.summary)
