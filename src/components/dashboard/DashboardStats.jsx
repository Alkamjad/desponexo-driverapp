import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Euro, TrendingUp, Calendar, Package } from "lucide-react";
import { t } from "@/components/utils/i18n";
import moment from "moment";

export default function DashboardStats({ tours }) {
  const stats = useMemo(() => {
    const now = moment();
    const thisWeekStart = now.clone().startOf('isoWeek');
    const lastWeekStart = thisWeekStart.clone().subtract(1, 'week');
    const thisMonthStart = now.clone().startOf('month');
    const lastMonthStart = thisMonthStart.clone().subtract(1, 'month');

    // Filter abgeschlossene Touren mit approved_at
    const completedTours = tours.filter(t => 
      t.status?.toLowerCase() === 'completed' && t.approved_at
    );

    // Diese Woche
    const thisWeekTours = completedTours.filter(t => 
      moment(t.approved_at).isSameOrAfter(thisWeekStart)
    );
    const thisWeekEarnings = thisWeekTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0);

    // Letzte Woche
    const lastWeekTours = completedTours.filter(t => {
      const date = moment(t.approved_at);
      return date.isSameOrAfter(lastWeekStart) && date.isBefore(thisWeekStart);
    });
    const lastWeekEarnings = lastWeekTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0);

    // Dieser Monat
    const thisMonthTours = completedTours.filter(t => 
      moment(t.approved_at).isSameOrAfter(thisMonthStart)
    );
    const thisMonthEarnings = thisMonthTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0);

    // Letzter Monat
    const lastMonthTours = completedTours.filter(t => {
      const date = moment(t.approved_at);
      return date.isSameOrAfter(lastMonthStart) && date.isBefore(thisMonthStart);
    });
    const lastMonthEarnings = lastMonthTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0);

    // Durchschnitte
    const avgToursPerDay = thisMonthTours.length / now.date();
    const avgEarningsPerTour = thisMonthTours.length > 0 ? thisMonthEarnings / thisMonthTours.length : 0;

    // Letzte 7 Tage Trend
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = now.clone().subtract(i, 'days');
      const dayTours = completedTours.filter(t => 
        moment(t.approved_at).isSame(date, 'day')
      );
      last7Days.push({
        date: date.format('DD.MM'),
        tours: dayTours.length,
        earnings: dayTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0)
      });
    }

    // Letzte 4 Wochen
    const last4Weeks = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = now.clone().subtract(i, 'weeks').startOf('isoWeek');
      const weekEnd = weekStart.clone().endOf('isoWeek');
      const weekTours = completedTours.filter(t => {
        const date = moment(t.approved_at);
        return date.isSameOrAfter(weekStart) && date.isSameOrBefore(weekEnd);
      });
      last4Weeks.push({
        week: `KW${weekStart.isoWeek()}`,
        tours: weekTours.length,
        earnings: weekTours.reduce((sum, t) => sum + (parseFloat(t.final_compensation) || 0), 0)
      });
    }

    return {
      thisWeekTours: thisWeekTours.length,
      thisWeekEarnings,
      lastWeekTours: lastWeekTours.length,
      lastWeekEarnings,
      thisMonthTours: thisMonthTours.length,
      thisMonthEarnings,
      lastMonthTours: lastMonthTours.length,
      lastMonthEarnings,
      avgToursPerDay,
      avgEarningsPerTour,
      last7Days,
      last4Weeks
    };
  }, [tours]);

  const earningsChange = stats.lastWeekEarnings > 0 
    ? ((stats.thisWeekEarnings - stats.lastWeekEarnings) / stats.lastWeekEarnings * 100).toFixed(1)
    : 0;

  const toursChange = stats.lastWeekTours > 0
    ? ((stats.thisWeekTours - stats.lastWeekTours) / stats.lastWeekTours * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Euro className="w-5 h-5 text-emerald-400" />
              </div>
              {earningsChange !== 0 && (
                <div className={`text-xs flex items-center gap-1 ${
                  earningsChange > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${earningsChange < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(earningsChange)}%
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.thisWeekEarnings.toFixed(2)}€
            </div>
            <div className="text-xs text-slate-400">Diese Woche</div>
            <div className="text-xs text-slate-500 mt-1">
              Letzte: {stats.lastWeekEarnings.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              {toursChange !== 0 && (
                <div className={`text-xs flex items-center gap-1 ${
                  toursChange > 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  <TrendingUp className={`w-3 h-3 ${toursChange < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(toursChange)}%
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.thisWeekTours}
            </div>
            <div className="text-xs text-slate-400">Touren diese Woche</div>
            <div className="text-xs text-slate-500 mt-1">
              Letzte: {stats.lastWeekTours}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.avgToursPerDay.toFixed(1)}
            </div>
            <div className="text-xs text-slate-400">Ø Touren/Tag</div>
            <div className="text-xs text-slate-500 mt-1">
              Dieser Monat
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center mb-2">
              <Euro className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {stats.avgEarningsPerTour.toFixed(2)}€
            </div>
            <div className="text-xs text-slate-400">Ø pro Tour</div>
            <div className="text-xs text-slate-500 mt-1">
              Dieser Monat
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Trend & Entwicklung</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="7days" className="w-full">
            <TabsList className="bg-slate-700 w-full">
              <TabsTrigger value="7days" className="flex-1 text-xs">7 Tage</TabsTrigger>
              <TabsTrigger value="4weeks" className="flex-1 text-xs">4 Wochen</TabsTrigger>
            </TabsList>
            
            <TabsContent value="7days" className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#cbd5e1' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Line type="monotone" dataKey="tours" stroke="#3b82f6" strokeWidth={2} name="Touren" />
                  <Line type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} name="Verdienst €" />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="4weeks" className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.last4Weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
                  <Bar dataKey="tours" fill="#3b82f6" name="Touren" />
                  <Bar dataKey="earnings" fill="#10b981" name="Verdienst €" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Monats-Vergleich */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Monatsvergleich</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-xs mb-1">Dieser Monat</div>
              <div className="text-white font-semibold">{stats.thisMonthTours} Touren</div>
              <div className="text-emerald-400 text-sm">{stats.thisMonthEarnings.toFixed(2)}€</div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 text-xs mb-1">Letzter Monat</div>
              <div className="text-white font-semibold">{stats.lastMonthTours} Touren</div>
              <div className="text-slate-400 text-sm">{stats.lastMonthEarnings.toFixed(2)}€</div>
            </div>
          </div>
          
          {stats.lastMonthEarnings > 0 && (
            <div className="pt-3 border-t border-slate-700">
              <div className={`text-center text-sm ${
                stats.thisMonthEarnings > stats.lastMonthEarnings ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {stats.thisMonthEarnings > stats.lastMonthEarnings ? '+' : ''}
                {(stats.thisMonthEarnings - stats.lastMonthEarnings).toFixed(2)}€
                {' '}({((stats.thisMonthEarnings - stats.lastMonthEarnings) / stats.lastMonthEarnings * 100).toFixed(1)}%)
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}