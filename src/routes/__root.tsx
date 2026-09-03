import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { QueryProvider } from "@/components/query-provider";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "PlanitService";

export const Route = createRootRoute({
  errorComponent: ({ error }) => (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", background: "#f3eee4", color: "#1c1917", padding: 48 }}>
        <p>PlanitService</p>
        <h1>The page did not load.</h1>
        <p>
          <a href="/">Home</a>
          {" · "}
          <a href="/start">Homeowner</a>
          {" · "}
          <a href="/shop">Contractor</a>
        </p>
        <p style={{ opacity: 0.6, fontSize: 13 }}>{error.message}</p>
      </body>
    </html>
  ),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f3eee4" },
      {
        name: "description",
        content:
          "The Property Record that belongs to you. Start it yourself. Request bids. Keep the jobs, products, and warranties.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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
