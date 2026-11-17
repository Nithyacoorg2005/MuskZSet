# Musk Empire: Real-Time Global Sales Leaderboard (Powered by Redis)

![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Event--Driven-blue?style=for-the-badge)
![Data Structures](https://img.shields.io/badge/Redis-ZSET%20%7C%20HASH%20%7C%20PUB%2FSUB-critical?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A high-throughput, low-latency **Real-Time Sales Leaderboard and Live Order Ticker** tracking simulated global revenue streams across Elon Musk's ecosystem of companies (**Tesla, SpaceX, Starlink, xAI, X Corp, The Boring Company, and Neuralink**).

This project moves beyond basic `GET`/`SET` key-value caching to showcase **Redis as an in-memory, single-threaded atomic data structure engine** capable of ranking, aggregating, and broadcasting thousands of concurrent financial events per second with sub-millisecond latency.

---

## Table of Contents

1. [Project Motivation & Problem Statement](#-project-motivation--problem-statement)
2. [Why Redis for Real-Time Leaderboards?](#-why-redis-for-real-time-leaderboards)
3. [System Architecture](#-system-architecture)
4. [Simulated Company & Product Dataset](#-simulated-company--product-dataset)
5. [Redis Data Structures & Schema Design](#-redis-data-structures--schema-design)
6. [Core Redis Operations & Complexity Analysis](#-core-redis-operations--complexity-analysis)
7. [Time-Windowed Leaderboards (All-Time vs. Daily vs. 60-Second Surge)](#-time-windowed-leaderboards-all-time-vs-daily-vs-60-second-surge)
8. [Atomic Operations & Redis Pipelining](#-atomic-operations--redis-pipelining)
9. [Project Directory Structure](#-project-directory-structure)
10. [API Endpoints & WebSocket Events](#-api-endpoints--websocket-events)
11. [Installation & Setup Guide](#-installation--setup-guide)
12. [Production Readiness: Persistence, Memory & Scaling](#-production-readiness-persistence-memory--scaling)
13. [Future Enhancements](#-future-enhancements)

---

## Project Motivation & Problem Statement

In traditional relational databases (like PostgreSQL or MySQL), generating a real-time leaderboard across millions of sales events requires expensive `SUM()`, `GROUP BY`, and `ORDER BY` queries:

```sql
-- Traditional SQL Approach: Slows down exponentially as rows grow (O(N log N))
SELECT company_id, SUM(sale_amount) AS total_revenue
FROM sales_transactions
GROUP BY company_id
ORDER BY total_revenue DESC;
```

When thousands of transactions occur every second (e.g., global Starlink subscription renewals, X Premium micro-transactions, and Tesla vehicle deliveries), running this SQL query on every page load—or locks contending to update summary rows—causes severe lock contention and database CPU spikes.

### The Redis Solution
By leveraging **Redis Sorted Sets (`ZSET`)** and **Single-Threaded Atomic Operations**, every incoming sale updates the company's score and automatically re-sorts the leaderboard in **$O(\log N)$** time in RAM. Fetching the top companies takes **$O(\log N + M)$** time—delivering real-time rankings in **< 0.5 milliseconds** with zero database locks.

---

## Why Redis for Real-Time Leaderboards?

1. **Skip List + Hash Table (`ZSET`) Internals:** Under the hood, a Redis Sorted Set combines a **Hash Table** (mapping member $\rightarrow$ score in $O(1)$ time) with a **Skip List** (maintaining sorted order of scores in $O(\log N)$ time).
2. **Single-Threaded Atomic Execution:** Redis processes commands sequentially in an event loop using OS-level I/O multiplexing (`epoll`/`kqueue`). When 500 Starlink orders arrive at the exact same millisecond, `ZINCRBY` processes each increment atomically without race conditions, mutex lock overhead, or lost updates.
3. **Multi-Structure Synergy:** Alongside `ZSET` for rankings, this project uses:
   - **`HASH`** to store rich metadata and per-company order counters.
   - **`PUB/SUB`** to broadcast live sale events to connected WebSocket clients instantaneously.
   - **Native `TTL` (`EXPIRE`)** to power rolling 60-second "Flash Leaderboards" that self-clean from RAM automatically.

---

## System Architecture

```text
+-------------------------------------------------------------------------+
|                    LIVE SALES SIMULATOR / INGESTION                     |
|  Generates realistic orders (Model Y, Falcon 9, Starlink Kit, Grok API) |
+------------------------------------+------------------------------------+
                                     |
                                     |  (1) Redis Pipeline / Lua Script
                                     v
+-------------------------------------------------------------------------+
|                         REDIS IN-MEMORY ENGINE                          |
|                                                                         |
|  +---------------------------+      +--------------------------------+  |
|  |   Sorted Sets (ZSET)      |      |         Hashes (HASH)          |  |
|  |  - leaderboard:all_time   |      |  - company:tesla:meta          |  |
|  |  - leaderboard:daily:YYYY |      |  - company:spacex:meta         |  |
|  |  - leaderboard:minute:MM  |      |  (Tracks order counts, avg $)  |  |
|  +---------------------------+      +--------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                        Redis Pub/Sub Channel                      |  |
|  |                    channel: "live_sales_stream"                   |  |
|  +-------------------------------------------------------------------+  |
+-----------------+-----------------------------------+-------------------+
                  |                                   |
     (2) ZREVRANGE|WITHSCORES            (3) SUBSCRIBE|live_sales_stream
                  v                                   v
+-------------------------------------------------------------------------+
|                      BACKEND API & WEBSOCKET SERVER                     |
|                        (Node.js / FastAPI / Go)                         |
+------------------------------------+------------------------------------+
                                     |
                                     |  (4) WebSockets / Server-Sent Events
                                     v
+-------------------------------------------------------------------------+
|                      REAL-TIME FRONTEND DASHBOARD                       |
|   - Animated Live Rank Leaderboard (1st to 7th place)                   |
|   - Live Order Ticker Tape ("+$45,000 Tesla Model Y sold in Austin")    |
|   - Timeframe Switcher (All-Time | Today | Last 60 Seconds)             |
+-------------------------------------------------------------------------+
```

---

## Simulated Company & Product Dataset

Because private and public companies do not expose a live checkout firehose, the project includes a **Weighted Real-Time Sales Simulator** that mirrors the real-world transaction frequency and ticket size of each Elon Musk venture:

| Member Key | Company Name | Category | Simulated Products & Ticket Sizes (USD) | Event Frequency |
| :--- | :--- | :--- | :--- | :--- |
| `tesla` | **Tesla, Inc.** | Automotive & Energy | • Supercharger Session (`$18`)<br>• Full Self-Driving Sub (`$99`)<br>• Model 3 / Model Y (`$44,990`)<br>• Cybertruck (`$79,990`)<br>• Megapack Utility Battery (`$1,200,000`) | High (Every 0.2s – 2s) |
| `starlink` | **Starlink** | Satellite Internet | • Monthly Residential Sub (`$120`)<br>• Starlink Mini / Standard Kit (`$499`)<br>• Maritime / Aviation Terminal (`$25,000`) | Very High (Every 0.05s – 0.5s) |
| `spacex` | **SpaceX** | Aerospace & Launch | • Transporter Rideshare Slot (`$300,000`)<br>• Commercial Falcon 9 Launch (`$67,000,000`)<br>• Deep Space / NASA Milestone (`$120,000,000`) | Low / Whale Spikes (Every 15s – 60s) |
| `x_corp` | **X Corp (formerly Twitter)** | Social & AdTech | • X Premium+ Subscription (`$16`)<br>• Verified Organization Tier (`$1,000`)<br>• Global Brand Takeover Ad (`$85,000`) | Very High (Every 0.1s – 0.4s) |
| `xai` | **xAI** | Artificial Intelligence | • Grok API Developer Top-up (`$50`)<br>• Enterprise Grok API License (`$15,000`)<br>• Colossus Compute Cluster Lease (`$250,000`) | Medium (Every 0.5s – 3s) |
| `boring_co` | **The Boring Company** | Infrastructure & Transit | • Vegas Loop Ride Pass (`$12`)<br>• Not-a-Flamethrower Merch (`$500`)<br>• Municipal Tunnel Milestone (`$2,500,000`) | Medium (Every 1s – 5s) |
| `neuralink` | **Neuralink** | Neurotechnology | • Research Grant Tranche (`$50,000`)<br>• Telepathy Clinical Trial Milestone (`$500,000`) | Low (Every 10s – 30s) |

> **Why this dataset makes an exciting demo:**
> In the **60-Second Window Leaderboard**, `starlink` and `x_corp` constantly battle `tesla` via rapid micro-transactions—until `spacex` suddenly lands a `$67,000,000` Falcon 9 contract and catapults from #7 straight to #1!

---

## Redis Data Structures & Schema Design

### 1. Sorted Sets (`ZSET`) — The Ranking Engine
Each leaderboard is stored as a Redis Sorted Set where:
- **Key:** `leaderboard:sales:<timeframe>`
- **Member:** Company identifier string (e.g., `"tesla"`, `"spacex"`)
- **Score:** 64-bit IEEE 754 floating-point number representing total revenue in USD.

```text
Key: leaderboard:sales:all_time
+---------------+--------------------+------+
| Member        | Score (USD)        | Rank |
+---------------+--------------------+------+
| "tesla"       | 96750490120.00     |  #1  |
| "spacex"      | 14230000000.00     |  #2  |
| "starlink"    |  8450120900.00     |  #3  |
| "x_corp"      |  3120450100.00     |  #4  |
| "xai"         |  1250000000.00     |  #5  |
| "boring_co"   |   410250000.00     |  #6  |
| "neuralink"   |    95500000.00     |  #7  |
+---------------+--------------------+------+
```

### 2. Hashes (`HASH`) — Company Metadata & Order Telemetry
Sorted Sets only store a `member` and a `score`. To display company details, logos, total order volume, and last sold item without hitting a SQL database, each company has a companion Redis Hash:
- **Key:** `company:<member_id>:stats`

```redis
HSET company:tesla:stats
    name "Tesla, Inc."
    ticker "TSLA"
    sector "Automotive & Clean Energy"
    logo_url "/assets/logos/tesla.svg"
    total_orders "145092"
    last_product "Model Y Long Range"
    last_sale_usd "44990"
    updated_at "1763405640000"
```

### 3. Pub/Sub Channel — Live Event Broadcasting
- **Channel:** `channel:sales_feed`
- **Payload (JSON String):**
```json
{
  "event_id": "evt_98f2a1c",
  "company_id": "spacex",
  "company_name": "SpaceX",
  "product": "Falcon 9 Commercial Launch",
  "amount_usd": 67000000,
  "region": "Cape Canaveral, FL",
  "timestamp": 1763405640125
}
```

---

## Core Redis Operations & Complexity Analysis

Below are the exact Redis commands powering the application and their algorithmic time complexities (where $N$ is the number of companies in the leaderboard and $M$ is the number of items returned):

| Operation | Redis Command | Time Complexity | Purpose in Project |
| :--- | :--- | :---: | :--- |
| **Record a Sale** | `ZINCRBY leaderboard:sales:all_time 44990 "tesla"` | $O(\log N)$ | Atomically adds `$44,990` to Tesla's revenue and updates its rank position. |
| **Get Top Leaderboard** | `ZREVRANGE leaderboard:sales:all_time 0 -1 WITHSCORES` | $O(\log N + M)$ | Returns all companies sorted from **highest to lowest** revenue along with their scores. |
| **Get Company Rank** | `ZREVRANK leaderboard:sales:all_time "starlink"` | $O(\log N)$ | Returns the 0-based rank of a specific company (`0` = 1st place). |
| **Get Company Revenue** | `ZSCORE leaderboard:sales:all_time "starlink"` | $O(1)$ | Instantly retrieves the exact revenue score of a single company via the internal hash table. |
| **Filter by Revenue Tier** | `ZREVRANGEBYSCORE leaderboard:sales:all_time +inf 1000000000` | $O(\log N + M)$ | Finds all "Unicorn" companies that have generated over `$1 Billion` in sales. |
| **Increment Order Count** | `HINCRBY company:tesla:stats total_orders 1` | $O(1)$ | Atomically increments the total number of orders processed for Tesla. |
| **Broadcast Live Sale** | `PUBLISH channel:sales_feed "{...json...}"` | $O(N_{subs})$ | Pushes the transaction event to all subscribed WebSocket backend servers. |

---

## Time-Windowed Leaderboards (All-Time vs. Daily vs. 60-Second Surge)

A standout feature of this project is supporting **multi-horizon leaderboards** simultaneously using Redis key naming conventions and automatic TTL expiration (`EXPIRE`):

1. **All-Time Leaderboard (`leaderboard:sales:all_time`):**
   - Never expires. Persisted to disk via Redis AOF/RDB.
2. **Daily Leaderboard (`leaderboard:sales:daily:2026-11-18`):**
   - Key name includes the UTC date (`YYYY-MM-DD`).
   - Assigned a `TTL` of `172800` seconds (48 hours) via `EXPIRE` so old daily leaderboards automatically evict themselves from memory.
3. **Live 60-Second "Surge" Leaderboard (`leaderboard:sales:minute:2026-11-18T18:54`):**
   - Key name includes the current UTC minute.
   - Assigned a `TTL` of `120` seconds.
   - Allows the UI to show *"Who is making the most money right this minute?"* without running any background cron jobs to delete old data.

---

## Atomic Operations & Redis Pipelining

When a single sale occurs (e.g., a `$499` Starlink Kit is sold), we need to update three time-windowed `ZSET` keys, update the company's `HASH` stats, and `PUBLISH` the event.

Sending 6 separate network requests sequentially wastes network Round-Trip Time (RTT). Instead, we batch them into a single **Redis Pipeline** (or `MULTI/EXEC` transaction) so all commands travel across the network in **one single packet** and execute back-to-back on the Redis single thread:

```python
# Python (redis-py) Atomic Pipeline Example
async def record_company_sale(redis_client, company_id: str, product: str, amount: float):
    today_key = f"leaderboard:sales:daily:{datetime.utcnow().strftime('%Y-%m-%d')}"
    minute_key = f"leaderboard:sales:minute:{datetime.utcnow().strftime('%Y-%m-%dT%H:%M')}"
    stats_key = f"company:{company_id}:stats"

    async with redis_client.pipeline(transaction=True) as pipe:
        # 1. Increment All-Time, Daily, and Current-Minute Sorted Sets
        pipe.zincrby("leaderboard:sales:all_time", amount, company_id)
        pipe.zincrby(today_key, amount, company_id)
        pipe.expire(today_key, 172800)  # Auto-expire in 48 hours
        pipe.zincrby(minute_key, amount, company_id)
        pipe.expire(minute_key, 120)    # Auto-expire in 2 minutes

        # 2. Update Company Metadata Hash
        pipe.hincrby(stats_key, "total_orders", 1)
        pipe.hset(stats_key, mapping={
            "last_product": product,
            "last_sale_usd": amount,
            "updated_at": int(time.time() * 1000)
        })

        # 3. Publish to Real-Time Feed
        event_payload = json.dumps({
            "company_id": company_id,
            "product": product,
            "amount_usd": amount,
            "timestamp": int(time.time() * 1000)
        })
        pipe.publish("channel:sales_feed", event_payload)

        # Execute all commands in a single network round-trip
        results = await pipe.execute()
        return results[0]  # Returns new all-time score
```

---

## Project Directory Structure

```text
musk-redis-leaderboard/
├── docker-compose.yml           # Spins up Redis Stack (with RedisInsight GUI) + App
├── redis.conf                   # Custom production Redis config (AOF + Memory policies)
├── backend/
│   ├── main.py                  # FastAPI / Node.js server with REST + WebSockets
│   ├── redis_client.py          # Connection pooling & Lua / Pipeline helpers
│   ├── simulator.py             # Background worker generating realistic company sales
│   ├── seed.py                  # Seeds initial company metadata & baseline revenues
│   └── requirements.txt
├── frontend/
│   ├── index.html               # Real-time dashboard UI
│   ├── app.js                   # WebSocket listener & leaderboard rank animations
│   └── styles.css
└── README.md
```

---

## API Endpoints & WebSocket Events

### REST API
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/leaderboard?window=all_time` | Returns ranked list of all 7 companies (`all_time`, `daily`, or `minute`) with scores, rank, and metadata. |
| `GET` | `/api/company/{company_id}` | Returns specific company's current rank (`ZREVRANK`), score (`ZSCORE`), and `HASH` order telemetry. |
| `POST` | `/api/sale` | Manually triggers a custom sale event (e.g., *"Launch a Falcon Heavy for $97M"*) to watch the leaderboard react immediately. |
| `POST` | `/api/simulator/toggle` | Pauses, resumes, or adjusts the speed (`1x`, `10x`, `100x`) of the background sales simulator. |

### WebSocket Stream (`ws://localhost:8000/ws/leaderboard`)
Pushes real-time JSON frames to connected browsers whenever a sale occurs:
```json
{
  "type": "SALE_EVENT",
  "sale": {
    "company_id": "tesla",
    "product": "Cybertruck AWD",
    "amount_usd": 79990
  },
  "leaderboard": [
    { "rank": 1, "company_id": "tesla", "score": 96750570110, "total_orders": 145093 },
    { "rank": 2, "company_id": "spacex", "score": 14230000000, "total_orders": 412 }
  ]
}
```

---

## Installation & Setup Guide

### Prerequisites
- **Docker & Docker Compose** (recommended for running Redis + RedisInsight GUI)
- **Python 3.10+** or **Node.js 18+**

### Step 1: Start Redis Stack with Docker
Run the following command to launch Redis along with **RedisInsight** (a visual browser for inspecting your Sorted Sets and Hashes in real time):

```bash
docker run -d --name redis-leaderboard \
  -p 6379:6379 \
  -p 8001:8001 \
  redis/redis-stack:latest
```
- **Redis Server:** `localhost:6379`
- **RedisInsight GUI:** Open `http://localhost:8001` in your browser to watch keys update live.

### Step 2: Clone & Install Backend Dependencies
```bash
git clone https://github.com/yourusername/musk-redis-leaderboard.git
cd musk-redis-leaderboard/backend

python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install fastapi uvicorn redis websockets
```

### Step 3: Seed Initial Company Data via `redis-cli` (Optional Quick Test)
You can test the leaderboard directly in your terminal right now using `redis-cli`:

```bash
docker exec -it redis-leaderboard redis-cli

# Seed initial scores
127.0.0.1:6379> ZADD leaderboard:sales:all_time 5000000 "tesla" 4800000 "starlink" 3000000 "x_corp" 2000000 "xai" 1500000 "spacex"

# View live rankings (highest to lowest)
127.0.0.1:6379> ZREVRANGE leaderboard:sales:all_time 0 -1 WITHSCORES

# Simulate SpaceX landing a $67M Falcon 9 launch contract!
127.0.0.1:6379> ZINCRBY leaderboard:sales:all_time 67000000 "spacex"

# Check the leaderboard again — SpaceX is now #1!
127.0.0.1:6379> ZREVRANGE leaderboard:sales:all_time 0 -1 WITHSCORES
```

### Step 4: Run the Application
```bash
uvicorn main:app --reload --port 8000
```
Open `http://localhost:8000` in your browser to view the live dashboard.

---

## Production Readiness: Persistence, Memory & Scaling

To ensure this leaderboard doesn't lose data on restart or crash under heavy load, the following production configurations are applied in `redis.conf`:

1. **Hybrid Persistence (AOF + RDB):**
   - `appendonly yes` and `appendfsync everysec`: Every `ZINCRBY` sale command is written to an Append-Only File so at most 1 second of data can ever be lost in a power outage.
   - `aof-use-rdb-preamble yes`: Combines fast RDB snapshot boot times with AOF durability.
2. **Memory Management & Eviction Policy:**
   - `maxmemory 512mb`
   - `maxmemory-policy volatile-lru`: Ensures Redis only evicts keys that have an explicit `TTL` (like old minute/daily leaderboards) and **never** evicts the permanent `leaderboard:sales:all_time` key.
3. **Connection Pooling:**
   - The backend initializes a shared `redis.ConnectionPool(max_connections=50)` so concurrent HTTP requests reuse existing TCP sockets rather than performing expensive TCP handshakes on every sale.

---

## Future Enhancements

- [ ] **Lua Scripting for Conditional Milestones:** Trigger an automated alert the exact microsecond a company crosses a `$100M` milestone using an atomic server-side Lua script (`EVAL`).
- [ ] **Redis Streams (`XADD` / `XREADGROUP`):** Replace `Pub/Sub` with Redis Streams so a background worker can batch-insert raw transaction logs into PostgreSQL/ClickHouse for long-term auditing without losing messages if a consumer disconnects.
- [ ] **HyperLogLog (`PFADD` / `PFCOUNT`):** Track unique customers buying from each company using only `12 KB` of memory per company.

---

## License

Distributed under the MIT License. Built as an architectural showcase of Redis In-Memory Data Structures.