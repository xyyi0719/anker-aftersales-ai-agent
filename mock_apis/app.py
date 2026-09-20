"""
Mock API 统一入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import orders, warranty, tickets, policy

app = FastAPI(
    title="Anker 售后 Mock API + 政策检索代理",
    description="为 Dify Chatflow 提供模拟订单/保修/工单接口 + 政策检索代理",
    version="1.0.0",
)

# CORS（Dify 前端可能跨域调用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(warranty.router)
app.include_router(tickets.router)
app.include_router(policy.router)


@app.get("/")
async def root():
    return {
        "service": "Anker 售后 Mock API",
        "endpoints": [
            "POST /api/orders/{order_id}",
            "POST /api/warranty/check",
            "POST /api/tickets",
            "POST /api/policy/retrieve",
            "GET /docs (Swagger UI)"
        ],
        "version": "1.0.0"
    }


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8002, reload=True)