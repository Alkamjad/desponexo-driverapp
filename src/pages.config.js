/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Abrechnung from './pages/Abrechnung';
import Abwesenheit from './pages/Abwesenheit';
import Anmelden from './pages/Anmelden';
import AuthCallback from './pages/AuthCallback';
import Chat from './pages/Chat';
import Dashboard from './pages/Dashboard';
import Datenschutz from './pages/Datenschutz';
import Dokumente from './pages/Dokumente';
import DriverHome from './pages/DriverHome';
import Impressum from './pages/Impressum';
import Leistungsanalyse from './pages/Leistungsanalyse';
import NotificationSettings from './pages/NotificationSettings';
import Notifications from './pages/Notifications';
import OfflineCache from './pages/OfflineCache';
import OrdnungswidrigkeitDetails from './pages/OrdnungswidrigkeitDetails';
import Ordnungswidrigkeiten from './pages/Ordnungswidrigkeiten';
import PasswordChange from './pages/PasswordChange';
import Profil from './pages/Profil';
import ResetPassword from './pages/ResetPassword';
import SetPassword from './pages/SetPassword';
import Setup from './pages/Setup';
import TourDetails from './pages/TourDetails';
import Uebersicht from './pages/Uebersicht';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Abrechnung": Abrechnung,
    "Abwesenheit": Abwesenheit,
    "Anmelden": Anmelden,
    "AuthCallback": AuthCallback,
    "Chat": Chat,
    "Dashboard": Dashboard,
    "Datenschutz": Datenschutz,
    "Dokumente": Dokumente,
    "DriverHome": DriverHome,
    "Impressum": Impressum,
    "Leistungsanalyse": Leistungsanalyse,
    "NotificationSettings": NotificationSettings,
    "Notifications": Notifications,
    "OfflineCache": OfflineCache,
    "OrdnungswidrigkeitDetails": OrdnungswidrigkeitDetails,
    "Ordnungswidrigkeiten": Ordnungswidrigkeiten,
    "PasswordChange": PasswordChange,
    "Profil": Profil,
    "ResetPassword": ResetPassword,
    "SetPassword": SetPassword,
    "Setup": Setup,
    "TourDetails": TourDetails,
    "Uebersicht": Uebersicht,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};