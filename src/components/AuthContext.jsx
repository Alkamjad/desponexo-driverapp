import React, { createContext, useContext, useState, useEffect } from 'react';
import supabase from '@/components/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial Session Check
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // Load Driver Profile from localStorage
          const savedDriver = localStorage.getItem('driver_data');
          if (savedDriver) {
            try {
              const driverData = JSON.parse(savedDriver);
              if (driverData.earnings_access_enabled === undefined) {
                driverData.earnings_access_enabled = true;
              }
              setDriver(driverData);
            } catch (parseError) {
              console.error('Error parsing driver data:', parseError);
              localStorage.removeItem('driver_data');
            }
          } else {
            // Fallback: Wenn localStorage leer, aber Session da -> Driver-Daten von Supabase laden
            const driverId = localStorage.getItem('driver_id');
            if (driverId) {
              const { data: driverFromDb } = await supabase
                .from('drivers')
                .select('*')
                .eq('id', driverId)
                .single();
              
              if (driverFromDb) {
                setDriver(driverFromDb);
                localStorage.setItem('driver_data', JSON.stringify(driverFromDb));
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          setDriver(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const updateDriver = (driverData) => {
    if (driverData.earnings_access_enabled === undefined) {
      driverData.earnings_access_enabled = true;
    }
    setDriver(driverData);
    localStorage.setItem('driver_data', JSON.stringify(driverData));
    localStorage.setItem('driver_id', driverData.id);
    localStorage.setItem('driver_email', driverData.email);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('driver_data');
    localStorage.removeItem('driver_id');
    setUser(null);
    setDriver(null);
  };

  const value = {
    supabase,
    user,
    driver,
    driverId: driver?.id,
    loading,
    updateDriver,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};