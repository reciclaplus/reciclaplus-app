"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { hasRole } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { COLORS } from "@/lib/theme";
import { STATUS_PILL_COLORS } from "@/lib/collection-status";
import { buildBarrioColorMap, getBarrioColor } from "@/lib/barrio-colors";
import type { PdrWithHistory, TownDetail } from "@/lib/types";

const PAGE_SIZE = 6;

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

function PdrRow({
  pdr,
  barrioColor,
  onOpen,
}: {
  pdr: PdrWithHistory;
  barrioColor: string;
  onOpen: () => void;
}) {
  const lastWeek = pdr.recent_collections[pdr.recent_collections.length - 1];
  const initials = pdr.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card sx={{ borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
      <CardActionArea onClick={onOpen} sx={{ p: 1.75 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr auto", md: "1fr 130px 150px 110px 24px" },
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: COLORS.limeSoft,
                color: COLORS.emeraldEnd,
                fontWeight: 800,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 15.5, fontWeight: 700, fontFamily: "var(--font-display)", color: COLORS.ink }}>
                {pdr.name}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, fontWeight: 500, color: COLORS.muted }}>
                {pdr.description || pdr.category}
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", display: { xs: "none", md: "flex" } }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barrioColor, flexShrink: 0 }} />
            <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, color: COLORS.body }}>
              {pdr.neighborhood}
            </Typography>
          </Stack>

          <Typography
            sx={{
              display: { xs: "none", md: "block" },
              fontSize: 13.5,
              fontWeight: 600,
              color: COLORS.body,
            }}
          >
            {lastWeek
              ? `S${lastWeek.week}/${lastWeek.year}`
              : strings.list.noHistory}
          </Typography>

          <Box sx={{ display: { xs: "none", md: "block" } }}>
            {lastWeek ? <StatusPill status={lastWeek.status} /> : null}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <ChevronRightIcon sx={{ color: "#c2ccc3" }} />
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

function PdrList() {
  const { user } = useAuth();
  const canWrite = user ? hasRole(user.role, "write") : false;

  const [pdrs, setPdrs] = useState<PdrWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [towns, setTowns] = useState<TownDetail[]>([]);
  const [search, setSearch] = useState("");
  const [activeBarrio, setActiveBarrio] = useState<string | null>(null);
  const [page, setPage] = useState(0);
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
    const term = search.trim().toLowerCase();
    return pdrs.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term);
      const matchesBarrio = !activeBarrio || p.neighborhood === activeBarrio;
      return matchesSearch && matchesBarrio;
    });
  }, [pdrs, search, activeBarrio]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  function updateBarrio(value: string | null) {
    setActiveBarrio(value);
    setPage(0);
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

      <TextField
        fullWidth
        placeholder={strings.list.searchPlaceholder}
        value={search}
        onChange={(e) => updateSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: COLORS.muted }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "#fff",
            borderRadius: "12px",
            height: 44,
            "& fieldset": { borderColor: COLORS.hairlineSoft },
          },
        }}
      />

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

      {/* Table header (desktop only) */}
      <Box
        sx={{
          display: { xs: "none", md: "grid" },
          gridTemplateColumns: "1fr 130px 150px 110px 24px",
          gap: 1.5,
          px: 1.75,
        }}
      >
        {[strings.list.colName, strings.list.colNeighborhood, strings.list.colLastCollection, strings.list.colStatus, ""].map(
          (label, i) => (
            <Typography
              key={i}
              sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.muted }}
            >
              {label}
            </Typography>
          ),
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : pageRows.length === 0 ? (
        <Alert severity="info">{pdrs.length === 0 ? strings.list.empty : strings.list.emptyFiltered}</Alert>
      ) : (
        <Stack spacing={1.25}>
          {pageRows.map((pdr) => (
            <PdrRow
              key={pdr.id}
              pdr={pdr}
              barrioColor={getBarrioColor(barrioColorMap, pdr.neighborhood)}
              onOpen={() => (canWrite ? openEdit(pdr) : undefined)}
            />
          ))}
        </Stack>
      )}

      {!loading && filtered.length > 0 && (
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", pt: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: COLORS.body }}>
            {strings.list.showing} {pageRows.length} {strings.list.of} {filtered.length}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <Button
                key={i}
                size="small"
                onClick={() => setPage(i)}
                sx={{
                  minWidth: 32,
                  borderRadius: "10px",
                  bgcolor: safePage === i ? COLORS.emeraldEnd : "transparent",
                  color: safePage === i ? "#fff" : COLORS.body,
                  "&:hover": { bgcolor: safePage === i ? COLORS.emeraldDeepest : COLORS.hairlineAlt },
                }}
              >
                {i + 1}
              </Button>
            ))}
          </Stack>
        </Stack>
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
