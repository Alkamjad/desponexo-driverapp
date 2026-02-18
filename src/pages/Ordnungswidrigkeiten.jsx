import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, ArrowLeft, FileText, Euro, Calendar, 
  MapPin, Loader2, RefreshCw, Inbox, Building2, Truck
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import LoadingScreen from "@/components/LoadingScreen";
import supabase from "@/components/supabaseClient";
import { useTabStateRestoration } from "@/components/hooks/useTabStateRestoration";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";

const VIOLATION_TYPE_LABELS = {
  SPEEDING: 'Geschwindigkeitsüberschreitung',
  RED_LIGHT: 'Rotlichtverstoß',
  PARKING: 'Parkverstoß',
  PHONE: 'Handyverstoß',
  DISTANCE: 'Abstandsverstoß',
  OTHER: 'Sonstiges'
};

const getStatusConfig = (status) => {
  const configs = {
    OPEN: { 
      label: 'Offen', 
      color: 'bg-yellow-500',
      textColor: 'text-yellow-400'
    },
    PAID: { 
      label: 'Bezahlt', 
      color: 'bg-green-500',
      textColor: 'text-green-400'
    },
    CANCELLED: { 
      label: 'Storniert', 
      color: 'bg-slate-500',
      textColor: 'text-slate-400'
    }
  };
  return configs[status] || configs.OPEN;
};

export default function Ordnungswidrigkeiten() {
  const navigate = useNavigate();
  const [violations, setViolations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const scrollRef = useScrollRestoration('Ordnungswidrigkeiten');
  useTabStateRestoration('Ordnungswidrigkeiten', activeTab, setActiveTab);

  useEffect(() => {
    loadViolations();
  }, []);

  const loadViolations = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);

    try {
      // ✅ Direkte Supabase Query
      const { data, error } = await supabase
        .from('traffic_violations')
        .select(`
          id,
          driver_id,
          tour_id,
          vehicle_id,
          violation_type,
          custom_label,
          status,
          amount,
          currency,
          violation_date,
          reference_number,
          due_date,
          notes_company,
          paid_at,
          cancelled_at,
          cancelled_reason,
          has_pdf,
          created_at,
          updated_at
        `)
        .order('violation_date', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase violations error:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          statusCode: error?.statusCode
        });
        toast.error(t('violations_error_loading'));
        setViolations([]);
      } else {
        // Load PDFs and Payment Proofs from traffic_violation_files
        const violationsWithFiles = await Promise.all(
          (data || []).map(async (violation) => {
            try {
              const { data: files, error: filesError } = await supabase
                .from('traffic_violation_files')
                .select('*')
                .eq('violation_id', violation.id);

              if (!filesError && files) {
                const pdfFile = files.find(f => 
                  f.file_type === 'VIOLATION_PDF' || 
                  f.file_type === 'PDF' ||
                  f.mime_type === 'application/pdf'
                );
                const proofFile = files.find(f => f.file_type === 'PAYMENT_PROOF');

                let pdf_url = null;
                let payment_proof_url = null;

                if (pdfFile?.path) {
                  const { data: signedPdf } = await supabase.storage
                    .from('traffic-violations')
                    .createSignedUrl(pdfFile.path, 3600);
                  pdf_url = signedPdf?.signedUrl || null;
                }

                if (proofFile?.path) {
                  const { data: signedProof } = await supabase.storage
                    .from('traffic-violations')
                    .createSignedUrl(proofFile.path, 3600);
                  payment_proof_url = signedProof?.signedUrl || null;
                }

                return {
                  ...violation,
                  pdf_url,
                  payment_proof_url
                };
              }
              return violation;
            } catch (err) {
              return violation;
            }
          })
        );
        setViolations(violationsWithFiles);
      }
    } catch (error) {
      console.error('Error loading violations:', error);
      toast.error(t('violations_error_loading'));
      setViolations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredViolations = violations.filter(v => {
    if (activeTab === "open") return v.status === 'OPEN';
    if (activeTab === "paid") return v.status === 'PAID';
    if (activeTab === "cancelled") return v.status === 'CANCELLED';
    return true;
  });

  if (isLoading) {
    return <LoadingScreen message={t('violations_loading')} />;
  }

  const openCount = violations.filter(v => v.status === 'OPEN').length;
  const paidCount = violations.filter(v => v.status === 'PAID').length;
  const cancelledCount = violations.filter(v => v.status === 'CANCELLED').length;

  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Header */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 pt-8 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              {t('violations_title')}
            </h1>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-red-100 text-sm">
              {openCount} {t('violations_open').toLowerCase()} · {paidCount} {t('violations_paid').toLowerCase()} · {cancelledCount} {t('violations_cancelled').toLowerCase()}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadViolations(true)}
              disabled={isRefreshing}
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-12 relative z-10 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-slate-800 border border-slate-700 p-1 h-auto">
            <TabsTrigger 
              value="open" 
              className="py-3 data-[state=active]:bg-yellow-600 data-[state=active]:text-white rounded-lg text-xs"
            >
              {t('violations_open')} ({openCount})
            </TabsTrigger>
            <TabsTrigger 
              value="paid" 
              className="py-3 data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-lg text-xs"
            >
              {t('violations_paid')} ({paidCount})
            </TabsTrigger>
            <TabsTrigger 
              value="cancelled" 
              className="py-3 data-[state=active]:bg-slate-600 data-[state=active]:text-white rounded-lg text-xs"
            >
              {t('violations_cancelled')} ({cancelledCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        {filteredViolations.length === 0 ? (
          <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 font-medium mb-2">
                {t('violations_empty')}
              </p>
              <p className="text-slate-500 text-sm">
                {t('violations_empty_desc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredViolations.map((violation) => {
            const config = getStatusConfig(violation.status);
            return (
              <Card 
                key={violation.id} 
                className="border-0 shadow-xl bg-slate-800/80 backdrop-blur cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => navigate(createPageUrl(`OrdnungswidrigkeitDetails?id=${violation.id}`))}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-lg">
                          {violation.reference_number || `#${violation.id.substring(0, 8)}`}
                        </h3>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {VIOLATION_TYPE_LABELS[violation.violation_type] || violation.violation_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-red-400 font-bold text-xl">
                        {violation.amount?.toFixed(2)}€
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-slate-400 text-sm">Status:</span>
                    <Badge className={`${config.color} text-white text-xs`}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    {violation.violation_date && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(violation.violation_date).toLocaleDateString('de-DE')}
                      </div>
                    )}
                    {violation.custom_label && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="w-4 h-4" />
                        {violation.custom_label}
                      </div>
                    )}
                    {violation.due_date && violation.status === 'OPEN' && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <AlertTriangle className="w-4 h-4" />
                        Fällig bis {new Date(violation.due_date).toLocaleDateString('de-DE')}
                      </div>
                    )}

                  </div>

                  <div className="flex gap-2">
                    {violation.pdf_url && (
                      <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
                        <FileText className="w-3 h-3 mr-1" />
                        PDF vorhanden
                      </Badge>
                    )}
                    {violation.payment_proof_url && (
                      <Badge variant="outline" className="text-green-400 border-green-600 text-xs">
                        ✓ Nachweis hochgeladen
                      </Badge>
                    )}
                  </div>

                  {/* Button zum Details */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(createPageUrl(`OrdnungswidrigkeitDetails?id=${violation.id}`));
                    }}
                    className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Mehr Details & Bezahlung
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}