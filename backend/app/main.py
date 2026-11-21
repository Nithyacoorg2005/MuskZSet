import json
import asyncio
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = redis.Redis(host="redis", port=6379, db=0, decode_responses=True)

@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.json()
    
    # Listen for a successful checkout event
    if payload.get("type") == "checkout.session.completed":
        session = payload["data"]["object"]
        
        amount = session["amount_total"] / 100  # Stripe amounts are in cents
        item = "Real Store Purchase"
        company = "My Business"

        # Push the real sale to Redis
        async with redis_client.pipeline() as pipe:
            pipe.zincrby("leaderboard:musk_sales", amount, company)
            pipe.publish("live_sales", json.dumps({
                "company": company, 
                "item": item, 
                "amount": amount
            }))
            await pipe.execute()
            
    return {"status": "success"}

@app.get("/leaderboard")
async def get_leaderboard():
    leaderboard = await redis_client.zrevrange("leaderboard:musk_sales", 0, -1, withscores=True)
    return [{"company": company, "score": score} for company, score in leaderboard]

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("live_sales")
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
            if message:
                await websocket.send_text(message["data"])
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        await pubsub.unsubscribe("live_sales")