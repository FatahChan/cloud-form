import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "~/lib/api";

export const Route = createFileRoute("/join/$token")({
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    try {
      await api("/api/join", {
        method: "POST",
        body: JSON.stringify({
          token,
          email: String(fd.get("email") ?? ""),
          name: String(fd.get("name") ?? ""),
          password: String(fd.get("password") ?? ""),
        }),
      });
      await navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Join failed");
    }
  }

  return (
    <AuthShell title="Join team" description="Pick a name, email, and password. You'll use the email to log in.">
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
          Join
        </Button>
      </form>
    </AuthShell>
  );
}
