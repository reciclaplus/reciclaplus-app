"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { hasRole } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";
import { STATUS_PILL_COLORS } from "@/lib/collection-status";
import { buildBarrioColorMap, getBarrioColor } from "@/lib/barrio-colors";
import { mondayOfWeek } from "@/lib/week";
import type { PdrWithHistory, TownDetail, WeekStatus } from "@/lib/types";

const gridLocaleText = esES.components.MuiDataGrid.defaultProps.localeText;

function formatMondayDate(w: WeekStatus): string {
  const mon = mondayOfWeek(w);
  const dd = String(mon.getUTCDate()).padStart(2, "0");
  const mm = String(mon.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${mon.getUTCFullYear()}`;
}

function StatusPill({ status }: { status: keyof typeof strings.collectionPass.statuses }) {
  const colors = STATUS_PILL_COLORS[status];
  return (
    <Chip
      label={strings.collectionPass.statuses[status]}
      size="small"
      sx={{
        bgcolor: colors.bg,
        color: colors.text,
        fontWeight: 800,
        fontSize: 11.5,
      }}
    />
  );
}

function HistoryStrip({ history }: { history: WeekStatus[] }) {
  const slots = Array.from({ length: 5 }, (_, i) => history[history.length - 5 + i]);
  return (
    <Stack direction="row" spacing={0.75}>
      {slots.map((ws, i) =>
        ws ? (
          <Tooltip key={i} title={`S${ws.week}/${ws.year} · ${strings.collectionPass.statuses[ws.status]}`}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: COLORS.status[ws.status].dot }} />
          </Tooltip>
        ) : (
          <Box key={i} sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: COLORS.hairlineAlt }} />
        ),
      )}
    </Stack>
  );
}

interface PdrRow extends PdrWithHistory {
  barrioColor: string;
  lastWeekLabel: string;
  lastWeekSort: number;
  lastStatus: WeekStatus["status"] | "";
}

function PdrList() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, "write") : false;

  const [pdrs, setPdrs] = useState<PdrWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [towns, setTowns] = useState<TownDetail[]>([]);
  const [activeBarrio, setActiveBarrio] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<PdrWithHistory | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PdrWithHistory>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PdrWithHistory | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PdrWithHistory[]>("/pdrs/with-history")
      .then(setPdrs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    apiFetch<TownDetail[]>("/towns").then(async (summaries) => {
      const details = await Promise.all(
        summaries.map((t) => apiFetch<TownDetail>(`/towns/${t.id}`)),
      );
      setTowns(details);
    });
  }, [load]);

  const allNeighborhoods = useMemo(
    () => towns.flatMap((t) => t.communities.flatMap((c) => c.neighborhoods.map((n) => n.name))),
    [towns],
  );
  const barrioColorMap = useMemo(() => buildBarrioColorMap(allNeighborhoods), [allNeighborhoods]);
  const communityCount = useMemo(() => new Set(pdrs.map((p) => p.community)).size, [pdrs]);

  const filtered = useMemo(() => {
    return pdrs.filter((p) => {
      const matchesBarrio = !activeBarrio || p.neighborhood === activeBarrio;
      const matchesCategory = !activeCategory || p.category === activeCategory;
      return matchesBarrio && matchesCategory;
    });
  }, [pdrs, activeBarrio, activeCategory]);

  const rows: PdrRow[] = useMemo(
    () =>
      filtered.map((p) => {
        const lastWeek = p.recent_collections[p.recent_collections.length - 1];
        return {
          ...p,
          barrioColor: getBarrioColor(barrioColorMap, p.neighborhood),
          lastWeekLabel: lastWeek ? formatMondayDate(lastWeek) : strings.list.noHistory,
          lastWeekSort: lastWeek ? lastWeek.year * 100 + lastWeek.week : -1,
          lastStatus: lastWeek?.status ?? "",
        };
      }),
    [filtered, barrioColorMap],
  );

  function updateBarrio(value: string | null) {
    setActiveBarrio(value);
  }

  function updateCategory(value: string | null) {
    setActiveCategory(value);
  }

  function openEdit(pdr: PdrWithHistory) {
    setEditTarget(pdr);
    setEditDraft({
      name: pdr.name,
      description: pdr.description,
      category: pdr.category,
      community: pdr.community,
      neighborhood: pdr.neighborhood,
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/pdrs/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify(editDraft),
      });
      setEditTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/pdrs/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setEditTarget(null);
    load();
  }

  const allCommunities = useMemo(
    () => towns.flatMap((t) => t.communities.map((c) => c.name)),
    [towns],
  );
  const allCategories = useMemo(
    () => [...new Set(towns.flatMap((t) => t.categories))],
    [towns],
  );

  const columns: GridColDef<PdrRow>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: strings.list.colName,
        flex: 1.6,
        minWidth: 220,
        valueGetter: (_value, row) => `${row.name} ${row.description ?? ""}`.trim(),
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%", minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
              {params.row.name}
            </Typography>
            {params.row.description && (
              <Typography noWrap sx={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, ml: 1 }}>
                {params.row.description}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        field: "category",
        headerName: strings.list.colCategory,
        width: 140,
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Chip
            label={params.row.category}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 700, borderColor: COLORS.hairlineSoft, color: COLORS.body }}
          />
        ),
      },
      {
        field: "community",
        headerName: strings.list.colCommunity,
        width: 150,
      },
      {
        field: "neighborhood",
        headerName: strings.list.colNeighborhood,
        width: 160,
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", height: "100%" }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: params.row.barrioColor, flexShrink: 0 }} />
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: COLORS.body }}>
              {params.row.neighborhood}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "lastWeekSort",
        headerName: strings.list.colLastCollection,
        width: 130,
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.body }}>
              {params.row.lastWeekLabel}
            </Typography>
          </Box>
        ),
      },
      {
        field: "lastStatus",
        headerName: strings.list.colStatus,
        width: 130,
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            {params.row.lastStatus ? <StatusPill status={params.row.lastStatus} /> : null}
          </Box>
        ),
      },
      {
        field: "history",
        headerName: strings.list.colHistory,
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <HistoryStrip history={params.row.recent_collections} />
          </Box>
        ),
      },
      {
        field: "created_at",
        headerName: strings.list.colCreatedAt,
        width: 140,
        type: "date",
        valueGetter: (_value, row) => new Date(row.created_at),
        renderCell: (params: GridRenderCellParams<PdrRow>) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.body }}>
              {new Date(params.row.created_at).toLocaleDateString("es-ES")}
            </Typography>
          </Box>
        ),
      },
    ],
    [],
  );

  if (error) {
    return <Alert severity="error">{strings.list.loadError}</Alert>;
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Box>
          <Typography sx={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.02em", color: COLORS.ink }}>
            {strings.list.title}
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: COLORS.body, mt: 0.5 }}>
            {pdrs.length} {strings.list.count} · {communityCount} {strings.list.communities}
          </Typography>
        </Box>
        {canWrite && (
          <Button
            component={Link}
            href="/new-pdr"
            variant="contained"
            startIcon={<AddIcon sx={{ color: `${COLORS.lime} !important` }} />}
            sx={{ bgcolor: COLORS.emeraldEnd, "&:hover": { bgcolor: COLORS.emeraldDeepest } }}
          >
            {strings.nav.newPdr}
          </Button>
        )}
      </Stack>

      <Stack spacing={0.75}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.muted }}>
          {strings.list.colNeighborhood}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip
            label={strings.list.allBarrios}
            onClick={() => updateBarrio(null)}
            sx={{
              fontWeight: 700,
              bgcolor: activeBarrio === null ? COLORS.emeraldEnd : "#fff",
              color: activeBarrio === null ? "#fff" : COLORS.body,
              border: `1px solid ${activeBarrio === null ? COLORS.emeraldEnd : COLORS.hairlineSoft}`,
            }}
          />
          {allNeighborhoods.map((n) => (
            <Chip
              key={n}
              label={n}
              onClick={() => updateBarrio(n)}
              sx={{
                fontWeight: 700,
                bgcolor: activeBarrio === n ? COLORS.emeraldEnd : "#fff",
                color: activeBarrio === n ? "#fff" : COLORS.body,
                border: `1px solid ${activeBarrio === n ? COLORS.emeraldEnd : COLORS.hairlineSoft}`,
              }}
            />
          ))}
        </Box>
      </Stack>

      <Stack spacing={0.75}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.muted }}>
          {strings.list.colCategory}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip
            label={strings.list.allCategories}
            onClick={() => updateCategory(null)}
            sx={{
              fontWeight: 700,
              bgcolor: activeCategory === null ? COLORS.emeraldEnd : "#fff",
              color: activeCategory === null ? "#fff" : COLORS.body,
              border: `1px solid ${activeCategory === null ? COLORS.emeraldEnd : COLORS.hairlineSoft}`,
            }}
          />
          {allCategories.map((c) => (
            <Chip
              key={c}
              label={c}
              onClick={() => updateCategory(c)}
              sx={{
                fontWeight: 700,
                bgcolor: activeCategory === c ? COLORS.emeraldEnd : "#fff",
                color: activeCategory === c ? "#fff" : COLORS.body,
                border: `1px solid ${activeCategory === c ? COLORS.emeraldEnd : COLORS.hairlineSoft}`,
              }}
            />
          ))}
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">{pdrs.length === 0 ? strings.list.empty : strings.list.emptyFiltered}</Alert>
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          localeText={gridLocaleText}
          showToolbar
          autoHeight
          disableRowSelectionOnClick
          onRowClick={(params) => (canWrite ? openEdit(params.row as PdrWithHistory) : undefined)}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            columns: { columnVisibilityModel: { created_at: false } },
          }}
          sx={{
            bgcolor: "#fff",
            borderRadius: "14px",
            borderColor: COLORS.hairlineSoft,
            "--DataGrid-containerBackground": COLORS.canvas,
            "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 800, fontSize: 12, color: COLORS.body },
            "& .MuiDataGrid-row": { cursor: canWrite ? "pointer" : "default" },
          }}
        />
      )}

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {strings.common.edit}
          {editTarget && (
            <IconButton
              size="small"
              onClick={() => setDeleteTarget(editTarget)}
              aria-label={strings.common.delete}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={strings.list.colName}
              value={editDraft.name ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label={strings.list.colDescription}
              value={editDraft.description ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label={strings.list.colCategory}
              value={editDraft.category ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
              fullWidth
            >
              {allCategories.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={strings.list.colCommunity}
              value={editDraft.community ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, community: e.target.value }))}
              fullWidth
            >
              {allCommunities.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={strings.list.colNeighborhood}
              value={editDraft.neighborhood ?? ""}
              onChange={(e) => setEditDraft((d) => ({ ...d, neighborhood: e.target.value }))}
              fullWidth
            >
              {allNeighborhoods.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)}>{strings.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={saveEdit}
            disabled={saving}
            sx={{ bgcolor: COLORS.emeraldEnd, "&:hover": { bgcolor: COLORS.emeraldDeepest } }}
          >
            {saving ? strings.common.saving : strings.common.save}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{strings.list.deleteConfirm}</DialogTitle>
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
