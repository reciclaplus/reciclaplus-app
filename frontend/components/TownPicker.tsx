"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { strings } from "@/lib/strings";
import { useTownState } from "@/lib/town-context";

/** Full-page list of the user's towns, shown until one is picked. */
export function TownPicker() {
  const { towns, selectTown } = useTownState();

  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 4, md: 8 } }}>
      <Stack spacing={2} sx={{ width: "100%", maxWidth: 440 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800 }}>
          {strings.towns.pickerTitle}
        </Typography>
        <Typography color="text.secondary">{strings.towns.pickerHint}</Typography>
        {towns.map((t) => (
          <Paper key={t.id} variant="outlined" sx={{ borderRadius: "14px", overflow: "hidden" }}>
            <ButtonBase
              onClick={() => selectTown(t.id)}
              sx={{
                width: "100%",
                justifyContent: "space-between",
                textAlign: "left",
                px: 2,
                py: 1.75,
                minHeight: 56,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{t.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {strings.roles[t.role]}
                </Typography>
              </Box>
              <ChevronRightIcon color="action" />
            </ButtonBase>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
