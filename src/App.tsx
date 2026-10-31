import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import LoadingScreen from './components/LoadingScreen'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const About = lazy(() => import('./pages/About'))
const VoiceAssistant = lazy(() => import('./pages/VoiceAssistantPage'))
const OCRPage = lazy(() => import('./pages/OCRPage'))
const NavigationPage = lazy(() => import('./pages/NavigationPage'))

function App() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <Navbar />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/voice" element={<VoiceAssistant />} />
          <Route path="/ocr" element={<OCRPage />} />
          <Route path="/navigation" element={<NavigationPage />} />
        </Routes>
      </Suspense>
      <Footer />
    </div>
  )
}

export default App
