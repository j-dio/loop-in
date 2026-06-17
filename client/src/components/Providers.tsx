import { ThemeProvider } from "@/lib/theme";
import { WorkspaceProvider } from "@/context/WorkspaceContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </ThemeProvider>
  );
}
