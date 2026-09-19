import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "~/lib/api";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [events, setEvents] = useState<
    { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; created_at: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ events: typeof events }>("/api/audit?limit=50")
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
  }, []);

  return (
    <Page title="Audit" description="Admin writes on this instance.">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{e.action}</TableCell>
                <TableCell>
                  {e.entity_type} {e.entity_id ?? ""}
                </TableCell>
                <TableCell className="font-mono text-xs">{e.actor_id ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Page>
  );
}
