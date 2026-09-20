import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { QueryProvider } from "@/components/query-provider";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "PlanitService";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0b3a6a" },
      {
        name: "description",
        content:
          "The file for the house. Jobs, products, warranties, and the shop you call back.",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <QueryProvider>
            <Outlet />
            <Toaster
              theme="light"
              position="bottom-center"
              toastOptions={{
                classNames: {
                  toast: "bg-card text-foreground shadow-[var(--shadow-border)] font-sans",
                },
              }}
            />
          </QueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
