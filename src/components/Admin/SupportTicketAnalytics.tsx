import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from '../Navigation/Router';
import {
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Calendar,
  Tag,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';

type TimePeriod = '7days' | '30days' | '90days' | '180days' | 'ytd';

interface CategoryStats {
  category: string;
  count: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

interface PeriodStats {
  period: string;
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  avgResolutionTime: number;
}

export default function SupportTicketAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('30days');
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [periodComparison, setPeriodComparison] = useState<PeriodStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, selectedPeriod]);

  const getDateRange = (period: TimePeriod) => {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
      case '180days':
        startDate.setDate(now.getDate() - 180);
        break;
      case 'ytd':
        startDate.setMonth(0);
        startDate.setDate(1);
        break;
    }

    return startDate.toISOString();
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const startDate = getDateRange(selectedPeriod);

      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const categoryMap = new Map<string, CategoryStats>();

      tickets?.forEach((ticket) => {
        const category = ticket.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            category,
            count: 0,
            open: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0
          });
        }

        const stats = categoryMap.get(category)!;
        stats.count++;

        switch (ticket.status) {
          case 'open':
            stats.open++;
            break;
          case 'in_progress':
            stats.in_progress++;
            break;
          case 'resolved':
            stats.resolved++;
            break;
          case 'closed':
            stats.closed++;
            break;
        }
      });

      setCategoryStats(Array.from(categoryMap.values()).sort((a, b) => b.count - a.count));

      await loadPeriodComparison();
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodComparison = async () => {
    const periods: { label: string; days: number }[] = [
      { label: '7 Days', days: 7 },
      { label: '30 Days', days: 30 },
      { label: '90 Days', days: 90 },
      { label: '180 Days', days: 180 }
    ];

    const stats = await Promise.all(
      periods.map(async ({ label, days }) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data: tickets, error } = await supabase
          .from('support_tickets')
          .select('*')
          .gte('created_at', startDate.toISOString());

        if (error) throw error;

        const total = tickets?.length || 0;
        const open = tickets?.filter(t => t.status === 'open').length || 0;
        const in_progress = tickets?.filter(t => t.status === 'in_progress').length || 0;
        const resolved = tickets?.filter(t => t.status === 'resolved').length || 0;
        const closed = tickets?.filter(t => t.status === 'closed').length || 0;

        const resolvedTickets = tickets?.filter(t => t.resolved_at && t.created_at) || [];
        let avgResolutionTime = 0;

        if (resolvedTickets.length > 0) {
          const totalTime = resolvedTickets.reduce((sum, ticket) => {
            const created = new Date(ticket.created_at).getTime();
            const resolved = new Date(ticket.resolved_at).getTime();
            return sum + (resolved - created);
          }, 0);
          avgResolutionTime = totalTime / resolvedTickets.length / (1000 * 60 * 60);
        }

        return {
          period: label,
          total,
          open,
          in_progress,
          resolved,
          closed,
          avgResolutionTime
        };
      })
    );

    const ytdStart = new Date();
    ytdStart.setMonth(0);
    ytdStart.setDate(1);

    const { data: ytdTickets } = await supabase
      .from('support_tickets')
      .select('*')
      .gte('created_at', ytdStart.toISOString());

    const ytdTotal = ytdTickets?.length || 0;
    const ytdOpen = ytdTickets?.filter(t => t.status === 'open').length || 0;
    const ytdInProgress = ytdTickets?.filter(t => t.status === 'in_progress').length || 0;
    const ytdResolved = ytdTickets?.filter(t => t.status === 'resolved').length || 0;
    const ytdClosed = ytdTickets?.filter(t => t.status === 'closed').length || 0;

    const ytdResolvedTickets = ytdTickets?.filter(t => t.resolved_at && t.created_at) || [];
    let ytdAvgResolutionTime = 0;

    if (ytdResolvedTickets.length > 0) {
      const totalTime = ytdResolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.created_at).getTime();
        const resolved = new Date(ticket.resolved_at).getTime();
        return sum + (resolved - created);
      }, 0);
      ytdAvgResolutionTime = totalTime / ytdResolvedTickets.length / (1000 * 60 * 60);
    }

    stats.push({
      period: 'Year to Date',
      total: ytdTotal,
      open: ytdOpen,
      in_progress: ytdInProgress,
      resolved: ytdResolved,
      closed: ytdClosed,
      avgResolutionTime: ytdAvgResolutionTime
    });

    setPeriodComparison(stats);
  };

  const getPeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case '7days':
        return 'Last 7 Days';
      case '30days':
        return 'Last 30 Days';
      case '90days':
        return 'Last 90 Days';
      case '180days':
        return 'Last 180 Days';
      case 'ytd':
        return 'Year to Date';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'technical':
        return 'Technical';
      case 'billing':
        return 'Billing';
      case 'feature_request':
        return 'Feature Request';
      case 'sales_inquiry':
        return 'Sales Inquiry';
      case 'other':
        return 'Other';
      default:
        return category;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'closed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const exportToPDF = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    const primaryColor: [number, number, number] = [37, 99, 235];
    const secondaryColor: [number, number, number] = [55, 65, 81];
    const lightGray: [number, number, number] = [243, 244, 246];

    const loadImageAsBase64 = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    try {
      const logoBase64 = await loadImageAsBase64('/logo-B2-v2.png');
      pdf.addImage(logoBase64, 'PNG', 15, yPosition, 25, 7.5);
    } catch (error) {
      console.log('Could not load logo, continuing without it');
    }

    pdf.setFontSize(16);
    pdf.setTextColor(...primaryColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Support Ticket Analytics Report', pageWidth / 2, yPosition + 5, { align: 'center' });
    pdf.setFont('helvetica', 'normal');

    yPosition += 15;
    pdf.setFontSize(10);
    pdf.setTextColor(...secondaryColor);
    pdf.text(`Report Period: ${getPeriodLabel(selectedPeriod)}`, pageWidth / 2, yPosition, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth / 2, yPosition + 5, { align: 'center' });

    yPosition += 15;
    pdf.setDrawColor(...primaryColor);
    pdf.setLineWidth(0.5);
    pdf.line(15, yPosition, pageWidth - 15, yPosition);

    yPosition += 10;
    const totalResolved = categoryStats.reduce((sum, cat) => sum + cat.resolved + cat.closed, 0);
    const totalClosed = categoryStats.reduce((sum, cat) => sum + cat.closed, 0);
    const totalTickets = categoryStats.reduce((sum, cat) => sum + cat.count, 0);
    const resolutionRate = totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 100) : 0;
    const closedRate = totalTickets > 0 ? Math.round((totalClosed / totalTickets) * 100) : 0;

    pdf.setFillColor(...lightGray);
    const boxWidth = (pageWidth - 40) / 3;
    pdf.rect(15, yPosition, boxWidth, 25, 'F');
    pdf.rect(15 + boxWidth + 5, yPosition, boxWidth, 25, 'F');
    pdf.rect(15 + (boxWidth + 5) * 2, yPosition, boxWidth, 25, 'F');

    pdf.setFontSize(12);
    pdf.setTextColor(...primaryColor);
    pdf.text('Total Tickets', 20, yPosition + 8);
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text(totalTickets.toString(), 20, yPosition + 18);

    pdf.setFontSize(12);
    pdf.setTextColor(...primaryColor);
    pdf.text('Resolution Rate', 20 + boxWidth + 5, yPosition + 8);
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${resolutionRate}%`, 20 + boxWidth + 5, yPosition + 18);

    pdf.setFontSize(12);
    pdf.setTextColor(...primaryColor);
    pdf.text('Closed Rate', 20 + (boxWidth + 5) * 2, yPosition + 8);
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${closedRate}%`, 20 + (boxWidth + 5) * 2, yPosition + 18);

    yPosition += 35;
    pdf.setFontSize(14);
    pdf.setTextColor(...primaryColor);
    pdf.text('Tickets by Category', 15, yPosition);

    yPosition += 8;
    categoryStats.forEach((category, index) => {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFillColor(245, 247, 250);
      pdf.rect(15, yPosition, pageWidth - 30, 30, 'F');

      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text(getCategoryLabel(category.category), 20, yPosition + 8);
      pdf.text(category.count.toString(), pageWidth - 25, yPosition + 8, { align: 'right' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);

      const statusY = yPosition + 15;
      const colWidth = (pageWidth - 40) / 4;

      pdf.setTextColor(37, 99, 235);
      pdf.text(`Open: ${category.open}`, 20, statusY);

      pdf.setTextColor(202, 138, 4);
      pdf.text(`In Progress: ${category.in_progress}`, 20 + colWidth, statusY);

      pdf.setTextColor(22, 163, 74);
      pdf.text(`Resolved: ${category.resolved}`, 20 + colWidth * 2, statusY);

      pdf.setTextColor(107, 114, 128);
      pdf.text(`Closed: ${category.closed}`, 20 + colWidth * 3, statusY);

      const barY = yPosition + 22;
      const barWidth = pageWidth - 40;
      pdf.setFillColor(229, 231, 235);
      pdf.rect(20, barY, barWidth, 4, 'F');

      let currentX = 20;
      if (category.open > 0) {
        const width = (category.open / category.count) * barWidth;
        pdf.setFillColor(59, 130, 246);
        pdf.rect(currentX, barY, width, 4, 'F');
        currentX += width;
      }
      if (category.in_progress > 0) {
        const width = (category.in_progress / category.count) * barWidth;
        pdf.setFillColor(234, 179, 8);
        pdf.rect(currentX, barY, width, 4, 'F');
        currentX += width;
      }
      if (category.resolved > 0) {
        const width = (category.resolved / category.count) * barWidth;
        pdf.setFillColor(34, 197, 94);
        pdf.rect(currentX, barY, width, 4, 'F');
        currentX += width;
      }
      if (category.closed > 0) {
        const width = (category.closed / category.count) * barWidth;
        pdf.setFillColor(156, 163, 175);
        pdf.rect(currentX, barY, width, 4, 'F');
      }

      yPosition += 35;
    });

    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = 20;
    } else {
      yPosition += 10;
    }

    pdf.setFontSize(14);
    pdf.setTextColor(...primaryColor);
    pdf.text('Period Comparison', 15, yPosition);

    yPosition += 8;

    const tableHeaders = ['Period', 'Total', 'Open', 'In Progress', 'Resolved', 'Closed', 'Avg Time (h)'];
    const colWidths = [35, 20, 20, 25, 22, 20, 28];
    let xPos = 15;

    pdf.setFillColor(...primaryColor);
    pdf.rect(15, yPosition, pageWidth - 30, 8, 'F');

    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    tableHeaders.forEach((header, i) => {
      pdf.text(header, xPos + 2, yPosition + 5.5);
      xPos += colWidths[i];
    });

    yPosition += 8;
    pdf.setFont('helvetica', 'normal');

    periodComparison.forEach((period, index) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      if (index % 2 === 0) {
        pdf.setFillColor(...lightGray);
        pdf.rect(15, yPosition, pageWidth - 30, 8, 'F');
      }

      pdf.setTextColor(0, 0, 0);
      xPos = 15;

      pdf.text(period.period, xPos + 2, yPosition + 5.5);
      xPos += colWidths[0];

      pdf.text(period.total.toString(), xPos + 2, yPosition + 5.5);
      xPos += colWidths[1];

      pdf.text(period.open.toString(), xPos + 2, yPosition + 5.5);
      xPos += colWidths[2];

      pdf.text(period.in_progress.toString(), xPos + 2, yPosition + 5.5);
      xPos += colWidths[3];

      pdf.text(period.resolved.toString(), xPos + 2, yPosition + 5.5);
      xPos += colWidths[4];

      pdf.text(period.closed.toString(), xPos + 2, yPosition + 5.5);
      xPos += colWidths[5];

      pdf.text(period.avgResolutionTime > 0 ? period.avgResolutionTime.toFixed(1) : '-', xPos + 2, yPosition + 5.5);

      yPosition += 8;
    });

    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const footerY = pageHeight - 10;
    pdf.text('Proprieta - Real Estate Management Platform', pageWidth / 2, footerY, { align: 'center' });
    pdf.text(`Page 1 of ${pdf.getNumberOfPages()}`, pageWidth - 20, footerY, { align: 'right' });

    const fileName = `Support_Ticket_Analytics_${getPeriodLabel(selectedPeriod).replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalTickets = categoryStats.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/support')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Support Management</span>
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
          >
            <Download className="w-5 h-5" />
            Export to PDF
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Ticket Analytics</h2>
          <p className="text-gray-600 mt-1">Track support ticket trends and performance metrics</p>
        </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Time Period
          </h3>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="180days">Last 180 Days</option>
            <option value="ytd">Year to Date</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Total Tickets</p>
            <p className="text-3xl font-bold text-blue-900">{totalTickets}</p>
            <p className="text-xs text-blue-600 mt-1">{getPeriodLabel(selectedPeriod)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Resolution Rate</p>
            <p className="text-3xl font-bold text-green-900">
              {totalTickets > 0
                ? Math.round(
                    ((categoryStats.reduce((sum, cat) => sum + cat.resolved + cat.closed, 0)) / totalTickets) * 100
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-green-600 mt-1">Resolved</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Closed Rate</p>
            <p className="text-3xl font-bold text-gray-900">
              {totalTickets > 0
                ? Math.round(
                    ((categoryStats.reduce((sum, cat) => sum + cat.closed, 0)) / totalTickets) * 100
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-gray-600 mt-1">Closed</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-600" />
          Tickets by Category - {getPeriodLabel(selectedPeriod)}
        </h3>

        {categoryStats.length > 0 ? (
          <div className="space-y-4">
            {categoryStats.map((category) => (
              <div key={category.category} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{getCategoryLabel(category.category)}</h4>
                  <span className="text-2xl font-bold text-gray-900">{category.count}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-2 bg-blue-50 p-2 rounded">
                    {getStatusIcon('open')}
                    <div>
                      <p className="text-xs text-blue-600">Open</p>
                      <p className="font-semibold text-blue-900">{category.open}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-yellow-50 p-2 rounded">
                    {getStatusIcon('in_progress')}
                    <div>
                      <p className="text-xs text-yellow-600">In Progress</p>
                      <p className="font-semibold text-yellow-900">{category.in_progress}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-green-50 p-2 rounded">
                    {getStatusIcon('resolved')}
                    <div>
                      <p className="text-xs text-green-600">Resolved</p>
                      <p className="font-semibold text-green-900">{category.resolved}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                    {getStatusIcon('closed')}
                    <div>
                      <p className="text-xs text-gray-600">Closed</p>
                      <p className="font-semibold text-gray-900">{category.closed}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-full flex">
                    {category.open > 0 && (
                      <div
                        className="bg-blue-500"
                        style={{ width: `${(category.open / category.count) * 100}%` }}
                      />
                    )}
                    {category.in_progress > 0 && (
                      <div
                        className="bg-yellow-500"
                        style={{ width: `${(category.in_progress / category.count) * 100}%` }}
                      />
                    )}
                    {category.resolved > 0 && (
                      <div
                        className="bg-green-500"
                        style={{ width: `${(category.resolved / category.count) * 100}%` }}
                      />
                    )}
                    {category.closed > 0 && (
                      <div
                        className="bg-gray-500"
                        style={{ width: `${(category.closed / category.count) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No tickets found for this period</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Period Comparison
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Period</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Total</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Open</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">In Progress</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Resolved</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Closed</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-900">Avg Resolution Time</th>
              </tr>
            </thead>
            <tbody>
              {periodComparison.map((period) => (
                <tr key={period.period} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{period.period}</td>
                  <td className="text-center py-3 px-4 font-semibold">{period.total}</td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      {getStatusIcon('open')}
                      {period.open}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-yellow-600">
                      {getStatusIcon('in_progress')}
                      {period.in_progress}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      {getStatusIcon('resolved')}
                      {period.resolved}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      {getStatusIcon('closed')}
                      {period.closed}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    {period.avgResolutionTime > 0 ? (
                      <span className="text-gray-900">
                        {period.avgResolutionTime.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
