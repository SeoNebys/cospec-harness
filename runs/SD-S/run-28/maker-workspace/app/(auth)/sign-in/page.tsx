import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/ui/auth-shell";
export default function Page() { return <AuthShell><Suspense><AuthForm mode="sign-in" /></Suspense></AuthShell>; }
