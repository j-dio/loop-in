import "./index.css";
import { ViteReactSSG } from "vite-react-ssg";
import { Providers } from "./components/Providers";
import { AppShell } from "./layouts/AppShell";
import { Landing } from "./pages/Landing";
import { AuthCallback } from "./pages/AuthCallback";
import { Board } from "./pages/Board";
import { Thread } from "./pages/Thread";
import { Admin } from "./pages/Admin";
import { AcceptInvite } from "./pages/AcceptInvite";

export const createRoot = ViteReactSSG(
  {
    routes: [
      { index: true, element: <Providers><Landing /></Providers> },
      { path: "auth/callback", element: <Providers><AuthCallback /></Providers> },
      { path: "invite/accept", element: <Providers><AcceptInvite /></Providers> },
      {
        element: <Providers><AppShell /></Providers>,
        children: [
          { path: ":slug", element: <Board /> },
          { path: ":slug/post/:id", element: <Thread /> },
          { path: ":slug/admin", element: <Admin /> },
        ],
      },
    ],
  },
  // optional setup fn — unused
  undefined,
);
