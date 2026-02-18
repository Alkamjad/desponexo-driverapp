import { useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);
    
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="max-w-md w-full">
                <div className="text-center space-y-6">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-7xl font-light text-slate-600">404</h1>
                        <div className="h-0.5 w-16 bg-slate-700 mx-auto"></div>
                    </div>
                    
                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="text-2xl font-medium text-white">
                            Seite nicht gefunden
                        </h2>
                        <p className="text-slate-400 leading-relaxed">
                            Die Seite <span className="font-medium text-slate-300">"{pageName}"</span> existiert nicht in dieser App.
                        </p>
                    </div>
                    
                    {/* Action Button */}
                    <div className="pt-6">
                        <button 
                            onClick={() => window.location.href = createPageUrl('Dashboard')} 
                            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                        >
                            <Home className="w-4 h-4" />
                            Zurück zum Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}