import {
  columnFilteringFeature,
  createFilteredRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  tableFeatures,
} from "@tanstack/react-table";

export const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});

export type DataTableFeatures = typeof features;
