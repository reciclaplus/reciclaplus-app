"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import type { Pdr } from "@/lib/types";

const columns: GridColDef<Pdr>[] = [
  { field: "internal_id", headerName: strings.list.colInternalId, width: 80 },
  { field: "name", headerName: strings.list.colName, flex: 1, minWidth: 160 },
  { field: "category", headerName: strings.list.colCategory, width: 130 },
  { field: "community", headerName: strings.list.colCommunity, width: 150 },
  { field: "neighborhood", headerName: strings.list.colNeighborhood, width: 160 },
  {
    field: "created_at",
    headerName: strings.list.colCreatedAt,
    width: 140,
    valueFormatter: (value) =>
      value ? new Date(value as string).toLocaleDateString("es-DO") : "",
  },
];

function PdrList() {
  const [pdrs, setPdrs] = useState<Pdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<Pdr[]>("/pdrs")
      .then(setPdrs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pdrs;
    return pdrs.filter((p) =>
      [p.name, p.category, p.community, p.neighborhood]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [pdrs, search]);

  if (error) {
    return <Alert severity="error">{strings.list.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.list.title}
      </Typography>

      <TextField
        label={strings.list.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ maxWidth: 360 }}
      />

      <Box sx={{ width: "100%" }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: { sortModel: [{ field: "created_at", sort: "desc" }] },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          localeText={{ noRowsLabel: strings.list.empty }}
          sx={{ bgcolor: "background.paper" }}
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        {filtered.length} {strings.list.count}
      </Typography>
    </Stack>
  );
}

export default function ListPage() {
  return (
    <PermissionGuard minimum="read">
      <PdrList />
    </PermissionGuard>
  );
}
