import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "~/lib/api";

export const Route = createFileRoute("/admin/setup")({
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    try {
      await api("/api/setup", {
        method: "POST",
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
          password: String(fd.get("password") ?? ""),
        }),
      });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed");
    }
  }

  return (
    <AuthShell title="Create owner" description="This is the first admin. You'll use this email to log in later.">
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full">
          Set up
        </Button>
      </form>
    </AuthShell>
  );
}
