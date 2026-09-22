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
import AdminHome from './pages/AdminHome';
import AthleteHome from './pages/AthleteHome';
import AthleteProfile from './pages/AthleteProfile';
import CalendarPage from './pages/CalendarPage';
import CoachDashboard from './pages/CoachDashboard';
import CoachHome from './pages/CoachHome';
import CoachQuestionnaires from './pages/CoachQuestionnaires';
import DataExport from './pages/DataExport';
import GroupManagement from './pages/GroupManagement';
import Home from './pages/Home';
import Messages from './pages/Messages';
import PersonalDashboard from './pages/PersonalDashboard';
import QuestionBank from './pages/QuestionBank';
import Questionnaires from './pages/Questionnaires';
import SessionDetails from './pages/SessionDetails';
import UserManagement from './pages/UserManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminHome": AdminHome,
    "AthleteHome": AthleteHome,
    "AthleteProfile": AthleteProfile,
    "CalendarPage": CalendarPage,
    "CoachDashboard": CoachDashboard,
    "CoachHome": CoachHome,
    "CoachQuestionnaires": CoachQuestionnaires,
    "DataExport": DataExport,
    "GroupManagement": GroupManagement,
    "Home": Home,
    "Messages": Messages,
    "PersonalDashboard": PersonalDashboard,
    "QuestionBank": QuestionBank,
    "Questionnaires": Questionnaires,
    "SessionDetails": SessionDetails,
    "UserManagement": UserManagement,
}

export const pagesConfig = {
    mainPage: "AdminHome",
    Pages: PAGES,
    Layout: __Layout,
};