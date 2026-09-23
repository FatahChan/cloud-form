import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "~/lib/api";
import { parseSpreadsheetFile, type SpreadsheetData } from "~/lib/spreadsheet";
import { analyzeImport, importFields, importDataRowNumber, suggestColumnMapping, type ColumnMapping } from "~/shared/import";
import type { FormSchema } from "~/shared/schema";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/import")({
  ssr: false,
  component: ImportPage,
});

type FormListItem = { id: string; title: string; published: number };

const SKIP = "skip";

function ImportPage() {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<SpreadsheetData | null>(null);
  const [formId, setFormId] = useState("");
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const fields = useMemo(() => (schema ? importFields(schema) : []), [schema]);
  const analysis = useMemo(
    () => (schema && sheet ? analyzeImport(schema, mapping, sheet.rows) : null),
    [schema, sheet, mapping],
  );

  useEffect(() => {
    void api<{ forms: FormListItem[] }>("/api/forms")
      .then((d) => setForms(d.forms.filter((f) => f.published)))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load forms"));
  }, []);

  async function onFile(file: File | undefined) {
    setImported(null);
    setError(null);
    if (!file) return;
    try {
      const data = await parseSpreadsheetFile(file);
      setFileName(file.name);
      setSheet(data);
      setMapping(schema ? suggestColumnMapping(data.headers, schema) : Object.fromEntries(data.headers.map((h) => [h, null])));
    } catch (e) {
      setSheet(null);
      setFileName("");
      setError(e instanceof Error ? e.message : "Could not read file");
    }
  }

  async function onForm(id: string) {
    setFormId(id);
    setImported(null);
    setSchema(null);
    if (!id) return;
    try {
      const data = await api<{ publishedSchema: FormSchema | null; published: boolean }>("/api/forms/" + id);
      if (!data.published || !data.publishedSchema) {
        setError("That form is not published");
        return;
      }
      setSchema(data.publishedSchema);
      if (sheet) setMapping(suggestColumnMapping(sheet.headers, data.publishedSchema));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load form");
    }
  }

  async function runImport() {
    if (!formId || !sheet || !analysis?.ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ imported: number }>("/api/forms/" + formId + "/import", {
        method: "POST",
        body: JSON.stringify({ mapping, rows: sheet.rows }),
      });
      setImported(result.imported);
      toast.success(`Imported ${result.imported} row${result.imported === 1 ? "" : "s"}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const preview = sheet?.rows.slice(0, 5) ?? [];

  return (
    <Page title="Import" description="Upload a CSV or Excel file and map columns onto a published form.">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {imported != null && formId && (
        <Alert>
          <AlertTitle>Import finished</AlertTitle>
          <AlertDescription>
            {imported} row{imported === 1 ? "" : "s"} added.{" "}
            <Link to="/admin/forms/$id/inbox" params={{ id: formId }} className="font-medium">
              Open inbox
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>File</CardTitle>
          <CardDescription>CSV or .xlsx. First row is headers. Multi-select values use semicolons (A; B). File fields need an https:// link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {sheet && (
            <p className="text-sm text-muted-foreground">
              {fileName}: {sheet.rows.length} row{sheet.rows.length === 1 ? "" : "s"}, {sheet.headers.length} column
              {sheet.headers.length === 1 ? "" : "s"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form</CardTitle>
          <CardDescription>Only published forms can receive imported submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="import-form" className="mb-2">
            Destination form
          </Label>
          <Select value={formId || undefined} onValueChange={(v) => void onForm(v ?? "")}>
            <SelectTrigger id="import-form" className="w-full max-w-md">
              <SelectValue placeholder={forms.length ? "Choose a form" : "No published forms"} />
            </SelectTrigger>
            <SelectContent>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {sheet && schema && (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>Required fields must be mapped. Optional fields can be skipped.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Spreadsheet column</TableHead>
                  <TableHead>Form field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.headers.map((header) => (
                  <TableRow key={header}>
                    <TableCell className="font-medium">{header}</TableCell>
                    <TableCell>
                      <Select
                        value={mapping[header] ?? SKIP}
                        onValueChange={(v) =>
                          setMapping((m) => ({ ...m, [header]: !v || v === SKIP ? null : v }))
                        }
                      >
                        <SelectTrigger className="w-full max-w-md">
                          <SelectValue placeholder="Skip" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>Skip</SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.title} ({f.type})
                              {f.required ? " · required" : " · optional"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 flex flex-wrap gap-2">
              {fields.map((f) => (
                <Badge key={f.id} variant={f.required ? "default" : "secondary"}>
                  {f.title}
                  {f.required ? " required" : " optional"}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sheet && schema && preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              First {preview.length} data row{preview.length === 1 ? "" : "s"} (header not counted in row numbers).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  {sheet.headers.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{importDataRowNumber(i)}</TableCell>
                    {sheet.headers.map((h) => (
                      <TableCell key={h}>{row[h]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Compatibility</CardTitle>
            <CardDescription>
              {analysis.ready
                ? "Required fields are mapped and every row looks valid."
                : "Fix the file or mapping before importing. Row numbers match the preview (data rows only; row 1 in the file is the header)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Cannot import yet</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {analysis.blockers.map((b, i) => (
                      <li key={i}>{b.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {analysis.warnings.length > 0 && (
              <Alert>
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {analysis.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="button" disabled={!analysis.ready || busy} onClick={() => void runImport()}>
              {busy ? "Importing…" : "Import"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </Page>
  );
}
