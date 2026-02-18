import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, Clock, MapPin, Calendar, CheckCircle2, XCircle, Package, 
  Target, Zap, Award, Activity
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { t } from "@/components/utils/i18n";
import moment from "moment";

export default function DriverAnalytics({ tours }) {
  const [timeFilter, setTimeFilter] = useState("30"); // Tage
  const [tourTypeFilter, setTourTypeFilter] = useState("all");

  // Gefilterte Touren
  const filteredTours = useMemo(() => {
    let filtered = tours.filter(tour => {
      // Zeitfilter
      const tourDate = tour.tour_date || tour.scheduled_date;
      if (tourDate) {
        const daysAgo = moment().diff(moment(tourDate), 'days');
        if (timeFilter !== "all" && daysAgo > parseInt(timeFilter)) {
          return false;
        }
      }

      // Tourtyp-Filter
      if (tourTypeFilter === "multi" && !tour.is_multi_stop) return false;
      if (tourTypeFilter === "single" && tour.is_multi_stop) return false;

      return true;
    });

    return filtered;
  }, [tours, timeFilter, tourTypeFilter]);

  // Kennzahlen berechnen
  const analytics = useMemo(() => {
    const completed = filteredTours.filter(t => ['delivered', 'completed'].includes(t.status?.toLowerCase()));
    const cancelled = filteredTours.filter(t => ['cancelled', 'broken', 'failed'].includes(t.status?.toLowerCase()));

    // Durchschnittliche Lieferzeit (in Minuten)
    const deliveryTimes = completed
      .filter(t => t.picked_up_at && t.delivered_at)
      .map(t => {
        const start = new Date(t.picked_up_at);
        const end = new Date(t.delivered_at);
        return (end - start) / 1000 / 60; // Minuten
      });
    const avgDeliveryTime = deliveryTimes.length > 0 
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) 
      : 0;

    // Pünktlichkeit (geschätzt anhand von Lieferzeiten)
    const onTime = completed.filter(t => {
      if (!t.picked_up_at || !t.delivered_at) return true;
      const deliveryMinutes = (new Date(t.delivered_at) - new Date(t.picked_up_at)) / 1000 / 60;
      return deliveryMinutes <= 90; // < 90min = pünktlich
    }).length;
    const late = completed.length - onTime;

    // Durchschnittliche KM pro Tour (falls vorhanden)
    const toursWithKm = completed.filter(t => t.distance_km);
    const avgKm = toursWithKm.length > 0
      ? Math.round(toursWithKm.reduce((sum, t) => sum + (t.distance_km || 0), 0) / toursWithKm.length)
      : 0;

    // Performance Score (0-100)
    let performanceScore = 0;
    if (filteredTours.length > 0) {
      const successWeight = (completed.length / filteredTours.length) * 40; // 40% Gewicht
      const punctualityWeight = completed.length > 0 ? (onTime / completed.length) * 30 : 0; // 30% Gewicht
      const cancellationPenalty = (cancelled.length / filteredTours.length) * 30; // 30% Strafe
      performanceScore = Math.round(successWeight + punctualityWeight - cancellationPenalty);
    }

    // Produktivität: Touren pro Woche
    const weeksInPeriod = timeFilter === "all" ? 4 : Math.ceil(parseInt(timeFilter) / 7);
    const toursPerWeek = weeksInPeriod > 0 ? Math.round(completed.length / weeksInPeriod) : 0;

    return {
      totalTours: filteredTours.length,
      completed: completed.length,
      cancelled: cancelled.length,
      successRate: filteredTours.length > 0 ? Math.round((completed.length / filteredTours.length) * 100) : 0,
      avgDeliveryTime,
      onTime,
      late,
      avgKm,
      performanceScore,
      toursPerWeek
    };
  }, [filteredTours]);

  // Daten für Zeitverlauf-Chart (letzte 7 Tage)
  const timelineData = useMemo(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const dayTours = filteredTours.filter(t => {
        const tourDate = t.tour_date || t.scheduled_date;
        return tourDate && moment(tourDate).format('YYYY-MM-DD') === date;
      });
      
      last7Days.push({
        date: moment(date).format('DD.MM'),
        touren: dayTours.length,
        erledigt: dayTours.filter(t => ['delivered', 'completed'].includes(t.status?.toLowerCase())).length
      });
    }
    return last7Days;
  }, [filteredTours]);

  // Daten für Status-Pie-Chart
  const statusData = [
    { name: t('status_completed'), value: analytics.completed, color: '#10b981' },
    { name: t('status_cancelled'), value: analytics.cancelled, color: '#ef4444' },
    { name: t('analytics_other'), value: analytics.totalTours - analytics.completed - analytics.cancelled, color: '#6b7280' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card className="border-0 shadow-lg bg-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            {t('analytics_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('analytics_7_days')}</SelectItem>
                <SelectItem value="30">{t('analytics_30_days')}</SelectItem>
                <SelectItem value="90">{t('analytics_90_days')}</SelectItem>
                <SelectItem value="all">{t('analytics_all')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tourTypeFilter} onValueChange={setTourTypeFilter}>
              <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('analytics_all_tours')}</SelectItem>
                <SelectItem value="single">{t('analytics_standard')}</SelectItem>
                <SelectItem value="multi">{t('analytics_multistop')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Performance Score - Hero Card */}
      <Card className="border-0 shadow-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 overflow-hidden">
        <CardContent className="p-6 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-emerald-50 text-sm font-medium">{t('analytics_performance_score')}</p>
                  <p className="text-emerald-100/70 text-xs">{t('analytics_overall_rating')}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">{analytics.performanceScore}</div>
                <div className="text-emerald-100 text-sm">{t('analytics_of_100')}</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500 rounded-full"
                style={{ width: `${analytics.performanceScore}%` }}
              />
            </div>
            
            {/* Rating Badge */}
            <div className="mt-3 text-center">
              {analytics.performanceScore >= 80 && (
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  ⭐ {t('analytics_excellent_performance')}
                </Badge>
              )}
              {analytics.performanceScore >= 60 && analytics.performanceScore < 80 && (
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  ✅ {t('analytics_good_performance')}
                </Badge>
              )}
              {analytics.performanceScore < 60 && (
                <Badge className="bg-white/20 text-white border-0 text-xs">
                  📈 {t('analytics_room_for_improvement')}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kennzahlen Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Package className="w-8 h-8 text-white/80 mb-2" />
                <div className="text-2xl font-bold text-white">{analytics.completed}</div>
                <div className="text-xs text-blue-100">{t('analytics_completed_tours')}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-white/60">{analytics.totalTours}</div>
                <div className="text-xs text-blue-100">{t('analytics_total')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <CheckCircle2 className="w-8 h-8 text-white/80 mb-2" />
                <div className="text-2xl font-bold text-white">{analytics.successRate}%</div>
                <div className="text-xs text-green-100">{t('analytics_success_rate')}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-white/60">{analytics.cancelled}</div>
                <div className="text-xs text-green-100">{t('analytics_cancelled_short')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Clock className="w-8 h-8 text-white/80 mb-2" />
                <div className="text-2xl font-bold text-white">{analytics.avgDeliveryTime}</div>
                <div className="text-xs text-purple-100">{t('analytics_avg_minutes')}</div>
              </div>
              <div className="text-right">
                <Target className="w-6 h-6 text-white/60" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Zap className="w-8 h-8 text-white/80 mb-2" />
                <div className="text-2xl font-bold text-white">{analytics.toursPerWeek}</div>
                <div className="text-xs text-orange-100">{t('analytics_tours_per_week')}</div>
              </div>
              <div className="text-right">
                <Activity className="w-6 h-6 text-white/60" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pünktlichkeit */}
      <Card className="border-0 shadow-lg bg-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">{t('analytics_punctuality')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-slate-300 text-sm">{t('analytics_on_time')}: {analytics.onTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-slate-300 text-sm">{t('analytics_late')}: {analytics.late}</span>
            </div>
          </div>
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all"
              style={{ width: `${analytics.completed > 0 ? (analytics.onTime / analytics.completed) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Zeitverlauf */}
        <Card className="border-0 shadow-lg bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">{t('analytics_tour_overview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="touren" stroke="#3b82f6" strokeWidth={2} name={t('analytics_total')} />
                <Line type="monotone" dataKey="erledigt" stroke="#10b981" strokeWidth={2} name={t('analytics_completed')} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status-Verteilung */}
        <Card className="border-0 shadow-lg bg-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">{t('analytics_status_distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-3 flex-wrap">
              {statusData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-300 text-xs">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zusätzliche Insights */}
      <Card className="border-0 shadow-lg bg-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">{t('analytics_distance_performance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{analytics.avgKm || '—'} km</div>
                <div className="text-xs text-slate-400">{t('analytics_avg_distance')}</div>
              </div>
            </div>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-0">
              {t('analytics_per_tour')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}