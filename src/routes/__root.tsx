import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";

const Toaster = lazy(() => import("sonner").then((mod) => ({ default: mod.Toaster })));

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ASLENIX — Enterprise Attendance" },
      {
        name: "description",
        content:
          "ASLENIX Attendance Management System — futuristic enterprise platform for attendance, leave, and analytics.",
      },
      { property: "og:title", content: "ASLENIX — Enterprise Attendance" },
      { name: "twitter:title", content: "ASLENIX — Enterprise Attendance" },
      {
        property: "og:description",
        content:
          "ASLENIX Attendance Management System — futuristic enterprise platform for attendance, leave, and analytics.",
      },
      {
        name: "twitter:description",
        content:
          "ASLENIX Attendance Management System — futuristic enterprise platform for attendance, leave, and analytics.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/60cff978-283b-4c6b-ac01-c7aa240b2093",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/60cff978-283b-4c6b-ac01-c7aa240b2093",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var reloadKey = "aslenix:chunk-reload-attempted";
  function isChunkLoadError(value) {
    var text = "";
    if (typeof value === "string") text = value;
    else if (value && value.message) text = value.message;
    else if (value && value.reason && value.reason.message) text = value.reason.message;
    return /Failed to fetch dynamically imported module|Importing a module script failed|Expected a JavaScript-or-Wasm module script|Loading chunk|module script/i.test(text);
  }
  function reloadWithFreshShell() {
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, String(Date.now()));
    var url = new URL(window.location.href);
    url.searchParams.set("__fresh", String(Date.now()));
    window.location.replace(url.toString());
  }
  window.addEventListener("error", function (event) {
    var target = event.target;
    var scriptSrc = target && target.tagName === "SCRIPT" ? target.src : "";
    if ((scriptSrc && scriptSrc.indexOf("/assets/") !== -1) || isChunkLoadError(event.error || event.message)) {
      reloadWithFreshShell();
    }
  }, true);
  window.addEventListener("unhandledrejection", function (event) {
    if (isChunkLoadError(event.reason)) reloadWithFreshShell();
  });
})();`,
          }}
        />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Suspense fallback={null}>
          <Toaster theme="dark" position="top-right" richColors />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-10 text-center max-w-md">
        <h1 className="text-7xl font-bold gradient-text">404</h1>
        <p className="mt-4 text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="mt-6 inline-block neon-button px-5 py-2.5 rounded-xl font-medium">
          Go home
        </a>
      </div>
    </div>
  );
}
