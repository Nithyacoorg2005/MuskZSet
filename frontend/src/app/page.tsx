"use client";
import { useEffect, useState } from "react";
import { useWebsocket } from "../hooks/useWebsocket";
import { Leaderboard } from "../components/Leaderboard";
import { LiveTicker } from "../components/LiveTicker";

interface LeaderboardItem {
  company: string;
  score: number;
}

export default function Page() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [ticker, setTicker] = useState<any[]>([]);
  const latestSale = useWebsocket("ws://localhost:8000/ws/live");

  useEffect(() => {
    fetch("http://localhost:8000/leaderboard")
      .then(res => res.json())
      .then(data => setLeaderboard(data));
  }, []);

  useEffect(() => {
    if (latestSale) {
      setTicker(prev => [latestSale, ...prev].slice(0, 15));
      setLeaderboard(prev => {
        const updated = prev.map(item => 
          item.company === latestSale.company 
            ? { ...item, score: item.score + latestSale.amount } 
            : item
        );
        return updated.sort((a, b) => b.score - a.score);
      });
    }
  }, [latestSale]);

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-8">MuskPulse Live Leaderboard</h1>
      <div className="grid grid-cols-2 gap-8">
        <Leaderboard data={leaderboard} />
        <LiveTicker ticker={ticker} />
      </div>
    </div>
  );
}