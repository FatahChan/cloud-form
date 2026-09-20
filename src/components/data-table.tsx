import { useTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { features, type DataTableFeatures } from "@/components/data-table-features";

export type DataTablePagination = {
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
};

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  searchPlaceholder = "Search…",
  search,
  onSearchChange,
  empty = "No results.",
  toolbar,
  pagination,
}: {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  empty?: string;
  toolbar?: ReactNode;
  pagination?: DataTablePagination;
}) {
  const table = useTable({
    features,
    data,
    columns,
    getRowId,
    globalFilterFn: "includesString",
  });
  const searchValue = onSearchChange ? (search ?? "") : ((table.state.globalFilter as string | undefined) ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => {
            if (onSearchChange) onSearchChange(event.target.value);
            else table.setGlobalFilter(event.target.value);
          }}
          className="max-w-sm"
        />
        {toolbar}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-end gap-4">
          {pagination.pageSize != null && pagination.onPageSizeChange ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => pagination.onPageSizeChange?.(Number(value))}
              >
                <SelectTrigger size="sm" className="w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              type="button"
              onClick={pagination.onPreviousPage}
              disabled={!pagination.canPreviousPage}
            >
              <span className="sr-only">Previous page</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              type="button"
              onClick={pagination.onNextPage}
              disabled={!pagination.canNextPage}
            >
              <span className="sr-only">Next page</span>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
