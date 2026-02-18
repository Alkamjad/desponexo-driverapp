import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building, Mail, Phone, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function Impressum() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-24">
      <div className="max-w-4xl mx-auto pt-safe">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Anmelden'))}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Building className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Impressum</h1>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Angaben gemäß § 5 TMG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-300">
            
            {/* Unternehmensinformationen */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-400" />
                Unternehmensangaben
              </h2>
              <div className="space-y-2">
                <p className="text-lg"><strong className="text-emerald-400">[FIRMENNAME]</strong></p>
                <p>[Rechtsform - z.B. GmbH, UG, Einzelunternehmen]</p>
                <p>[Straße + Hausnummer]</p>
                <p>[PLZ + Ort]</p>
                <p>[Land]</p>
              </div>
            </section>

            {/* Vertretungsberechtigt */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Vertreten durch</h2>
              <div className="space-y-1">
                <p><strong className="text-emerald-400">[Geschäftsführer Name]</strong></p>
                <p className="text-sm text-slate-400">[Position - z.B. Geschäftsführer]</p>
              </div>
            </section>

            {/* Kontaktdaten */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Kontakt</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-slate-400">E-Mail</p>
                    <p className="text-white">[kontakt@firma.de]</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-slate-400">Telefon</p>
                    <p className="text-white">[+49 xxx xxx xxx]</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-slate-400">Website</p>
                    <p className="text-white">[www.firma.de]</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Registereintrag */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Registereintrag</h2>
              <div className="space-y-2 text-sm">
                <p><strong className="text-emerald-400">Handelsregister:</strong> [z.B. Amtsgericht München]</p>
                <p><strong className="text-emerald-400">Registernummer:</strong> [HRB xxxxx]</p>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                ℹ️ Falls Einzelunternehmen: Keine Handelsregisternummer erforderlich
              </p>
            </section>

            {/* Umsatzsteuer-ID */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Umsatzsteuer-Identifikationsnummer</h2>
              <p className="text-sm">
                Gemäß § 27a Umsatzsteuergesetz:<br />
                <strong className="text-emerald-400">USt-IdNr.: [DE xxxxxxxxx]</strong>
              </p>
              <p className="text-xs text-slate-500 mt-3">
                ℹ️ Prüfung der USt-IdNr.: <a href="https://evatr.bff-online.de/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">BZSt (Bundeszentralamt für Steuern)</a>
              </p>
            </section>

            {/* Verantwortlich für den Inhalt */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
              <div className="space-y-1">
                <p><strong className="text-emerald-400">[Name des Verantwortlichen]</strong></p>
                <p className="text-sm">[Straße + Hausnummer]</p>
                <p className="text-sm">[PLZ + Ort]</p>
              </div>
            </section>

            {/* EU-Streitschlichtung */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">EU-Streitschlichtung</h2>
              <p className="text-sm">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
              </p>
              <a 
                href="https://ec.europa.eu/consumers/odr" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline text-sm block mt-2"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              <p className="text-xs text-slate-500 mt-3">
                Unsere E-Mail-Adresse finden Sie oben im Impressum.
              </p>
            </section>

            {/* Verbraucherstreitbeilegung */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
              <p className="text-sm">
                Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            {/* Haftungsausschluss */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Haftungsausschluss</h2>
              
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-emerald-400 mb-2">Haftung für Inhalte</h3>
                  <p>
                    Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten 
                    nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter 
                    jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-emerald-400 mb-2">Haftung für Links</h3>
                  <p>
                    Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. 
                    Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der 
                    verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-emerald-400 mb-2">Urheberrecht</h3>
                  <p>
                    Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem 
                    deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung 
                    außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen 
                    Autors bzw. Erstellers.
                  </p>
                </div>
              </div>
            </section>

            {/* Bildnachweise */}
            <section className="bg-slate-900/50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Bildnachweise / Quellen</h2>
              <div className="text-sm space-y-2">
                <p>📸 Logo: [Eigenes Design / Quelle angeben]</p>
                <p>📱 Icons: Lucide React (MIT License)</p>
                <p>🎨 UI-Komponenten: shadcn/ui (MIT License)</p>
              </div>
            </section>

            {/* Footer */}
            <div className="border-t border-slate-700 pt-4 mt-6">
              <p className="text-xs text-slate-500">Stand: Januar 2025</p>
              <p className="text-xs text-amber-400 mt-2">
                ⚠️ Dieses Impressum ist ein Template und muss mit Ihren realen Unternehmensdaten ausgefüllt werden!
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}