import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './ui/App'
import { ToastProvider } from './ui/ToastProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
)
