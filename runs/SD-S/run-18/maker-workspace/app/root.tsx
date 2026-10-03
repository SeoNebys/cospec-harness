import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import type { Route } from "./+types/root";
import "./styles/app.css";

export const meta: Route.MetaFunction = () => [
  { title: "Keepsake — Bookmark manager" },
  {
    name: "description",
    content: "Save, organize, and rediscover the pages worth keeping.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "Please refresh and try again.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : `Error ${error.status}`;
    message = typeof error.data === "string" ? error.data : message;
  }

  return (
    <main className="error-page" data-harness-ready="true">
      <p className="eyebrow">Keepsake</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <a className="button button-primary" href="/">
        Return to your library
      </a>
    </main>
  );
}
