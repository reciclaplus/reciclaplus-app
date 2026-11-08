"use client";

import { useCallback, useEffect, useState } from "react";
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
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { apiFetch, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/roles";
import { strings } from "@/lib/strings";
import { useTown } from "@/lib/town-context";
import type { TownMember } from "@/lib/types";

const ROLES: Role[] = ["read", "write", "admin"];

/**
 * Who can access the selected project, and with which role. Adding an email
 * creates the account if needed; removing someone only ends their access here.
 */
export function MembersTab() {
  const { user: me, refresh } = useAuth();
  const { town, townPath } = useTown();
  const [members, setMembers] = useState<TownMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<TownMember | null>(null);

  const reload = useCallback(() => {
    return apiFetch<TownMember[]>(townPath("/members"))
      .then((list) => {
        setMembers(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [townPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Town admins can't change their own access (the backend refuses); a
  // superadmin keeps access regardless, so they can.
  const canChange = (member: TownMember) => member.user_id !== me?.id || !!me?.is_superadmin;

  async function remove(member: TownMember) {
    if (!window.confirm(strings.admin.users.removeConfirm)) return;
    setActionError(null);
    try {
      await apiFetch(townPath(`/members/${member.user_id}`), { method: "DELETE" });
      await reload();
      if (member.user_id === me?.id) await refresh();
    } catch (err) {
      setActionError(errorMessage(err, strings.common.genericError));
    }
  }

  if (loadError) {
    return <Alert severity="error">{strings.admin.users.loadError}</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
        <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
          {strings.admin.users.membersOf.replace("{town}", town.name)}
        </Typography>
        <Button variant="contained" onClick={() => setAddOpen(true)}>
          {strings.admin.users.addUser}
        </Button>
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>
          {actionError}
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
                <TableCell>{strings.admin.users.role}</TableCell>
                <TableCell align="right">{strings.admin.users.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>{strings.admin.users.empty}</TableCell>
                </TableRow>
              )}
              {members.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell sx={{ wordBreak: "break-all" }}>
                    {member.email}
                    {member.user_id === me?.id && (
                      <Chip label={strings.admin.users.you} size="small" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    {member.name ?? "—"}
                  </TableCell>
                  <TableCell>{strings.roles[member.role]}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {canChange(member) && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => setEditMember(member)}
                          aria-label={strings.admin.users.editUser}
                          title={strings.admin.users.editUser}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => remove(member)}
                          aria-label={strings.admin.users.remove}
                          title={strings.admin.users.remove}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {addOpen && (
        <AddMemberDialog
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            await reload();
          }}
        />
      )}
      {editMember && (
        <EditMemberDialog
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={async () => {
            setEditMember(null);
            await reload();
            if (editMember.user_id === me?.id) await refresh();
          }}
        />
      )}
    </Stack>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
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

function AddMemberDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { townPath } = useTown();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("read");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(townPath("/members"), {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null, role }),
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
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
            helperText={strings.admin.users.nameHint}
            fullWidth
          />
          <RoleSelect value={role} onChange={setRole} />
          <Alert severity="info">{strings.admin.users.loginHint}</Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.common.cancel}</Button>
        <Button variant="contained" onClick={save} disabled={!email.trim() || saving}>
          {saving ? strings.common.saving : strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditMemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: TownMember;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { townPath } = useTown();
  const [role, setRole] = useState<Role>(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(townPath(`/members/${member.user_id}`), {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, strings.common.genericError));
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{strings.admin.users.editUser}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label={strings.admin.users.email} value={member.email} fullWidth disabled />
          <TextField label={strings.admin.users.name} value={member.name ?? ""} fullWidth disabled />
          <Typography variant="body2" color="text.secondary">
            {strings.admin.users.sharedAccountHint}
          </Typography>
          <RoleSelect value={role} onChange={setRole} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.common.cancel}</Button>
        <Button variant="contained" onClick={save} disabled={saving || role === member.role}>
          {saving ? strings.common.saving : strings.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
