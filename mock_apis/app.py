"""FastAPI entrypoint shared by Docker, local development and regression tests."""
import hmac
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from mock_apis.routes import orders, warranty, tickets, policy, actions
from mock_apis.engine import chat
app = FastAPI(title='Anker 售后 Mock API', version='1.2.0')
@app.middleware('http')
async def guard(request: Request, call_next):
    key = os.environ.get('MOCK_API_KEY','')
    if request.url.path.startswith('/api/') and key and not hmac.compare_digest(request.headers.get('X-API-Key',''),key):
        return JSONResponse(dict(error='unauthorized'),status_code=401)
    return await call_next(request)
for router in (orders.router,warranty.router,tickets.router,policy.router,actions.router): app.include_router(router)
@app.get('/healthz')
@app.get('/health')
def health():
    return dict(status='ok',mock=True,embedding_required=False,version='1.2.0')
class Turn(BaseModel):
    query: str = Field(default='',max_length=8000)
    conversation_id: str = Field(min_length=1,max_length=200)
    state: dict = Field(default_factory=dict)
    extraction: dict = Field(default_factory=dict)
    has_image: bool = False
@app.post('/api/chat/turn')
def turn(req: Turn):
    return chat(req.model_dump())
