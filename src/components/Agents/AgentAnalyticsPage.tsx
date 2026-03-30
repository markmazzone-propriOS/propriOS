import { AgentAnalytics } from './AgentAnalytics';

export function AgentAnalyticsPage() {
  return (
    <div>
      <div className="bg-white shadow-sm border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Analytics</h1>
          <p className="text-gray-600">Track your performance and key metrics</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        <AgentAnalytics />
      </div>
    </div>
  );
}
