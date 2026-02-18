import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, File, Image as ImageIcon, Loader2, Check, CheckCheck, Mic, Square, AlertTriangle, Truck, Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import supabase from "@/components/supabaseClient";
import { callFunction } from "@/components/utils/callFunction";

export default function DriverChat({ driverEmail, companyId }) {
  const [driverData, setDriverData] = useState(null);

  // Lade Fahrer-Daten beim Mount
  useEffect(() => {
    const savedDriver = localStorage.getItem("driver_data");
    if (savedDriver) {
      try {
        setDriverData(JSON.parse(savedDriver));
      } catch (e) {
        // Fehler beim Laden der Fahrer-Daten
      }
    }
  }, []);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Scroll zu neuen Nachrichten
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Nachrichten laden direkt von Supabase (READ mit RLS)
  const loadMessages = async () => {
    try {
      const driverData = JSON.parse(localStorage.getItem('driver_data') || '{}');
      
      // Hole messages direkt von Supabase (RLS schützt automatisch)
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Konvertiere FILE PATHS zu Blob URLs (RLS-gesichert)
      const messagesWithUrls = await Promise.all((messages || []).map(async (msg) => {
        if (msg.attachment_url && !msg.attachment_url.startsWith('http')) {
          try {
            const { data, error } = await supabase.storage
              .from('chat_files')
              .download(msg.attachment_url);
            if (!error && data) {
              msg.attachment_url = URL.createObjectURL(data);
            }
          } catch (err) {
            console.warn('Failed to load image:', err);
          }
        }
        if (msg.audio_url && !msg.audio_url.startsWith('http')) {
          try {
            const { data, error } = await supabase.storage
              .from('chat_files')
              .download(msg.audio_url);
            if (!error && data) {
              msg.audio_url = URL.createObjectURL(data);
            }
          } catch (err) {
            console.warn('Failed to load audio:', err);
          }
        }
        return msg;
      }));

      setMessages(messagesWithUrls);

      // Markiere ungelesene Nachrichten als gelesen via Function
      const unreadIds = (messages || [])
        .filter(msg => msg.sender_type === 'company' && !msg.is_read)
        .map(msg => msg.id);

      if (unreadIds.length > 0) {
        try {
          await callFunction('markChatAsRead', { messageIds: unreadIds });
        } catch (err) {
          console.warn('Mark as read failed:', err);
        }
      }
      
    } catch (error) {
      toast.error('Fehler beim Laden der Nachrichten');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial laden + Polling alle 3 Sekunden + Notifications
  useEffect(() => {
    if (!driverEmail || !companyId) return;

    loadMessages();
    const interval = setInterval(loadMessages, 3000);

    // Subscribe für Chat-Benachrichtigungen mit Supabase Realtime
    const subscription = supabase
      .channel(`chat_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const message = payload.new;
          // Neue Message von Firma
          if (message.sender_type === 'company') {
            loadMessages(); // Sofort nachladen (Toast wird zentral vom NotificationHub gehandhabt)
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(subscription);
    };
  }, [driverEmail, companyId]);

  // Auto-scroll bei neuen Nachrichten
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Audio-Aufnahme starten
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('🎤 Aufnahme läuft...');
    } catch (error) {
       toast.error('Mikrofon-Zugriff verweigert');
    }
  };

  // Audio-Aufnahme stoppen
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Bild auswählen
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Nur Bilder erlauben
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien auswählen');
      return;
    }

    setImageFile(file);
    
    // Preview erstellen
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Bild senden via Function (DSGVO: Privater Bucket + Signed URL)
  const sendImage = async () => {
    if (!imageFile) return;

    setIsSending(true);
    try {
      // Multipart Upload (Backend handled File → privater Bucket → Signed URL)
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('type', 'image');
      formData.append('message', newMessage.trim() || '');

      await callFunction('sendDriverChatMessage', formData);

      setImageFile(null);
      setImagePreview(null);
      setNewMessage('');
      await loadMessages();
      toast.success('Bild gesendet');
    } catch (error) {
      toast.error(t('chat_send_error'));
    } finally {
      setIsSending(false);
    }
    };

    // Audio senden via Function (DSGVO: Privater Bucket + Signed URL)
  const sendAudio = async () => {
    if (!audioBlob) return;

    setIsSending(true);
    try {
      // Multipart Upload (Backend handled File → privater Bucket → Signed URL)
      const formData = new FormData();
      formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
      formData.append('type', 'audio');
      formData.append('message', '');

      await callFunction('sendDriverChatMessage', formData);

      setAudioBlob(null);
      await loadMessages();
      toast.success('Sprachnachricht gesendet');
    } catch (error) {
      toast.error(t('chat_send_error'));
    } finally {
      setIsSending(false);
    }
    };

    // Nachricht senden via Function
  const handleSend = async () => {
    const messageText = newMessage.trim();
    
    if (!messageText && !audioBlob && !imageFile) return;

    if (audioBlob) {
      await sendAudio();
      return;
    }

    if (imageFile) {
      await sendImage();
      return;
    }

    setIsSending(true);

    try {
      // Sende via Function (serverseitig werden driver_id, company_id, sender_name, etc. gesetzt)
      await callFunction('sendDriverChatMessage', {
        message: messageText
      });

      setNewMessage("");
      await loadMessages();
      
    } catch (error) {
       toast.error(t('chat_send_error'));
     } finally {
      setIsSending(false);
    }
  };

  // Enter-Taste zum Absenden
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Datei-Icon basierend auf Typ
  const getFileIcon = (url) => {
    if (!url) return <File className="w-4 h-4" />;
    
    const ext = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  // Bild herunterladen
  const downloadImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'photo.jpg';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Bild heruntergeladen');
    } catch (error) {
        toast.error(t('chat_download_error'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Datum-Badge */}
      <div className="flex justify-center sticky top-2 z-20 pointer-events-none">
        <span className="px-3 py-1 rounded-full bg-slate-800/60 backdrop-blur-md border border-slate-700/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          Heute
        </span>
      </div>

      {/* Nachrichten-Liste */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 relative z-10">
        {messages.length === 0 ? (
          <div className="text-center text-slate-400 mt-12">
            <p>Noch keine Nachrichten</p>
            <p className="text-sm mt-2">Schreibe eine Nachricht an deinen Disponenten</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isDriver = msg.sender_type === 'driver';
            const time = new Date(msg.created_at).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={msg.id}
                className={`flex ${isDriver ? 'justify-end' : 'justify-start'} ${isDriver ? 'max-w-[85%] ml-auto' : 'max-w-[85%]'}`}
              >
                <div className={`${isDriver ? 'flex flex-col items-end' : ''} w-full`}>
                  {/* Sender Name - IMMER anzeigen */}
                  <span className={`text-[11px] font-medium mb-1 ${isDriver ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {isDriver 
                      ? (msg.sender_name || driverData?.full_name || driverData?.first_name || 'Du')
                      : (driverData?.company_name || msg.sender_name || 'Support Zentrale')
                    }
                  </span>

                  {/* Tour-Kontext Badge */}
                  {msg.tour_number && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full border border-orange-500/30">
                        <Truck className="w-3 h-3" />
                        Bezüglich Tour #{msg.tour_number}
                      </span>
                    </div>
                  )}

                  {/* Nachricht */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 shadow-lg ${
                      msg.is_urgent 
                        ? 'border-2 border-red-500 bg-red-500/10 backdrop-blur-sm shadow-red-500/20'
                        : isDriver
                        ? 'bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 text-white'
                        : 'bg-slate-800/70 backdrop-blur-md border border-slate-700/50 text-slate-100'
                    } ${isDriver ? '' : ''}`}
                    style={isDriver ? { borderBottomRightRadius: '4px' } : { borderBottomLeftRadius: '4px' }}
                  >
                    {/* Dringend-Marker */}
                    {msg.is_urgent && (
                      <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        DRINGEND
                      </div>
                    )}

                    {/* Text anzeigen oder Platzhalter bei nur Audio */}
                    {msg.message ? (
                      <p className={`text-sm ${msg.is_urgent ? 'text-white font-medium' : ''}`}>{msg.message}</p>
                    ) : msg.audio_url ? (
                      <p className={`text-sm ${msg.is_urgent ? 'text-white font-medium' : ''} opacity-70`}>
                        🎤 Sprachnachricht
                      </p>
                    ) : null}

                    {/* Sprachnachricht */}
                    {msg.audio_url && (
                      <div className="mt-2 w-full">
                        <audio 
                          controls 
                          className="w-full h-10"
                          preload="metadata"
                        >
                          <source src={msg.audio_url} type="audio/webm" />
                          <source src={msg.audio_url} type="audio/mpeg" />
                          Ihr Browser unterstützt keine Audio-Wiedergabe.
                        </audio>
                      </div>
                    )}

                    {/* Bild-Anhang */}
                    {msg.attachment_url && msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) && (
                      <div className="mt-2">
                        <img 
                          src={msg.attachment_url} 
                          alt="Bild" 
                          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity select-none"
                          onClick={() => setLightboxImage(msg.attachment_url)}
                          onContextMenu={(e) => e.preventDefault()}
                          draggable={false}
                        />
                      </div>
                    )}

                    {/* Datei-Anhang (nicht-Bild) */}
                    {msg.attachment_url && !msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 mt-2 text-sm ${
                          isDriver ? 'text-orange-100' : 'text-slate-600'
                        } hover:underline`}
                      >
                        {getFileIcon(msg.attachment_url)}
                        <span>Anhang öffnen</span>
                      </a>
                    )}
                  </div>

                  {/* Zeitstempel + Status */}
                  <div className={`flex items-center ${isDriver ? 'justify-end' : 'justify-end'} gap-1 mt-1`}>
                    <span className={`text-[10px] font-medium ${isDriver ? 'text-emerald-400/80' : 'text-slate-400'}`}>
                      {time}
                    </span>
                    {isDriver && (
                      msg.is_read ? (
                        <CheckCheck className="w-4 h-4 text-emerald-500 font-bold" style={{ fill: 'currentColor' }} />
                      ) : (
                        <Check className="w-4 h-4 text-emerald-500/50" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Lightbox für Bildvergrößerung */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={lightboxImage} 
              alt="Vergrößertes Bild" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg select-none"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(lightboxImage);
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Herunterladen
              </Button>
              <Button
                size="sm"
                onClick={() => setLightboxImage(null)}
                className="bg-slate-700 hover:bg-slate-600"
              >
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input-Bereich */}
      <footer className="relative z-30 px-4 pb-8 pt-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent" style={{ boxShadow: '0 -4px 20px -5px rgba(0, 0, 0, 0.3)' }}>
        {/* Audio-Vorschau */}
        {audioBlob && (
          <div className="mb-3 p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <Mic className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-white text-sm">Sprachnachricht bereit</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAudioBlob(null)}
                className="text-red-400 hover:bg-red-500/10"
              >
                Löschen
              </Button>
            </div>
          </div>
        )}

        {/* Bild-Vorschau */}
        {imagePreview && (
          <div className="mb-3 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm">Bild bereit zum Senden</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="text-red-400 hover:bg-red-500/10"
              >
                Löschen
              </Button>
            </div>
            <img 
              src={imagePreview} 
              alt="Vorschau" 
              className="max-h-32 rounded-lg"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-[28px] pl-2 pr-4 py-1.5 min-h-[52px]">
            {/* Galerie Button (links) */}
            {!audioBlob && !imageFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isRecording}
                  className="size-9 flex items-center justify-center rounded-full text-slate-400 hover:text-emerald-500 transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
              </>
            )}
            
            <div className="flex-1 px-2">
              {!audioBlob && !imageFile && (
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Nachricht schreiben..."
                  disabled={isSending || isRecording}
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-[15px] text-white placeholder-slate-500 py-1"
                  type="text"
                />
              )}
              {audioBlob && (
                <span className="text-[15px] text-emerald-400">🎤 Sprachnachricht bereit</span>
              )}
              {imageFile && (
                <span className="text-[15px] text-blue-400">📷 Bild bereit</span>
              )}
            </div>

            {/* Kamera Button (rechts) */}
            {!audioBlob && !imageFile && (
              <>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSending}
                  className="flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Mikrofon / Senden Button */}
          {(!newMessage.trim() && !audioBlob && !imageFile) ? (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending}
              className={`size-12 shrink-0 flex items-center justify-center rounded-full shadow-lg active:scale-90 transition-all ${
                isRecording 
                  ? 'bg-red-600 shadow-red-500/20 animate-pulse' 
                  : 'bg-emerald-500 shadow-emerald-500/20 text-slate-950'
              }`}
            >
              {isRecording ? (
                <Square className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={isSending}
              className="size-12 shrink-0 flex items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-90 transition-all disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          )}
        </div>

        {/* Home Indicator */}
        <div className="w-32 h-1.5 bg-slate-800 rounded-full mx-auto mt-6 opacity-40"></div>
      </footer>
    </div>
  );
}