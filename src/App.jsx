import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { firebaseConfigured } from './firebase';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Goals from './pages/Goals';
import Weekly from './pages/Weekly';
import Stats from './pages/Stats';
import Focus from './pages/Focus';
import Journal from './pages/Journal';
import Profile from './pages/Profile';
import Setup from './pages/Setup';
import Habits from './pages/Habits';
import Achievements from './pages/Achievements';
import './styles/global.css';

function AppShell() {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/"             element={<Home />}         />
          <Route path="/goals"        element={<Goals />}        />
          <Route path="/weekly"       element={<Weekly />}       />
          <Route path="/focus"        element={<Focus />}        />
          <Route path="/journal"      element={<Journal />}      />
          <Route path="/stats"        element={<Stats />}        />
          <Route path="/profile"      element={<Profile />}      />
          <Route path="/habits"       element={<Habits />}       />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  if (!firebaseConfigured) {
    return (
      <BrowserRouter>
        <Setup />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/login"  element={<Login />}  />
            <Route path="/signup" element={<Signup />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            } />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
