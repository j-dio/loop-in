import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { ThemeProvider } from "./lib/theme";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AppShell } from "./layouts/AppShell";
import { Landing } from "./pages/Landing";
import { SignIn } from "./pages/SignIn";
import { AuthCallback } from "./pages/AuthCallback";
import { Home } from "./pages/Home";
import { Board } from "./pages/Board";
import { Thread } from "./pages/Thread";
import { Admin } from "./pages/Admin";
import { AcceptInvite } from "./pages/AcceptInvite";
import { Explore } from "./pages/Explore";
import { Notifications } from "./pages/Notifications";
import { Welcome } from "./pages/Welcome";
import { NotFound } from "./pages/NotFound";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route path="/welcome" element={<Welcome />} />

          <Route element={<AppShell />}>
            <Route path="/home" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
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
