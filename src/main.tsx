import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AppProviders } from '@/providers/AppProviders'

const root = document.getElementById('root')!
const missingSupabaseEnv =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (missingSupabaseEnv) {
  createRoot(root).render(
    <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: 12 }}>Tax-Checker — configuration error</h1>
      <p style={{ color: '#444', lineHeight: 1.6 }}>
        Supabase environment variables were not set at <strong>build time</strong>.
        In Netlify go to <strong>Site configuration → Environment variables</strong> and add:
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li><code>VITE_SUPABASE_URL</code></li>
        <li><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
      </ul>
      <p style={{ color: '#444' }}>Then run <strong>Deploys → Trigger deploy</strong> (rebuild required).</p>
    </div>,
  )
} else {
  createRoot(root).render(
    <AppProviders>
      <App />
    </AppProviders>,
  )
}
