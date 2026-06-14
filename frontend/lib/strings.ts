/**
 * Centralized Spanish UI strings.
 *
 * All user-facing text lives here (per project convention: code in English,
 * UI in Spanish). Import from this module instead of hardcoding strings inline.
 */
export const strings = {
  appName: "ReciclApp",
  landing: {
    tagline: "Gestión de recogida y reciclaje para la República Dominicana",
    description:
      "Administra puntos de recogida, registra las pasadas semanales y visualiza el impacto del reciclaje.",
    signInWithGoogle: "Iniciar sesión con Google",
  },
  home: {
    title: "Inicio",
    welcome: "Bienvenido",
    role: "Rol",
    signOut: "Cerrar sesión",
    loading: "Cargando...",
    error: "No se pudo cargar tu información.",
  },
  roles: {
    read: "Lectura",
    write: "Escritura",
    admin: "Administrador",
  },
} as const;
