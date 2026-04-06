import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AppShell } from './layouts/AppShell'
import { Landing } from './pages/Landing'
import { AuthCallback } from './pages/AuthCallback'
import { Board } from './pages/Board'
import { Thread } from './pages/Thread'
import { Admin } from './pages/Admin'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Shell wraps the slug pages */}
        <Route element={<AppShell />}>
          <Route path="/:slug" element={<Board />} />
          <Route path='/:slug/post/:id' element={<Thread />} />
          <Route path='/:slug/admin' element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
