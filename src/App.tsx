import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import BottomNav from './components/BottomNav'
import NaviFloatingAssistant from './components/NaviFloatingAssistant'
import LoadingScreen from './components/LoadingScreen'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const About = lazy(() => import('./pages/About'))
const VoiceAssistant = lazy(() => import('./pages/VoiceAssistantPage'))
const OCRPage = lazy(() => import('./pages/OCRPage'))
const NavigationPage = lazy(() => import('./pages/NavigationPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const ProximityPage = lazy(() => import('./pages/ProximityPage'))
const CurrencyPage = lazy(() => import('./pages/CurrencyPage'))
const PotholePage = lazy(() => import('./pages/PotholePage'))

function App() {
  return (
    <div className="min-h-screen bg-navy-900 text-white pb-16 md:pb-0">
      <Navbar />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/voice" element={<VoiceAssistant />} />
          <Route path="/ocr" element={<OCRPage />} />
          <Route path="/navigation" element={<NavigationPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/proximity" element={<ProximityPage />} />
          <Route path="/currency" element={<CurrencyPage />} />
          <Route path="/pothole" element={<PotholePage />} />
        </Routes>
      </Suspense>
      <Footer />
      <NaviFloatingAssistant />
      <BottomNav />
    </div>
  )
}

export default App
