import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "~/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/team")({
  component: TeamPage,
});

function TeamPage() {
  const [users, setUsers] = useState<{ id: string; email: string; name: string; role: string }[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ users: typeof users }>("/api/users")
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
  }, []);

  return (
    <Page
      title="Team"
      description="Invite admins with a one-time link."
      action={
        <Button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              const data = await api<{ url: string }>("/api/invites", { method: "POST" });
              const url = window.location.origin + data.url;
              setInvite(url);
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Invite copied");
              } catch {
                toast.message(url);
              }
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Invite failed");
            }
          }}
        >
          Create invite
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {invite && (
        <Alert>
          <AlertDescription className="break-all">{invite}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{u.role}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Page>
  );
}
