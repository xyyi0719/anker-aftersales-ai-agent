"""Whitelisted post-ticket actions. No entitlement decisions, no real dispatch."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from mock_apis.routes.tickets import transfer

router = APIRouter(prefix='/api/chat', tags=['actions'])


class ActionRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=200)
    # action 不做长度校验，交给白名单统一处理成 400（而非 422），客户端行为更可预期。
    action: str
    ticket_id: str


@router.post('/action')
def run(req: ActionRequest):
    result = transfer(req.conversation_id, req.ticket_id, req.action)
    if not result['ok']:
        return JSONResponse(dict(ok=False, error=result['error']), status_code=result['http_status'])
    return dict(ok=True, ticket=result['ticket'], message='已提交转派申请')
