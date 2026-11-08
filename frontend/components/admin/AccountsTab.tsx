"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import BlockIcon from "@mui/icons-material/Block";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { strings } from "@/lib/strings";
import type { Account } from "@/lib/types";

const a = strings.admin.accounts;

/**
 * Superadmin view of every account across projects: grant or remove
 * superadmin, and deactivate accounts. Neither applies to one's own account.
 */
export function AccountsTab() {
  const { user: me } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const reload = useCallback(() => {
    return apiFetch<Account[]>("/users")
      .then((list) => {
        setAccounts(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function change(account: Account, request: () => Promise<unknown>) {
    setError(null);
    setBusyEmail(account.email);
    try {
      await request();
      await reload();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
    } finally {
      setBusyEmail(null);
    }
  }

  function toggleSuperadmin(account: Account) {
    change(account, () =>
      apiFetch(`/users/${encodeURIComponent(account.email)}`, {
        method: "PUT",
        body: JSON.stringify({ is_superadmin: !account.is_superadmin }),
      }),
    );
  }

  function deactivate(account: Account) {
    if (!window.confirm(a.deactivateConfirm)) return;
    change(account, () => apiFetch(`/users/${encodeURIComponent(account.email)}`, { method: "DELETE" }));
  }

  if (loadError) {
    return <Alert severity="error">{a.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">{a.intro}</Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{strings.admin.users.email}</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  {strings.admin.users.name}
                </TableCell>
                <TableCell>{a.superadmin}</TableCell>
                <TableCell align="right">{strings.admin.users.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => {
                const isMe = account.id === me?.id;
                const busy = busyEmail === account.email;
                return (
                  <TableRow key={account.id}>
                    <TableCell sx={{ wordBreak: "break-all" }}>{account.email}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {account.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={account.is_superadmin}
                        disabled={isMe || busy}
                        onChange={() => toggleSuperadmin(account)}
                        slotProps={{ input: { "aria-label": a.superadmin } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!isMe && (
                        <IconButton
                          size="small"
                          disabled={busy}
                          onClick={() => deactivate(account)}
                          aria-label={a.deactivate}
                          title={a.deactivate}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
