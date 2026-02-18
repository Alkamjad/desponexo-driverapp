import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Building, LogOut, Key, Loader2, Check, Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { t } from "@/components/utils/i18n";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import ConnectionStatus from "@/components/ConnectionStatus";
import AccountDeletionDialog from "@/components/AccountDeletionDialog";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";
import { useAuth } from "@/components/AuthContext";

export default function Profil() {
  const isOnline = useOfflineStatus();
  const navigate = useNavigate();
  const { supabase, driver, loading, logout } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const scrollRef = useScrollRestoration('Profil');

  const handlePasswordChange = async () => {
     if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
       toast.error(t('profile_fill_fields'));
       return;
     }

     if (passwordForm.new !== passwordForm.confirm) {
       toast.error(t('profile_passwords_match'));
       return;
     }

     if (passwordForm.new.length < 6) {
       toast.error(t('profile_password_length'));
       return;
     }

     setIsChangingPassword(true);

     try {
       // 1. Erst aktuelle Credentials verifizieren mit Supabase Auth
       const { data, error: reAuthError } = await supabase.auth.signInWithPassword({
         email: driver.email,
         password: passwordForm.current
       });

       if (reAuthError) {
         toast.error('Aktuelles Passwort ist falsch');
         return;
       }

       // 2. Dann Passwort ändern
       const { error } = await supabase.auth.updateUser({
         password: passwordForm.new
       });

       if (error) {
         toast.error(error.message || t('profile_password_error'));
       } else {
         toast.success(t('profile_password_changed'));
         setShowPasswordForm(false);
         setPasswordForm({ current: '', new: '', confirm: '' });
       }
     } catch (error) {
       console.error('Password change error:', error);
       toast.error(t('tour_connection_error'));
     } finally {
       setIsChangingPassword(false);
     }
   };

  const handleLogout = async () => {
    await logout();
    navigate(createPageUrl('Anmelden'));
    toast.success(t('profile_logout_success'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md shadow-xl border-slate-700 bg-slate-800">
          <CardContent className="p-8 text-center">
            <p className="text-slate-400">{t('profile_error_loading_msg')}</p>
            <Button onClick={() => navigate(createPageUrl('Anmelden'))} className="mt-4">
              {t('profile_back_to_login')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />
      
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-20">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            {t('profile_title')}
          </h1>
        </div>
        <p className="text-emerald-100 text-sm">{t('profile_personal_info')}</p>
      </div>

      <div className="px-4 -mt-12 relative z-10 space-y-4">
        {/* Sprachwahl */}
        <LanguageSwitcher />
        
        {/* Persönliche Daten */}
        <Card className="border-0 shadow-xl bg-slate-800">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-white font-semibold text-lg mb-4">{t('profile_personal_data')}</h3>
            
            <div>
              <Label className="text-slate-400 text-xs mb-1">{t('profile_name').toUpperCase()}</Label>
              <div className="flex items-center gap-2 text-white">
                <User className="w-4 h-4 text-slate-400" />
                <span>{driver.full_name || `${driver.first_name} ${driver.last_name}`}</span>
              </div>
            </div>

            <div>
              <Label className="text-slate-400 text-xs mb-1">{t('profile_email').toUpperCase()}</Label>
              <div className="flex items-center gap-2 text-white">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{driver.email}</span>
              </div>
            </div>

            {driver.phone && (
              <div>
                <Label className="text-slate-400 text-xs mb-1">{t('profile_phone').toUpperCase()}</Label>
                <div className="flex items-center gap-2 text-white">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{driver.phone}</span>
                </div>
              </div>
            )}

            {driver.company_name && (
              <div>
                <Label className="text-slate-400 text-xs mb-1">{t('profile_company').toUpperCase()}</Label>
                <div className="flex items-center gap-2 text-white">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>{driver.company_name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benachrichtigungseinstellungen */}
        <Button
          onClick={() => navigate(createPageUrl('NotificationSettings'))}
          className="w-full h-14 bg-slate-800 hover:bg-slate-700 border border-slate-700 justify-start gap-4"
        >
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-medium">{t('notif_settings_title')}</p>
            <p className="text-slate-400 text-sm">{t('notif_settings_desc')}</p>
          </div>
        </Button>

        {/* Passwort ändern */}
        <Card className="border-0 shadow-xl bg-slate-800">
          <CardContent className="p-6">
            <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              {t('profile_change_password')}
            </h3>

            {!showPasswordForm ? (
              <Button
                onClick={() => setShowPasswordForm(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {t('profile_change_password')}
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-300 mb-2">{t('profile_current_password')}</Label>
                  <Input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder={t('profile_current_password')}
                  />
                </div>

                <div>
                  <Label className="text-slate-300 mb-2">{t('profile_new_password')}</Label>
                  <Input
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder={t('profile_password_placeholder')}
                  />
                </div>

                <div>
                  <Label className="text-slate-300 mb-2">{t('profile_confirm_password')}</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="bg-slate-900/50 border-slate-600 text-white"
                    placeholder={t('profile_password_repeat')}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({ current: '', new: '', confirm: '' });
                    }}
                    disabled={isChangingPassword}
                  >
                    {t('profile_cancel')}
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {t('profile_save')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account löschen */}
        <Button
          variant="outline"
          className="w-full border-red-600 text-red-400 hover:bg-red-600/20 h-14"
          onClick={() => setShowDeletionDialog(true)}
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Account löschen
        </Button>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full border-slate-600 text-slate-400 hover:bg-slate-600/20 h-14"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          {t('profile_logout')}
        </Button>
      </div>

      {/* Account Deletion Dialog */}
      <AccountDeletionDialog
        open={showDeletionDialog}
        onClose={() => setShowDeletionDialog(false)}
      />
    </div>
  );
}