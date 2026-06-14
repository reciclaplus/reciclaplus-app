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
  nav: {
    home: "Inicio",
    newPdr: "Nuevo PDR",
    signOut: "Cerrar sesión",
    menu: "Menú",
  },
  common: {
    loading: "Cargando...",
    noAccess: "No tienes permiso para ver esta página.",
    save: "Guardar",
    saving: "Guardando...",
    required: "Este campo es obligatorio",
  },
  newPdr: {
    title: "Nuevo punto de recogida",
    name: "Nombre",
    description: "Descripción",
    community: "Comunidad",
    neighborhood: "Barrio",
    category: "Categoría",
    location: "Ubicación",
    locationHint: "Toca el mapa para marcar la ubicación del punto.",
    selectedCoords: "Coordenadas seleccionadas",
    noLocation: "Aún no has marcado una ubicación en el mapa.",
    create: "Crear PDR",
    creating: "Creando...",
    success: "Punto de recogida creado correctamente.",
    error: "No se pudo crear el punto de recogida.",
    loadError: "No se pudieron cargar las opciones del formulario.",
    mapKeyMissing: "Falta la clave de Google Maps.",
  },
} as const;
