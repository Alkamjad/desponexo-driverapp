import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check, ChevronDown } from "lucide-react";
import { setLanguage, getCurrentLanguage, t } from "@/components/utils/i18n";

const SyrianFlag = () => (
  <img 
    src="https://attlcrcpybgfkygcgwvz.supabase.co/storage/v1/object/public/driver-assets/syrian-flag.png"
    alt="Syrian Flag"
    className="w-6 h-4 object-cover rounded-sm shadow-sm"
  />
);

export default function LanguageSwitcher({ compact = false, large = false }) {
  const currentLang = getCurrentLanguage();
  const [open, setOpen] = useState(false);

  const languages = [
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
    { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
    { code: 'ar', name: 'العربية', flag: <SyrianFlag />, nativeName: 'العربية' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱', nativeName: 'Polski' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', nativeName: 'Русский' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦', nativeName: 'Українська' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', nativeName: 'Türkçe' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'es', name: 'Español', flag: '🇪🇸', nativeName: 'Español' }
  ];

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setOpen(false);
  };

  const currentLanguage = languages.find(l => l.code === currentLang);

  if (compact) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`${
              large 
                ? 'h-16 px-6 gap-3' 
                : 'h-12 px-4 gap-2'
            } w-full bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-white justify-between`}
          >
            <div className="flex items-center gap-3">
              <Globe className={`${large ? 'w-6 h-6' : 'w-5 h-5'} text-emerald-400`} />
              <span className={`${large ? 'text-base' : 'text-sm'} font-medium`}>
                {currentLanguage?.nativeName}
              </span>
            </div>
            <ChevronDown className={`${large ? 'w-5 h-5' : 'w-4 h-4'} text-slate-400`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="center" 
          className="w-[calc(100vw-2rem)] max-w-md bg-slate-800 border-slate-700 max-h-[400px] overflow-y-auto"
        >
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`cursor-pointer ${
                large ? 'px-5 py-4' : 'px-4 py-3'
              } ${
                currentLang === lang.code
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className={`${large ? 'text-2xl' : 'text-xl'} flex items-center`}>{lang.flag}</div>
                  <span className={`${large ? 'text-base' : 'text-sm'} font-medium`}>{lang.nativeName}</span>
                </div>
                {currentLang === lang.code && (
                  <Check className={`${large ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Globe className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold">
            {t('profile_language')}
          </h3>
          <p className="text-slate-400 text-xs">
            {currentLang === 'ar' ? 'اختر لغة التطبيق' : 
             currentLang === 'en' ? 'Choose app language' : 
             currentLang === 'pl' ? 'Wybierz język aplikacji' : 
             currentLang === 'ru' ? 'Выберите язык приложения' :
             currentLang === 'uk' ? 'Виберіть мову додатку' :
             currentLang === 'tr' ? 'Uygulama dilini seç' :
             currentLang === 'fr' ? 'Choisir la langue de l\'application' :
             currentLang === 'es' ? 'Elige el idioma de la aplicación' :
             'Wähle die App-Sprache'}
          </p>
        </div>
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full h-14 justify-between bg-slate-900/50 border-slate-600 hover:bg-slate-700 text-white"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl flex items-center">{currentLanguage?.flag}</div>
              <div className="text-left">
                <p className="font-medium">{currentLanguage?.nativeName}</p>
                <p className="text-xs text-slate-400">{currentLanguage?.name}</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-[calc(100vw-2rem)] max-w-md bg-slate-800 border-slate-700"
        >
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`cursor-pointer px-4 py-4 ${
                currentLang === lang.code
                  ? 'bg-emerald-500/20'
                  : 'hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex items-center">{lang.flag}</div>
                  <div>
                    <p className={`font-medium ${currentLang === lang.code ? 'text-emerald-400' : 'text-white'}`}>
                      {lang.nativeName}
                    </p>
                    <p className="text-xs text-slate-400">{lang.name}</p>
                  </div>
                </div>
                {currentLang === lang.code && (
                  <Check className="w-5 h-5 text-emerald-400" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}