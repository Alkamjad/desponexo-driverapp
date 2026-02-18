import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stethoscope, Calendar, X } from 'lucide-react';
import supabase from '@/components/supabaseClient';

export default function AbsenceOverlay({ driverId, driverEmail, onClose }) {
  const [activeAbsence, setActiveAbsence] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    const savedDriver = localStorage.getItem('driver_data');
    if (savedDriver) {
      setDriver(JSON.parse(savedDriver));
    }
    loadActiveAbsence();
  }, [driverId, driverEmail]);

  const loadActiveAbsence = async () => {
    try {
      if (!driverId) {
        setIsLoading(false);
        return;
      }

      // Direkter Supabase Query mit RLS
      const { data, error } = await supabase
        .from('absence_requests')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filtere aktuelle/zukünftige genehmigte Abwesenheiten
        const today = new Date().toISOString().split('T')[0];
        const activeAbsence = data.find(a => 
          a.requested_end_date >= today && 
          a.status === 'approved'
        );
        
        if (activeAbsence) {
          setActiveAbsence(activeAbsence);
        }
      }
    } catch (error) {
      console.error('Error loading active absence:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !activeAbsence) {
    return null;
  }

  const isVacation = activeAbsence.request_type === 'urlaub';
  const Icon = isVacation ? Calendar : Stethoscope;
  const companyName = driver?.company_name || 'Ihr Arbeitgeber';
  const companyMessage = isVacation 
    ? `${companyName} wünscht dir einen erholsamen Urlaub und wertvolle Zeit mit deinen Liebsten!`
    : `${companyName} wünscht dir gute Besserung und schnelle Genesung!`;
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full h-full max-w-md flex flex-col items-center justify-center">
        <Card className="bg-gradient-to-br border-0 w-full shadow-2xl" style={{
          backgroundImage: isVacation 
            ? 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)'
            : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
        }}>
          <CardContent className="p-8 text-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="flex justify-center mb-6 pt-4">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                <Icon className="w-12 h-12 text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">
              {isVacation ? 'Genießen Sie Ihren Urlaub!' : 'Gute Besserung!'}
            </h1>

            <p className="text-white/90 text-base mb-6">
              {isVacation 
                ? 'Sie sind derzeit im Urlaub. Lassen Sie die Arbeit hinter sich und genießen Sie Ihre wohlverdiente Erholung.'
                : 'Sie sind derzeit krankgeschrieben. Konzentrieren Sie sich auf Ihre Genesung.'}
            </p>

            <div className="bg-white/10 rounded-lg p-5 mb-6 text-white/95">
              <p className="text-sm font-medium mb-2">
                {isVacation ? 'Urlaubszeitraum' : 'Abwesenheitszeitraum'}
              </p>
              <p className="text-white font-semibold mb-4">
                {new Date(activeAbsence.requested_start_date).toLocaleDateString('de-DE')} - {' '}
                {new Date(activeAbsence.requested_end_date).toLocaleDateString('de-DE')}
              </p>
              <p className="text-sm italic text-white/90">
                {companyMessage}
              </p>
            </div>

            <Button
              onClick={onClose}
              className={`w-full ${
                isVacation
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              Verstanden
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}