import { formatCurrency } from "../lib/utils";

interface LeaderboardItem {
  company: string;
  score: number;
}

export function Leaderboard({ data }: { data: LeaderboardItem[] }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Rankings</h2>
      {data.map((item, index) => (
        <div key={item.company} className="flex justify-between p-3 border-b">
          <span className="capitalize font-medium">
            #{index + 1} {item.company.replace('_', ' ')}
          </span>
          <span className="font-mono">{formatCurrency(item.score)}</span>
        </div>
      ))}
    </div>
  );
}