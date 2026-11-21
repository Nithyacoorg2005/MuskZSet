import { formatCurrency } from "../lib/utils";

interface SaleEvent {
  company: string;
  item: string;
  amount: number;
}

export function LiveTicker({ ticker }: { ticker: SaleEvent[] }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Live Sales Ticker</h2>
      <div className="bg-gray-100 p-4 rounded h-96 overflow-hidden flex flex-col gap-2">
        {ticker.map((sale, i) => (
          <div key={i} className="text-sm py-1 font-mono text-green-700 border-b border-gray-200">
            + {formatCurrency(sale.amount)} ({sale.company} - {sale.item})
          </div>
        ))}
      </div>
    </div>
  );
}