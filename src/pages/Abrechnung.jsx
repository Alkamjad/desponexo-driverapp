import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Euro, Loader2, CheckCircle2, Clock, AlertCircle, 
  Calendar, FileText, RefreshCw, Fuel, Droplet, Gauge, Shield,
  ChevronDown, ChevronUp, Download, TrendingUp, Search, X
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import supabase from "@/components/supabaseClient";
import moment from "moment";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";
import { useTabStateRestoration } from "@/components/hooks/useTabStateRestoration";

export default function Abrechnung() {
  const navigate = useNavigate();
  const isOnline = useOfflineStatus();
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [fuelReports, setFuelReports] = useState([]);
  const [activeTab, setActiveTab] = useState("touren");
  const [driver, setDriver] = useState(null);
  const [tours, setTours] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const scrollRef = useScrollRestoration('Abrechnung');
  useTabStateRestoration('Abrechnung', activeTab, setActiveTab);

  useEffect(() => {
    // Prüfe earnings_access_enabled direkt aus drivers Tabelle (RLS)
    const checkEarningsAccess = async () => {
      const driverId = localStorage.getItem("driver_id");
      
      if (!driverId) {
        navigate(createPageUrl('Anmelden'));
        return;
      }

      try {
        // Direkte Supabase Query mit RLS (Anon Key)
        const { data: driverData, error } = await supabase
          .from('drivers')
          .select('earnings_access_enabled')
          .eq('id', driverId)
          .single();

        if (error) {
          setDriver({ earnings_access_enabled: false });
          setIsLoading(false);
          return;
        }

        const accessEnabled = driverData.earnings_access_enabled !== false;
        setDriver({ earnings_access_enabled: accessEnabled });

        // Wenn Zugriff erlaubt, lade Daten
        if (accessEnabled) {
          checkAuthAndLoadPayments();
          loadFuelReports();
          loadTours();
        } else {
          setIsLoading(false);
        }

      } catch (error) {
        setDriver({ earnings_access_enabled: false });
        setIsLoading(false);
      }
    };

    checkEarningsAccess();
  }, []);



  const checkAuthAndLoadPayments = async () => {
    const driverEmail = localStorage.getItem("driver_email");
    
    if (!driverEmail) {
      navigate(createPageUrl('Anmelden'));
      return;
    }

    await loadPayments();
  };

  const loadPayments = async (showRefresh = false) => {
    const driverEmail = localStorage.getItem("driver_email");

    if (!driverEmail) {
      toast.error(t('billing_error_email'));
      return;
    }

    if (showRefresh) setIsRefreshing(true);

    try {
      // ✅ Direkte Supabase Query
      const { data, error } = await supabase
        .from('driver_payments')
        .select(`
          id,
          driver_id,
          total_amount,
          paid_amount,
          remaining_amount,
          status,
          payment_date,
          tour_ids,
          notes,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        toast.error(t('billing_error_loading'));
      } else {
        setPayments(data || []);
        if (showRefresh && data?.length > 0) {
          toast.success(t('billing_updated').replace('{count}', data.length));
        }
      }
    } catch (error) {
      toast.error(t('billing_error_loading'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadFuelReports = async () => {
    const driverEmail = localStorage.getItem("driver_email");
    if (!driverEmail) return;

    try {
      // ✅ Direkte Supabase Query
      const { data, error } = await supabase
        .from('fuel_reports')
        .select(`
          id,
          tour_id,
          driver_id,
          liters,
          amount,
          mileage,
          payment_method,
          status,
          submitted_at,
          reviewed_at,
          reviewed_by,
          rejection_reason,
          payment_date,
          payment_reference,
          receipt_photo_url,
          license_plate,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error) {
        setFuelReports(data || []);
      }
      } catch (error) {
    }
  };

  const loadTours = async () => {
    const driverId = localStorage.getItem("driver_id");
    if (!driverId) return;

    try {
      // ✅ Direkte Supabase Query - Minimal für Billing
      const { data, error } = await supabase
        .from('tours')
        .select(`
          id,
          tour_id,
          tour_title,
          status,
          scheduled_pickup_from,
          pickup_address,
          delivery_address,
          final_compensation
        `)
        .order('assigned_at', { ascending: false })
        .limit(100);

      if (!error) {
        setTours(data || []);
      }
      } catch (error) {
    }
  };



  // Dedupliziere Payments nach ID (Duplikat-Schutz) + Filter
  const uniquePayments = payments
    .filter((payment, index, self) => index === self.findIndex(p => p.id === payment.id))
    .filter(payment => {
      if (activeTab !== "touren") return true;
      
      // Text-Suche
      const searchLower = searchTerm.toLowerCase();
      const tourIds = payment.tour_ids?.join(' ') || '';
      const matchesSearch = !searchTerm || 
        payment.id.toLowerCase().includes(searchLower) ||
        tourIds.toLowerCase().includes(searchLower) ||
        payment.notes?.toLowerCase().includes(searchLower);

      // Datum-Filter
      const paymentDate = moment(payment.created_at).format('YYYY-MM-DD');
      const matchesDateFrom = !dateFrom || moment(paymentDate).isSameOrAfter(dateFrom, 'day');
      const matchesDateTo = !dateTo || moment(paymentDate).isSameOrBefore(dateTo, 'day');

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });

  const getStatusBadge = (status) => {
    const statusConfig = {
      'offen': { label: t('billing_payment_status_open'), color: 'bg-yellow-500/20 text-yellow-300', icon: Clock },
      'teilweise_bezahlt': { label: t('billing_payment_status_partial'), color: 'bg-blue-500/20 text-blue-300', icon: AlertCircle },
      'bezahlt': { label: t('billing_payment_status_paid'), color: 'bg-green-500/20 text-green-300', icon: CheckCircle2 }
    };

    const config = statusConfig[status] || statusConfig['offen'];
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Offene Tankbelege (eigenes Geld, nicht bezahlt) + Filter
  const openFuelReports = fuelReports
    .filter(f => f.status !== 'bezahlt' && f.status !== 'abgelehnt')
    .filter(f => {
      if (activeTab !== "tank") return true;
      
      // Text-Suche
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        f.tour_id?.toLowerCase().includes(searchLower) ||
        f.license_plate?.toLowerCase().includes(searchLower);

      // Datum-Filter
      const fuelDate = moment(f.created_at).format('YYYY-MM-DD');
      const matchesDateFrom = !dateFrom || moment(fuelDate).isSameOrAfter(dateFrom, 'day');
      const matchesDateTo = !dateTo || moment(fuelDate).isSameOrBefore(dateTo, 'day');

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });
  const totalFuelAmount = openFuelReports.reduce((sum, f) => sum + (f.amount || 0), 0);
  
  // Gefilterte Tankberichte für Anzeige
  const filteredFuelReports = fuelReports.filter(f => {
    if (activeTab !== "tank") return true;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      f.tour_id?.toLowerCase().includes(searchLower) ||
      f.license_plate?.toLowerCase().includes(searchLower);

    const fuelDate = moment(f.created_at).format('YYYY-MM-DD');
    const matchesDateFrom = !dateFrom || moment(fuelDate).isSameOrAfter(dateFrom, 'day');
    const matchesDateTo = !dateTo || moment(fuelDate).isSameOrBefore(dateTo, 'day');

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  // Separate Stats für Touren und Tankbelege
  const tourenStats = {
    gesamt: uniquePayments.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    bezahlt: uniquePayments.reduce((sum, p) => sum + (p.paid_amount || 0), 0),
    offen: uniquePayments.reduce((sum, p) => sum + (p.remaining_amount || 0), 0)
  };

  const tankStats = {
    gesamt: fuelReports.reduce((sum, f) => sum + (f.amount || 0), 0),
    bezahlt: fuelReports.filter(f => f.status === 'bezahlt').reduce((sum, f) => sum + (f.amount || 0), 0),
    offen: totalFuelAmount
  };

  const totalStats = activeTab === "touren" ? tourenStats : tankStats;

  // Monatliche Aufschlüsselung berechnen
  const getMonthlyBreakdown = () => {
    const monthlyData = {};
    
    if (activeTab === "touren") {
      uniquePayments.forEach(payment => {
        const monthKey = moment(payment.created_at).format('YYYY-MM');
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            displayName: moment(payment.created_at).format('MMMM YYYY'),
            total: 0,
            paid: 0,
            open: 0,
            items: []
          };
        }
        monthlyData[monthKey].total += payment.total_amount || 0;
        monthlyData[monthKey].paid += payment.paid_amount || 0;
        monthlyData[monthKey].open += payment.remaining_amount || 0;
        monthlyData[monthKey].items.push(payment);
      });
    } else {
      fuelReports.forEach(fuel => {
        const monthKey = moment(fuel.created_at).format('YYYY-MM');
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            displayName: moment(fuel.created_at).format('MMMM YYYY'),
            total: 0,
            paid: 0,
            open: 0,
            items: []
          };
        }
        monthlyData[monthKey].total += fuel.amount || 0;
        if (fuel.status === 'bezahlt') {
          monthlyData[monthKey].paid += fuel.amount || 0;
        } else {
          monthlyData[monthKey].open += fuel.amount || 0;
        }
        monthlyData[monthKey].items.push(fuel);
      });
    }
    
    return Object.values(monthlyData).sort((a, b) => b.month.localeCompare(a.month));
  };

  const monthlyBreakdown = getMonthlyBreakdown();

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = '';
    
    if (activeTab === "touren") {
      csvContent = 'Datum,Zahlungs-ID,Status,Gesamt,Bezahlt,Offen\n';
      uniquePayments.forEach(payment => {
        csvContent += `${moment(payment.created_at).format('DD.MM.YYYY')},${payment.id.substring(0, 8)},${payment.status},${payment.total_amount?.toFixed(2)},${payment.paid_amount?.toFixed(2)},${payment.remaining_amount?.toFixed(2)}\n`;
      });
    } else {
      csvContent = 'Datum,Liter,Betrag,KM-Stand,Zahlungsart,Status\n';
      fuelReports.forEach(fuel => {
        csvContent += `${moment(fuel.created_at).format('DD.MM.YYYY HH:mm')},${fuel.liters},${fuel.amount?.toFixed(2)},${fuel.mileage},${fuel.payment_method},${fuel.status || fuel.reimbursement_status}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `abrechnung_${activeTab}_${moment().format('YYYY-MM-DD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('billing_csv_exported'));
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Zugriffskontrolle - wenn earnings_access_enabled explizit false ist
  if (driver && driver.earnings_access_enabled === false) {
    return (
      <div className="min-h-screen pb-24">
        {/* Connection Status Banner */}
        <ConnectionStatus isOnline={isOnline} />
        
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-20">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Euro className="w-5 h-5" />
            </div>
            {t('billing_title')}
          </h1>
        </div>

        {/* Zugriff verweigert Message */}
        <div className="px-4 -mt-12 relative z-10">
          <Card className="bg-slate-800 border-slate-700 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Funktion deaktiviert</h2>
              <p className="text-slate-400">
                Die Abrechnungsseite wurde von Ihrer Firma deaktiviert.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />
      
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Euro className="w-5 h-5" />
              </div>
              {t('billing_title')}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                loadPayments(true);
                loadFuelReports();
              }}
              disabled={isRefreshing}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-emerald-100 text-sm">
            {t('billing_subtitle').replace('{tours}', payments.length).replace('{fuel}', fuelReports.length)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-12 relative z-10 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-slate-800 border border-slate-700 p-1 h-auto">
            <TabsTrigger 
              value="touren" 
              className="py-3 data-[state=active]:bg-emerald-600 data-[state=active]:text-white rounded-lg"
            >
              <Euro className="w-4 h-4 mr-1" />
              {t('billing_tours')} ({uniquePayments.length})
            </TabsTrigger>
            <TabsTrigger 
              value="tank" 
              className="py-3 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg"
            >
              <Fuel className="w-4 h-4 mr-1" />
              {t('billing_fuel')} ({fuelReports.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Statistik */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">{totalStats.gesamt.toFixed(2)}€</div>
              <div className="text-xs text-blue-100 mt-1">{t('billing_total')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">{totalStats.bezahlt.toFixed(2)}€</div>
              <div className="text-xs text-green-100 mt-1">{t('billing_paid')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
            <CardContent className="p-4 text-center">
              <div className="text-xl font-bold text-white">{totalStats.offen.toFixed(2)}€</div>
              <div className="text-xs text-orange-100 mt-1">{t('billing_open')}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Monatliche Übersicht */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            {t('billing_monthly_overview')}
          </h2>
          <Button
            onClick={handleExportCSV}
            size="sm"
            variant="outline"
            className="border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('billing_csv_export')}
          </Button>
        </div>

        <div className="space-y-3">
          {monthlyBreakdown.map((month) => (
            <Card key={month.month} className="bg-slate-800 border-slate-700 shadow-lg overflow-hidden">
              <button
                onClick={() => setExpandedMonth(expandedMonth === month.month ? null : month.month)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <h3 className="text-white font-bold mb-2">{month.displayName}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">{t('billing_total_label')}</p>
                      <p className="text-blue-400 font-bold">{month.total.toFixed(2)}€</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">{t('billing_paid_label')}</p>
                      <p className="text-green-400 font-bold">{month.paid.toFixed(2)}€</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">{t('billing_open_label')}</p>
                      <p className="text-orange-400 font-bold">{month.open.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  {expandedMonth === month.month ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {expandedMonth === month.month && (
                <div className="border-t border-slate-700 p-4 bg-slate-900/50 space-y-2">
                  <p className="text-slate-400 text-xs mb-3">{month.items.length} {activeTab === "touren" ? t('billing_payments') : t('billing_fuel_processes')}</p>
                  {activeTab === "touren" ? (
                    month.items.map((payment) => (
                      <div key={payment.id} className="bg-slate-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-medium">#{payment.id.substring(0, 8)}</p>
                          <p className="text-slate-500 text-xs">{moment(payment.created_at).format('DD.MM.YYYY')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">{payment.total_amount?.toFixed(2)}€</p>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    month.items.map((fuel) => {
                      const fuelStatus = fuel.status;
                      const isReviewPending = fuelStatus === 'wird_geprueft' || fuelStatus === 'wird_geprüft';

                      return (
                        <div key={fuel.id} className="bg-slate-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Fuel className="w-4 h-4 text-blue-400" />
                              <div>
                                <p className="text-white text-sm font-medium">{fuel.liters}L</p>
                                <p className="text-slate-500 text-xs">{moment(fuel.created_at).format('DD.MM.YYYY')}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">{fuel.amount?.toFixed(2)}€</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={`text-xs ${fuelStatus === 'bezahlt' ? 'bg-green-500/20 text-green-300' : fuelStatus === 'abgelehnt' ? 'bg-red-500/20 text-red-300' : isReviewPending ? 'bg-yellow-500/20 text-yellow-300' : 'bg-orange-500/20 text-orange-300'}`}>
                              {fuelStatus === 'bezahlt' ? t('fuel_paid') : fuelStatus === 'abgelehnt' ? t('billing_rejected') : isReviewPending ? t('billing_being_checked') : t('fuel_open')}
                            </Badge>
                            {isReviewPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-blue-600 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                   // TODO: Öffne FuelReportModal mit Bearbeitung
                                 }}
                              >
                                {t('billing_edit')}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        {activeTab === "touren" && (
          <>
            {/* Suchfilter für Touren */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Tour-ID oder Zahlungs-ID</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="z.B. #5b42ec37..."
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Von</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Bis</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>
                {(searchTerm || dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setDateFrom(""); setDateTo(""); }} className="w-full text-slate-400 hover:text-white">
                    <X className="w-4 h-4 mr-2" />Filter zurücksetzen
                  </Button>
                )}
              </CardContent>
            </Card>

            {uniquePayments.length === 0 ? (
          <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Euro className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 font-medium">{t('billing_no_payments')}</p>
              <p className="text-slate-500 text-sm mt-2">
                {t('billing_no_payments_desc')}
              </p>
            </CardContent>
          </Card>
            ) : (
              uniquePayments.map((payment) => {
                const firstTour = payment.tour_ids?.[0] ? tours.find(t => t.tour_id === payment.tour_ids[0] || t.id === payment.tour_ids[0]) : null;
                const tourNumber = firstTour?.tour_title || payment.tour_ids?.[0]?.substring(0, 8) || payment.id.substring(0, 8);

                return (
              <Card key={payment.id} className="border-0 shadow-lg bg-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                 <div>
                   <CardTitle className="text-white text-lg mb-2">
                     Abrechnung zur Tour {tourNumber}
                   </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="w-4 h-4" />
                      {moment(payment.created_at).format('DD.MM.YYYY')}
                    </div>
                  </div>
                  {getStatusBadge(payment.status)}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Beträge */}
                <div className="grid grid-cols-3 gap-3 py-4 border-y border-slate-700">
                  <div>
                    <p className="text-xs text-slate-500">{t('billing_total')}</p>
                    <p className="text-lg font-bold text-white">{payment.total_amount?.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t('billing_paid')}</p>
                    <p className="text-lg font-bold text-green-400">{payment.paid_amount?.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{t('billing_open')}</p>
                    <p className="text-lg font-bold text-orange-400">{payment.remaining_amount?.toFixed(2)}€</p>
                  </div>
                </div>

                {/* Zahlungsdatum */}
                {payment.payment_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-slate-400">{t('billing_paid_on')}</span>
                    <span className="text-white">{moment(payment.payment_date).format('DD.MM.YYYY')}</span>
                  </div>
                )}

                {/* Tour Details */}
                {payment.tour_ids && payment.tour_ids.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-3">{t('billing_settled_tours')}</p>
                    <div className="space-y-2">
                      {payment.tour_ids.map((tourId, index) => {
                        const tour = tours.find(t => t.tour_id === tourId || t.id === tourId);
                        
                        if (!tour) {
                          return (
                            <Badge key={index} variant="outline" className="text-xs border-slate-600 text-slate-300">
                              Tour #{tourId.substring(0, 8)}
                            </Badge>
                          );
                        }

                        return (
                          <div key={index} className="bg-slate-700/30 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white font-medium">Tour {tour.tour_title || `#${tour.tour_id?.substring(0, 8) || tour.id.substring(0, 8)}`}</span>
                              {tour.scheduled_pickup_from && (
                                <span className="text-slate-400 text-xs">{moment(tour.scheduled_pickup_from).format('DD.MM.YY')}</span>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-slate-400">
                              {tour.pickup_address && (
                                <div className="flex items-start gap-2">
                                  <span className="text-emerald-400">▲</span>
                                  <span>{tour.pickup_address}</span>
                                </div>
                              )}
                              {tour.delivery_address && (
                                <div className="flex items-start gap-2">
                                  <span className="text-blue-400">▼</span>
                                  <span>{tour.delivery_address}</span>
                                </div>
                              )}
                              {tour.final_compensation && (
                                <div className="text-emerald-400 font-semibold mt-2">
                                  {tour.final_compensation}€
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notizen */}
                {payment.notes && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('billing_notes')}</p>
                        <p className="text-sm text-slate-300">{payment.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
                );
              })
            )}
          </>
        )}

        {activeTab === "tank" && (
          <>
            {/* Suchfilter für Tankvorgänge */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Tour-ID oder Kennzeichen</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="z.B. Tour-123 oder B-XY 1234..."
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Von</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-1.5 block">Bis</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-slate-700 border-slate-600 text-white" />
                  </div>
                </div>
                {(searchTerm || dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setDateFrom(""); setDateTo(""); }} className="w-full text-slate-400 hover:text-white">
                    <X className="w-4 h-4 mr-2" />Filter zurücksetzen
                  </Button>
                )}
              </CardContent>
            </Card>

            {filteredFuelReports.length === 0 ? (
              <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Fuel className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-300 font-medium">{t('billing_no_fuel')}</p>
                  <p className="text-slate-500 text-sm mt-2">
                    {t('billing_no_fuel_desc')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredFuelReports.map((fuel) => {
                const isOwnMoney = fuel.payment_method === 'eigenes_geld';
                const fuelStatus = fuel.status;
                
                // Status-Logik: Bezahlt oder Offen
                let statusConfig;
                if (fuelStatus === 'bezahlt') {
                  statusConfig = { 
                    label: fuel.payment_date ? `${t('fuel_paid_on')} ${moment(fuel.payment_date).format('DD.MM.YY')}` : t('fuel_paid'), 
                    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', 
                    icon: CheckCircle2 
                  };
                } else {
                  statusConfig = { 
                    label: isOwnMoney ? t('fuel_reimbursement_open') : t('fuel_open'), 
                    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', 
                    icon: Clock 
                  };
                }
                const StatusIcon = statusConfig.icon;

                return (
                  <Card key={fuel.id} className={`border shadow-lg ${isOwnMoney ? 'bg-gradient-to-br from-orange-900/20 to-slate-800 border-orange-500/20' : 'bg-gradient-to-br from-blue-900/20 to-slate-800 border-blue-500/20'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-lg mb-2 flex items-center gap-2">
                            <Fuel className={`w-5 h-5 ${isOwnMoney ? 'text-orange-400' : 'text-blue-400'}`} />
                            {t('fuel_tankvorgang')}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Calendar className="w-4 h-4" />
                            {moment(fuel.created_at).format('DD.MM.YYYY HH:mm')}
                          </div>
                          {fuel.license_plate && (
                            <p className="text-slate-400 text-sm mt-1">
                              {t('fuel_vehicle')} {fuel.license_plate}
                            </p>
                          )}
                          {isOwnMoney && (
                            <Badge className="bg-orange-500/20 text-orange-300 text-xs mt-2 border-orange-500/30">
                              {t('fuel_own_money')}
                            </Badge>
                          )}
                        </div>
                        <Badge className={`${statusConfig.color} border`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-700">
                        <div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Droplet className="w-3 h-3" /> {t('fuel_liters').split(' ')[0]}
                          </p>
                          <p className="text-lg font-bold text-white">{fuel.liters}L</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Euro className="w-3 h-3" /> {t('billing_total')}
                          </p>
                          <p className="text-lg font-bold text-blue-400">{fuel.amount?.toFixed(2)}€</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Gauge className="w-3 h-3" /> {t('fuel_mileage').split(' ')[0]}
                          </p>
                          <p className="text-lg font-bold text-white">{fuel.mileage?.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="bg-slate-700/30 rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">{t('fuel_payment_type')}</p>
                            <p className="text-white capitalize">{fuel.payment_method?.replace('_', ' ')}</p>
                          </div>
                          {fuel.payment_date && fuel.status === 'bezahlt' && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">{t('fuel_reimbursed_on')}</p>
                              <p className="text-emerald-400 font-semibold">{moment(fuel.payment_date).format('DD.MM.YYYY')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {fuel.receipt_photo_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-blue-600 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => window.open(fuel.receipt_photo_url, '_blank')}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            {t('fuel_view_receipt')}
                          </Button>
                        )}
                        {fuel.status === 'wird_geprueft' && (
                          <Button
                            size="sm"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              // Speichere fuel report in sessionStorage für Bearbeitung
                              sessionStorage.setItem('edit_fuel_report', JSON.stringify(fuel));
                              navigate(createPageUrl('DriverHome'));
                            }}
                          >
                            📝 Tankbeleg bearbeiten
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}