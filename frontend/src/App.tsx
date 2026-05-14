import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './styles/toastify-overrides.css'
import Signin from './Components/Authentication/Signin/Signin'
import ForgotPassword from './Components/Authentication/ForgotPassword/ForgotPassword'
import ResetPassword from './Components/Authentication/ResetPassword/ResetPassword'
import InviteSetPassword from './Components/Authentication/InviteSetPassword/InviteSetPassword'
import { MainLayout } from './Components/Layout/MainLayout'
import { DashboardPage } from './Components/pages/Dashboard/DashboardPage'
import { UsersPage } from './Components/pages/Users/UsersPage'
import { JobsPage } from './Components/pages/Jobs/JobsPage'
import { RiskPage } from './Components/pages/Risk/RiskPage'
import { ArticlesPage } from './Components/pages/Articles/ArticlesPage'
import { AdminPage } from './Components/pages/Admin/AdminPage'
import { ReviewPage } from './Components/pages/Review/ReviewPage'
import { SettingsPage } from './Components/pages/Settings/SettingsPage'
import { AccountPage } from './Components/pages/Account/AccountPage'
import { RequireAuth } from './Components/RequireAuth'

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="bottom-right" autoClose={4000} theme="light" />
      <Routes>
        <Route path="/signin" element={<Signin />} />
        <Route path="/forgotPassword" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/resetPassword" element={<ResetPassword />} />
        <Route path="/invite/set-password" element={<InviteSetPassword />} />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/risk" element={<RiskPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
