import redis
import json
import time
import requests

r = redis.Redis(host='redis', port=6379, decode_responses=True)

# 1. Seed the Private Companies (Static Real Valuations)
private_valuations = {
    "SpaceX": 210000000000, 
    "xAI": 24000000000,
    "X (Twitter)": 12500000000,
    "Neuralink": 8000000000,
    "The Boring Company": 5700000000
}

for company, val in private_valuations.items():
    r.zadd("leaderboard", {company: val})

print("Connected to Wall Street (Lightweight API). Fetching live TSLA data...")
last_price = 0
headers = {'User-Agent': 'Mozilla/5.0'}

# 2. Stream Live Public Market Data
while True:
    try:
        # Fetch raw JSON directly from Yahoo Finance API
        url = "https://query1.finance.yahoo.com/v8/finance/chart/TSLA"
        response = requests.get(url, headers=headers)
        data = response.json()
        
        # Extract current price
        live_price = data['chart']['result'][0]['meta']['regularMarketPrice']
        
        # Calculate Market Cap (approx 3.19 Billion shares outstanding)
        shares_outstanding = 3190000000
        live_market_cap = live_price * shares_outstanding
        
        # Update Tesla's live market cap on the Rankings board
        r.zadd("leaderboard", {"Tesla": live_market_cap})
        
        # Broadcast a new event to the Ticker if the stock price moved
        if live_price != last_price:
            event = {
                "company": "Tesla (TSLA)",
                "amount": live_price,
                "type": "Live Stock Price"
            }
            r.publish("live_sales", json.dumps(event))
            print(f"TSLA Live: ${live_price} | Market Cap: ${live_market_cap:,.0f}")
            last_price = live_price
            
    except Exception as e:
        print(f"Market Data Error: {e}")
        
    # Poll Wall Street every 5 seconds
    time.sleep(5)