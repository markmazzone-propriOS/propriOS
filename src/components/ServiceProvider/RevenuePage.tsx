import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  ArrowLeft
} from 'lucide-react';

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'annual';

type RevenueData = {
  period: TimePeriod;
  amount: number;
  change: number;
  jobCount: number;
};

type ChartDataPoint = {
  label: string;
  amount: number;
};

export function RevenuePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('monthly');
  const [revenueStats, setRevenueStats] = useState<Record<TimePeriod, RevenueData>>({
    daily: { period: 'daily', amount: 0, change: 0, jobCount: 0 },
    weekly: { period: 'weekly', amount: 0, change: 0, jobCount: 0 },
    monthly: { period: 'monthly', amount: 0, change: 0, jobCount: 0 },
    annual: { period: 'annual', amount: 0, change: 0, jobCount: 0 }
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    loadRevenueData();
  }, [user]);

  useEffect(() => {
    generateChartData(selectedPeriod);
  }, [selectedPeriod]);

  const loadRevenueData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: jobs, error } = await supabase
        .from('service_jobs')
        .select('final_cost, completed_at')
        .eq('provider_id', user.id)
        .eq('status', 'completed')
        .not('final_cost', 'is', null)
        .not('completed_at', 'is', null);

      if (error) throw error;

      if (jobs) {
        const now = new Date();
        const stats = calculateRevenueStats(jobs, now);
        setRevenueStats(stats);
        generateChartData('monthly');
      }
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRevenueStats = (jobs: any[], now: Date): Record<TimePeriod, RevenueData> => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
    const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    const filterByDateRange = (start: Date, end: Date = now) => {
      return jobs.filter(job => {
        const completedDate = new Date(job.completed_at);
        return completedDate >= start && completedDate <= end;
      });
    };

    const sumRevenue = (jobList: any[]) => {
      return jobList.reduce((sum, job) => sum + (job.final_cost || 0), 0);
    };

    const todayJobs = filterByDateRange(startOfToday);
    const yesterdayJobs = filterByDateRange(startOfYesterday, startOfToday);
    const dailyRevenue = sumRevenue(todayJobs);
    const yesterdayRevenue = sumRevenue(yesterdayJobs);
    const dailyChange = yesterdayRevenue > 0 ? ((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

    const weekJobs = filterByDateRange(startOfWeek);
    const lastWeekJobs = filterByDateRange(startOfLastWeek, startOfWeek);
    const weeklyRevenue = sumRevenue(weekJobs);
    const lastWeekRevenue = sumRevenue(lastWeekJobs);
    const weeklyChange = lastWeekRevenue > 0 ? ((weeklyRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0;

    const monthJobs = filterByDateRange(startOfMonth);
    const lastMonthJobs = filterByDateRange(startOfLastMonth, endOfLastMonth);
    const monthlyRevenue = sumRevenue(monthJobs);
    const lastMonthRevenue = sumRevenue(lastMonthJobs);
    const monthlyChange = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

    const yearJobs = filterByDateRange(startOfYear);
    const lastYearJobs = filterByDateRange(startOfLastYear, endOfLastYear);
    const annualRevenue = sumRevenue(yearJobs);
    const lastYearRevenue = sumRevenue(lastYearJobs);
    const annualChange = lastYearRevenue > 0 ? ((annualRevenue - lastYearRevenue) / lastYearRevenue) * 100 : 0;

    return {
      daily: { period: 'daily', amount: dailyRevenue, change: dailyChange, jobCount: todayJobs.length },
      weekly: { period: 'weekly', amount: weeklyRevenue, change: weeklyChange, jobCount: weekJobs.length },
      monthly: { period: 'monthly', amount: monthlyRevenue, change: monthlyChange, jobCount: monthJobs.length },
      annual: { period: 'annual', amount: annualRevenue, change: annualChange, jobCount: yearJobs.length }
    };
  };

  const generateChartData = async (period: TimePeriod) => {
    if (!user) return;

    try {
      const { data: jobs, error } = await supabase
        .from('service_jobs')
        .select('final_cost, completed_at')
        .eq('provider_id', user.id)
        .eq('status', 'completed')
        .not('final_cost', 'is', null)
        .not('completed_at', 'is', null);

      if (error) throw error;
      if (!jobs) return;

      const now = new Date();
      let dataPoints: ChartDataPoint[] = [];

      if (period === 'daily') {
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

          const dayJobs = jobs.filter(job => {
            const completedDate = new Date(job.completed_at);
            return completedDate >= startOfDay && completedDate <= endOfDay;
          });

          const amount = dayJobs.reduce((sum, job) => sum + (job.final_cost || 0), 0);
          dataPoints.push({
            label: date.toLocaleDateString('en-US', { weekday: 'short' }),
            amount
          });
        }
      } else if (period === 'weekly') {
        for (let i = 7; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + i * 7));
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          weekEnd.setHours(23, 59, 59);

          const weekJobs = jobs.filter(job => {
            const completedDate = new Date(job.completed_at);
            return completedDate >= weekStart && completedDate <= weekEnd;
          });

          const amount = weekJobs.reduce((sum, job) => sum + (job.final_cost || 0), 0);
          dataPoints.push({
            label: `Week ${8 - i}`,
            amount
          });
        }
      } else if (period === 'monthly') {
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

          const monthJobs = jobs.filter(job => {
            const completedDate = new Date(job.completed_at);
            return completedDate >= monthStart && completedDate <= monthEnd;
          });

          const amount = monthJobs.reduce((sum, job) => sum + (job.final_cost || 0), 0);
          dataPoints.push({
            label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
            amount
          });
        }
      } else {
        for (let i = 4; i >= 0; i--) {
          const year = now.getFullYear() - i;
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31, 23, 59, 59);

          const yearJobs = jobs.filter(job => {
            const completedDate = new Date(job.completed_at);
            return completedDate >= yearStart && completedDate <= yearEnd;
          });

          const amount = yearJobs.reduce((sum, job) => sum + (job.final_cost || 0), 0);
          dataPoints.push({
            label: year.toString(),
            amount
          });
        }
      }

      setChartData(dataPoints);
    } catch (error) {
      console.error('Error generating chart data:', error);
    }
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Revenue Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1f2937; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .stat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
            .stat-label { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
            .stat-value { font-size: 32px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
            .stat-change { font-size: 14px; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
            .chart-data { margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background-color: #f9fafb; font-weight: 600; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Revenue Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Daily Revenue</div>
              <div class="stat-value">$${revenueStats.daily.amount.toLocaleString()}</div>
              <div class="stat-change ${revenueStats.daily.change >= 0 ? 'positive' : 'negative'}">
                ${revenueStats.daily.change >= 0 ? '↑' : '↓'} ${Math.abs(revenueStats.daily.change).toFixed(1)}% vs yesterday
              </div>
              <div class="stat-label" style="margin-top: 8px;">${revenueStats.daily.jobCount} jobs completed</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Weekly Revenue</div>
              <div class="stat-value">$${revenueStats.weekly.amount.toLocaleString()}</div>
              <div class="stat-change ${revenueStats.weekly.change >= 0 ? 'positive' : 'negative'}">
                ${revenueStats.weekly.change >= 0 ? '↑' : '↓'} ${Math.abs(revenueStats.weekly.change).toFixed(1)}% vs last week
              </div>
              <div class="stat-label" style="margin-top: 8px;">${revenueStats.weekly.jobCount} jobs completed</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Monthly Revenue</div>
              <div class="stat-value">$${revenueStats.monthly.amount.toLocaleString()}</div>
              <div class="stat-change ${revenueStats.monthly.change >= 0 ? 'positive' : 'negative'}">
                ${revenueStats.monthly.change >= 0 ? '↑' : '↓'} ${Math.abs(revenueStats.monthly.change).toFixed(1)}% vs last month
              </div>
              <div class="stat-label" style="margin-top: 8px;">${revenueStats.monthly.jobCount} jobs completed</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Annual Revenue</div>
              <div class="stat-value">$${revenueStats.annual.amount.toLocaleString()}</div>
              <div class="stat-change ${revenueStats.annual.change >= 0 ? 'positive' : 'negative'}">
                ${revenueStats.annual.change >= 0 ? '↑' : '↓'} ${Math.abs(revenueStats.annual.change).toFixed(1)}% vs last year
              </div>
              <div class="stat-label" style="margin-top: 8px;">${revenueStats.annual.jobCount} jobs completed</div>
            </div>
          </div>

          <div class="chart-data">
            <h2>${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Revenue Breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${chartData.map(point => `
                  <tr>
                    <td>${point.label}</td>
                    <td>$${point.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>This report is generated automatically and includes all completed jobs with recorded final costs.</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const maxChartValue = Math.max(...chartData.map(d => d.amount), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-gray-600 hover:text-blue-600 transition"
            title="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Revenue</h1>
            <p className="text-gray-600 mt-2">Track your earnings and financial performance</p>
          </div>
        </div>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Download size={20} />
          Export to PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Daily Revenue</p>
            <Calendar className="text-blue-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mb-2">
            ${revenueStats.daily.amount.toLocaleString()}
          </p>
          <div className="flex items-center text-sm">
            {revenueStats.daily.change >= 0 ? (
              <TrendingUp className="text-green-600 mr-1" size={16} />
            ) : (
              <TrendingDown className="text-red-600 mr-1" size={16} />
            )}
            <span className={revenueStats.daily.change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(revenueStats.daily.change).toFixed(1)}%
            </span>
            <span className="text-gray-500 ml-1">vs yesterday</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{revenueStats.daily.jobCount} jobs completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Weekly Revenue</p>
            <Calendar className="text-green-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mb-2">
            ${revenueStats.weekly.amount.toLocaleString()}
          </p>
          <div className="flex items-center text-sm">
            {revenueStats.weekly.change >= 0 ? (
              <TrendingUp className="text-green-600 mr-1" size={16} />
            ) : (
              <TrendingDown className="text-red-600 mr-1" size={16} />
            )}
            <span className={revenueStats.weekly.change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(revenueStats.weekly.change).toFixed(1)}%
            </span>
            <span className="text-gray-500 ml-1">vs last week</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{revenueStats.weekly.jobCount} jobs completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Monthly Revenue</p>
            <DollarSign className="text-yellow-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mb-2">
            ${revenueStats.monthly.amount.toLocaleString()}
          </p>
          <div className="flex items-center text-sm">
            {revenueStats.monthly.change >= 0 ? (
              <TrendingUp className="text-green-600 mr-1" size={16} />
            ) : (
              <TrendingDown className="text-red-600 mr-1" size={16} />
            )}
            <span className={revenueStats.monthly.change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(revenueStats.monthly.change).toFixed(1)}%
            </span>
            <span className="text-gray-500 ml-1">vs last month</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{revenueStats.monthly.jobCount} jobs completed</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">Annual Revenue</p>
            <TrendingUp className="text-red-500" size={24} />
          </div>
          <p className="text-3xl font-bold text-gray-800 mb-2">
            ${revenueStats.annual.amount.toLocaleString()}
          </p>
          <div className="flex items-center text-sm">
            {revenueStats.annual.change >= 0 ? (
              <TrendingUp className="text-green-600 mr-1" size={16} />
            ) : (
              <TrendingDown className="text-red-600 mr-1" size={16} />
            )}
            <span className={revenueStats.annual.change >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(revenueStats.annual.change).toFixed(1)}%
            </span>
            <span className="text-gray-500 ml-1">vs last year</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{revenueStats.annual.jobCount} jobs completed</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Revenue Trends</h2>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly', 'annual'] as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  selectedPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80">
          <div className="flex items-end justify-between h-full gap-2 pb-8">
            {chartData.map((point, index) => {
              const height = maxChartValue > 0 ? (point.amount / maxChartValue) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-full">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      ${point.amount.toLocaleString()}
                    </div>
                    <div
                      className="w-full bg-blue-600 rounded-t-md hover:bg-blue-700 transition-all cursor-pointer"
                      style={{ height: `${height}%`, minHeight: point.amount > 0 ? '4px' : '0' }}
                      title={`${point.label}: $${point.amount.toLocaleString()}`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2 font-medium">{point.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
