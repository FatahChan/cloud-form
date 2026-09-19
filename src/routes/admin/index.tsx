import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "~/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: FormsPage,
});

type FormListItem = { id: string; slug: string; title: string; published: number; updated_at: number };

function FormsPage() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await api<{ forms: FormListItem[] }>("/api/forms");
    setForms(data.forms);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
  }, []);

  return (
    <Page
      title="Forms"
      description="Build, publish, and read responses."
      action={
        <Button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              await api("/api/forms", { method: "POST", body: JSON.stringify({ title: "Untitled form" }) });
              await load();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Create failed");
            }
          }}
        >
          New form
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No forms yet.
                </TableCell>
              </TableRow>
            ) : (
              forms.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    <Link to="/admin/forms/$id" params={{ id: f.id }} className="hover:underline">
                      {f.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.published ? "default" : "secondary"}>{f.published ? "Published" : "Draft"}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/admin/forms/$id/inbox" params={{ id: f.id }}>
                        Inbox
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(window.location.origin + "/f/" + f.slug).then(
                          () => toast.success("Link copied"),
                          () => toast.message(window.location.origin + "/f/" + f.slug),
                        );
                      }}
                    >
                      Copy link
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Page>
  );
}
