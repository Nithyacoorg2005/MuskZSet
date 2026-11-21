import { formatCurrency } from "../lib/utils";

interface CompanyCardProps {
  rank: number;
  company: string;
  score: number;
}

export function CompanyCard({ rank, company, score }: CompanyCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center transition-all hover:shadow-md">
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-2">
        Rank #{rank}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 capitalize mb-3">
        {company.replace('_', ' ')}
      </h3>
      <div className="text-xl font-mono text-green-700 font-medium bg-green-50 px-3 py-1 rounded">
        {formatCurrency(score)}
      </div>
    </div>
  );
}