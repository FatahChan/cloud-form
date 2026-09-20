import { createColumnHelper } from "@tanstack/react-table";
import { CopyIcon, InboxIcon } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table";
import { type DataTableFeatures } from "@/components/data-table-features";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "~/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: FormsPage,
});

type FormListItem = {
  id: string;
  slug: string;
  title: string;
  published: number;
  updated_at: number;
  created_by_name: string;
  updated_by_name: string;
};

const columnHelper = createColumnHelper<DataTableFeatures, FormListItem>();

const columns = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Title",
    cell: ({ row }) => (
      <Link to="/admin/forms/$id" params={{ id: row.original.id }} className="font-medium hover:underline">
        {row.original.title}
      </Link>
    ),
  }),
  columnHelper.accessor((row) => (row.published ? "Published" : "Draft"), {
    id: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue();
      return <Badge variant={status === "Published" ? "default" : "secondary"}>{status}</Badge>;
    },
  }),
  columnHelper.accessor("created_by_name", { header: "Created by" }),
  columnHelper.accessor((row) => new Date(row.updated_at).toLocaleString(), {
    id: "updated_at",
    header: "Last updated",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
  }),
  columnHelper.accessor("updated_by_name", { header: "Updated by" }),
  columnHelper.display({
    id: "actions",
    enableGlobalFilter: false,
    cell: ({ row }) => {
      const f = row.original;
      return (
        <div className="space-x-2 text-right">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/forms/$id/inbox" params={{ id: f.id }}>
              <InboxIcon data-icon="inline-start" />
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
            <CopyIcon data-icon="inline-start" />
            Copy link
          </Button>
        </div>
      );
    },
  }),
]);

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
      <DataTable
        columns={columns}
        data={forms}
        getRowId={(row) => row.id}
        searchPlaceholder="Search forms…"
        empty={forms.length ? "No matching forms." : "No forms yet."}
      />
    </Page>
  );
}
