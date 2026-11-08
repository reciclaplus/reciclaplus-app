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
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, type GridColDef, type GridColumnVisibilityModel, type GridRenderCellParams } from "@mui/x-data-grid";
import { esES } from "@mui/x-data-grid/locales";
import { PermissionGuard } from "@/components/PermissionGuard";
import { MapPicker, type LatLng } from "@/components/MapPicker";
import { apiFetch } from "@/lib/api";
import { neighborhoodLabel, neighborhoodOptions } from "@/lib/locations";
import { hasRole } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { useTown } from "@/lib/town-context";
import { COLORS } from "@/lib/theme";
import { ALERT_PILL_COLORS, STATUS_PILL_COLORS } from "@/lib/collection-status";
import { buildBarrioColorMap, getBarrioColor } from "@/lib/barrio-colors";
import { formatMondayDate } from "@/lib/week";
import type { PdrWithHistory, WeekStatus } from "@/lib/types";

const gridLocaleText = esES.components.MuiDataGrid.defaultProps.localeText;

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

function AlertPill() {
  return (
    <Chip
      label={strings.list.statusAlert}
      size="small"
      sx={{
        bgcolor: ALERT_PILL_COLORS.bg,
        color: ALERT_PILL_COLORS.text,
        fontWeight: 800,
        fontSize: 11.5,
      }}
    />
  );
}

function HistoryStrip({ history }: { history: WeekStatus[] }) {
  return (
    <Stack direction="row" spacing={0.75}>
      {history.map((ws, i) =>
        ws.status ? (
          <Tooltip key={i} title={`S${ws.week}/${ws.year} · ${strings.collectionPass.statuses[ws.status]}`}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: COLORS.status[ws.status].dot }} />
          </Tooltip>
        ) : (
          <Tooltip key={i} title={`S${ws.week}/${ws.year} · ${strings.list.noHistory}`}>
            <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: COLORS.hairlineAlt }} />
          </Tooltip>
        ),
      )}
    </Stack>
  );
}

/** The edit dialog's fields. Location is chosen by ID; community only narrows
 * the barrio dropdown. */
interface EditDraft {
  name: string;
  description: string;
  category: string;
  communityId: string;
  neighborhoodId: string;
  lat: number;
  lng: number;
}

interface PdrRow extends PdrWithHistory {
  /** Barrio name, plus community when the name repeats in the town. */
  barrioLabel: string;
  barrioColor: string;
  lastWeekLabel: string;
  lastWeekSort: number;
  lastStatus: WeekStatus["status"] | "";
  noCollectionAlert: boolean;
}

function hasNoCollectionAlert(p: PdrWithHistory): boolean {
  return !p.recent_collections.some((ws) => ws.status === "collected");
}

function lastRecordedWeek(history: WeekStatus[]): WeekStatus | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status) return history[i];
  }
  return undefined;
}

function PdrList() {
  const { town, detail, townPath } = useTown();
  const canWrite = hasRole(town.role, "write");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [pdrs, setPdrs] = useState<PdrWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeBarrio, setActiveBarrio] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeAlertOnly, setActiveAlertOnly] = useState(false);
  const [editTarget, setEditTarget] = useState<PdrWithHistory | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PdrWithHistory | null>(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({
    created_at: false,
  });

  useEffect(() => {
    setColumnVisibilityModel({
      created_at: false,
      category: !isMobile,
      community: !isMobile,
      lastWeekSort: !isMobile,
      history: !isMobile,
    });
  }, [isMobile]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PdrWithHistory[]>(townPath("/pdrs/with-history"))
      .then(setPdrs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [townPath]);

  useEffect(() => {
    load();
  }, [load]);

  const allNeighborhoods = useMemo(() => neighborhoodOptions(detail), [detail]);
  const barrioColorMap = useMemo(
    () => buildBarrioColorMap(allNeighborhoods.map((n) => n.label)),
    [allNeighborhoods],
  );
  const communityCount = useMemo(
    () => new Set(pdrs.map((p) => p.community_id ?? p.community)).size,
    [pdrs],
  );

  const filtered = useMemo(() => {
    return pdrs.filter((p) => {
      const matchesBarrio = !activeBarrio || p.neighborhood_id === activeBarrio;
      const matchesCategory = !activeCategory || p.category === activeCategory;
      const matchesAlert = !activeAlertOnly || hasNoCollectionAlert(p);
      return matchesBarrio && matchesCategory && matchesAlert;
    });
  }, [pdrs, activeBarrio, activeCategory, activeAlertOnly]);

  const rows: PdrRow[] = useMemo(
    () =>
      filtered.map((p) => {
        const lastWeek = lastRecordedWeek(p.recent_collections);
        const barrioLabel = neighborhoodLabel(allNeighborhoods, p.neighborhood_id, p.neighborhood);
        return {
          ...p,
          barrioLabel,
          barrioColor: getBarrioColor(barrioColorMap, barrioLabel),
          lastWeekLabel: lastWeek ? formatMondayDate(lastWeek) : strings.list.noHistory,
          lastWeekSort: lastWeek ? lastWeek.year * 100 + lastWeek.week : -1,
          lastStatus: lastWeek?.status ?? "",
          noCollectionAlert: hasNoCollectionAlert(p),
        };
      }),
    [filtered, barrioColorMap, allNeighborhoods],
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
      description: pdr.description ?? "",
      category: pdr.category,
      communityId: pdr.community_id ?? "",
      neighborhoodId: pdr.neighborhood_id ?? "",
      lat: pdr.lat,
      lng: pdr.lng,
    });
  }

  function updateDraft(changes: Partial<EditDraft>) {
    setEditDraft((d) => (d ? { ...d, ...changes } : d));
  }

  // The barrio dropdown only offers the chosen community's barrios.
  const editNeighborhoods = useMemo(
    () => detail.communities.find((c) => c.id === editDraft?.communityId)?.neighborhoods ?? [],
    [detail, editDraft?.communityId],
  );
  // A PDR can keep a category since removed from the town's list: show it so the
  // dialog doesn't blank it, while only the current list is offered otherwise.
  const editCategories = useMemo(() => {
    const current = editTarget?.category;
    return current && !detail.categories.includes(current)
      ? [current, ...detail.categories]
      : detail.categories;
  }, [detail, editTarget]);

  const editLocation: LatLng | null = editDraft ? { lat: editDraft.lat, lng: editDraft.lng } : null;

  async function saveEdit() {
    if (!editTarget || !editDraft) return;
    setSaving(true);
    try {
      await apiFetch(townPath(`/pdrs/${editTarget.id}`), {
        method: "PUT",
        body: JSON.stringify({
          name: editDraft.name,
          description: editDraft.description,
          category: editDraft.category,
          neighborhood_id: editDraft.neighborhoodId || null,
          lat: editDraft.lat,
          lng: editDraft.lng,
        }),
      });
      setEditTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(townPath(`/pdrs/${deleteTarget.id}`), { method: "DELETE" });
    setDeleteTarget(null);
    setEditTarget(null);
    load();
  }

  // Filter options: the town's categories plus any still used by its PDRs.
  const allCategories = useMemo(
    () => [...new Set([...detail.categories, ...pdrs.map((p) => p.category)])],
    [detail, pdrs],
  );

  const columns: GridColDef<PdrRow>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: strings.list.colName,
        flex: isMobile ? 1 : 1.6,
        minWidth: isMobile ? 140 : 220,
        valueGetter: (_value, row) => `${row.name} ${row.description ?? ""}`.trim(),
        renderCell: (params: GridRenderCellParams<PdrRow>) =>
          isMobile ? (
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
                {params.row.name}
              </Typography>
              {params.row.description && (
                <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 500, color: COLORS.muted }}>
                  {params.row.description}
                </Typography>
              )}
            </Box>
          ) : (
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
              {params.row.barrioLabel}
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
            {params.row.noCollectionAlert ? (
              <AlertPill />
            ) : params.row.lastStatus ? (
              <StatusPill status={params.row.lastStatus} />
            ) : null}
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
    [isMobile],
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

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
        <TextField
          select
          label={strings.list.colNeighborhood}
          value={activeBarrio ?? ""}
          onChange={(e) => updateBarrio(e.target.value || null)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{strings.list.allBarrios}</MenuItem>
          {allNeighborhoods.map((n) => (
            <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label={strings.list.colCategory}
          value={activeCategory ?? ""}
          onChange={(e) => updateCategory(e.target.value || null)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{strings.list.allCategories}</MenuItem>
          {allCategories.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>

        <Chip
          label={strings.list.filterAlertOnly}
          onClick={() => setActiveAlertOnly((v) => !v)}
          sx={{
            fontWeight: 700,
            bgcolor: activeAlertOnly ? ALERT_PILL_COLORS.bg : "#fff",
            color: activeAlertOnly ? ALERT_PILL_COLORS.text : COLORS.body,
            border: `1px solid ${activeAlertOnly ? ALERT_PILL_COLORS.bg : COLORS.hairlineSoft}`,
          }}
        />
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
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={setColumnVisibilityModel}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
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
              value={editDraft?.name ?? ""}
              onChange={(e) => updateDraft({ name: e.target.value })}
              fullWidth
            />
            <TextField
              label={strings.list.colDescription}
              value={editDraft?.description ?? ""}
              onChange={(e) => updateDraft({ description: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label={strings.list.colCategory}
              value={editDraft?.category ?? ""}
              onChange={(e) => updateDraft({ category: e.target.value })}
              fullWidth
            >
              {editCategories.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={strings.list.colCommunity}
              value={editDraft?.communityId ?? ""}
              onChange={(e) => updateDraft({ communityId: e.target.value, neighborhoodId: "" })}
              fullWidth
            >
              {detail.communities.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={strings.list.colNeighborhood}
              value={editDraft?.neighborhoodId ?? ""}
              onChange={(e) => updateDraft({ neighborhoodId: e.target.value })}
              disabled={!editDraft?.communityId}
              fullWidth
            >
              {editNeighborhoods.map((n) => (
                <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
              ))}
            </TextField>
            {editDraft && (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: COLORS.body, mb: 0.5 }}>
                  {strings.newPdr.location}
                </Typography>
                <MapPicker
                  center={{ lat: detail.map_center_lat, lng: detail.map_center_lng }}
                  value={editLocation}
                  onChange={(point) => updateDraft({ lat: point.lat, lng: point.lng })}
                  height={240}
                />
                <Typography sx={{ fontSize: 12, color: COLORS.muted, mt: 0.5 }}>
                  {editLocation
                    ? `${strings.newPdr.selectedCoords}: ${editLocation.lat.toFixed(6)}, ${editLocation.lng.toFixed(6)}`
                    : strings.newPdr.noLocation}
                </Typography>
              </Box>
            )}
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
