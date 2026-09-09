import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 🛠️ Antes: en cuanto el SW quedaba "esperando" se le mandaba SKIP_WAITING
// a la fuerza, sin avisarle a nadie — la pestaña abierta seguía corriendo
// el JS viejo mientras por debajo el SW nuevo (con assets nuevos) tomaba
// control, mezclando código viejo con cache nueva en silencio. El registro
// y el aviso ahora los maneja ActualizacionDisponible.jsx (useRegisterSW),
// que espera a que el usuario confirme antes de aplicar la actualización.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)