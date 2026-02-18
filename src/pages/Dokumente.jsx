import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  FileText, File, CreditCard, FileCheck, Loader2, Eye, Download, Inbox, X, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { t } from "@/components/utils/i18n";
import moment from "moment";
import { useOfflineStatus } from "@/components/hooks/useOfflineStatus";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useScrollRestoration } from "@/components/hooks/useScrollRestoration";
import { authClient } from "@/components/authClient";
import supabase from "@/components/supabaseClient";

export default function Dokumente() {
  const isOnline = useOfflineStatus();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState(null);
  const scrollRef = useScrollRestoration('Dokumente');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const driverEmail = localStorage.getItem('driver_email');

    if (!driverEmail) {
      if (navigator.onLine) {
        navigate(createPageUrl('Anmelden'));
      }
      return;
    }

    try {
      // ✅ Direkte Supabase Query
      const { data, error } = await supabase
        .from('driver_documents')
        .select(`
          id,
          driver_id,
          driver_email,
          driver_name,
          company_id,
          document_type,
          file_path,
          file_size,
          uploaded_at,
          created_at,
          updated_at
        `)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      if (error) {
        toast.error(t('documents_connection_error'));
        setDocuments([]);
      } else {
        // Generate signed URLs
        const documentsWithSignedUrls = await Promise.all(
          (data || []).map(async (doc) => {
            try {
              const { data: signedData, error: signError } = await supabase.storage
                .from('driver-documents')
                .createSignedUrl(doc.file_path, 3600);

              if (!signError && signedData?.signedUrl) {
                return { ...doc, signed_url: signedData.signedUrl };
              }
              return doc;
            } catch (err) {
              return doc;
            }
          })
        );
        setDocuments(documentsWithSignedUrls);
      }
    } catch (error) {
      toast.error(t('documents_connection_error'));
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    const icons = {
      'Führerschein': CreditCard,
      'Personalausweis': CreditCard,
      'Arbeitsvertrag': FileCheck,
      'Sonstiges': File
    };
    return icons[type] || FileText;
  };

  const getDocumentColor = (type) => {
    const colors = {
      'Führerschein': 'bg-blue-500/20 text-blue-400',
      'Personalausweis': 'bg-purple-500/20 text-purple-400',
      'Arbeitsvertrag': 'bg-emerald-500/20 text-emerald-400',
      'Sonstiges': 'bg-slate-500/20 text-slate-400'
    };
    return colors[type] || 'bg-slate-500/20 text-slate-400';
  };

  // Gruppieren nach document_type
  const groupedDocuments = documents.reduce((acc, doc) => {
    const type = doc.document_type || 'Sonstiges';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {});

  const openDocument = (doc) => {
    setViewingDoc(doc);
  };

  const downloadDocument = async (doc) => {
    try {
      const response = await fetch(doc.signed_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.document_type}_${moment(doc.uploaded_at).format('YYYY-MM-DD')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success(t('documents_download_started'));
    } catch (error) {
      toast.error(t('documents_download_failed'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 overflow-y-auto" ref={scrollRef}>
      {/* Connection Status Banner */}
      <ConnectionStatus isOnline={isOnline} />
      
      {/* Header */}
       <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 pt-8 pb-8">
         <div className="flex items-center gap-3 mb-2">
           <Button
             variant="ghost"
             size="icon"
             onClick={() => navigate(-1)}
             className="text-white hover:bg-white/20"
           >
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
               <FileText className="w-5 h-5" />
             </div>
             {t('documents_title')}
           </h1>
         </div>
         <p className="text-emerald-100 text-sm ml-14">
           {t('documents_subtitle').replace('{count}', documents.length).replace('{plural}', documents.length === 1 ? t('documents_document') : t('documents_documents'))}
         </p>
       </div>

      <div className="px-4 relative z-10 space-y-4">
        {documents.length === 0 ? (
          <Card className="border-0 shadow-xl bg-slate-800/80 backdrop-blur">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 font-medium mb-2">{t('documents_no_docs')}</p>
              <p className="text-slate-500 text-sm">
                {t('documents_no_docs_desc')}
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedDocuments).map(([type, docs]) => {
            const Icon = getDocumentIcon(type);
            const colorClass = getDocumentColor(type);

            return (
              <Card key={type} className="border-0 shadow-xl bg-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-white font-semibold">{type}</h3>
                    <Badge className="ml-auto bg-slate-700 text-slate-300">
                      {docs.length}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/80 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 text-sm">
                            {t('documents_uploaded')} {moment(doc.uploaded_at).format('DD.MM.YYYY')}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-500 text-xs">
                              {moment(doc.uploaded_at).format('HH:mm')} {t('overview_time')}
                            </p>
                            {doc.file_size && (
                              <Badge variant="outline" className="text-xs">
                                {(doc.file_size / 1024).toFixed(0)} KB
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-3">
                          <Button
                            size="sm"
                            onClick={() => openDocument(doc)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t('documents_view')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadDocument(doc)}
                            className="border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* PDF Viewer Modal */}
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-7xl w-[95vw] h-[95vh] bg-slate-900 border-slate-700 p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                {viewingDoc?.document_type}
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => downloadDocument(viewingDoc)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('documents_download')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewingDoc(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              {t('documents_uploaded_on')} {viewingDoc && moment(viewingDoc.uploaded_at).format('DD.MM.YYYY HH:mm')} {t('overview_time')}
            </p>
          </DialogHeader>
          
          <div className="px-6 pb-6 h-[calc(95vh-120px)]">
            {viewingDoc?.signed_url ? (
              <iframe
                src={viewingDoc.signed_url}
                className="w-full h-full rounded-lg bg-white border border-slate-700"
                title="PDF Viewer"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">{t('documents_cannot_load')}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}