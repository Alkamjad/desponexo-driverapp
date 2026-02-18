import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DriverAnalytics from "@/components/DriverAnalytics";
import DashboardStats from "@/components/dashboard/DashboardStats";
import supabase from "@/components/supabaseClient";
import { t } from "@/components/utils/i18n";

export default function LeistungsanalysePage() {
  const navigate = useNavigate();
  const [tours, setTours] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    const driverId = localStorage.getItem("driver_id");
    if (!driverId) {
      navigate('/');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .order('assigned_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Supabase error:', error);
        setTours([]);
      } else {
        setTours(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading tours:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-24">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-lg border-b border-emerald-900/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-white hover:bg-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Leistungsanalyse</h1>
              <p className="text-sm text-slate-400">Statistiken & Auswertung</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <DashboardStats tours={tours} />
        <DriverAnalytics tours={tours} />
      </div>
    </div>
  );
}