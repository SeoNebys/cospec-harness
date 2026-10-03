import { AuthForm } from "@/components/forms/auth-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <AuthForm mode="reset" resetToken={(await searchParams).token} />;
}
