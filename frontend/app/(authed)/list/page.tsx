"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  DataGrid,
  type GridColDef,
} from "@mui/x-data-grid";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { hasRole } from "@/lib/roles";
import { strings } from "@/lib/strings";
import type { PdrWithHistory, WeekStatus } from "@/lib/types";

const STATUS_DOT_COLOR: Record<string, string> = {
  collected: "#2e7d32",
  empty: "#ed6c02",
  unavailable: "#d32f2f",
  closed: "#616161",
};

function HistoryDots({ weeks }: { weeks: WeekStatus[] }) {
  if (weeks.length === 0) {
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }
  return (
    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
      {weeks.map((w) => (
        <Tooltip
          key={`${w.year}-${w.week}`}
          title={`S${w.week} ${w.year}: ${strings.collectionPass.statuses[w.status]}`}
          arrow
        >
          <Box
            sx={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              bgcolor: STATUS_DOT_COLOR[w.status] ?? "#bdbdbd",
              flexShrink: 0,
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

function PdrList() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, "write") : false;

  const [pdrs, setPdrs] = useState<PdrWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PdrWithHistory | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PdrWithHistory[]>("/pdrs/with-history")
      .then(setPdrs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/pdrs/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }

  const columns: GridColDef<PdrWithHistory>[] = [
    { field: "internal_id", headerName: strings.list.colInternalId, width: 80 },
    { field: "name", headerName: strings.list.colName, flex: 1, minWidth: 160 },
    { field: "description", headerName: strings.list.colDescription, flex: 1, minWidth: 180 },
    { field: "category", headerName: strings.list.colCategory, width: 130 },
    { field: "community", headerName: strings.list.colCommunity, width: 150 },
    { field: "neighborhood", headerName: strings.list.colNeighborhood, width: 160 },
    {
      field: "recent_collections",
      headerName: strings.list.colHistory,
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <HistoryDots weeks={params.value as WeekStatus[]} />
      ),
    },
    {
      field: "created_at",
      headerName: strings.list.colCreatedAt,
      width: 140,
      valueFormatter: (value) =>
        value ? new Date(value as string).toLocaleDateString("es-DO") : "",
    },
    ...(canWrite
      ? [
          {
            field: "actions" as const,
            headerName: "",
            width: 60,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            disableExport: true,
            renderCell: (params: { row: PdrWithHistory }) => (
              <IconButton
                size="small"
                onClick={() => setDeleteTarget(params.row)}
                aria-label={strings.common.delete}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            ),
          } satisfies GridColDef<PdrWithHistory>,
        ]
      : []),
  ];

  if (error) {
    return <Alert severity="error">{strings.list.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.list.title}
      </Typography>

      <Box sx={{ width: "100%" }}>
        <DataGrid
          rows={pdrs}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          showToolbar
          initialState={{
            columns: {
              columnVisibilityModel: { internal_id: false, created_at: false },
            },
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
        {pdrs.length} {strings.list.count}
      </Typography>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{strings.list.deleteConfirm}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget?.name}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{strings.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {strings.common.delete}
          </Button>
        </DialogActions>
      </Dialog>
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
