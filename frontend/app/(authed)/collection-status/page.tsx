"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { PermissionGuard } from "@/components/PermissionGuard";
import { apiFetch } from "@/lib/api";
import { strings } from "@/lib/strings";
import { type Status, STATUS_PILL_COLORS } from "@/lib/collection-status";
import { type IsoWeek, shiftWeek, formatWeekLabel } from "@/lib/week";

interface StatusRow {
  pdr_id: string;
  name: string;
  community: string;
  neighborhood: string;
  status: Status | null;
}

function StatusPill({ status }: { status: Status | null }) {
  if (!status) {
    return (
      <Chip
        label={strings.collectionStatus.notSet}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 700, fontSize: 11.5 }}
      />
    );
  }
  const colors = STATUS_PILL_COLORS[status];
  return (
    <Chip
      label={strings.collectionPass.statuses[status]}
      size="small"
      sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: 800, fontSize: 11.5 }}
    />
  );
}

function NeighborhoodAccordion({ neighborhood, rows }: { neighborhood: string; rows: StatusRow[] }) {
  const collected = rows.filter((r) => r.status === "collected").length;
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700, flexGrow: 1 }}>
            {neighborhood}
          </Typography>
          <Chip
            label={`${collected}/${rows.length} ${strings.collectionStatus.collectedSuffix}`}
            size="small"
            sx={{ fontWeight: 700, fontSize: 11.5, flexShrink: 0 }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {rows.map((row, i) => (
          <Box key={row.pdr_id}>
            {i > 0 && <Divider />}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 500, fontSize: "0.875rem" }}>
                  {row.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {row.community}
                </Typography>
              </Box>
              <StatusPill status={row.status} />
            </Box>
          </Box>
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

function CollectionStatus() {
  const [week, setWeek] = useState<IsoWeek | null>(null);
  const [currentWeek, setCurrentWeek] = useState<IsoWeek | null>(null);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadWeek = useCallback(async (w: IsoWeek) => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiFetch<StatusRow[]>(`/collections/${w.year}/${w.week}`);
      setRows(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const w = await apiFetch<IsoWeek>("/collections/current");
        setWeek(w);
        setCurrentWeek(w);
        await loadWeek(w);
      } catch {
        setError(true);
        setLoading(false);
      }
    }
    init();
  }, [loadWeek]);

  function goToWeek(delta: number) {
    if (!week) return;
    const next = shiftWeek(week, delta);
    setWeek(next);
    loadWeek(next);
  }

  const neighborhoods = useMemo(() => {
    const byNeighborhood = new Map<string, StatusRow[]>();
    for (const row of rows) {
      const list = byNeighborhood.get(row.neighborhood) ?? [];
      list.push(row);
      byNeighborhood.set(row.neighborhood, list);
    }
    return Array.from(byNeighborhood.entries())
      .map(([neighborhood, rows]) => ({ neighborhood, rows }))
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
  }, [rows]);

  if (error) {
    return <Alert severity="error">{strings.collectionStatus.loadError}</Alert>;
  }

  if (loading || !week) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {strings.collectionStatus.title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton size="small" onClick={() => goToWeek(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="subtitle1" color="text.secondary">
          {formatWeekLabel(week)}
        </Typography>
        <IconButton size="small" onClick={() => goToWeek(1)}>
          <ChevronRightIcon />
        </IconButton>
        {currentWeek && (week.year !== currentWeek.year || week.week !== currentWeek.week) && (
          <Button size="small" onClick={() => { setWeek(currentWeek); loadWeek(currentWeek); }}>
            {strings.collectionStatus.today}
          </Button>
        )}
      </Box>

      {neighborhoods.length === 0 ? (
        <Alert severity="info">{strings.collectionStatus.empty}</Alert>
      ) : (
        <Stack spacing={1}>
          {neighborhoods.map(({ neighborhood, rows }) => (
            <NeighborhoodAccordion key={neighborhood} neighborhood={neighborhood} rows={rows} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default function CollectionStatusPage() {
  return (
    <PermissionGuard minimum="read">
      <CollectionStatus />
    </PermissionGuard>
  );
}
