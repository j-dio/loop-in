import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { ThemeProvider } from "./lib/theme";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AppShell } from "./layouts/AppShell";
import { Landing } from "./pages/Landing";
import { AuthCallback } from "./pages/AuthCallback";
import { Board } from "./pages/Board";
import { Thread } from "./pages/Thread";
import { Admin } from "./pages/Admin";
import { AcceptInvite } from "./pages/AcceptInvite";
import { Explore } from "./pages/Explore";
import { Notifications } from "./pages/Notifications";
import { NotFound } from "./pages/NotFound";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route path="/explore" element={<Explore />} />

          <Route element={<AppShell />}>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/:slug" element={<Board />} />
            <Route path="/:slug/post/:id" element={<Thread />} />
            <Route path="/:slug/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </WorkspaceProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
