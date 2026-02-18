import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function Datenschutz() {
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
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Datenschutzerklärung</h1>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Datenschutz nach DSGVO</CardTitle>
            <p className="text-slate-400 text-sm">Stand: Januar 2025</p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6 text-slate-300">
                
                {/* 1. Verantwortlicher */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">1. Verantwortlicher</h2>
                  <p className="mb-2">Verantwortlich für die Datenverarbeitung ist:</p>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p><strong className="text-emerald-400">[FIRMENNAME]</strong></p>
                    <p>[Straße + Hausnummer]</p>
                    <p>[PLZ + Ort]</p>
                    <p>E-Mail: [kontakt@firma.de]</p>
                    <p>Telefon: [+49 xxx xxx xxx]</p>
                  </div>
                </section>

                {/* 2. Erhobene Daten */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">2. Welche Daten erheben wir?</h2>
                  <p className="mb-3">Die DespoNexo Driver App verarbeitet folgende personenbezogene Daten:</p>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">📧 Kontaktdaten:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>E-Mail-Adresse</li>
                        <li>Vollständiger Name</li>
                        <li>Telefonnummer</li>
                        <li>Firmen-/Arbeitgeberzuordnung</li>
                      </ul>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">📍 Standortdaten (GPS):</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Echtzeit-GPS-Position während aktiver Touren</li>
                        <li>Routenverlauf und Zeitstempel</li>
                        <li>Start- und Zieladressen der Lieferungen</li>
                        <li>Zwischenstopps bei Multi-Stop-Touren</li>
                      </ul>
                      <p className="text-amber-400 text-xs mt-2">⚠️ GPS-Tracking erfolgt nur während aktiver Touren und nach Ihrer Zustimmung.</p>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">📸 Fotos & Dokumente:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Lieferbestätigungsfotos (POD - Proof of Delivery)</li>
                        <li>Tankbelege und Quittungen</li>
                        <li>Unterschriften der Empfänger</li>
                        <li>Tour-Dokumentation (z.B. Schadensmeldungen)</li>
                      </ul>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">💬 Kommunikationsdaten:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Chat-Nachrichten zwischen Fahrer und Disponent</li>
                        <li>Benachrichtigungen und Systemmeldungen</li>
                        <li>Zeitstempel der Kommunikation</li>
                      </ul>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">📱 Technische Daten:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Geräte-ID (für Push-Benachrichtigungen)</li>
                        <li>Firebase Cloud Messaging Token (FCM)</li>
                        <li>App-Version und Betriebssystem</li>
                        <li>Fehlermeldungen und Logs (bei technischen Problemen)</li>
                      </ul>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <h3 className="font-semibold text-emerald-400 mb-2">💰 Abrechnungsdaten:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Touren-Historie und abgeschlossene Aufträge</li>
                        <li>Vergütungsinformationen (Tourpreise, Tankkosten)</li>
                        <li>Zahlungsstatus (ausstehend/bezahlt)</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* 3. Zweck der Datenverarbeitung */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">3. Zweck der Datenverarbeitung</h2>
                  <p className="mb-3">Ihre Daten werden ausschließlich zu folgenden Zwecken verarbeitet:</p>
                  <div className="bg-slate-900/50 p-4 rounded-lg space-y-2 text-sm">
                    <p>✅ <strong>Tourenplanung und -durchführung:</strong> Zuweisung von Aufträgen, Navigation, Lieferstatus</p>
                    <p>✅ <strong>Kommunikation:</strong> Chat mit Disponenten, Benachrichtigungen über neue Touren</p>
                    <p>✅ <strong>Liefernachweis:</strong> Dokumentation erfolgreicher Zustellungen (POD)</p>
                    <p>✅ <strong>Abrechnung:</strong> Vergütungsberechnung, Tankkosten-Erstattung</p>
                    <p>✅ <strong>Qualitätssicherung:</strong> Pünktlichkeit, Zustellquote, Kundenzufriedenheit</p>
                    <p>✅ <strong>Rechtliche Verpflichtungen:</strong> Aufbewahrungsfristen für Liefernachweise (HGB, AO)</p>
                  </div>
                </section>

                {/* 4. Rechtsgrundlage */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">4. Rechtsgrundlage (DSGVO)</h2>
                  <div className="space-y-2 text-sm">
                    <p>📜 <strong>Art. 6 Abs. 1 lit. b DSGVO</strong> - Vertragserfüllung (Arbeitsvertrag/Auftragsvereinbarung)</p>
                    <p>📜 <strong>Art. 6 Abs. 1 lit. a DSGVO</strong> - Einwilligung (GPS-Tracking, Push-Benachrichtigungen)</p>
                    <p>📜 <strong>Art. 6 Abs. 1 lit. c DSGVO</strong> - Rechtliche Verpflichtung (Aufbewahrungsfristen)</p>
                    <p>📜 <strong>Art. 6 Abs. 1 lit. f DSGVO</strong> - Berechtigtes Interesse (Qualitätssicherung, Betrugsschutz)</p>
                  </div>
                </section>

                {/* 5. Datenspeicherung */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">5. Wo werden Ihre Daten gespeichert?</h2>
                  <div className="bg-slate-900/50 p-4 rounded-lg space-y-3 text-sm">
                    <div>
                      <p className="font-semibold text-emerald-400 mb-1">🗄️ Supabase (PostgreSQL Datenbank)</p>
                      <p>Server-Standort: EU (Frankfurt/Dublin - DSGVO-konform)</p>
                      <p className="text-xs text-slate-400">Speichert: Touren, Dokumente, Chat-Nachrichten, Abrechnungen</p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-400 mb-1">🔔 Firebase Cloud Messaging (Google)</p>
                      <p>Server-Standort: EU</p>
                      <p className="text-xs text-slate-400">Speichert: Push-Token für Benachrichtigungen</p>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-400 mb-1">📱 Lokale Speicherung (Gerät)</p>
                      <p>Offline-Cache für aktive Touren (bei fehlender Internetverbindung)</p>
                    </div>
                  </div>
                </section>

                {/* 6. Speicherdauer */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">6. Wie lange werden Daten gespeichert?</h2>
                  <div className="bg-slate-900/50 p-4 rounded-lg space-y-2 text-sm">
                    <p>⏱️ <strong>Aktive Touren:</strong> Bis zur erfolgreichen Zustellung + 30 Tage</p>
                    <p>⏱️ <strong>Liefernachweise (POD):</strong> 10 Jahre (gesetzliche Aufbewahrungsfrist HGB)</p>
                    <p>⏱️ <strong>Abrechnungsdaten:</strong> 10 Jahre (AO § 147 - Buchhaltung)</p>
                    <p>⏱️ <strong>Chat-Nachrichten:</strong> 6 Monate nach letzter Aktivität</p>
                    <p>⏱️ <strong>GPS-Daten:</strong> 30 Tage nach Tourende (danach gelöscht)</p>
                    <p>⏱️ <strong>Tankbelege:</strong> 2 Jahre (Nachweispflicht gegenüber Finanzamt)</p>
                    <p>⏱️ <strong>Benutzerkonto:</strong> Bis zur Kündigung/Löschung des Accounts</p>
                  </div>
                </section>

                {/* 7. Weitergabe an Dritte */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">7. Werden Daten an Dritte weitergegeben?</h2>
                  <p className="mb-3">Ihre Daten werden NUR in folgenden Fällen weitergegeben:</p>
                  <div className="bg-slate-900/50 p-4 rounded-lg space-y-2 text-sm">
                    <p>✅ <strong>An Ihren Arbeitgeber/Auftraggeber:</strong> Zur Tourenabwicklung und Abrechnung</p>
                    <p>✅ <strong>An technische Dienstleister:</strong> Supabase (Datenbank-Hosting), Firebase (Push-Benachrichtigungen) - alle DSGVO-konform</p>
                    <p>✅ <strong>Bei rechtlicher Verpflichtung:</strong> An Behörden auf gerichtliche Anordnung</p>
                    <p>❌ <strong>KEIN Verkauf Ihrer Daten</strong> an Dritte zu Werbezwecken!</p>
                    <p>❌ <strong>KEINE Weitergabe</strong> an Länder außerhalb der EU</p>
                  </div>
                </section>

                {/* 8. Ihre Rechte */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">8. Ihre Rechte (DSGVO)</h2>
                  <div className="space-y-3">
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">📋 Recht auf Auskunft (Art. 15 DSGVO)</p>
                      <p className="text-sm">Sie können jederzeit Auskunft über die von Ihnen gespeicherten Daten verlangen.</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">✏️ Recht auf Berichtigung (Art. 16 DSGVO)</p>
                      <p className="text-sm">Falsche Daten können Sie in der App unter "Profil" selbst korrigieren.</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">🗑️ Recht auf Löschung (Art. 17 DSGVO)</p>
                      <p className="text-sm">Nach Vertragsende können Sie die Löschung Ihrer Daten beantragen (außer gesetzliche Aufbewahrungsfristen).</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">🚫 Recht auf Einschränkung (Art. 18 DSGVO)</p>
                      <p className="text-sm">Sie können die Verarbeitung Ihrer Daten einschränken lassen.</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">📦 Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</p>
                      <p className="text-sm">Sie können Ihre Daten in einem gängigen Format exportieren lassen.</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">⛔ Widerspruchsrecht (Art. 21 DSGVO)</p>
                      <p className="text-sm">Sie können der Datenverarbeitung aus berechtigtem Interesse widersprechen.</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="font-semibold text-emerald-400 mb-2">🔄 Widerruf der Einwilligung (Art. 7 DSGVO)</p>
                      <p className="text-sm">GPS-Tracking und Push-Benachrichtigungen können jederzeit in den Einstellungen deaktiviert werden.</p>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg mt-4">
                    <p className="text-amber-400 font-semibold mb-2">📧 Ausübung Ihrer Rechte:</p>
                    <p className="text-sm">Kontaktieren Sie uns unter: <strong className="text-white">[datenschutz@firma.de]</strong></p>
                    <p className="text-xs text-slate-400 mt-2">Wir werden Ihre Anfrage innerhalb von 30 Tagen bearbeiten.</p>
                  </div>
                </section>

                {/* 9. Beschwerderecht */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">9. Beschwerderecht</h2>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="mb-2">Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:</p>
                    <p className="text-sm"><strong className="text-emerald-400">Landesbeauftragte für Datenschutz und Informationsfreiheit</strong></p>
                    <p className="text-sm">[Bundesland-spezifische Behörde eintragen]</p>
                    <p className="text-sm">Webseite: <span className="text-emerald-400">[www.datenschutz-xyz.de]</span></p>
                  </div>
                </section>

                {/* 10. Datensicherheit */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">10. Datensicherheit</h2>
                  <div className="bg-slate-900/50 p-4 rounded-lg space-y-2 text-sm">
                    <p>🔒 <strong>SSL/TLS-Verschlüsselung:</strong> Alle Daten werden verschlüsselt übertragen</p>
                    <p>🔐 <strong>Passwort-Hashing:</strong> Passwörter werden niemals im Klartext gespeichert (bcrypt)</p>
                    <p>🛡️ <strong>JWT-Token:</strong> Sichere Authentifizierung ohne Session-Cookies</p>
                    <p>🔒 <strong>Datenbank-Verschlüsselung:</strong> Supabase verwendet Row Level Security (RLS)</p>
                    <p>🔑 <strong>Zugriffskontrolle:</strong> Nur autorisierte Mitarbeiter haben Zugriff auf Server</p>
                  </div>
                </section>

                {/* 11. Änderungen */}
                <section>
                  <h2 className="text-xl font-bold text-white mb-3">11. Änderungen dieser Datenschutzerklärung</h2>
                  <p className="text-sm">
                    Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte Rechtslagen oder 
                    Funktionen der App anzupassen. Sie werden über wesentliche Änderungen per Push-Benachrichtigung informiert.
                  </p>
                </section>

                {/* Footer */}
                <div className="border-t border-slate-700 pt-4 mt-8">
                  <p className="text-sm text-slate-500">Letzte Aktualisierung: Januar 2025</p>
                  <p className="text-xs text-slate-600 mt-2">
                    ⚠️ Diese Datenschutzerklärung ist ein Template und muss von einem Rechtsanwalt geprüft werden!
                  </p>
                </div>

              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}