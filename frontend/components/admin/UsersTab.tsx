"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/roles";
import { strings } from "@/lib/strings";
import type { ActiveUser } from "@/lib/types";

const ROLES: Role[] = ["read", "write", "admin"];

export function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<ActiveUser | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiFetch<ActiveUser[]>("/users"));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleDelete(user: ActiveUser) {
    if (!window.confirm(strings.admin.users.deleteConfirm)) return;
    await apiFetch(`/users/${encodeURIComponent(user.email)}`, { method: "DELETE" });
    reload();
  }

  if (error) {
    return <Alert severity="error">{strings.admin.users.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Button variant="contained" onClick={() => setAddOpen(true)}>
          {strings.admin.users.addUser}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{strings.admin.users.email}</TableCell>
                <TableCell>{strings.admin.users.name}</TableCell>
                <TableCell>{strings.admin.users.role}</TableCell>
                <TableCell align="right">{strings.admin.users.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>{strings.admin.users.empty}</TableCell>
                </TableRow>
              )}
              {users.map((user) => (
                <TableRow key={user.email}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name ?? "—"}</TableCell>
                  <TableCell>{strings.roles[user.role]}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => setEditUser(user)}
                      aria-label={strings.common.edit}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {me?.email !== user.email && (
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(user)}
                        aria-label={strings.common.delete}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {addOpen && (
        <AddUserDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            reload();
          }}
        />
      )}
      {editUser && (
        <EditUserDialog
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            reload();
          }}
        />
      )}
    </Stack>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <TextField
      select
      label={strings.admin.users.role}
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      fullWidth
    >
      {ROLES.map((r) => (
        <MenuItem key={r} value={r}>
          {strings.roles[r]}
        </MenuItem>
      ))}
    </TextField>
  );
}

function AddUserDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("read");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null, role }),
      });
      onSaved();
    } catch {
      setError(strings.common.genericError);
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{strings.admin.users.addUser}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label={strings.admin.users.email}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label={strings.admin.users.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <RoleSelect value={role} onChange={setRole} />
          <Alert severity="info">{strings.admin.users.loginHint}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.common.cancel}</Button>
        <Button variant="contained" onClick={save} disabled={!email.trim() || saving}>
          {strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: ActiveUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${encodeURIComponent(user.email)}`, {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() || null, role }),
      });
      onSaved();
    } catch {
      setError(strings.common.genericError);
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{strings.admin.users.editUser}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label={strings.admin.users.email} value={user.email} fullWidth disabled />
          <TextField
            label={strings.admin.users.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <RoleSelect value={role} onChange={setRole} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.common.cancel}</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
