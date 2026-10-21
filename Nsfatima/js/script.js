const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isLoginPage = currentPage === "index.html";
const isAuthenticated = sessionStorage.getItem("isAuthenticated") === "true";

const DEFAULT_INSTITUTION_LOGO_URL = "imagenes/fatima.svg";
let defaultInstitutionLogoDataUrl = "";

/**
 * Convierte el logo institucional SVG a un dataURL PNG para incrustarlo en los PDFs
 * (jsPDF.addImage requiere PNG/JPEG; SVG no es compatible).
 */
const preloadDefaultInstitutionLogo = () => {
  if (defaultInstitutionLogoDataUrl) return Promise.resolve(defaultInstitutionLogoDataUrl);
  return new Promise((resolve) => {
    if (typeof Image === "undefined" || typeof document === "undefined") {
      resolve("");
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const targetSize = 256;
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        defaultInstitutionLogoDataUrl = canvas.toDataURL("image/png");
        resolve(defaultInstitutionLogoDataUrl);
      } catch (error) {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = DEFAULT_INSTITUTION_LOGO_URL;
  });
};

preloadDefaultInstitutionLogo();

const getInstitutionLogoSrc = (settings) =>
  (settings && settings.logoDataUrl) || DEFAULT_INSTITUTION_LOGO_URL;

const getInstitutionLogoPdfDataUrl = (settings) =>
  (settings && settings.logoDataUrl) || defaultInstitutionLogoDataUrl || "";

const SYSTEM_DB_KEY = "nsfDocenteDB";
const SYSTEM_DB_VERSION = 3;
const SYSTEM_DB_BACKUP_HISTORY_KEY = "nsfDocenteDBBackupHistory";
const MAX_BACKUP_HISTORY = 10;
/** Capacidad mínima soportada por el sistema (validaciones e información al usuario). */
const SYSTEM_MIN_STUDENTS_CAPACITY = 50;

const FIRST_NAMES_POOL = [
  "Ana", "Luis", "María", "Carlos", "Sofía", "Diego", "Lucía", "Mateo", "Valentina", "Joaquín",
  "Camila", "Sebastián", "Renata", "Andrés", "Isabella", "Bruno", "Daniela", "Gabriel", "Fernanda", "Adrián",
  "Mariana", "Rodrigo", "Antonella", "Iván", "Ariana", "Pablo", "Romina", "Tomás", "Emilia", "Felipe",
  "Sara", "Hugo", "Paula", "Nicolás", "Bianca", "Esteban", "Jimena", "Álvaro", "Noelia", "Daniel",
  "Valeria", "Mario", "Karla", "Óscar", "Lorena", "Iker", "Adriana", "Manuel", "Helena", "Hernán"
];
const LAST_NAMES_POOL = [
  "Perez Ramos", "Gomez Salas", "Quispe Huamán", "Mamani Choque", "Vargas Torres", "Sánchez Ruiz",
  "Castro Núñez", "Flores Vega", "Rojas Cárdenas", "Huamán Quispe", "Salinas Mora", "Cárdenas Soto",
  "Ríos Aguilar", "Pacheco León", "Méndez Bustamante", "Cabrera Paredes", "Reyes Ortega", "Calderón Vera",
  "Soto Castillo", "Pizarro Rivera", "Morales Núñez", "Ortega Loayza", "Ramos Fuentes", "Bautista Ávila",
  "Cárdenas Ríos", "Yupanqui Inca", "Sosa Aliaga", "Aguirre Salcedo", "Béjar Cuya", "Acosta Tello",
  "Carrillo Espinoza", "Loayza Bravo", "Espinoza Vásquez", "Mendoza Aguilar", "Velarde Linares",
  "Carbajal Ríos", "Tello Quispe", "Camargo Anco", "Vilca Apaza", "Apaza Choquehuanca",
  "Ñaupari Auqui", "Linares Pajares", "Tipula Pinto", "Inca Roca", "Atauchi Yauri", "Ccahuana Quispe",
  "Llanos Pacheco", "Aliaga Salas", "Núñez Bocanegra", "Ñahui Conde"
];
const GRADES_POOL = ["1°", "2°", "3°", "4°", "5°", "6°"];
const SECTIONS_POOL = ["A", "B"];

const generateSeedStudents = (count = SYSTEM_MIN_STUDENTS_CAPACITY) => {
  const result = [];
  const usedDnis = new Set();
  for (let i = 0; i < count; i += 1) {
    let dni;
    do {
      dni = String(70000000 + Math.floor(Math.random() * 9999999)).padStart(8, "0").slice(0, 8);
    } while (usedDnis.has(dni));
    usedDnis.add(dni);
    const firstName = FIRST_NAMES_POOL[i % FIRST_NAMES_POOL.length];
    const lastName = LAST_NAMES_POOL[i % LAST_NAMES_POOL.length];
    const grade = GRADES_POOL[i % GRADES_POOL.length];
    const section = SECTIONS_POOL[Math.floor(i / GRADES_POOL.length) % SECTIONS_POOL.length];
    const ageOffset = 5 + Number(grade.replace("°", ""));
    const birthYear = new Date().getFullYear() - ageOffset;
    const birthMonth = String(((i * 7) % 12) + 1).padStart(2, "0");
    const birthDay = String(((i * 13) % 27) + 1).padStart(2, "0");
    result.push({
      dni,
      fullName: `${lastName} ${firstName}`,
      grade,
      section,
      birthDate: `${birthYear}-${birthMonth}-${birthDay}`
    });
  }
  result.sort((a, b) => a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" }));
  return result;
};

const buildEmptyDatabase = () => ({
  version: SYSTEM_DB_VERSION,
  students: [],
  schedules: [],
  attendanceRegistry: {},
  attendanceClosedMonths: [],
  incidents: [],
  gradesCnebBimesters: null,
  systemSettings: {},
  academicYears: [],
  teacherSignatureName: "",
  users: []
});

const buildSampleScheduleSeed = () => [
  { startTime: "08:00", endTime: "09:00", curricularArea: "Comunicación", grade: "1°", section: "A" },
  { startTime: "09:00", endTime: "10:00", curricularArea: "Matemática", grade: "1°", section: "A" },
  { startTime: "10:15", endTime: "11:15", curricularArea: "Personal Social", grade: "2°", section: "A" },
  { startTime: "11:15", endTime: "12:15", curricularArea: "Ciencia y Tecnología", grade: "3°", section: "A" },
  { startTime: "08:00", endTime: "09:00", curricularArea: "Arte y Cultura", grade: "4°", section: "B" },
  { startTime: "09:00", endTime: "10:00", curricularArea: "Educación Física", grade: "5°", section: "A" }
];

/**
 * Base de datos por defecto para una instalación limpia:
 * - Sin estudiantes (el docente los registra desde Estudiantes)
 * - Sin sesiones de horario (se registran desde Horario)
 * - Sin asistencia, incidencias ni calificaciones
 * - Solo se crea el año académico actual abierto, listo para usar
 *
 * Para cargar 50 estudiantes de ejemplo, el docente puede usar
 * "Cargar 50 estudiantes de muestra" en la página de Configuración.
 */
const buildDefaultDatabase = () => ({
  ...buildEmptyDatabase(),
  academicYears: [{ year: new Date().getFullYear(), status: "abierto" }]
});

const normalizeDatabase = (rawDb) => {
  const base = buildEmptyDatabase();
  if (!rawDb || typeof rawDb !== "object") return base;
  const studentsRaw = Array.isArray(rawDb.students) ? rawDb.students : base.students;
  return {
    ...base,
    ...rawDb,
    version: SYSTEM_DB_VERSION,
    students: studentsRaw.map((student) => ({
      dni: String(student?.dni ?? "").trim(),
      fullName: String(student?.fullName ?? "").trim(),
      grade: String(student?.grade ?? "").trim(),
      section: String(student?.section ?? "").trim(),
      birthDate: String(student?.birthDate ?? "").trim()
    })),
    schedules: Array.isArray(rawDb.schedules) ? rawDb.schedules : base.schedules,
    attendanceRegistry:
      rawDb.attendanceRegistry && typeof rawDb.attendanceRegistry === "object" ? rawDb.attendanceRegistry : {},
    attendanceClosedMonths: Array.isArray(rawDb.attendanceClosedMonths) ? rawDb.attendanceClosedMonths : [],
    incidents: Array.isArray(rawDb.incidents) ? rawDb.incidents : [],
    gradesCnebBimesters:
      rawDb.gradesCnebBimesters && typeof rawDb.gradesCnebBimesters === "object"
        ? rawDb.gradesCnebBimesters
        : null,
    systemSettings:
      rawDb.systemSettings && typeof rawDb.systemSettings === "object" ? rawDb.systemSettings : {},
    academicYears: Array.isArray(rawDb.academicYears) ? rawDb.academicYears : base.academicYears,
    teacherSignatureName:
      typeof rawDb.teacherSignatureName === "string" ? rawDb.teacherSignatureName : "",
    users: Array.isArray(rawDb.users)
      ? rawDb.users
          .filter((user) => user && typeof user === "object")
          .map((user) => ({
            username: String(user.username || "").trim().toLowerCase(),
            displayName: String(user.displayName || "").trim(),
            role: user.role === "admin" ? "admin" : "docente",
            salt: String(user.salt || ""),
            hash: String(user.hash || ""),
            createdAt: user.createdAt || new Date().toISOString()
          }))
          .filter((user) => user.username && user.hash && user.salt)
      : base.users
  };
};

/* ============================================================
 * CACHÉ EN MEMORIA DE LA BASE DE DATOS
 * ============================================================
 * Mantenemos una sola copia normalizada en memoria para evitar
 * que cada loadX/saveX cause un JSON.parse + normalize del store
 * completo. Esto acelera drásticamente la navegación (asistencia,
 * calificaciones, dashboard) y reduce el coste por interacción.
 *
 * Invalidación:
 *  - Tras cada writeDatabase() refrescamos la copia normalizada.
 *  - Si otra pestaña modifica el storage, escuchamos 'storage'
 *    y limpiamos la caché para releer al próximo acceso.
 */
let __dbCache = null;

const readDatabase = () => {
  if (__dbCache) return __dbCache;
  const raw = localStorage.getItem(SYSTEM_DB_KEY);
  if (!raw) {
    __dbCache = normalizeDatabase(null);
    return __dbCache;
  }
  try {
    __dbCache = normalizeDatabase(JSON.parse(raw));
  } catch (error) {
    __dbCache = normalizeDatabase(null);
  }
  return __dbCache;
};

/* Estado del autoguardado para feedback visual + manejo de errores. */
const __autosaveState = {
  pendingLegacyKeys: new Map(), // key -> JSON string
  flushHandle: null,
  lastError: null,
  listeners: new Set()
};

const notifyAutosaveStatus = (status, detail) => {
  __autosaveState.listeners.forEach((listener) => {
    try {
      listener(status, detail);
    } catch (error) {
      /* No bloquear si un listener falla. */
    }
  });
};

const subscribeAutosaveStatus = (listener) => {
  if (typeof listener === "function") __autosaveState.listeners.add(listener);
  return () => __autosaveState.listeners.delete(listener);
};

const handleStorageQuotaError = (error) => {
  __autosaveState.lastError = error;
  // Solo notificar una vez por sesión para no bombardear al usuario.
  if (!__autosaveState.quotaNotified) {
    __autosaveState.quotaNotified = true;
    // Diferimos para evitar TDZ si el error ocurre antes de definirse showToast.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          if (typeof showToast === "function") {
            showToast(
              "Sin espacio para guardar. Exporte un respaldo desde Configuración y libere registros antiguos.",
              { type: "error", duration: 8000 }
            );
          }
        } catch (e) {
          /* noop */
        }
      }, 0);
    }
  }
  notifyAutosaveStatus("error", error);
};

const writeDatabase = (db) => {
  const normalized = normalizeDatabase(db);
  try {
    localStorage.setItem(SYSTEM_DB_KEY, JSON.stringify(normalized));
    __dbCache = normalized;
    notifyAutosaveStatus("saved", { at: Date.now() });
  } catch (error) {
    if (error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)) {
      handleStorageQuotaError(error);
    } else {
      __autosaveState.lastError = error;
      notifyAutosaveStatus("error", error);
    }
    throw error;
  }
};

const updateDatabase = (updater) => {
  const current = readDatabase();
  const next = updater(current);
  writeDatabase(next);
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SYSTEM_DB_KEY) {
      // Otra pestaña escribió: invalidar caché para releer fresco al próximo acceso.
      __dbCache = null;
    }
  });
}

/* ============================================================
 * ESCRITURAS LEGACY DIFERIDAS
 * ============================================================
 * Para preservar compatibilidad con código que aún lee de las
 * claves antiguas (studentsRegistry, attendanceRegistry, etc.),
 * mantenemos el espejo, pero diferimos las escrituras al tiempo
 * de inactividad del navegador. Esto evita un setItem extra en
 * cada clic del usuario (asistencia, calificaciones) y mantiene
 * la consistencia eventual.
 */
const scheduleLegacyMirror = (key, value) => {
  if (!key) return;
  __autosaveState.pendingLegacyKeys.set(key, value);
  if (__autosaveState.flushHandle !== null) return;
  const flush = () => {
    __autosaveState.flushHandle = null;
    const pending = __autosaveState.pendingLegacyKeys;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    for (const [k, v] of entries) {
      try {
        if (typeof v === "string") {
          localStorage.setItem(k, v);
        } else if (v === null || v === undefined) {
          localStorage.removeItem(k);
        } else {
          localStorage.setItem(k, JSON.stringify(v));
        }
      } catch (error) {
        if (error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)) {
          handleStorageQuotaError(error);
          break;
        }
      }
    }
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    __autosaveState.flushHandle = window.requestIdleCallback(flush, { timeout: 800 });
  } else {
    __autosaveState.flushHandle = window.setTimeout(flush, 80);
  }
};

const flushLegacyMirrorNow = () => {
  if (__autosaveState.flushHandle === null) return;
  if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    try { window.cancelIdleCallback(__autosaveState.flushHandle); } catch (e) { /* noop */ }
  } else {
    try { window.clearTimeout(__autosaveState.flushHandle); } catch (e) { /* noop */ }
  }
  __autosaveState.flushHandle = null;
  const pending = __autosaveState.pendingLegacyKeys;
  if (pending.size === 0) return;
  const entries = Array.from(pending.entries());
  pending.clear();
  for (const [k, v] of entries) {
    try {
      if (typeof v === "string") {
        localStorage.setItem(k, v);
      } else if (v === null || v === undefined) {
        localStorage.removeItem(k);
      } else {
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (error) {
      /* En el flush final ignoramos errores no fatales. */
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushLegacyMirrorNow);
  window.addEventListener("pagehide", flushLegacyMirrorNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushLegacyMirrorNow();
  });
}

const getDbValue = (key, fallback) => {
  const db = readDatabase();
  const value = db[key];
  return value === undefined ? fallback : value;
};

const setDbValue = (key, value) => {
  updateDatabase((db) => ({
    ...db,
    [key]: value
  }));
};

const isValidDniFormat = (raw) => /^\d{8}$/.test(String(raw ?? "").trim());

const isDniUniqueAmong = (raw, students, excludeIndex = -1) => {
  const dni = String(raw ?? "").trim();
  if (!Array.isArray(students)) return true;
  return !students.some((student, idx) => idx !== excludeIndex && String(student.dni).trim() === dni);
};

const getTodayDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateEs = (value) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
};

const AUTH_SESSION_FLAG = "isAuthenticated";
const AUTH_SESSION_USER = "currentUserUsername";
const AUTH_SESSION_DISPLAY = "currentUserDisplayName";
const AUTH_SESSION_ROLE = "currentUserRole";
const AUTH_LAST_ACTIVITY_KEY = "lastActivityAt";
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
const INACTIVITY_WARNING_MS = 2 * 60 * 1000;

const generateSaltHex = (byteLength = 16) => {
  const bytes = new Uint8Array(byteLength);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const isSubtleCryptoAvailable = () => {
  const subtle = typeof window !== "undefined" && window.crypto && window.crypto.subtle;
  return !!(subtle && typeof subtle.digest === "function");
};

const computeFallbackHash = (message) => {
  // Hash determinista (FNV-1a 32 bits con cuatro rondas para 32 hex chars).
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < message.length; i += 1) {
    const c = message.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, "0");
  const part4 = ((Math.imul(h1, h2)) >>> 0).toString(16).padStart(8, "0");
  return `fb${part1}${part2}${part3}${part4}`;
};

const hashPasswordWithSalt = async (saltHex, password, options = {}) => {
  const message = `${saltHex}::${String(password)}`;
  const algo = options.algo;
  if (algo === "fallback") return computeFallbackHash(message);
  if (isSubtleCryptoAvailable()) {
    try {
      const encoded = new TextEncoder().encode(message);
      const buffer = await window.crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      /* Fallback si por alguna razón el digest falla en runtime. */
    }
  }
  return computeFallbackHash(message);
};

const detectHashAlgo = (hash) =>
  typeof hash === "string" && hash.startsWith("fb") && hash.length <= 40 ? "fallback" : "sha256";

const loadUsers = () => {
  const fromDb = getDbValue("users", []);
  return Array.isArray(fromDb) ? fromDb : [];
};

const saveUsers = (users) => {
  const normalized = Array.isArray(users) ? users : [];
  setDbValue("users", normalized);
};

const findUserByUsername = (username) => {
  const target = String(username || "").trim().toLowerCase();
  if (!target) return null;
  return loadUsers().find((user) => user.username === target) || null;
};

const validateUsernameFormat = (raw) => /^[a-zA-Z0-9._-]{3,24}$/.test(String(raw || "").trim());

const validatePasswordFormat = (raw) => String(raw || "").length >= 6;

const registerUser = async ({ username, displayName, password, role }) => {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanDisplay = String(displayName || "").trim().replace(/\s+/g, " ");
  if (!validateUsernameFormat(cleanUsername)) {
    return { ok: false, error: "El usuario debe tener entre 3 y 24 caracteres (letras, números, . _ -)." };
  }
  if (!cleanDisplay || cleanDisplay.length < 3) {
    return { ok: false, error: "Ingrese el nombre y apellidos completos del usuario." };
  }
  if (!validatePasswordFormat(password)) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  const users = loadUsers();
  if (users.some((user) => user.username === cleanUsername)) {
    return { ok: false, error: "Ese nombre de usuario ya está registrado. Use otro o inicie sesión." };
  }
  const salt = generateSaltHex(16);
  const hash = await hashPasswordWithSalt(salt, password);
  const algo = detectHashAlgo(hash);
  const effectiveRole = role === "admin" || users.length === 0 ? "admin" : "docente";
  const newUser = {
    username: cleanUsername,
    displayName: cleanDisplay,
    role: effectiveRole,
    salt,
    hash,
    algo,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers(users);
  return { ok: true, user: newUser };
};

const authenticateUser = async (username, password) => {
  const user = findUserByUsername(username);
  if (!user) return { ok: false, error: "Usuario no encontrado. Verifique los datos o regístrese." };
  const storedAlgo = user.algo || detectHashAlgo(user.hash);
  /* Si la cuenta se registró con SHA-256 pero el contexto actual no lo soporta, avisamos sin permitir un login con hash distinto. */
  if (storedAlgo === "sha256" && !isSubtleCryptoAvailable()) {
    return {
      ok: false,
      error:
        "Esta cuenta requiere un contexto seguro (HTTPS o localhost) para verificar la contraseña. Abra el sistema mediante https:// o localhost."
    };
  }
  const candidate = await hashPasswordWithSalt(user.salt, password, { algo: storedAlgo });
  if (candidate !== user.hash) {
    return { ok: false, error: "Contraseña incorrecta." };
  }
  return { ok: true, user };
};

const beginAuthenticatedSession = (user) => {
  sessionStorage.setItem(AUTH_SESSION_FLAG, "true");
  sessionStorage.setItem(AUTH_SESSION_USER, user.username);
  sessionStorage.setItem(AUTH_SESSION_DISPLAY, user.displayName || user.username);
  sessionStorage.setItem(AUTH_SESSION_ROLE, user.role || "docente");
  sessionStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(Date.now()));
};

const endAuthenticatedSession = ({ reason = "manual" } = {}) => {
  /*
   * Solo creamos un punto de restauración automático en logouts manuales explícitos.
   * Los logouts por inactividad antes saturaban el historial (cap = 10) y desplazaban
   * los puntos manuales del usuario antes de operaciones destructivas.
   */
  if (reason === "manual") {
    try {
      if (typeof createRestorePoint === "function") {
        createRestorePoint("auto:logout-manual");
      }
    } catch (error) {
      // Ignorar si todavía no hay base de datos lista.
    }
  }
  sessionStorage.removeItem(AUTH_SESSION_FLAG);
  sessionStorage.removeItem(AUTH_SESSION_USER);
  sessionStorage.removeItem(AUTH_SESSION_DISPLAY);
  sessionStorage.removeItem(AUTH_SESSION_ROLE);
  sessionStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
};

const getCurrentUserInfo = () => ({
  username: sessionStorage.getItem(AUTH_SESSION_USER) || "",
  displayName: sessionStorage.getItem(AUTH_SESSION_DISPLAY) || "",
  role: sessionStorage.getItem(AUTH_SESSION_ROLE) || ""
});

const syncLegacyStorageToDatabase = () => {
  const rawDbString = localStorage.getItem(SYSTEM_DB_KEY);
  const dbExisted = Boolean(rawDbString);
  // Leemos la versión real persistida ANTES de normalizar (que sobrescribe el campo version).
  let previousVersion = 0;
  try {
    const parsed = rawDbString ? JSON.parse(rawDbString) : null;
    previousVersion = Number(parsed && parsed.version) || 0;
  } catch (error) {
    previousVersion = 0;
  }
  const db = readDatabase();
  const migrated = { ...db };

  const migrateKey = (legacyKey, dbKey, parser, shouldMigrate) => {
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    if (!shouldMigrate(migrated[dbKey])) return;
    try {
      const parsed = parser(raw);
      migrated[dbKey] = parsed;
    } catch (error) {
      // Ignorar datos legacy corruptos para no romper la carga.
    }
  };

  migrateKey("studentsRegistry", "students", JSON.parse, (v) => !Array.isArray(v) || v.length === 0);
  migrateKey("schedulesRegistry", "schedules", JSON.parse, (v) => !Array.isArray(v) || v.length === 0);
  migrateKey("attendanceRegistry", "attendanceRegistry", JSON.parse, (v) => !v || Object.keys(v).length === 0);
  migrateKey(
    "attendanceClosedMonths",
    "attendanceClosedMonths",
    JSON.parse,
    (v) => !Array.isArray(v) || v.length === 0
  );
  migrateKey("incidentsRegistry", "incidents", JSON.parse, (v) => !Array.isArray(v) || v.length === 0);
  migrateKey("gradesCnebBimesters", "gradesCnebBimesters", JSON.parse, (v) => !v || typeof v !== "object");
  migrateKey("systemSettings", "systemSettings", JSON.parse, (v) => !v || Object.keys(v).length === 0);
  migrateKey("academicYearsRegistry", "academicYears", JSON.parse, (v) => !Array.isArray(v) || v.length === 0);

  const teacherNameLegacy = localStorage.getItem("teacherSignatureName");
  if (teacherNameLegacy && !migrated.teacherSignatureName) {
    migrated.teacherSignatureName = teacherNameLegacy;
  }

  // El sistema arranca en cero: solo se asegura un año académico abierto para que el
  // docente pueda empezar a registrar estudiantes y calificaciones sin pasos extra.
  if (!Array.isArray(migrated.academicYears) || migrated.academicYears.length === 0) {
    migrated.academicYears = [{ year: new Date().getFullYear(), status: "abierto" }];
  }

  /**
   * Migración v2 → v3:
   * Versiones anteriores creaban automáticamente 50 estudiantes y 6 sesiones de horario
   * de muestra al primer arranque. Si la instalación aún no fue personalizada (no hay
   * usuarios registrados y la IE no tiene nombre configurado), eliminamos esos datos
   * de muestra para que el docente parta desde cero. Si ya hay actividad real, se
   * respetan los datos del usuario.
   */
  if (previousVersion < 3) {
    const hasRealUsers = Array.isArray(migrated.users) && migrated.users.length > 0;
    const hasConfiguredInstitution =
      migrated.systemSettings &&
      (migrated.systemSettings.institutionName || migrated.systemSettings.directorName);
    if (!hasRealUsers && !hasConfiguredInstitution) {
      migrated.students = [];
      migrated.schedules = [];
      migrated.incidents = [];
      migrated.attendanceRegistry = {};
      migrated.attendanceClosedMonths = [];
      migrated.gradesCnebBimesters = null;
      // Limpiamos también las claves legacy duplicadas para evitar que reaparezcan.
      [
        "studentsRegistry",
        "schedulesRegistry",
        "attendanceRegistry",
        "attendanceClosedMonths",
        "incidentsRegistry",
        "gradesCnebBimesters"
      ].forEach((k) => localStorage.removeItem(k));
    }
  }

  writeDatabase(migrated);
};

syncLegacyStorageToDatabase();

const loadBackupHistory = () => {
  const raw = localStorage.getItem(SYSTEM_DB_BACKUP_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveBackupHistory = (history) => {
  const normalized = Array.isArray(history) ? history.slice(0, MAX_BACKUP_HISTORY) : [];
  localStorage.setItem(SYSTEM_DB_BACKUP_HISTORY_KEY, JSON.stringify(normalized));
};

const createRestorePoint = (reason = "manual") => {
  const db = readDatabase();
  const history = loadBackupHistory();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason,
    data: db
  };
  history.unshift(entry);
  saveBackupHistory(history);
};

const restoreFromHistoryEntry = (entry) => {
  if (!entry || !entry.data || typeof entry.data !== "object") return false;
  const normalized = normalizeDatabase(entry.data);
  writeDatabase(normalized);
  localStorage.setItem("studentsRegistry", JSON.stringify(normalized.students));
  localStorage.setItem("schedulesRegistry", JSON.stringify(normalized.schedules));
  localStorage.setItem("attendanceRegistry", JSON.stringify(normalized.attendanceRegistry));
  localStorage.setItem("attendanceClosedMonths", JSON.stringify(normalized.attendanceClosedMonths));
  localStorage.setItem("incidentsRegistry", JSON.stringify(normalized.incidents));
  localStorage.setItem("gradesCnebBimesters", JSON.stringify(normalized.gradesCnebBimesters || {}));
  localStorage.setItem("systemSettings", JSON.stringify(normalized.systemSettings));
  localStorage.setItem("academicYearsRegistry", JSON.stringify(normalized.academicYears));
  localStorage.setItem("teacherSignatureName", normalized.teacherSignatureName || "");
  return true;
};

if (!isLoginPage && !isAuthenticated) {
  window.location.href = "index.html";
}

if (isLoginPage && isAuthenticated) {
  window.location.href = "principal.html";
}

document.querySelectorAll(".menu-item").forEach((item) => {
  const target = item.getAttribute("href");
  const isActive = target === currentPage;
  item.classList.toggle("active", isActive);
  if (isActive) {
    item.setAttribute("aria-current", "page");
  } else {
    item.removeAttribute("aria-current");
  }
});

const studentsStorageKey = "studentsRegistry";

const loadStudents = () => {
  const fromDb = getDbValue("students", []);
  if (Array.isArray(fromDb) && fromDb.length) return [...fromDb];
  const rawLegacy = localStorage.getItem(studentsStorageKey);
  if (!rawLegacy) return [];
  try {
    const parsed = JSON.parse(rawLegacy);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveStudents = (students) => {
  setDbValue("students", students);
  scheduleLegacyMirror(studentsStorageKey, students);
};

const systemSettingsStorageKey = "systemSettings";
const academicYearsStorageKey = "academicYearsRegistry";

const loadSystemSettings = () => {
  const fromDb = getDbValue("systemSettings", {});
  if (fromDb && typeof fromDb === "object" && Object.keys(fromDb).length) return fromDb;
  const rawLegacy = localStorage.getItem(systemSettingsStorageKey);
  if (!rawLegacy) return {};
  try {
    const parsed = JSON.parse(rawLegacy);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

const loadAcademicYearsRegistry = () => {
  const fromDb = getDbValue("academicYears", []);
  if (Array.isArray(fromDb) && fromDb.length) return fromDb;
  const rawLegacy = localStorage.getItem(academicYearsStorageKey);
  if (!rawLegacy) return [];
  try {
    const parsed = JSON.parse(rawLegacy);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const ensureToastStack = () => {
  let stack = document.getElementById("appToastStack");
  if (stack) return stack;
  stack = document.createElement("div");
  stack.id = "appToastStack";
  stack.className = "toast-stack";
  stack.setAttribute("role", "status");
  stack.setAttribute("aria-live", "polite");
  document.body.appendChild(stack);
  return stack;
};

const TOAST_ICONS = {
  success: "fa-circle-check",
  error: "fa-circle-xmark",
  warning: "fa-triangle-exclamation",
  info: "fa-circle-info"
};

const showToast = (message, options = {}) => {
  const { type = "info", duration = 4500 } = options;
  if (typeof document === "undefined" || !document.body) return;
  const stack = ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  const iconClass = TOAST_ICONS[type] || TOAST_ICONS.info;
  toast.innerHTML = `
    <span class="toast-icon"><i class="fa-solid ${iconClass}"></i></span>
    <p class="toast-message">${escapeHtml(message)}</p>
    <button type="button" class="toast-close" aria-label="Cerrar notificación"><i class="fa-solid fa-xmark"></i></button>
  `;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  const dismiss = () => {
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 280);
  };
  toast.querySelector(".toast-close")?.addEventListener("click", dismiss);
  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }
  return dismiss;
};

window.showToast = showToast;

const enhanceTopbarActionButton = (button) => {
  if (!button || button.dataset.adaptiveReady === "true") return;
  const icon = button.querySelector("i");
  const rawText = button.textContent.replace(/\s+/g, " ").trim();
  if (!icon || !rawText) {
    button.dataset.adaptiveReady = "true";
    return;
  }
  const labelText = rawText;
  button.innerHTML = "";
  button.appendChild(icon);
  const labelSpan = document.createElement("span");
  labelSpan.className = "btn-label";
  labelSpan.textContent = labelText;
  button.appendChild(labelSpan);
  if (!button.getAttribute("title")) button.setAttribute("title", labelText);
  if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", labelText);
  button.dataset.adaptiveReady = "true";
};

const applyAdaptiveTopbarButtons = () => {
  document
    .querySelectorAll(".topbar .topbar-actions > .btn-primary, .topbar .topbar-actions > .btn-danger")
    .forEach((btn) => {
      btn.dataset.iconOnlyMobile = "true";
      enhanceTopbarActionButton(btn);
    });
};

const applyDynamicSystemConfiguration = () => {
  if (isLoginPage) return;
  const settings = loadSystemSettings();
  const academicYears = loadAcademicYearsRegistry();
  const openYear = academicYears.find((item) => item.status === "abierto");

  const topbarTitle = document.querySelector(".topbar h2");
  const topbarSubtitle = document.querySelector(".topbar p");
  if (topbarTitle && settings.institutionName) {
    topbarTitle.textContent = settings.institutionName;
  }
  if (topbarSubtitle) {
    const subtitleParts = [
      openYear ? `Año académico ${openYear.year}` : "",
      settings.ieAddress || "",
      settings.directorName ? `Director(a): ${settings.directorName}` : ""
    ].filter(Boolean);
    if (subtitleParts.length) {
      topbarSubtitle.textContent = subtitleParts.join(" | ");
    }
  }

  const topbarHeaderBlock = document.querySelector(".topbar > div:first-child");
  if (topbarHeaderBlock) {
    let logo = document.getElementById("topbarInstitutionLogo");
    if (!logo) {
      logo = document.createElement("img");
      logo.id = "topbarInstitutionLogo";
      logo.alt = "Logo de la institución";
      logo.decoding = "async";
      logo.loading = "eager";
      logo.onerror = () => {
        /* Si el logo subido por el usuario no se puede cargar, volvemos al SVG por defecto. */
        if (logo.dataset.fallbackApplied !== "true") {
          logo.dataset.fallbackApplied = "true";
          logo.src = DEFAULT_INSTITUTION_LOGO_URL;
        } else {
          logo.style.display = "none";
        }
      };
      topbarHeaderBlock.prepend(logo);
    }
    logo.src = getInstitutionLogoSrc(settings);
  }

  const topbarActions = document.querySelector(".topbar .topbar-actions");
  const currentUser = getCurrentUserInfo();
  if (topbarActions && currentUser.displayName) {
    let badge = document.getElementById("topbarUserBadge");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "topbarUserBadge";
      badge.className = "topbar-user-badge";
      badge.setAttribute("title", `${currentUser.displayName} (${currentUser.username})`);
      topbarActions.prepend(badge);
    }
    const roleLabel = currentUser.role === "admin" ? "Administrador" : "Docente";
    badge.innerHTML = `<i class="fa-solid fa-user-shield" aria-hidden="true"></i><span class="topbar-user-text"><strong>${escapeHtml(currentUser.displayName)}</strong><small>${roleLabel} · ${escapeHtml(currentUser.username)}</small></span>`;
  }

  applyAdaptiveTopbarButtons();

  /* Indicador de autoguardado: feedback discreto cada vez que el sistema persiste cambios. */
  if (topbarActions) {
    let saveIndicator = document.getElementById("topbarAutosaveIndicator");
    if (!saveIndicator) {
      saveIndicator = document.createElement("span");
      saveIndicator.id = "topbarAutosaveIndicator";
      saveIndicator.className = "topbar-autosave";
      saveIndicator.setAttribute("aria-live", "polite");
      saveIndicator.setAttribute("role", "status");
      saveIndicator.innerHTML = '<i class="fa-solid fa-cloud-check" aria-hidden="true"></i><span class="topbar-autosave-text">Listo</span>';
      saveIndicator.title = "Estado de guardado automático";
      topbarActions.prepend(saveIndicator);
    }
    const textEl = saveIndicator.querySelector(".topbar-autosave-text");
    let flashTimer = null;
    subscribeAutosaveStatus((status, detail) => {
      if (!textEl) return;
      if (status === "saved") {
        const d = new Date(detail?.at || Date.now());
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        textEl.textContent = `Guardado ${hh}:${mm}`;
        saveIndicator.classList.remove("is-error");
        saveIndicator.classList.add("is-flash");
        if (flashTimer) window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => saveIndicator.classList.remove("is-flash"), 900);
      } else if (status === "error") {
        textEl.textContent = "Error al guardar";
        saveIndicator.classList.add("is-error");
      }
    });
  }

  const content = document.querySelector("main.content");
  if (!content) return;
  const existingPanel = document.getElementById("systemContextPanel");
  if (existingPanel) existingPanel.remove();

  const contextPanel = document.createElement("div");
  contextPanel.id = "systemContextPanel";
  contextPanel.className = "system-context-panel";
  const activeYearLabel = openYear ? String(openYear.year) : "Sin año abierto";
  const teacherName = settings.teacherName || localStorage.getItem("teacherSignatureName") || "No configurado";
  contextPanel.innerHTML = `
    <p><strong>IE:</strong> ${escapeHtml(settings.institutionName || "No configurado")} <span class="dot-sep">·</span> <strong>Dirección:</strong> ${escapeHtml(settings.ieAddress || "No configurada")}</p>
    <p><strong>Docente:</strong> ${escapeHtml(teacherName)} <span class="dot-sep">·</span> <strong>Director(a):</strong> ${escapeHtml(settings.directorName || "No configurado")} <span class="dot-sep">·</span> <strong>Año académico:</strong> ${escapeHtml(activeYearLabel)}</p>
  `;
  content.prepend(contextPanel);
};

applyDynamicSystemConfiguration();

const setupConnectivityIndicator = () => {
  if (isLoginPage) return;
  if (typeof document === "undefined") return;
  document.body.classList.toggle("is-offline", !navigator.onLine);
  window.addEventListener("online", () => {
    if (document.body.classList.contains("is-offline")) {
      showToast("Conexión a internet restablecida.", { type: "success", duration: 2500 });
    }
    document.body.classList.remove("is-offline");
  });
  window.addEventListener("offline", () => {
    document.body.classList.add("is-offline");
    showToast("Sin conexión a internet. El sistema sigue operativo en modo local.", {
      type: "warning",
      duration: 4000
    });
  });
};

setupConnectivityIndicator();

const setupGlobalKeyboardShortcuts = () => {
  if (isLoginPage) return;
  document.addEventListener("keydown", (event) => {
    const isCtrl = event.ctrlKey || event.metaKey;
    if (!isCtrl) return;
    const key = event.key.toLowerCase();
    if (key === "k") {
      const search = document.querySelector(".search-input");
      if (search instanceof HTMLInputElement) {
        event.preventDefault();
        search.focus();
        search.select();
      }
    }
    if (key === "s") {
      const activeForm = document.activeElement?.closest("form");
      if (activeForm) {
        event.preventDefault();
        if (typeof activeForm.requestSubmit === "function") {
          activeForm.requestSubmit();
        } else {
          activeForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
    }
  });
};

setupGlobalKeyboardShortcuts();

const PDF_BRAND = {
  primary: [29, 78, 216],
  primaryDark: [30, 64, 175],
  accent: [14, 165, 164],
  success: [22, 163, 74],
  warning: [202, 138, 4],
  danger: [220, 38, 38],
  textDark: [15, 23, 42],
  textMuted: [100, 116, 139],
  border: [203, 213, 225],
  zebra: [245, 248, 252],
  headerFill: [232, 240, 254]
};

const getTeacherSignatureName = () => {
  const settings = loadSystemSettings();
  return (
    (settings.teacherName || "").trim() ||
    (localStorage.getItem("teacherSignatureName") || "").trim()
  );
};

/* ============================================================
   Firma digital (manuscrita) + Sello de validación
   ============================================================ */

const getTeacherSignatureImage = () => {
  const settings = loadSystemSettings();
  return (settings.teacherSignatureImage || "").trim() || "";
};

const getDirectorSignatureImage = () => {
  const settings = loadSystemSettings();
  return (settings.directorSignatureImage || "").trim() || "";
};

const setupSignaturePad = (canvas, options = {}) => {
  if (!canvas || !canvas.getContext) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(rect.width || 0, options.minWidth || 280);
    const targetH = Math.max(rect.height || 0, options.height || 140);
    canvas.width = Math.round(targetW * dpr);
    canvas.height = Math.round(targetH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = options.color || "#0f172a";
  };
  resizeCanvas();

  let isDrawing = false;
  let hasDrawn = false;
  let resizeRaf = 0;

  const getPos = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (event.touches && event.touches[0]) {
      const t = event.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    hasDrawn = true;
  };

  const move = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath();
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  canvas.addEventListener("touchcancel", end);

  window.addEventListener("resize", () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const before = canvas.toDataURL("image/png");
      resizeCanvas();
      if (hasDrawn) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        img.src = before;
      }
    });
  });

  const clear = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
  };

  const isEmpty = () => !hasDrawn;

  const toDataUrl = () => {
    if (!hasDrawn) return "";
    // Recortamos los píxeles transparentes para una firma compacta
    const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const idx = (y * canvas.width + x) * 4 + 3;
        if (fullData[idx] !== 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (!found) return "";
    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.width, maxX + pad);
    maxY = Math.min(canvas.height, maxY + pad);
    const cropW = maxX - minX;
    const cropH = maxY - minY;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    return tempCanvas.toDataURL("image/png");
  };

  const loadDataUrl = (url) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      clear();
      const cssW = canvas.width / (window.devicePixelRatio || 1);
      const cssH = canvas.height / (window.devicePixelRatio || 1);
      const ratio = Math.min(cssW / img.width, cssH / img.height, 1);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const dx = (cssW - drawW) / 2;
      const dy = (cssH - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      hasDrawn = true;
    };
    img.src = url;
  };

  return { clear, isEmpty, toDataUrl, loadDataUrl };
};

/* Carga diferida de la librería QRCode para no afectar el arranque del sistema. */
const loadQrCodeLibrary = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("No DOM"));
  if (window.QRCode && typeof window.QRCode.toDataURL === "function") {
    return Promise.resolve(window.QRCode);
  }
  if (window.__qrLoadingPromise) return window.__qrLoadingPromise;
  window.__qrLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lib="qrcode"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.QRCode));
      existing.addEventListener("error", () => reject(new Error("QRCode CDN error")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
    script.async = true;
    script.dataset.lib = "qrcode";
    script.onload = () => {
      if (window.QRCode && typeof window.QRCode.toDataURL === "function") {
        resolve(window.QRCode);
      } else {
        reject(new Error("QRCode library missing toDataURL"));
      }
    };
    script.onerror = () => reject(new Error("No se pudo cargar la librería de QR"));
    document.head.appendChild(script);
  });
  return window.__qrLoadingPromise;
};

const generateQrDataUrl = async (text, options = {}) => {
  try {
    const QR = await loadQrCodeLibrary();
    return await QR.toDataURL(String(text || ""), {
      width: options.width || 260,
      margin: options.margin == null ? 1 : options.margin,
      errorCorrectionLevel: options.errorCorrectionLevel || "M",
      color: {
        dark: options.dark || "#0f172a",
        light: options.light || "#ffffff"
      }
    });
  } catch (error) {
    return "";
  }
};

/* Pre-cargamos la librería de QR si la página dispone de jsPDF para que el primer reporte se emita sin demoras. */
if (typeof window !== "undefined" && window.jspdf) {
  loadQrCodeLibrary().catch(() => {
    /* Sin conexión: el sello se imprimirá sin QR; el sistema sigue funcionando. */
  });
}

/* Registro del Service Worker para soporte offline + instalación como PWA.
 * Se omite el registro cuando el sistema se abre vía file:// porque los service workers
 * requieren un origen HTTP(S). */
if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  window.location.protocol !== "file:"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch(() => {
        /* Sin SW se sigue trabajando online; no es bloqueante. */
      });
  });
}

/**
 * Envuelve un handler async de exportación para deshabilitar el botón mientras se genera el reporte,
 * mostrar un spinner y prevenir doble clic / colisiones.
 */
const withExportLoadingState = (button, handler) => {
  if (!button) return handler;
  return async (...args) => {
    if (button.disabled) return;
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Generando…</span>';
    try {
      return await handler(...args);
    } catch (error) {
      if (typeof showToast === "function") {
        showToast(`No se pudo generar el reporte: ${error?.message || error}`, {
          type: "error",
          duration: 5000
        });
      }
      throw error;
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
      button.innerHTML = originalHtml;
    }
  };
};

const ISSUED_SEALS_KEY = "issuedSealsRegistry";
const ISSUED_SEALS_MAX = 250;

const loadIssuedSeals = () => {
  const fromDb = getDbValue(ISSUED_SEALS_KEY, []);
  return Array.isArray(fromDb) ? fromDb : [];
};

const persistIssuedSeal = (record) => {
  try {
    const seals = loadIssuedSeals();
    seals.unshift(record);
    const trimmed = seals.slice(0, ISSUED_SEALS_MAX);
    setDbValue(ISSUED_SEALS_KEY, trimmed);
  } catch (error) {
    /* En caso de cuota llena en localStorage, seguimos sin bloquear la emisión del PDF. */
  }
};

/* Sello criptográfico determinista para validar reportes (no es PKI eIDAS, es trazabilidad institucional). */
const generateDocumentSeal = async (reportTitle, extraPayload = "") => {
  const settings = loadSystemSettings();
  const timestamp = new Date().toISOString();
  const teacher = (settings.teacherName || "").trim() || "(sin docente)";
  const institution = (settings.institutionName || "").trim() || "(sin IE)";
  const director = (settings.directorName || "").trim() || "(sin director)";
  const openYear =
    (loadAcademicYearsRegistry().find((y) => y.status === "abierto") || {}).year || "—";
  const payload = `${institution}|${teacher}|${director}|${openYear}|${reportTitle}|${extraPayload}|${timestamp}`;
  let hash;
  try {
    hash = await hashPasswordWithSalt("nsf-doc-seal-2026", payload);
  } catch (error) {
    let acc = 0x811c9dc5;
    for (let i = 0; i < payload.length; i += 1) {
      acc = Math.imul(acc ^ payload.charCodeAt(i), 0x01000193);
    }
    hash = (acc >>> 0).toString(16).padStart(8, "0").repeat(8);
  }
  const idSource = hash.replace(/[^0-9a-f]/gi, "").slice(0, 16).toUpperCase();
  const groups = idSource.match(/.{1,4}/g) || [idSource];
  const id = `NSF-${groups.join("-")}`;
  const qrPayload = [
    "NSF-SISTEMA-DOCENTE",
    `ID:${id}`,
    `IE:${institution}`,
    `DOC:${teacher}`,
    `DIR:${director}`,
    `ANIO:${openYear}`,
    `REP:${reportTitle}`,
    `TS:${timestamp}`,
    `H:${hash.slice(0, 32)}`
  ].join("\n");
  const qrDataUrl = await generateQrDataUrl(qrPayload, { width: 240, margin: 1 });
  /* Guardamos el sello para que la sección "Verificar autenticidad" pueda comprobarlo realmente. */
  persistIssuedSeal({
    id,
    hash,
    timestamp,
    reportTitle,
    extraPayload,
    teacher,
    director,
    institution,
    academicYear: openYear,
    payload
  });
  return { id, hash, timestamp, payload, teacher, director, institution, qrDataUrl };
};

/**
 * Verifica si un código de validación corresponde a un sello realmente emitido por este sistema
 * y reproduce el hash con los datos almacenados para confirmar integridad.
 */
const verifyDocumentSeal = async (code) => {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^NSF-([0-9A-F]{4}-){3}[0-9A-F]{4}$/.test(normalized)) {
    return { status: "format-invalid" };
  }
  const seals = loadIssuedSeals();
  const record = seals.find((s) => s.id === normalized);
  if (!record) {
    return { status: "not-found", code: normalized };
  }
  let recomputed;
  try {
    recomputed = await hashPasswordWithSalt("nsf-doc-seal-2026", record.payload || "");
  } catch (error) {
    recomputed = null;
  }
  const tampered = recomputed && recomputed !== record.hash;
  return {
    status: tampered ? "tampered" : "valid",
    record,
    recomputed
  };
};

const drawPdfValidationSeal = (doc, seal) => {
  if (!seal) return;
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page !== pageCount) continue; // Sello visible solo en la última página
    const boxW = 102;
    const boxH = 34;
    const boxX = pageWidth - 12 - boxW;
    const boxY = pageHeight - 18 - boxH;
    const qrSize = 26;

    doc.setFillColor(...PDF_BRAND.zebra);
    doc.setDrawColor(...PDF_BRAND.primary);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2.5, 2.5, "FD");

    // Cabecera azul del sello
    doc.setFillColor(...PDF_BRAND.primary);
    doc.roundedRect(boxX, boxY, boxW, 6, 2.5, 2.5, "F");
    doc.rect(boxX, boxY + 3, boxW, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(255, 255, 255);
    doc.text("SELLO DIGITAL DE VALIDACIÓN", boxX + boxW / 2, boxY + 4.2, { align: "center" });

    // QR a la izquierda
    const qrX = boxX + 3;
    const qrY = boxY + 7;
    if (seal.qrDataUrl) {
      try {
        doc.addImage(seal.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      } catch (error) {
        /* Si no se pudo incrustar el QR, mostramos un marcador. */
        doc.setDrawColor(...PDF_BRAND.border);
        doc.rect(qrX, qrY, qrSize, qrSize);
        doc.setFontSize(6);
        doc.setTextColor(...PDF_BRAND.textMuted);
        doc.text("QR no disponible", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center" });
      }
    } else {
      doc.setDrawColor(...PDF_BRAND.border);
      doc.rect(qrX, qrY, qrSize, qrSize);
      doc.setFontSize(6);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text("QR", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center", baseline: "middle" });
    }
    doc.setFontSize(5.6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text("Escanee para verificar", qrX + qrSize / 2, qrY + qrSize + 2.2, { align: "center" });

    // Texto a la derecha
    const txtX = qrX + qrSize + 4;
    let cursorY = boxY + 10.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF_BRAND.primaryDark);
    doc.text("Código de validación", txtX, cursorY);
    cursorY += 3.6;
    doc.setFontSize(8.4);
    doc.setTextColor(...PDF_BRAND.textDark);
    doc.text(seal.id, txtX, cursorY);
    cursorY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    const fechaCorta = new Date(seal.timestamp).toLocaleString("es-PE");
    doc.text(`Emitido: ${fechaCorta}`, txtX, cursorY);
    cursorY += 3.2;
    doc.text(`IE: ${(seal.institution || "").slice(0, 42)}`, txtX, cursorY);
    cursorY += 3.2;
    doc.text(`Docente: ${(seal.teacher || "").slice(0, 42)}`, txtX, cursorY);
    cursorY += 3.2;
    doc.setFontSize(6);
    doc.text(`H: ${seal.hash.slice(0, 28)}...`, txtX, cursorY);
    doc.setTextColor(0, 0, 0);
  }
};

const drawPdfInstitutionHeader = (doc, reportTitle, options = {}) => {
  const settings = loadSystemSettings();
  const academicYears = loadAcademicYearsRegistry();
  const openYear = academicYears.find((item) => item.status === "abierto");
  const institutionName = settings.institutionName || "Institución Educativa";
  const yearLabel = openYear ? `Año académico ${openYear.year}` : "Año académico no definido";
  const directorLabel = settings.directorName
    ? `Director(a): ${settings.directorName}`
    : "Director(a): No configurado";
  const addressLabel = settings.ieAddress || "Dirección no configurada";
  const teacherName = getTeacherSignatureName() || "No configurado";
  const generatedAt = new Date().toLocaleString("es-PE");
  const subtitle = String(options.subtitle || "").trim();

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  // Barra superior en color institucional
  doc.setFillColor(...PDF_BRAND.primary);
  doc.rect(0, 0, pageWidth, 5, "F");

  // Logo institucional
  let startX = marginX;
  const pdfLogo = getInstitutionLogoPdfDataUrl(settings);
  if (pdfLogo) {
    try {
      doc.addImage(pdfLogo, "PNG", marginX, 9, 20, 20);
      startX = marginX + 24;
    } catch (error) {
      startX = marginX;
    }
  }

  // Nombre de la institución
  doc.setTextColor(...PDF_BRAND.textDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(institutionName, startX, 15);

  // Datos administrativos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text(`${yearLabel}  ·  ${directorLabel}`, startX, 21);
  doc.text(addressLabel, startX, 26);

  // Bloque derecho: docente + generado
  const rightX = pageWidth - marginX;
  doc.text(`Docente: ${teacherName}`, rightX, 21, { align: "right" });
  doc.text(`Generado: ${generatedAt}`, rightX, 26, { align: "right" });

  // Línea separadora
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.line(marginX, 31, pageWidth - marginX, 31);

  // Bloque de título del reporte (banda azul suave)
  const titleBoxTop = 33;
  const titleBoxH = subtitle ? 13 : 10;
  doc.setFillColor(...PDF_BRAND.headerFill);
  doc.roundedRect(marginX, titleBoxTop, pageWidth - 2 * marginX, titleBoxH, 1.5, 1.5, "F");
  doc.setTextColor(...PDF_BRAND.primaryDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(reportTitle, pageWidth / 2, titleBoxTop + 6.5, { align: "center" });
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text(subtitle, pageWidth / 2, titleBoxTop + 11, { align: "center" });
  }

  // Reset
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return titleBoxTop + titleBoxH + 5;
};

const drawPdfMetaStrip = (doc, y, items = []) => {
  if (!items.length) return y;
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const stripH = 9;
  doc.setFillColor(...PDF_BRAND.zebra);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, pageWidth - 2 * marginX, stripH, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_BRAND.textDark);
  const segWidth = (pageWidth - 2 * marginX) / items.length;
  items.forEach((item, idx) => {
    const cx = marginX + segWidth * idx + segWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_BRAND.primaryDark);
    doc.text(String(item.label || ""), cx, y + 3.8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_BRAND.textDark);
    doc.text(String(item.value || "—"), cx, y + 7.5, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  return y + stripH + 5;
};

const drawPdfSignatureBlock = (doc, y) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const teacherName = getTeacherSignatureName();
  const settings = loadSystemSettings();
  const director = settings.directorName || "________________";
  const teacherSig = getTeacherSignatureImage();
  const directorSig = getDirectorSignatureImage();
  const blockH = 40;
  const reservedForSeal = 58; // espacio inferior reservado al sello de validación + pie de página
  let topY = y;
  if (topY + blockH > pageHeight - reservedForSeal) {
    doc.addPage();
    topY = 20;
  }
  const colWidth = (pageWidth - 2 * marginX) / 2 - 6;
  const leftX = marginX + colWidth / 2;
  const rightX = pageWidth - marginX - colWidth / 2;
  const lineY = topY + 22;

  const drawSigImage = (dataUrl, centerX) => {
    if (!dataUrl) return;
    const maxW = 56;
    const maxH = 16;
    try {
      doc.addImage(dataUrl, "PNG", centerX - maxW / 2, lineY - maxH - 1, maxW, maxH);
    } catch (error) {
      /* Si la imagen no se pudiera incrustar (formato no soportado), continuamos. */
    }
  };
  drawSigImage(teacherSig, leftX);
  drawSigImage(directorSig, rightX);

  doc.setDrawColor(...PDF_BRAND.textMuted);
  doc.setLineWidth(0.4);
  doc.line(leftX - colWidth / 2 + 6, lineY, leftX + colWidth / 2 - 6, lineY);
  doc.line(rightX - colWidth / 2 + 6, lineY, rightX + colWidth / 2 - 6, lineY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.textDark);
  doc.text(teacherName || "________________", leftX, lineY + 5, { align: "center" });
  doc.text(director, rightX, lineY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text("Docente responsable", leftX, lineY + 10, { align: "center" });
  doc.text("Director(a)", rightX, lineY + 10, { align: "center" });
  if (teacherSig) {
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_BRAND.success);
    doc.text("Firma digital registrada", leftX, lineY + 14, { align: "center" });
  }
  if (directorSig) {
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_BRAND.success);
    doc.text("Firma digital registrada", rightX, lineY + 14, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
  return topY + blockH;
};

const drawPdfTable = (doc, options) => {
  const {
    startY = 50,
    columns = [],
    rows = [],
    onNewPage,
    fontSize = 9,
    headerFontSize = 8.4,
    rowHeight: rowH = 7,
    marginX = 12,
    headerHeight = 8,
    zebra = true,
    align = []
  } = options;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - 2 * marginX;
  const totalWeight = columns.reduce((sum, c) => sum + (c.width || 1), 0);
  const colXs = [];
  let xCursor = marginX;
  const colWidths = columns.map((c) => {
    const w = (c.width / totalWeight) * tableWidth;
    colXs.push(xCursor);
    xCursor += w;
    return w;
  });

  const drawHead = (y) => {
    doc.setFillColor(...PDF_BRAND.primary);
    doc.rect(marginX, y, tableWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    columns.forEach((col, idx) => {
      const cellX = colXs[idx];
      const cellW = colWidths[idx];
      const colAlign = (align && align[idx]) || "left";
      const tx = colAlign === "center" ? cellX + cellW / 2 : colAlign === "right" ? cellX + cellW - 2 : cellX + 2;
      doc.text(String(col.header || ""), tx, y + headerHeight / 2 + 1.2, {
        align: colAlign,
        baseline: "middle"
      });
    });
    doc.setTextColor(...PDF_BRAND.textDark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    return y + headerHeight;
  };

  let y = drawHead(startY);

  rows.forEach((row, rowIdx) => {
    if (y + rowH > pageHeight - 22) {
      doc.addPage();
      const newTop = typeof onNewPage === "function" ? onNewPage() : 20;
      y = drawHead(newTop);
    }
    if (zebra && rowIdx % 2 === 1) {
      doc.setFillColor(...PDF_BRAND.zebra);
      doc.rect(marginX, y, tableWidth, rowH, "F");
    }
    doc.setDrawColor(...PDF_BRAND.border);
    doc.setLineWidth(0.18);
    doc.line(marginX, y + rowH, marginX + tableWidth, y + rowH);
    columns.forEach((col, idx) => {
      const cellX = colXs[idx];
      const cellW = colWidths[idx];
      const value = row[idx] == null ? "" : String(row[idx]);
      const colAlign = (align && align[idx]) || "left";
      const tx = colAlign === "center" ? cellX + cellW / 2 : colAlign === "right" ? cellX + cellW - 2 : cellX + 2;
      const truncated = doc.splitTextToSize(value, cellW - 3)[0] || "";
      doc.text(truncated, tx, y + rowH / 2 + 1.1, { align: colAlign, baseline: "middle" });
    });
    y += rowH;
  });

  // Borde exterior
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.rect(marginX, startY, tableWidth, y - startY);
  doc.setLineWidth(0.4);
  doc.line(marginX, startY + headerHeight, marginX + tableWidth, startY + headerHeight);
  return y;
};

const buildInstitutionHeaderRows = (reportTitle) => {
  const settings = loadSystemSettings();
  const academicYears = loadAcademicYearsRegistry();
  const openYear = academicYears.find((item) => item.status === "abierto");
  const institutionName = settings.institutionName || "Institución Educativa";
  const yearLabel = openYear ? `Año académico ${openYear.year}` : "Año académico no definido";
  const directorLabel = settings.directorName ? `Director(a): ${settings.directorName}` : "Director(a): No configurado";
  const addressLabel = settings.ieAddress || "Dirección no configurada";
  const teacherName =
    (settings.teacherName || "").trim() || (localStorage.getItem("teacherSignatureName") || "").trim();
  const generatedAt = new Date().toLocaleString("es-PE");
  return [
    [institutionName],
    [`${yearLabel}  |  ${directorLabel}`],
    [addressLabel],
    [reportTitle],
    [`Docente: ${teacherName || "No configurado"}  |  Generado: ${generatedAt}`],
    []
  ];
};

const exportSheetToExcel = ({ filename, sheetName, reportTitle, columns = [], rows = [], extraTopRows = [] }) => {
  const xlsx = window.XLSX;
  if (!xlsx) {
    if (typeof showToast === "function") {
      showToast("No se pudo cargar la librería de Excel. Verifique su conexión a internet.", {
        type: "error",
        duration: 5000
      });
    }
    return false;
  }

  const headerBlock = buildInstitutionHeaderRows(reportTitle);
  const aoa = [
    ...headerBlock,
    ...extraTopRows,
    columns.map((col) => col.header),
    ...rows
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(aoa);

  const widths = columns.map((col) => {
    const headerLen = String(col.header || "").length;
    let maxLen = headerLen;
    rows.forEach((row) => {
      const cell = row?.[columns.indexOf(col)];
      const cellLen = cell == null ? 0 : String(cell).length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    return { wch: Math.min(Math.max(maxLen + 2, col.width || 10), 48) };
  });
  if (widths.length) worksheet["!cols"] = widths;

  worksheet["!merges"] = worksheet["!merges"] || [];
  const headerRowsCount = headerBlock.length - 1;
  if (columns.length > 1) {
    for (let r = 0; r < headerRowsCount; r += 1) {
      worksheet["!merges"].push({ s: { r, c: 0 }, e: { r, c: columns.length - 1 } });
    }
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, String(sheetName || "Reporte").slice(0, 31));
  xlsx.writeFile(workbook, filename);
  return true;
};

const addPdfPageNumbers = (doc, reportLabel = "", seal = null) => {
  const pageCount = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleDateString("es-PE");
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 8;
    doc.setDrawColor(...PDF_BRAND.border);
    doc.setLineWidth(0.3);
    doc.line(12, footerY - 4, pageWidth - 12, footerY - 4);
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BRAND.textMuted);
    if (reportLabel) {
      doc.text(reportLabel, 12, footerY);
    }
    doc.text(`Página ${page} de ${pageCount}`, pageWidth / 2, footerY, { align: "center" });
    doc.text(`Emitido ${generatedAt}`, pageWidth - 12, footerY, { align: "right" });
    if (seal && seal.id) {
      doc.setFontSize(7);
      doc.setTextColor(...PDF_BRAND.primaryDark);
      doc.text(`Cód. validación: ${seal.id}`, pageWidth / 2, footerY - 7, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }
};

if (isLoginPage) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginError = document.getElementById("loginError");
  const registerError = document.getElementById("registerError");
  const authTabs = document.querySelectorAll(".auth-tab");
  const authIntroText = document.getElementById("authIntroText");

  const showAuthError = (element, message) => {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("hidden");
  };

  const clearAuthError = (element) => {
    if (!element) return;
    element.textContent = "";
    element.classList.add("hidden");
  };

  const activateAuthPanel = (panelId) => {
    document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.authPanel !== panelId);
    });
    authTabs.forEach((tab) => {
      const isActive = tab.dataset.authTab === panelId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    clearAuthError(loginError);
    clearAuthError(registerError);
  };

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateAuthPanel(tab.dataset.authTab || "login"));
  });

  const hasUsers = loadUsers().length > 0;
  if (!hasUsers) {
    activateAuthPanel("register");
    if (authIntroText) {
      authIntroText.innerHTML =
        '<strong>Primer acceso:</strong> registre la cuenta del docente principal para iniciar el sistema.';
    }
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError(loginError);
    const username = document.getElementById("loginUsername")?.value.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";
    if (!username || !password) {
      showAuthError(loginError, "Debe completar usuario y contraseña.");
      return;
    }
    if (!loadUsers().length) {
      showAuthError(loginError, "Aún no hay usuarios registrados. Use la pestaña 'Registrarse' para crear el primero.");
      activateAuthPanel("register");
      return;
    }
    const result = await authenticateUser(username, password);
    if (!result.ok) {
      showAuthError(loginError, result.error || "No se pudo iniciar sesión.");
      return;
    }
    beginAuthenticatedSession(result.user);
    window.location.href = "principal.html";
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError(registerError);
    const displayName = document.getElementById("registerDisplayName")?.value.trim() || "";
    const username = document.getElementById("registerUsername")?.value.trim() || "";
    const password = document.getElementById("registerPassword")?.value || "";
    const passwordConfirm = document.getElementById("registerPasswordConfirm")?.value || "";

    if (password !== passwordConfirm) {
      showAuthError(registerError, "Las contraseñas no coinciden.");
      return;
    }

    const result = await registerUser({ username, displayName, password });
    if (!result.ok) {
      showAuthError(registerError, result.error || "No se pudo crear la cuenta.");
      return;
    }
    beginAuthenticatedSession(result.user);
    window.location.href = "principal.html";
  });
}

const performLogout = (reason = "manual") => {
  endAuthenticatedSession({ reason });
  window.location.href = "index.html";
};

document.querySelectorAll(".logout-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    performLogout("manual");
  });
});

const setupInactivityWatcher = () => {
  if (isLoginPage || !isAuthenticated) return;

  let warningTimerId = null;
  let logoutTimerId = null;
  let countdownIntervalId = null;
  let logoutDeadline = 0;
  let banner = null;
  let bannerCountdown = null;

  const ensureBanner = () => {
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "inactivityBanner";
    banner.className = "inactivity-banner hidden";
    banner.setAttribute("role", "alertdialog");
    banner.setAttribute("aria-live", "assertive");
    banner.innerHTML = `
      <div class="inactivity-banner-card">
        <div class="inactivity-banner-icon"><i class="fa-solid fa-hourglass-half"></i></div>
        <div class="inactivity-banner-body">
          <h4>Sesión a punto de cerrarse</h4>
          <p>Su sesión se cerrará por inactividad en <strong id="inactivityBannerCountdown">2:00</strong>. Realice cualquier acción para continuar.</p>
        </div>
        <div class="inactivity-banner-actions">
          <button type="button" class="btn-primary" id="inactivityStayBtn"><i class="fa-solid fa-arrows-rotate"></i> Continuar</button>
          <button type="button" class="btn-danger" id="inactivityLogoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Cerrar ahora</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    bannerCountdown = banner.querySelector("#inactivityBannerCountdown");
    banner.querySelector("#inactivityStayBtn")?.addEventListener("click", () => {
      resetTimers();
    });
    banner.querySelector("#inactivityLogoutBtn")?.addEventListener("click", () => {
      performLogout("user-confirmed");
    });
    return banner;
  };

  const formatCountdown = (msRemaining) => {
    const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const hideBanner = () => {
    if (banner) banner.classList.add("hidden");
    if (countdownIntervalId) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  };

  const showWarning = () => {
    ensureBanner();
    if (!banner) return;
    banner.classList.remove("hidden");
    if (bannerCountdown) bannerCountdown.textContent = formatCountdown(INACTIVITY_WARNING_MS);
    if (countdownIntervalId) window.clearInterval(countdownIntervalId);
    countdownIntervalId = window.setInterval(() => {
      const remaining = logoutDeadline - Date.now();
      if (!bannerCountdown) return;
      if (remaining <= 0) {
        bannerCountdown.textContent = "0:00";
        window.clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        return;
      }
      bannerCountdown.textContent = formatCountdown(remaining);
    }, 1000);
  };

  const clearScheduledTimers = () => {
    if (warningTimerId) {
      window.clearTimeout(warningTimerId);
      warningTimerId = null;
    }
    if (logoutTimerId) {
      window.clearTimeout(logoutTimerId);
      logoutTimerId = null;
    }
  };

  const resetTimers = () => {
    clearScheduledTimers();
    hideBanner();
    const now = Date.now();
    logoutDeadline = now + INACTIVITY_TIMEOUT_MS;
    sessionStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(now));
    warningTimerId = window.setTimeout(showWarning, INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS);
    logoutTimerId = window.setTimeout(() => performLogout("inactivity"), INACTIVITY_TIMEOUT_MS);
  };

  const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
  let lastReset = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastReset < 1000) return;
    lastReset = now;
    if (banner && !banner.classList.contains("hidden")) {
      // No reiniciar automáticamente cuando el aviso ya está en pantalla;
      // requerimos que el usuario haga clic en "Continuar" para evitar
      // que el simple movimiento del mouse extienda la sesión sin querer.
      return;
    }
    resetTimers();
  };
  activityEvents.forEach((eventName) => {
    document.addEventListener(eventName, onActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onActivity();
  });

  const lastActivityRaw = Number(sessionStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || "0");
  const elapsedSinceLast = lastActivityRaw ? Date.now() - lastActivityRaw : 0;
  if (lastActivityRaw && elapsedSinceLast >= INACTIVITY_TIMEOUT_MS) {
    performLogout("inactivity-resume");
    return;
  }
  resetTimers();
};

setupInactivityWatcher();

if (currentPage === "principal.html") {
  let students = loadStudents();
  let incidentsFromDb = getDbValue("incidents", []);
  let gradesRegistry = getDbValue("gradesCnebBimesters", null);
  let userPickedDay = false;
  const dashboardBimesterFilter = document.getElementById("dashboardBimesterFilter");
  const dashboardAttendanceMonth = document.getElementById("dashboardAttendanceMonth");
  const dashboardAttendanceDay = document.getElementById("dashboardAttendanceDay");

  const refreshDashboardSources = () => {
    students = loadStudents();
    incidentsFromDb = getDbValue("incidents", []);
    gradesRegistry = getDbValue("gradesCnebBimesters", null);
  };
  const cnebAreasBase = [
    { key: "comunicacion", label: "Comunicación" },
    { key: "castellano_segunda_lengua", label: "Castellano 2da lengua" },
    { key: "matematica", label: "Matemática" },
    { key: "personal_social", label: "Personal Social" },
    { key: "ciencia_tecnologia", label: "Ciencia y Tecnología" },
    { key: "religion", label: "Educación Religiosa" },
    { key: "arte_cultura", label: "Arte y Cultura" },
    { key: "educacion_fisica", label: "Educación Física" },
    { key: "ingles", label: "Inglés" }
  ];

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentDay = now.getDate();

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  };

  const donut = document.getElementById("asistencia-donut");
  const asistenciaContexto = document.getElementById("asistencia-contexto");
  const metricAsistenciaSub = document.getElementById("metric-asistencia-sub");
  const barsContainer = document.getElementById("rendimiento-barras");
  const bimesterOrder = ["IV", "III", "II", "I"];

  const getDaysInMonth = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  };

  const getLatestDayWithAttendance = (registryByMonth, monthKey) => {
    const monthBlock = registryByMonth?.[monthKey] || {};
    let latestDay = 0;
    Object.values(monthBlock).forEach((studentDays) => {
      Object.keys(studentDays || {}).forEach((dayKey) => {
        const day = Number(dayKey);
        if (day > latestDay) latestDay = day;
      });
    });
    return latestDay;
  };

  const syncAttendanceDayOptions = () => {
    const attendanceRegistry = getDbValue("attendanceRegistry", {});
    const monthKey = dashboardAttendanceMonth?.value || currentMonthKey;
    if (!dashboardAttendanceDay) return;
    const daysCount = getDaysInMonth(monthKey);
    const selected = Number(dashboardAttendanceDay.value || "0");
    dashboardAttendanceDay.innerHTML = Array.from({ length: daysCount }, (_, idx) => idx + 1)
      .map((day) => `<option value="${day}">${day}</option>`)
      .join("");
    const latestWithData = getLatestDayWithAttendance(attendanceRegistry, monthKey);
    const fallbackDay = latestWithData || Math.min(currentDay, daysCount);
    const safeDay = selected >= 1 && selected <= daysCount ? selected : fallbackDay;
    dashboardAttendanceDay.value = String(safeDay);
  };

  const getBimesterStats = (selectedBimester) => {
    const cnebAreasStats = cnebAreasBase.map((area) => ({ ...area, total: 0, count: 0 }));
    const latestBimesterWithData = bimesterOrder.find((id) => {
      const grades = gradesRegistry?.[id]?.grades;
      return grades && Object.keys(grades).length > 0;
    });
    const sourceBimester = selectedBimester === "auto" ? latestBimesterWithData : selectedBimester;
    const sourceBimesterGrades =
      sourceBimester && gradesRegistry?.[sourceBimester]?.grades ? gradesRegistry[sourceBimester].grades : {};

    if (gradesRegistry && typeof gradesRegistry === "object") {
      Object.values(sourceBimesterGrades).forEach((studentAreas) => {
        cnebAreasStats.forEach((entry) => {
          const areaGrades = studentAreas?.[entry.key];
          if (!areaGrades || typeof areaGrades !== "object") return;
          Object.values(areaGrades).forEach((g) => {
            const map = { AD: 100, A: 85, B: 70, C: 55 };
            if (map[g]) {
              entry.total += map[g];
              entry.count += 1;
            }
          });
        });
      });
    }

    const performanceRows = cnebAreasStats.map((entry) => ({
      curso: entry.label,
      porcentaje: entry.count ? Math.round(entry.total / entry.count) : 0,
      tieneDatos: entry.count > 0
    }));
    const areasConDatos = performanceRows.filter((row) => row.tieneDatos);
    const promedioGeneralAreas = areasConDatos.length
      ? areasConDatos.reduce((sum, row) => sum + row.porcentaje, 0) / areasConDatos.length
      : 0;

    return {
      rendimiento: performanceRows,
      promedioGeneralAreas,
      bimesterFuente: sourceBimester || "Sin bimestre con datos"
    };
  };

  const renderDashboard = () => {
    refreshDashboardSources();
    const attendanceRegistry = getDbValue("attendanceRegistry", {});
    const selectedBimester = dashboardBimesterFilter?.value || "auto";
    const bimesterStats = getBimesterStats(selectedBimester);
    const selectedMonthKey = dashboardAttendanceMonth?.value || currentMonthKey;
    const latestWithData = getLatestDayWithAttendance(attendanceRegistry, selectedMonthKey);
    const dayValueRaw = Number(dashboardAttendanceDay?.value || 0);
    const selectedDay = userPickedDay && dayValueRaw
      ? dayValueRaw
      : (latestWithData || dayValueRaw || currentDay);
    const monthAttendance = attendanceRegistry[selectedMonthKey] || {};
    const monthLabel = getMonthLabel(selectedMonthKey);

    if (dashboardAttendanceDay && !userPickedDay) {
      dashboardAttendanceDay.value = String(selectedDay);
    }

    let presentes = 0;
    let faltas = 0;
    let tardanzas = 0;
    let justificados = 0;

    students.forEach((student) => {
      const status = monthAttendance?.[student.dni]?.[selectedDay];
      if (status === "✓") presentes += 1;
      if (status === "F") faltas += 1;
      if (status === "T") tardanzas += 1;
      if (status === "J") justificados += 1;
    });
    const totalMarcadosDia = presentes + faltas + tardanzas + justificados;
    const porcentajeAsistencia = totalMarcadosDia ? Math.round(((presentes + tardanzas) / totalMarcadosDia) * 100) : 0;

    const incidenciasDelMes = incidentsFromDb.filter((incident) => {
      const date = String(incident?.date || "");
      return date.startsWith(selectedMonthKey);
    }).length;

    const dashboardData = {
      estudiantes: students.length,
      asistencia: {
        porcentaje: porcentajeAsistencia,
        presentes,
        faltas,
        tardanzas,
        justificados
      },
      incidencias: incidenciasDelMes,
      rendimiento: bimesterStats.rendimiento,
      bimesterFuente: bimesterStats.bimesterFuente,
      promedioGeneralAreas: bimesterStats.promedioGeneralAreas
    };

    setText("metric-estudiantes", dashboardData.estudiantes);
    setText("metric-asistencia", `${dashboardData.asistencia.porcentaje}%`);
    setText("metric-incidencias", dashboardData.incidencias.toString().padStart(2, "0"));
    setText("metric-promedio", dashboardData.promedioGeneralAreas.toFixed(1));
    setText("asistencia-donut-label", `${dashboardData.asistencia.porcentaje}%`);
    setText("asistencia-presentes", dashboardData.asistencia.presentes);
    setText("asistencia-faltas", dashboardData.asistencia.faltas);
    setText("asistencia-tardanzas", dashboardData.asistencia.tardanzas);
    setText("asistencia-justificados", dashboardData.asistencia.justificados);

    if (asistenciaContexto) {
      asistenciaContexto.textContent = latestWithData
        ? `Reporte automático del último día con registro (${selectedDay} de ${monthLabel}).`
        : `Reporte del día ${selectedDay} de ${monthLabel}, aún sin registros marcados.`;
    }
    if (metricAsistenciaSub) {
      metricAsistenciaSub.textContent = `Dato real del día ${selectedDay} (${monthLabel}).`;
    }

    if (donut) {
      const totalStudents = Math.max(students.length, 1);
      const presentPct = Math.round((dashboardData.asistencia.presentes / totalStudents) * 100);
      const latePct = Math.round((dashboardData.asistencia.tardanzas / totalStudents) * 100);
      const justifiedPct = Math.round((dashboardData.asistencia.justificados / totalStudents) * 100);
      const absentPct = Math.round((dashboardData.asistencia.faltas / totalStudents) * 100);
      const accounted = presentPct + latePct + justifiedPct + absentPct;
      const pendingPct = Math.max(100 - accounted, 0);
      const p1 = presentPct;
      const p2 = p1 + latePct;
      const p3 = p2 + justifiedPct;
      const p4 = p3 + absentPct;
      const p5 = p4 + pendingPct;
      donut.style.background = `conic-gradient(
        #1f7ae0 0% ${p1}%,
        #f5a524 ${p1}% ${p2}%,
        #7b61ff ${p2}% ${p3}%,
        #e5484d ${p3}% ${p4}%,
        #dfe8f7 ${p4}% ${p5}%
      )`;
    }

    if (barsContainer) {
      const baseRows = dashboardData.rendimiento
        .map(
          (item) => `
          <div class="bar-row">
            <div class="bar-head">
              <span>${item.curso}</span>
              <strong>${item.porcentaje}%</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${item.porcentaje}%"></div>
            </div>
          </div>
        `
        )
        .join("");
      const fuente = `<p class="bars-footnote"><strong>Fuente:</strong> ${dashboardData.bimesterFuente}.</p>`;
      barsContainer.innerHTML = `${baseRows}${fuente}`;
    }
  };

  dashboardBimesterFilter?.addEventListener("change", () => {
    renderDashboard();
  });

  dashboardAttendanceMonth?.addEventListener("change", () => {
    userPickedDay = false;
    syncAttendanceDayOptions();
    renderDashboard();
  });

  dashboardAttendanceDay?.addEventListener("change", () => {
    userPickedDay = true;
    renderDashboard();
  });

  if (dashboardAttendanceMonth) {
    dashboardAttendanceMonth.value = currentMonthKey;
  }
  syncAttendanceDayOptions();
  renderDashboard();

  // ============================================================
  // Reporte consolidado automático (PDF)
  // ============================================================
  const exportConsolidatedPdfBtn = document.getElementById("exportConsolidatedPdfBtn");

  const computeAttendanceMonthlyStats = (monthKey, registry, studentList) => {
    let p = 0, a = 0, t = 0, j = 0;
    studentList.forEach((s) => {
      const dayMap = registry[monthKey]?.[s.dni] || {};
      Object.values(dayMap).forEach((v) => {
        if (v === "✓") p += 1;
        else if (v === "F") a += 1;
        else if (v === "T") t += 1;
        else if (v === "J") j += 1;
      });
    });
    const total = p + a + t + j;
    const rate = total ? Math.round(((p + t + j) / total) * 100) : 0;
    return { p, a, t, j, total, rate };
  };

  exportConsolidatedPdfBtn?.addEventListener("click", withExportLoadingState(exportConsolidatedPdfBtn, async () => {
    const jspdf = window.jspdf;
    if (!jspdf) {
      showToast("No se pudo cargar jsPDF. Verifique su conexión a internet.", { type: "error" });
      return;
    }
    refreshDashboardSources();
    const attendanceRegistry = getDbValue("attendanceRegistry", {});
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const seal = await generateDocumentSeal(
      "Reporte Consolidado",
      `consolidated:${currentMonthKey}:${students.length}`
    );
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const selectedBimester = dashboardBimesterFilter?.value || "auto";
    const bimesterStats = getBimesterStats(selectedBimester);
    const monthLabel = getMonthLabel(currentMonthKey);
    const monthlyAttendance = computeAttendanceMonthlyStats(currentMonthKey, attendanceRegistry, students);
    const totalStudents = students.length;

    // Distribución por grado
    const byGrade = students.reduce((acc, s) => {
      acc[s.grade || "?"] = (acc[s.grade || "?"] || 0) + 1;
      return acc;
    }, {});
    const gradeBreakdown =
      Object.entries(byGrade)
        .sort(([a], [b]) => a.localeCompare(b, "es"))
        .map(([g, c]) => `${g}: ${c}`)
        .join("  ·  ") || "—";

    // Incidencias del mes
    const incidentsThisMonth = incidentsFromDb.filter((inc) =>
      String(inc?.date || "").startsWith(currentMonthKey)
    );
    const incidentsTotal = incidentsFromDb.length;

    const REPORT_TITLE = "Reporte Consolidado del Sistema";
    const REPORT_SUBTITLE = `${monthLabel} · Bimestre fuente: ${bimesterStats.bimesterFuente || "—"}`;

    let y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });

    y = drawPdfMetaStrip(doc, y, [
      { label: "Estudiantes", value: String(totalStudents) },
      { label: "% Asistencia (mes)", value: `${monthlyAttendance.rate}%` },
      { label: "Incidencias (mes)", value: String(incidentsThisMonth.length) },
      {
        label: "Promedio general",
        value: bimesterStats.promedioGeneralAreas
          ? bimesterStats.promedioGeneralAreas.toFixed(1)
          : "0.0"
      }
    ]);

    // === Sección 1: Estudiantes ===
    const drawSectionTitle = (title) => {
      if (y + 9 > pageH - 22) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
      }
      doc.setFillColor(...PDF_BRAND.primary);
      doc.rect(marginX, y, pageW - 2 * marginX, 7.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(title, marginX + 3, y + 5.2);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      y += 10;
    };

    drawSectionTitle("1. Población estudiantil");
    doc.setFontSize(9.5);
    doc.text(`Total de estudiantes registrados: ${totalStudents}`, marginX + 2, y);
    y += 5;
    const gradeLines = doc.splitTextToSize(`Distribución por grado: ${gradeBreakdown}`, pageW - 2 * marginX - 4);
    gradeLines.forEach((line) => {
      doc.text(line, marginX + 2, y);
      y += 5;
    });
    y += 4;

    // === Sección 2: Asistencia ===
    drawSectionTitle(`2. Asistencia del mes (${monthLabel})`);
    y = drawPdfMetaStrip(doc, y - 1, [
      { label: "Presentes", value: String(monthlyAttendance.p) },
      { label: "Faltas", value: String(monthlyAttendance.a) },
      { label: "Tardanzas", value: String(monthlyAttendance.t) },
      { label: "Justificadas", value: String(monthlyAttendance.j) },
      { label: "Total marcado", value: String(monthlyAttendance.total) }
    ]);
    y += 1;

    // === Sección 3: Rendimiento por área ===
    drawSectionTitle(`3. Rendimiento académico (${bimesterStats.bimesterFuente || "sin datos"})`);
    const performanceRows = bimesterStats.rendimiento || [];
    if (performanceRows.every((r) => !r.tieneDatos)) {
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text("No hay calificaciones registradas todavía.", marginX + 2, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 10;
    } else {
      // Mini tabla con barras visuales
      const rowH = 6.5;
      performanceRows.forEach((row, idx) => {
        if (y + rowH > pageH - 22) {
          doc.addPage();
          y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
        }
        if (idx % 2 === 1) {
          doc.setFillColor(...PDF_BRAND.zebra);
          doc.rect(marginX, y, pageW - 2 * marginX, rowH, "F");
        }
        doc.setFontSize(9);
        doc.setTextColor(...PDF_BRAND.textDark);
        doc.text(row.curso, marginX + 2, y + 4.4);
        // Barra
        const barX = marginX + 90;
        const barMaxW = pageW - 2 * marginX - 110;
        doc.setFillColor(225, 235, 250);
        doc.rect(barX, y + 1.8, barMaxW, 2.8, "F");
        const fillW = barMaxW * (row.porcentaje / 100);
        const fillColor =
          row.porcentaje >= 80 ? [22, 163, 74] : row.porcentaje >= 60 ? [202, 138, 4] : row.porcentaje > 0 ? [220, 38, 38] : [148, 163, 184];
        doc.setFillColor(...fillColor);
        doc.rect(barX, y + 1.8, fillW, 2.8, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PDF_BRAND.primaryDark);
        doc.text(`${row.porcentaje}%`, pageW - marginX - 2, y + 4.4, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        y += rowH;
      });
      y += 3;
    }

    // === Sección 4: Incidencias ===
    drawSectionTitle("4. Incidencias del mes");
    doc.setFontSize(9.5);
    doc.text(
      `Incidencias del mes: ${incidentsThisMonth.length}  ·  Total histórico: ${incidentsTotal}`,
      marginX + 2,
      y
    );
    y += 5;
    if (incidentsThisMonth.length) {
      const top = incidentsThisMonth.slice(0, 5);
      doc.setFontSize(9);
      top.forEach((inc, idx) => {
        if (y + 5 > pageH - 22) {
          doc.addPage();
          y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
        }
        const text = `${idx + 1}. ${formatDateEs(inc.date)} · ${inc.fullName} (${inc.grade}${inc.section}) — ${(inc.detail || "").slice(0, 100)}`;
        const lines = doc.splitTextToSize(text, pageW - 2 * marginX - 4);
        lines.forEach((line) => {
          doc.text(line, marginX + 2, y);
          y += 4.5;
        });
      });
      if (incidentsThisMonth.length > 5) {
        doc.setTextColor(...PDF_BRAND.textMuted);
        doc.setFontSize(8.5);
        doc.text(`...y ${incidentsThisMonth.length - 5} incidencia(s) más.`, marginX + 2, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
    } else {
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text("Sin incidencias registradas en el mes en curso.", marginX + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }
    y += 4;

    drawPdfSignatureBlock(doc, y + 4);
    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, "Reporte Consolidado", seal);
    doc.save(`reporte-consolidado-${currentMonthKey}.pdf`);
    showToast("Reporte consolidado generado.", { type: "success" });
  }));

  const dashboardInterval = window.setInterval(() => {
    if (document.hidden) return;
    if (!userPickedDay) syncAttendanceDayOptions();
    renderDashboard();
  }, 15000);
  window.addEventListener("storage", (event) => {
    if (event.key === SYSTEM_DB_KEY) {
      if (!userPickedDay) syncAttendanceDayOptions();
      renderDashboard();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (!userPickedDay) syncAttendanceDayOptions();
      renderDashboard();
    }
  });
  window.addEventListener("beforeunload", () => {
    window.clearInterval(dashboardInterval);
  });
}

if (currentPage === "estudiantes.html") {
  const studentForm = document.getElementById("studentForm");
  const studentsTbody = document.getElementById("studentsTbody");
  const sortStudentsBtn = document.getElementById("sortStudentsBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const studentsSearchInput = document.getElementById("studentsSearchInput");
  const studentsCounter = document.getElementById("studentsCounter");
  let editIndex = -1;
  let searchTerm = "";

  const students = loadStudents();

  const fields = {
    dni: document.getElementById("dni"),
    fullName: document.getElementById("fullName"),
    grade: document.getElementById("grade"),
    section: document.getElementById("section"),
    birthDate: document.getElementById("birthDate")
  };

  if (fields.birthDate) fields.birthDate.max = getTodayDateString();

  const matchesSearch = (student) => {
    if (!searchTerm) return true;
    const haystack = `${student.dni} ${student.fullName} ${student.grade} ${student.section}`.toLowerCase();
    return haystack.includes(searchTerm);
  };

  const renderStudents = () => {
    if (!studentsTbody) return;
    const filtered = students
      .map((student, index) => ({ student, index }))
      .filter(({ student }) => matchesSearch(student));

    studentsTbody.innerHTML = filtered.length
      ? filtered
          .map(
            ({ student, index }, displayIdx) => `
              <tr>
                <td>${displayIdx + 1}</td>
                <td>${student.dni}</td>
                <td>${student.fullName}</td>
                <td>${student.grade}</td>
                <td>${student.section}</td>
                <td>${formatDateEs(student.birthDate)}</td>
                <td>
                  <div class="table-actions">
                    <button type="button" class="btn-edit" data-action="edit" data-index="${index}" aria-label="Editar registro" title="Editar"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span class="btn-label">Editar</span></button>
                    <button type="button" class="btn-delete" data-action="delete" data-index="${index}" aria-label="Eliminar registro" title="Eliminar"><i class="fa-solid fa-trash" aria-hidden="true"></i><span class="btn-label">Eliminar</span></button>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="7" class="empty-row">Sin resultados para mostrar.</td></tr>`;

    if (studentsCounter) {
      const showing = filtered.length;
      const total = students.length;
      const capacityHint =
        total < SYSTEM_MIN_STUDENTS_CAPACITY
          ? ` (capacidad mínima del sistema: ${SYSTEM_MIN_STUDENTS_CAPACITY}).`
          : "";
      studentsCounter.textContent = searchTerm
        ? `Mostrando ${showing} de ${total} estudiantes${capacityHint}`
        : `Total registrados: ${total}${capacityHint}`;
    }
  };

  const clearForm = () => {
    studentForm?.reset();
    editIndex = -1;
    const saveButton = document.getElementById("saveStudentBtn");
    if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Guardar estudiante';
  };

  studentsSearchInput?.addEventListener("input", () => {
    searchTerm = studentsSearchInput.value.trim().toLowerCase();
    renderStudents();
  });

  studentForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const newStudent = {
      dni: fields.dni.value.trim(),
      fullName: fields.fullName.value.trim().replace(/\s+/g, " "),
      grade: fields.grade.value,
      section: fields.section.value,
      birthDate: fields.birthDate.value
    };

    if (!isValidDniFormat(newStudent.dni)) {
      showToast("El DNI debe tener exactamente 8 dígitos numéricos.", { type: "error" });
      fields.dni?.focus();
      return;
    }
    if (!isDniUniqueAmong(newStudent.dni, students, editIndex)) {
      showToast("Ya existe otro estudiante con ese DNI. Verifique los datos.", { type: "error" });
      fields.dni?.focus();
      return;
    }
    if (!newStudent.fullName || newStudent.fullName.length < 3) {
      showToast("Ingrese los apellidos y nombres completos.", { type: "warning" });
      fields.fullName?.focus();
      return;
    }
    if (newStudent.birthDate && newStudent.birthDate > getTodayDateString()) {
      showToast("La fecha de nacimiento no puede ser posterior al día de hoy.", { type: "warning" });
      fields.birthDate?.focus();
      return;
    }

    const wasEdit = editIndex >= 0;
    if (wasEdit) {
      students[editIndex] = newStudent;
    } else {
      students.push(newStudent);
    }

    saveStudents(students);
    renderStudents();
    clearForm();
    showToast(
      wasEdit ? "Estudiante actualizado correctamente." : "Estudiante registrado correctamente.",
      { type: "success" }
    );
  });

  studentsTbody?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (Number.isNaN(index)) return;

    if (action === "delete") {
      const student = students[index];
      const ok = window.confirm(
        student ? `¿Eliminar al estudiante ${student.fullName} (DNI ${student.dni})?` : "¿Eliminar este registro?"
      );
      if (!ok) return;
      students.splice(index, 1);
      saveStudents(students);
      renderStudents();
      if (editIndex === index) clearForm();
      showToast("Estudiante eliminado.", { type: "info" });
      return;
    }

    if (action === "edit") {
      const student = students[index];
      if (!student) return;
      fields.dni.value = student.dni;
      fields.fullName.value = student.fullName;
      fields.grade.value = student.grade;
      fields.section.value = student.section;
      fields.birthDate.value = student.birthDate;
      editIndex = index;
      const saveButton = document.getElementById("saveStudentBtn");
      if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>Actualizar estudiante';
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  sortStudentsBtn?.addEventListener("click", () => {
    students.sort((a, b) => a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" }));
    saveStudents(students);
    renderStudents();
    clearForm();
  });

  exportPdfBtn?.addEventListener("click", withExportLoadingState(exportPdfBtn, async () => {
    const jspdf = window.jspdf;
    if (!jspdf) {
      window.print();
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const REPORT_TITLE = "Nómina de Estudiantes";
    const REPORT_SUBTITLE = "Nivel Primaria · Listado oficial";
    const seal = await generateDocumentSeal(REPORT_TITLE, `students:${students.length}`);

    const ordered = [...students].sort((a, b) => {
      const gA = (a.grade || "").localeCompare(b.grade || "", "es");
      if (gA !== 0) return gA;
      const sA = (a.section || "").localeCompare(b.section || "", "es");
      if (sA !== 0) return sA;
      return (a.fullName || "").localeCompare(b.fullName || "", "es", { sensitivity: "base" });
    });

    // Estadísticas automáticas
    const byGrade = ordered.reduce((acc, st) => {
      const k = `${st.grade || "?"}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const bySection = ordered.reduce((acc, st) => {
      const k = `${st.section || "?"}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const gradeBreakdown = Object.entries(byGrade)
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([g, c]) => `${g}: ${c}`)
      .join(" · ") || "—";
    const sectionBreakdown = Object.entries(bySection)
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([s, c]) => `${s}: ${c}`)
      .join(" · ") || "—";

    let y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
    y = drawPdfMetaStrip(doc, y, [
      { label: "Total estudiantes", value: String(ordered.length) },
      { label: "Por grado", value: gradeBreakdown },
      { label: "Por sección", value: sectionBreakdown }
    ]);

    y = drawPdfTable(doc, {
      startY: y,
      columns: [
        { header: "N°", width: 0.45 },
        { header: "DNI", width: 1.1 },
        { header: "Apellidos y Nombres", width: 4.8 },
        { header: "Grado", width: 0.8 },
        { header: "Sec.", width: 0.6 },
        { header: "F. Nacimiento", width: 1.2 }
      ],
      align: ["center", "center", "left", "center", "center", "center"],
      rows: ordered.map((student, idx) => [
        String(idx + 1),
        student.dni,
        student.fullName,
        student.grade,
        student.section,
        formatDateEs(student.birthDate)
      ]),
      onNewPage: () => drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE })
    });

    drawPdfSignatureBlock(doc, y + 10);
    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, REPORT_TITLE, seal);
    doc.save("nomina-estudiantes-primaria.pdf");
  }));

  exportExcelBtn?.addEventListener("click", () => {
    const columns = [
      { header: "N°", width: 5 },
      { header: "DNI", width: 12 },
      { header: "Apellidos y Nombres", width: 36 },
      { header: "Grado", width: 8 },
      { header: "Sección", width: 8 },
      { header: "Fecha de Nacimiento", width: 18 }
    ];
    const ordered = [...students].sort((a, b) => {
      const g = (a.grade || "").localeCompare(b.grade || "", "es");
      if (g !== 0) return g;
      const s = (a.section || "").localeCompare(b.section || "", "es");
      if (s !== 0) return s;
      return (a.fullName || "").localeCompare(b.fullName || "", "es", { sensitivity: "base" });
    });
    const rows = ordered.map((student, idx) => [
      idx + 1,
      student.dni,
      student.fullName,
      student.grade,
      student.section,
      formatDateEs(student.birthDate)
    ]);
    const byGrade = ordered.reduce((acc, st) => {
      const k = `${st.grade || "?"}`;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const breakdown = Object.entries(byGrade)
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([g, c]) => `${g}: ${c}`)
      .join(" · ");
    exportSheetToExcel({
      filename: "nomina-estudiantes-primaria.xlsx",
      sheetName: "Estudiantes",
      reportTitle: "Nómina de Estudiantes — Nivel Primaria",
      columns,
      rows,
      extraTopRows: [
        [`Total registrado: ${ordered.length} estudiantes`],
        [`Distribución por grado: ${breakdown || "—"}`],
        []
      ]
    });
  });

  renderStudents();
  saveStudents(students);
  const saveButton = document.getElementById("saveStudentBtn");
  if (saveButton) saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Guardar estudiante';
}

if (currentPage === "horario.html") {
  const scheduleForm = document.getElementById("scheduleForm");
  const scheduleTbody = document.getElementById("scheduleTbody");
  const exportSchedulePdfBtn = document.getElementById("exportSchedulePdfBtn");
  const exportScheduleExcelBtn = document.getElementById("exportScheduleExcelBtn");
  const saveScheduleBtn = document.getElementById("saveScheduleBtn");
  const teacherNameStorageKey = "teacherSignatureName";
  let editScheduleIndex = -1;

  const scheduleFields = {
    startTime: document.getElementById("startTime"),
    endTime: document.getElementById("endTime"),
    curricularArea: document.getElementById("curricularArea"),
    grade: document.getElementById("scheduleGrade"),
    section: document.getElementById("scheduleSection")
  };

  const schedulesStorageKey = "schedulesRegistry";
  const loadSchedules = () => {
    const fromDb = getDbValue("schedules", []);
    if (Array.isArray(fromDb) && fromDb.length) return fromDb;
    const rawLegacy = localStorage.getItem(schedulesStorageKey);
    if (!rawLegacy) return [];
    try {
      const parsed = JSON.parse(rawLegacy);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };
  const saveSchedules = (schedules) => {
    setDbValue("schedules", schedules);
    scheduleLegacyMirror(schedulesStorageKey, schedules);
  };

  const schedules = loadSchedules();

  const clearScheduleForm = () => {
    scheduleForm?.reset();
    editScheduleIndex = -1;
    if (saveScheduleBtn) saveScheduleBtn.innerHTML = '<i class="fa-solid fa-plus"></i>Agregar al horario';
  };

  const renderSchedules = () => {
    if (!scheduleTbody) return;
    if (!schedules.length) {
      scheduleTbody.innerHTML = `<tr><td colspan="7" class="empty-row">No hay sesiones registradas. Agregue la primera sesión usando el formulario.</td></tr>`;
      return;
    }
    scheduleTbody.innerHTML = schedules
      .map(
        (schedule, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${schedule.startTime}</td>
            <td>${schedule.endTime}</td>
            <td>${escapeHtml(schedule.curricularArea)}</td>
            <td>${schedule.grade}</td>
            <td>${schedule.section}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn-edit" data-action="edit" data-index="${index}" aria-label="Editar registro" title="Editar"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span class="btn-label">Editar</span></button>
                <button type="button" class="btn-delete" data-action="delete" data-index="${index}" aria-label="Eliminar registro" title="Eliminar"><i class="fa-solid fa-trash" aria-hidden="true"></i><span class="btn-label">Eliminar</span></button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  scheduleForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const newSchedule = {
      startTime: scheduleFields.startTime.value,
      endTime: scheduleFields.endTime.value,
      curricularArea: scheduleFields.curricularArea.value.trim(),
      grade: scheduleFields.grade.value,
      section: scheduleFields.section.value
    };

    if (!newSchedule.startTime || !newSchedule.endTime) {
      showToast("Indique hora de inicio y de fin.", { type: "warning" });
      return;
    }
    if (newSchedule.endTime <= newSchedule.startTime) {
      showToast("La hora de fin debe ser posterior a la hora de inicio.", { type: "error" });
      return;
    }
    if (!newSchedule.curricularArea) {
      showToast("Indique el área curricular.", { type: "warning" });
      return;
    }

    const conflict = schedules.find((schedule, idx) => {
      if (idx === editScheduleIndex) return false;
      if (schedule.grade !== newSchedule.grade || schedule.section !== newSchedule.section) return false;
      return schedule.startTime < newSchedule.endTime && newSchedule.startTime < schedule.endTime;
    });
    if (conflict) {
      const ok = window.confirm(
        `Aviso: existe otra clase del mismo grado/sección que se cruza con este horario (${conflict.startTime}-${conflict.endTime} ${conflict.curricularArea}). ¿Desea guardar de todos modos?`
      );
      if (!ok) return;
    }

    const wasEdit = editScheduleIndex >= 0;
    if (wasEdit) {
      schedules[editScheduleIndex] = newSchedule;
    } else {
      schedules.push(newSchedule);
    }

    saveSchedules(schedules);
    renderSchedules();
    clearScheduleForm();
    showToast(wasEdit ? "Sesión actualizada." : "Sesión agregada al horario.", { type: "success" });
  });

  scheduleTbody?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (Number.isNaN(index)) return;

    if (action === "delete") {
      const sessionInfo = schedules[index];
      const ok = window.confirm(
        sessionInfo
          ? `¿Eliminar la sesión de ${sessionInfo.curricularArea} (${sessionInfo.startTime}-${sessionInfo.endTime})?`
          : "¿Eliminar esta sesión?"
      );
      if (!ok) return;
      schedules.splice(index, 1);
      saveSchedules(schedules);
      renderSchedules();
      if (editScheduleIndex === index) clearScheduleForm();
      showToast("Sesión eliminada.", { type: "info" });
      return;
    }

    if (action === "edit") {
      const schedule = schedules[index];
      if (!schedule) return;
      scheduleFields.startTime.value = schedule.startTime;
      scheduleFields.endTime.value = schedule.endTime;
      scheduleFields.curricularArea.value = schedule.curricularArea;
      scheduleFields.grade.value = schedule.grade;
      scheduleFields.section.value = schedule.section;
      editScheduleIndex = index;
      if (saveScheduleBtn) saveScheduleBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>Actualizar horario';
    }
  });

  const getScheduleTeacherName = () => {
    const settings = loadSystemSettings();
    return (settings.teacherName || "").trim() || (localStorage.getItem(teacherNameStorageKey) || "").trim();
  };

  exportSchedulePdfBtn?.addEventListener("click", withExportLoadingState(exportSchedulePdfBtn, async () => {
    const jspdf = window.jspdf;
    if (!jspdf) {
      window.print();
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const REPORT_TITLE = "Horario Académico";
    const REPORT_SUBTITLE = "Nivel Primaria · Distribución semanal de sesiones";
    const seal = await generateDocumentSeal(REPORT_TITLE, `schedules:${schedules.length}`);

    const ordered = [...schedules].sort((a, b) => {
      const g = (a.grade || "").localeCompare(b.grade || "", "es");
      if (g !== 0) return g;
      const s = (a.section || "").localeCompare(b.section || "", "es");
      if (s !== 0) return s;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    const totalSessions = ordered.length;
    const uniqueAreas = new Set(ordered.map((s) => s.curricularArea).filter(Boolean)).size;
    const uniqueGroups = new Set(ordered.map((s) => `${s.grade}-${s.section}`)).size;

    let y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
    y = drawPdfMetaStrip(doc, y, [
      { label: "Total sesiones", value: String(totalSessions) },
      { label: "Áreas distintas", value: String(uniqueAreas) },
      { label: "Grupos atendidos", value: String(uniqueGroups) }
    ]);

    let counter = 0;
    let currentGroup = "";
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 12;

    const renderGroupBanner = (label) => {
      if (y + 9 > pageHeight - 22) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
      }
      doc.setFillColor(...PDF_BRAND.accent);
      doc.rect(marginX, y, pageWidth - 2 * marginX, 7.4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text(label, marginX + 3, y + 5.2);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 9;
    };

    const renderRowHeader = () => {
      doc.setFillColor(...PDF_BRAND.primary);
      doc.rect(marginX, y, pageWidth - 2 * marginX, 7.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.4);
      doc.setTextColor(255, 255, 255);
      doc.text("N°", marginX + 4, y + 5);
      doc.text("Inicio", marginX + 18, y + 5);
      doc.text("Fin", marginX + 38, y + 5);
      doc.text("Área curricular", marginX + 58, y + 5);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y += 7.5;
    };

    if (totalSessions === 0) {
      doc.setFontSize(10);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text("No hay sesiones registradas para este horario.", marginX + 2, y + 6);
      doc.setTextColor(0, 0, 0);
      y += 14;
    }

    ordered.forEach((schedule) => {
      const groupKey = `${schedule.grade} - Sección ${schedule.section}`;
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        const inGroup = ordered.filter((s) => `${s.grade} - Sección ${s.section}` === groupKey).length;
        renderGroupBanner(`${groupKey}   ·   ${inGroup} sesión(es)`);
        renderRowHeader();
        counter = 0;
      }
      counter += 1;
      const lines = doc.splitTextToSize(schedule.curricularArea || "—", pageWidth - 2 * marginX - 60);
      const rowH = Math.max(6.4, lines.length * 4.6 + 2);
      if (y + rowH > pageHeight - 22) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
        renderGroupBanner(`${groupKey} (continuación)`);
        renderRowHeader();
      }
      if (counter % 2 === 0) {
        doc.setFillColor(...PDF_BRAND.zebra);
        doc.rect(marginX, y, pageWidth - 2 * marginX, rowH, "F");
      }
      doc.setDrawColor(...PDF_BRAND.border);
      doc.setLineWidth(0.18);
      doc.line(marginX, y + rowH, marginX + pageWidth - 2 * marginX, y + rowH);
      doc.setFontSize(9);
      doc.setTextColor(...PDF_BRAND.textDark);
      const baseY = y + 4.6;
      doc.text(String(counter), marginX + 4, baseY);
      doc.text(schedule.startTime || "", marginX + 18, baseY);
      doc.text(schedule.endTime || "", marginX + 38, baseY);
      lines.forEach((line, li) => {
        doc.text(line, marginX + 58, baseY + li * 4.6);
      });
      doc.setTextColor(0, 0, 0);
      y += rowH;
    });

    drawPdfSignatureBlock(doc, y + 8);
    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, REPORT_TITLE, seal);
    doc.save("horario-primaria.pdf");
  }));

  exportScheduleExcelBtn?.addEventListener("click", () => {
    const columns = [
      { header: "N°", width: 5 },
      { header: "Grado", width: 8 },
      { header: "Sección", width: 8 },
      { header: "Hora de inicio", width: 14 },
      { header: "Hora de fin", width: 14 },
      { header: "Área curricular", width: 36 }
    ];
    const ordered = [...schedules].sort((a, b) => {
      const g = (a.grade || "").localeCompare(b.grade || "", "es");
      if (g !== 0) return g;
      const s = (a.section || "").localeCompare(b.section || "", "es");
      if (s !== 0) return s;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });
    const rows = ordered.map((schedule, idx) => [
      idx + 1,
      schedule.grade,
      schedule.section,
      schedule.startTime,
      schedule.endTime,
      schedule.curricularArea
    ]);
    const uniqueGroups = new Set(ordered.map((s) => `${s.grade}-${s.section}`)).size;
    exportSheetToExcel({
      filename: "horario-primaria.xlsx",
      sheetName: "Horario",
      reportTitle: "Horario Académico — Nivel Primaria",
      columns,
      rows,
      extraTopRows: [
        [`Total de sesiones: ${ordered.length}  ·  Grupos atendidos: ${uniqueGroups}`],
        []
      ]
    });
  });

  renderSchedules();
  saveSchedules(schedules);
  clearScheduleForm();
}

if (currentPage === "asistencia.html") {
  const attendanceMonthInput = document.getElementById("attendanceMonth");
  const exportAttendancePdfBtn = document.getElementById("exportAttendancePdfBtn");
  const exportAttendanceExcelBtn = document.getElementById("exportAttendanceExcelBtn");
  const closeMonthBtn = document.getElementById("closeMonthBtn");
  const openMonthBtn = document.getElementById("openMonthBtn");
  const attendanceThead = document.getElementById("attendanceThead");
  const attendanceTbody = document.getElementById("attendanceTbody");
  const monthlyPresentEl = document.getElementById("attendanceMonthlyPresent");
  const monthlyLateEl = document.getElementById("attendanceMonthlyLate");
  const monthlyAbsentEl = document.getElementById("attendanceMonthlyAbsent");
  const monthlyJustifiedEl = document.getElementById("attendanceMonthlyJustified");
  const monthlyRateEl = document.getElementById("attendanceMonthlyRate");
  const attendanceStorageKey = "attendanceRegistry";
  const attendanceClosedMonthsKey = "attendanceClosedMonths";
  const teacherNameStorageKey = "teacherSignatureName";
  const attendanceStatuses = ["✓", "F", "T", "J"];

  const getMonthKey = () => attendanceMonthInput?.value || "";
  const getMonthFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("month") || "";
  };
  const getTodayMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const getDaysInMonth = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  };

  const getDayInfo = (monthKey, day) => {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayIndex = date.getDay();
    const dayMap = ["D", "L", "M", "X", "J", "V", "S"];
    return {
      shortName: dayMap[dayIndex],
      isWeekend: dayIndex === 0 || dayIndex === 6
    };
  };

  const getWorkWeekIndex = (monthKey, day) => {
    const [year, month] = monthKey.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const dayOfWeek = firstDay.getDay();
    const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const firstWeekStart = new Date(year, month - 1, 1 + offsetToMonday);
    const currentDate = new Date(year, month - 1, day);
    const diffMs = currentDate.getTime() - firstWeekStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const loadAttendanceRegistry = () => {
    const fromDb = getDbValue("attendanceRegistry", {});
    if (fromDb && typeof fromDb === "object") return fromDb;
    const rawLegacy = localStorage.getItem(attendanceStorageKey);
    if (!rawLegacy) return {};
    try {
      const parsed = JSON.parse(rawLegacy);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const saveAttendanceRegistry = (registry) => {
    setDbValue("attendanceRegistry", registry);
    scheduleLegacyMirror(attendanceStorageKey, registry);
  };

  const loadClosedMonths = () => {
    const fromDb = getDbValue("attendanceClosedMonths", []);
    if (Array.isArray(fromDb)) return fromDb;
    const rawLegacy = localStorage.getItem(attendanceClosedMonthsKey);
    if (!rawLegacy) return [];
    try {
      const parsed = JSON.parse(rawLegacy);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveClosedMonths = (months) => {
    setDbValue("attendanceClosedMonths", months);
    scheduleLegacyMirror(attendanceClosedMonthsKey, months);
  };

  const isClosedMonth = (monthKey) => loadClosedMonths().includes(monthKey);

  const ensureMonthStructure = (registry, monthKey, students) => {
    if (!registry[monthKey]) registry[monthKey] = {};
    students.forEach((student) => {
      if (!registry[monthKey][student.dni]) registry[monthKey][student.dni] = {};
    });
  };

  const getStudentStats = (dayMap) => {
    const values = Object.values(dayMap || {});
    return {
      present: values.filter((status) => status === "✓").length,
      late: values.filter((status) => status === "T").length,
      absent: values.filter((status) => status === "F").length,
      justified: values.filter((status) => status === "J").length
    };
  };

  const updateMonthlySummary = (registry, monthKey, students) => {
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalJustified = 0;

    students.forEach((student) => {
      const dayMap = registry[monthKey]?.[student.dni] || {};
      const stats = getStudentStats(dayMap);
      totalPresent += stats.present;
      totalLate += stats.late;
      totalAbsent += stats.absent;
      totalJustified += stats.justified;
    });

    const totalMarked = totalPresent + totalLate + totalAbsent + totalJustified;
    const attendanceRate = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : 0;

    if (monthlyPresentEl) monthlyPresentEl.textContent = String(totalPresent);
    if (monthlyLateEl) monthlyLateEl.textContent = String(totalLate);
    if (monthlyAbsentEl) monthlyAbsentEl.textContent = String(totalAbsent);
    if (monthlyJustifiedEl) monthlyJustifiedEl.textContent = String(totalJustified);
    if (monthlyRateEl) monthlyRateEl.textContent = `${attendanceRate}%`;
  };

  const buildAttendanceTable = () => {
    const students = loadStudents();
    const monthKey = getMonthKey();
    if (!monthKey || !attendanceThead || !attendanceTbody) return;

    const registry = loadAttendanceRegistry();
    ensureMonthStructure(registry, monthKey, students);
    saveAttendanceRegistry(registry);

    const daysCount = getDaysInMonth(monthKey);
    const isMonthClosed = isClosedMonth(monthKey);
    const businessDays = Array.from({ length: daysCount }, (_, index) => index + 1).filter((day) => {
      const info = getDayInfo(monthKey, day);
      return !info.isWeekend;
    });

    const dayHeaders = businessDays.map((day) => {
      const info = getDayInfo(monthKey, day);
      const weekIndex = getWorkWeekIndex(monthKey, day);
      const weekClass = `attendance-week-tone-${((weekIndex - 1) % 6) + 1}`;
      return `<th class="attendance-day-header ${weekClass}" title="Semana ${weekIndex}">${info.shortName}<br>${day}</th>`;
    }).join("");

    attendanceThead.innerHTML = `
      <tr>
        <th>N°</th>
        <th>DNI</th>
        <th>Nombres y Apellidos (${getMonthLabel(monthKey)})</th>
        ${dayHeaders}
        <th>✓</th>
        <th>F</th>
        <th>T</th>
        <th>J</th>
      </tr>
    `;

    attendanceTbody.innerHTML = students
      .map((student, studentIndex) => {
        const dayMap = registry[monthKey][student.dni] || {};
        const dailyCells = businessDays.map((day) => {
          const value = dayMap[day] || "";
          const isDisabled = isMonthClosed;
          const weekIndex = getWorkWeekIndex(monthKey, day);
          const weekClass = `attendance-week-tone-${((weekIndex - 1) % 6) + 1}`;
          const statusClass = value
            ? ` status-${value === "✓" ? "present" : value === "F" ? "absent" : value === "T" ? "late" : "justified"}`
            : "";
          return `
            <td class="attendance-week-cell ${weekClass}" title="Semana ${weekIndex}">
              <select data-dni="${student.dni}" data-day="${day}" class="attendance-status${statusClass}" ${isDisabled ? "disabled" : ""}>
                <option value="" ${value === "" ? "selected" : ""}>-</option>
                ${attendanceStatuses.map((status) => `<option value="${status}" ${value === status ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </td>
          `;
        }).join("");

        const stats = getStudentStats(dayMap);
        return `
          <tr>
            <td>${studentIndex + 1}</td>
            <td>${student.dni}</td>
            <td>${student.fullName}</td>
            ${dailyCells}
            <td>${stats.present}</td>
            <td>${stats.absent}</td>
            <td>${stats.late}</td>
            <td>${stats.justified}</td>
          </tr>
        `;
      })
      .join("");

    updateMonthlySummary(registry, monthKey, students);
  };

  attendanceMonthInput?.addEventListener("change", () => {
    buildAttendanceTable();
  });

  closeMonthBtn?.addEventListener("click", () => {
    const monthKey = getMonthKey();
    if (!monthKey) return;
    const closedMonths = loadClosedMonths();
    if (!closedMonths.includes(monthKey)) {
      closedMonths.push(monthKey);
      saveClosedMonths(closedMonths);
    }
    buildAttendanceTable();
  });

  openMonthBtn?.addEventListener("click", () => {
    const monthKey = getMonthKey();
    if (!monthKey) return;
    const closedMonths = loadClosedMonths().filter((item) => item !== monthKey);
    saveClosedMonths(closedMonths);
    buildAttendanceTable();
  });

  attendanceTbody?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.classList.contains("attendance-status")) return;

    const monthKey = getMonthKey();
    if (!monthKey || isClosedMonth(monthKey)) {
      buildAttendanceTable();
      return;
    }

    const dni = target.dataset.dni || "";
    const day = Number(target.dataset.day || "0");
    if (!dni || !day) return;
    const registry = loadAttendanceRegistry();
    if (!registry[monthKey]) registry[monthKey] = {};
    if (!registry[monthKey][dni]) registry[monthKey][dni] = {};

    if (target.value) {
      registry[monthKey][dni][day] = target.value;
    } else {
      delete registry[monthKey][dni][day];
    }

    saveAttendanceRegistry(registry);
    buildAttendanceTable();
  });

  exportAttendancePdfBtn?.addEventListener("click", withExportLoadingState(exportAttendancePdfBtn, async () => {
    const monthKey = getMonthKey();
    if (!monthKey) return;

    const jspdf = window.jspdf;
    if (!jspdf) {
      window.print();
      return;
    }

    const students = loadStudents();
    const registry = loadAttendanceRegistry();
    ensureMonthStructure(registry, monthKey, students);
    const closedMonths = loadClosedMonths();
    const isClosed = closedMonths.includes(monthKey);

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const monthLabel = getMonthLabel(monthKey);
    const REPORT_TITLE = "Registro de Asistencia Mensual";
    const REPORT_SUBTITLE = `${monthLabel} · ${students.length} estudiantes${isClosed ? " · MES CERRADO" : ""}`;
    const seal = await generateDocumentSeal(REPORT_TITLE, `attendance:${monthKey}:${students.length}`);

    // Recopilar estadísticas
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalJustified = 0;
    const studentRows = students.map((student) => {
      const dayMap = registry[monthKey][student.dni] || {};
      const stats = getStudentStats(dayMap);
      totalPresent += stats.present;
      totalLate += stats.late;
      totalAbsent += stats.absent;
      totalJustified += stats.justified;
      const total = stats.present + stats.late + stats.absent + stats.justified;
      const rate = total ? Math.round(((stats.present + stats.late + stats.justified) / total) * 100) : 0;
      return { student, stats, total, rate };
    });
    const totalMarked = totalPresent + totalLate + totalAbsent + totalJustified;
    const attendanceRate = totalMarked
      ? Math.round(((totalPresent + totalLate + totalJustified) / totalMarked) * 100)
      : 0;

    let y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
    y = drawPdfMetaStrip(doc, y, [
      { label: "% Asistencia", value: `${attendanceRate}%` },
      { label: "Presentes", value: String(totalPresent) },
      { label: "Tardanzas", value: String(totalLate) },
      { label: "Justificadas", value: String(totalJustified) },
      { label: "Faltas", value: String(totalAbsent) }
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const cols = {
      n: { x: marginX + 2, w: 8 },
      dni: { x: marginX + 12, w: 22 },
      name: { x: marginX + 36, w: 96 },
      pres: { x: pageWidth - marginX - 70, w: 12 },
      abs: { x: pageWidth - marginX - 58, w: 12 },
      late: { x: pageWidth - marginX - 46, w: 12 },
      just: { x: pageWidth - marginX - 34, w: 12 },
      rate: { x: pageWidth - marginX - 22, w: 22 }
    };

    const drawTableHeader = (top) => {
      doc.setFillColor(...PDF_BRAND.primary);
      doc.rect(marginX, top, pageWidth - 2 * marginX, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("N°", cols.n.x, top + 5.5);
      doc.text("DNI", cols.dni.x, top + 5.5);
      doc.text("Apellidos y Nombres", cols.name.x, top + 5.5);
      doc.text("✓", cols.pres.x + cols.pres.w / 2, top + 5.5, { align: "center" });
      doc.text("F", cols.abs.x + cols.abs.w / 2, top + 5.5, { align: "center" });
      doc.text("T", cols.late.x + cols.late.w / 2, top + 5.5, { align: "center" });
      doc.text("J", cols.just.x + cols.just.w / 2, top + 5.5, { align: "center" });
      doc.text("% Asist.", cols.rate.x + cols.rate.w / 2, top + 5.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_BRAND.textDark);
      doc.setFontSize(9);
      return top + 8;
    };

    y = drawTableHeader(y);
    const rowH = 6.4;

    studentRows.forEach((entry, idx) => {
      if (y + rowH > pageHeight - 24) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
        y = drawTableHeader(y);
      }
      if (idx % 2 === 1) {
        doc.setFillColor(...PDF_BRAND.zebra);
        doc.rect(marginX, y, pageWidth - 2 * marginX, rowH, "F");
      }
      doc.setDrawColor(...PDF_BRAND.border);
      doc.setLineWidth(0.18);
      doc.line(marginX, y + rowH, marginX + pageWidth - 2 * marginX, y + rowH);
      const baseY = y + 4.4;
      doc.setTextColor(...PDF_BRAND.textDark);
      doc.text(String(idx + 1), cols.n.x, baseY);
      doc.text(entry.student.dni, cols.dni.x, baseY);
      const name = doc.splitTextToSize(entry.student.fullName || "—", cols.name.w - 2)[0] || "";
      doc.text(name, cols.name.x, baseY);
      doc.text(String(entry.stats.present), cols.pres.x + cols.pres.w / 2, baseY, { align: "center" });
      doc.text(String(entry.stats.absent), cols.abs.x + cols.abs.w / 2, baseY, { align: "center" });
      doc.text(String(entry.stats.late), cols.late.x + cols.late.w / 2, baseY, { align: "center" });
      doc.text(String(entry.stats.justified), cols.just.x + cols.just.w / 2, baseY, { align: "center" });

      // Coloreado de tasa: verde alto, amarillo medio, rojo bajo
      const rateColor =
        entry.rate >= 90 ? [22, 163, 74] : entry.rate >= 75 ? [202, 138, 4] : [220, 38, 38];
      doc.setTextColor(...rateColor);
      doc.setFont("helvetica", "bold");
      doc.text(`${entry.rate}%`, cols.rate.x + cols.rate.w / 2, baseY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_BRAND.textDark);
      y += rowH;
    });

    // Fila de totales con fondo azul claro
    if (y + 9 > pageHeight - 24) {
      doc.addPage();
      y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
    }
    doc.setFillColor(...PDF_BRAND.headerFill);
    doc.rect(marginX, y, pageWidth - 2 * marginX, 8.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.primaryDark);
    doc.text("TOTALES DEL MES", cols.name.x, y + 5.6);
    doc.text(String(totalPresent), cols.pres.x + cols.pres.w / 2, y + 5.6, { align: "center" });
    doc.text(String(totalAbsent), cols.abs.x + cols.abs.w / 2, y + 5.6, { align: "center" });
    doc.text(String(totalLate), cols.late.x + cols.late.w / 2, y + 5.6, { align: "center" });
    doc.text(String(totalJustified), cols.just.x + cols.just.w / 2, y + 5.6, { align: "center" });
    doc.text(`${attendanceRate}%`, cols.rate.x + cols.rate.w / 2, y + 5.6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Leyenda
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text(
      "Leyenda:  ✓ Asistencia    F Falta    T Tardanza    J Justificación      ·      % Asist. = (Presentes + Tardanzas + Justificaciones) / Total marcado",
      marginX,
      y
    );
    doc.setTextColor(0, 0, 0);
    y += 4;

    drawPdfSignatureBlock(doc, y + 6);
    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, `${REPORT_TITLE} — ${monthLabel}`, seal);
    doc.save(`asistencia-${monthKey}.pdf`);
  }));

  exportAttendanceExcelBtn?.addEventListener("click", () => {
    const monthKey = getMonthKey();
    if (!monthKey) {
      showToast("Seleccione un mes para exportar.", { type: "warning" });
      return;
    }
    const students = loadStudents();
    const registry = loadAttendanceRegistry();
    ensureMonthStructure(registry, monthKey, students);

    const daysCount = getDaysInMonth(monthKey);
    const businessDays = Array.from({ length: daysCount }, (_, idx) => idx + 1).filter(
      (day) => !getDayInfo(monthKey, day).isWeekend
    );

    const columns = [
      { header: "N°", width: 5 },
      { header: "DNI", width: 12 },
      { header: "Apellidos y Nombres", width: 36 },
      { header: "Grado", width: 8 },
      { header: "Sección", width: 8 },
      ...businessDays.map((day) => ({ header: String(day), width: 4 })),
      { header: "✓ Presentes", width: 11 },
      { header: "F Faltas", width: 9 },
      { header: "T Tardanzas", width: 12 },
      { header: "J Justif.", width: 9 },
      { header: "% Asist.", width: 9 }
    ];

    let totPres = 0, totAbs = 0, totLate = 0, totJust = 0;
    const rows = students.map((student, idx) => {
      const dayMap = registry[monthKey][student.dni] || {};
      const stats = getStudentStats(dayMap);
      const total = stats.present + stats.late + stats.absent + stats.justified;
      const rate = total ? Math.round(((stats.present + stats.late + stats.justified) / total) * 100) : 0;
      totPres += stats.present;
      totAbs += stats.absent;
      totLate += stats.late;
      totJust += stats.justified;
      return [
        idx + 1,
        student.dni,
        student.fullName,
        student.grade,
        student.section,
        ...businessDays.map((day) => dayMap[day] || ""),
        stats.present,
        stats.absent,
        stats.late,
        stats.justified,
        `${rate}%`
      ];
    });

    const grandTotal = totPres + totAbs + totLate + totJust;
    const grandRate = grandTotal
      ? Math.round(((totPres + totLate + totJust) / grandTotal) * 100)
      : 0;
    rows.push([
      "",
      "",
      "TOTALES DEL MES",
      "",
      "",
      ...businessDays.map(() => ""),
      totPres,
      totAbs,
      totLate,
      totJust,
      `${grandRate}%`
    ]);

    exportSheetToExcel({
      filename: `asistencia-${monthKey}.xlsx`,
      sheetName: `Asistencia ${monthKey}`,
      reportTitle: `Registro de Asistencia Mensual — ${getMonthLabel(monthKey)}`,
      columns,
      rows,
      extraTopRows: [
        [`Mes: ${monthKey}  |  Total estudiantes: ${students.length}  |  % asistencia general: ${grandRate}%`],
        ["Leyenda:", "✓ Asistencia", "F Falta", "T Tardanza", "J Justificación"],
        ["Cálculo:", "% Asist. = (Presentes + Tardanzas + Justificaciones) / Total marcado"],
        []
      ]
    });
  });

  if (attendanceMonthInput && !attendanceMonthInput.value) {
    const monthFromUrl = getMonthFromUrl();
    attendanceMonthInput.value = monthFromUrl || getTodayMonthKey();
  }
  buildAttendanceTable();
}

if (currentPage === "incidencias.html") {
  const incidentForm = document.getElementById("incidentForm");
  const exportIncidentsPdfBtn = document.getElementById("exportIncidentsPdfBtn");
  const exportIncidentsExcelBtn = document.getElementById("exportIncidentsExcelBtn");
  const incidentsTbody = document.getElementById("incidentsTbody");
  const saveIncidentBtn = document.getElementById("saveIncidentBtn");
  const incidentsStorageKey = "incidentsRegistry";
  const teacherNameStorageKey = "teacherSignatureName";
  let editIncidentIndex = -1;

  const incidentFields = {
    selector: document.getElementById("incidentStudentSelector"),
    dni: document.getElementById("incidentDni"),
    fullName: document.getElementById("incidentStudentName"),
    grade: document.getElementById("incidentGrade"),
    section: document.getElementById("incidentSection"),
    date: document.getElementById("incidentDate"),
    detail: document.getElementById("incidentDetail")
  };

  const getTodayDateValue = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value) => {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };

  const loadIncidents = () => {
    const fromDb = getDbValue("incidents", []);
    if (Array.isArray(fromDb)) return fromDb;
    const rawLegacy = localStorage.getItem(incidentsStorageKey);
    if (!rawLegacy) return [];
    try {
      const parsed = JSON.parse(rawLegacy);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveIncidents = (incidents) => {
    setDbValue("incidents", incidents);
    scheduleLegacyMirror(incidentsStorageKey, incidents);
  };

  const incidents = loadIncidents();

  const getStudentByDni = (dni) => loadStudents().find((student) => student.dni === dni);

  const renderStudentSelector = () => {
    if (!incidentFields.selector) return;
    const students = loadStudents();
    incidentFields.selector.innerHTML = `
      <option value="">Seleccione un estudiante</option>
      ${students
        .map(
          (student) =>
            `<option value="${student.dni}">${student.dni} - ${student.fullName} (${student.grade} ${student.section})</option>`
        )
        .join("")}
    `;
  };

  const fillStudentDataByDni = () => {
    const dni = incidentFields.dni.value.trim();
    const student = getStudentByDni(dni);
    incidentFields.fullName.value = student?.fullName || "";
    incidentFields.grade.value = student?.grade || "";
    incidentFields.section.value = student?.section || "";
    if (incidentFields.selector) {
      incidentFields.selector.value = student?.dni || "";
    }
  };

  const clearIncidentForm = () => {
    incidentForm?.reset();
    if (incidentFields.selector) incidentFields.selector.value = "";
    incidentFields.fullName.value = "";
    incidentFields.grade.value = "";
    incidentFields.section.value = "";
    editIncidentIndex = -1;
    if (saveIncidentBtn) saveIncidentBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Guardar incidencia';
  };

  const renderIncidents = () => {
    if (!incidentsTbody) return;
    if (!incidents.length) {
      incidentsTbody.innerHTML = `<tr><td colspan="8" class="empty-row">Sin incidencias registradas. Use el formulario para registrar la primera.</td></tr>`;
      return;
    }
    incidentsTbody.innerHTML = incidents
      .map((incident, index) => {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${incident.dni}</td>
            <td>${escapeHtml(incident.fullName)}</td>
            <td>${escapeHtml(incident.grade)}</td>
            <td>${escapeHtml(incident.section)}</td>
            <td>${formatDate(incident.date)}</td>
            <td>${escapeHtml(incident.detail)}</td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn-edit" data-action="edit" data-index="${index}" aria-label="Editar registro" title="Editar"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span class="btn-label">Editar</span></button>
                <button type="button" class="btn-delete" data-action="delete" data-index="${index}" aria-label="Eliminar registro" title="Eliminar"><i class="fa-solid fa-trash" aria-hidden="true"></i><span class="btn-label">Eliminar</span></button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  incidentFields.dni?.addEventListener("input", () => {
    fillStudentDataByDni();
  });

  incidentFields.selector?.addEventListener("change", () => {
    if (!incidentFields.selector) return;
    incidentFields.dni.value = incidentFields.selector.value;
    fillStudentDataByDni();
  });

  incidentForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    fillStudentDataByDni();
    const dni = incidentFields.dni.value.trim();
    if (!isValidDniFormat(dni)) {
      showToast("El DNI debe tener 8 dígitos numéricos.", { type: "error" });
      incidentFields.dni?.focus();
      return;
    }
    const student = getStudentByDni(dni);
    if (!student) {
      showToast("DNI no encontrado en el registro de estudiantes.", { type: "error" });
      return;
    }
    if (!incidentFields.detail.value.trim()) {
      showToast("Describa el detalle de la incidencia.", { type: "warning" });
      incidentFields.detail?.focus();
      return;
    }
    if (!incidentFields.date.value) {
      showToast("Indique la fecha de la incidencia.", { type: "warning" });
      incidentFields.date?.focus();
      return;
    }

    const incidentData = {
      id: editIncidentIndex >= 0 ? incidents[editIncidentIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dni,
      fullName: student.fullName,
      grade: student.grade,
      section: student.section,
      date: incidentFields.date.value,
      detail: incidentFields.detail.value.trim()
    };

    const today = getTodayDateValue();
    if (incidentData.date > today) {
      showToast("No se puede registrar una incidencia con fecha futura.", { type: "error" });
      return;
    }

    const wasEdit = editIncidentIndex >= 0;
    if (wasEdit) {
      incidents[editIncidentIndex] = incidentData;
    } else {
      incidents.push(incidentData);
    }

    saveIncidents(incidents);
    renderIncidents();
    clearIncidentForm();
    showToast(wasEdit ? "Incidencia actualizada." : "Incidencia registrada.", { type: "success" });
  });

  incidentsTbody?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;

    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (Number.isNaN(index)) return;

    if (action === "delete") {
      const incidentItem = incidents[index];
      const ok = window.confirm(
        incidentItem
          ? `¿Eliminar la incidencia de ${incidentItem.fullName} (${formatDate(incidentItem.date)})?`
          : "¿Eliminar esta incidencia?"
      );
      if (!ok) return;
      incidents.splice(index, 1);
      saveIncidents(incidents);
      renderIncidents();
      if (editIncidentIndex === index) clearIncidentForm();
      showToast("Incidencia eliminada.", { type: "info" });
      return;
    }

    if (action === "edit") {
      const incident = incidents[index];
      if (!incident) return;
      if (incidentFields.selector) incidentFields.selector.value = incident.dni;
      incidentFields.dni.value = incident.dni;
      incidentFields.fullName.value = incident.fullName;
      incidentFields.grade.value = incident.grade;
      incidentFields.section.value = incident.section;
      incidentFields.date.value = incident.date;
      incidentFields.detail.value = incident.detail;
      editIncidentIndex = index;
      if (saveIncidentBtn) saveIncidentBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>Actualizar incidencia';
    }
  });

  exportIncidentsPdfBtn?.addEventListener("click", withExportLoadingState(exportIncidentsPdfBtn, async () => {
    const jspdf = window.jspdf;
    if (!jspdf) {
      window.print();
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const contentWidth = pageWidth - 2 * marginX;
    const lineHeight = 5;
    const REPORT_TITLE = "Registro de Incidencias";
    const REPORT_SUBTITLE = "Nivel Primaria · Cronológico por fecha";
    const seal = await generateDocumentSeal(REPORT_TITLE, `incidents:${incidents.length}`);

    // Ordenar por fecha ascendente
    const ordered = [...incidents].sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || ""))
    );

    // Estadísticas automáticas
    const byMonth = {};
    const byGrade = {};
    const byStudent = {};
    ordered.forEach((inc) => {
      const monthKey = String(inc.date || "").slice(0, 7);
      if (monthKey) byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
      if (inc.grade) byGrade[inc.grade] = (byGrade[inc.grade] || 0) + 1;
      if (inc.dni) byStudent[inc.dni] = (byStudent[inc.dni] || 0) + 1;
    });
    const studentsConRecurrencia = Object.entries(byStudent).filter(([, c]) => c >= 2).length;
    const mesActivo = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];

    let y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
    y = drawPdfMetaStrip(doc, y, [
      { label: "Total incidencias", value: String(ordered.length) },
      { label: "Mes con más casos", value: mesActivo ? `${mesActivo[0]} (${mesActivo[1]})` : "—" },
      { label: "Estudiantes con ≥2", value: String(studentsConRecurrencia) },
      {
        label: "Por grado",
        value:
          Object.entries(byGrade)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([g, c]) => `${g}:${c}`)
            .join("  ") || "—"
      }
    ]);

    const ensureSpace = (needed) => {
      if (y + needed > pageHeight - 22) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, REPORT_TITLE, { subtitle: REPORT_SUBTITLE });
      }
    };

    const writeWrappedText = (text, x, options = {}) => {
      const maxWidth = options.maxWidth ?? contentWidth - (x - marginX);
      const lines = doc.splitTextToSize(String(text ?? ""), maxWidth);
      lines.forEach((line) => {
        ensureSpace(lineHeight);
        doc.text(line, x, y);
        y += lineHeight;
      });
    };

    if (!ordered.length) {
      doc.setFontSize(10);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text("Sin incidencias registradas para el periodo actual.", marginX, y);
      doc.setTextColor(0, 0, 0);
      y += 14;
    }

    ordered.forEach((incident, idx) => {
      const cardH = 6;
      ensureSpace(cardH + lineHeight * 2 + 6);
      // Encabezado de tarjeta (banda azul oscura)
      doc.setFillColor(...PDF_BRAND.primaryDark);
      doc.rect(marginX, y, contentWidth, cardH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(
        `Incidencia N° ${idx + 1}  ·  ${formatDate(incident.date) || "Sin fecha"}  ·  ${incident.grade || "—"} ${incident.section || ""}`,
        marginX + 3,
        y + 4.2
      );
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += cardH + 1;

      // Datos del estudiante
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Estudiante:", marginX + 1, y + 4);
      doc.setFont("helvetica", "normal");
      doc.text(`${incident.fullName || "—"} · DNI ${incident.dni || "—"}`, marginX + 22, y + 4);
      y += 6.5;

      // Detalle con caja
      doc.setFont("helvetica", "bold");
      doc.text("Detalle:", marginX + 1, y);
      doc.setFont("helvetica", "normal");
      y += 4;
      writeWrappedText(incident.detail || "—", marginX + 4, { maxWidth: contentWidth - 8 });

      // Separador entre tarjetas
      y += 2;
      ensureSpace(2);
      doc.setDrawColor(...PDF_BRAND.border);
      doc.setLineWidth(0.25);
      doc.line(marginX, y, marginX + contentWidth, y);
      y += 4;
    });

    drawPdfSignatureBlock(doc, y + 4);
    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, REPORT_TITLE, seal);
    doc.save("incidencias-primaria.pdf");
  }));

  exportIncidentsExcelBtn?.addEventListener("click", () => {
    const columns = [
      { header: "N°", width: 5 },
      { header: "Fecha", width: 12 },
      { header: "DNI", width: 12 },
      { header: "Apellidos y Nombres", width: 36 },
      { header: "Grado", width: 8 },
      { header: "Sección", width: 8 },
      { header: "Detalle de incidencia", width: 60 }
    ];
    const ordered = [...incidents].sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || ""))
    );
    const rows = ordered.map((incident, idx) => [
      idx + 1,
      formatDateEs(incident.date),
      incident.dni,
      incident.fullName,
      incident.grade,
      incident.section,
      incident.detail
    ]);
    const byMonth = {};
    ordered.forEach((inc) => {
      const m = String(inc.date || "").slice(0, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + 1;
    });
    const monthBreakdown = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, c]) => `${m}: ${c}`)
      .join(" · ");
    exportSheetToExcel({
      filename: "incidencias-primaria.xlsx",
      sheetName: "Incidencias",
      reportTitle: "Registro de Incidencias — Nivel Primaria",
      columns,
      rows,
      extraTopRows: [
        [`Total de incidencias: ${ordered.length}`],
        [`Distribución mensual: ${monthBreakdown || "—"}`],
        []
      ]
    });
  });

  renderStudentSelector();
  renderIncidents();
  if (incidentFields.date) incidentFields.date.max = getTodayDateValue();
  clearIncidentForm();

  window.addEventListener("storage", (event) => {
    if (event.key === SYSTEM_DB_KEY || event.key === "studentsRegistry") {
      renderStudentSelector();
    }
    if (event.key === SYSTEM_DB_KEY || event.key === "incidentsRegistry") {
      incidents.splice(0, incidents.length, ...loadIncidents());
      renderIncidents();
    }
  });
}

if (currentPage === "calificaciones.html") {
  const gradesThead = document.getElementById("gradesThead");
  const gradesTbody = document.getElementById("gradesTbody");
  const exportGradesPdfBtn = document.getElementById("exportGradesPdfBtn");
  const exportGradesExcelBtn = document.getElementById("exportGradesExcelBtn");
  const bimesterSelect = document.getElementById("bimesterSelect");
  const bimesterStatusText = document.getElementById("bimesterStatusText");
  const closeBimesterBtn = document.getElementById("closeBimesterBtn");
  const reopenBimesterBtn = document.getElementById("reopenBimesterBtn");
  const areaListEl = document.getElementById("areaList");
  const selectedAreaTitle = document.getElementById("selectedAreaTitle");
  const selectedAreaSubtitle = document.getElementById("selectedAreaSubtitle");
  const gradesEmptyHint = document.getElementById("gradesEmptyHint");

  const gradesCnebStorageKey = "gradesCnebBimesters";
  const teacherNameStorageKey = "teacherSignatureName";

  /** Claves antiguas cuando la transversal era un solo bloque con 3 evaluaciones (`__ctv__` + sufijo). */
  const LEGACY_TRANSVERSAL_ID = "__ctv__";

  const BIMESTER_LABELS = {
    I: "BIMESTRE I",
    II: "BIMESTRE II",
    III: "BIMESTRE III",
    IV: "BIMESTRE IV"
  };

  /** Dos competencias transversales por área: una columna de calificativo cada una (sin triple evaluación). */
  const TRANSVERSAL_COMPETENCIAS = [
    {
      id: "ctv_tic",
      short: "TIC",
      label: "Se desenvuelve en entornos virtuales generados por la TIC."
    },
    {
      id: "ctv_gest_ap",
      short: "Gest. ap.",
      label: "Gestiona su aprendizaje de manera autónoma."
    }
  ];

  const TRANSVERSAL_IDS = new Set(TRANSVERSAL_COMPETENCIAS.map((c) => c.id));

  const CNEB_AREAS = [
    {
      key: "comunicacion",
      label: "Comunicación",
      competencias: [
        { id: "com_oral", label: "Se comunica oralmente en su lengua materna.", short: "C1" },
        { id: "com_lee", label: "Lee diversos tipos de textos escritos.", short: "C2" },
        { id: "com_esc", label: "Escribe diversos tipos de textos escritos.", short: "C3" }
      ]
    },
    {
      key: "castellano_segunda_lengua",
      label: "Castellano como segunda lengua",
      competencias: [
        {
          id: "csl_oral",
          label: "Se comunica oralmente en castellano como segunda lengua",
          short: "CSL1"
        },
        {
          id: "csl_lee",
          label: "Lee diversos tipos de textos en castellano como segunda lengua",
          short: "CSL2"
        },
        {
          id: "csl_esc",
          label: "Escribe diversos tipos de textos en castellano como segunda lengua",
          short: "CSL3"
        }
      ]
    },
    {
      key: "matematica",
      label: "Matemática",
      competencias: [
        { id: "mat_cant", label: "Resuelve problemas de cantidad", short: "M1" },
        { id: "mat_reg", label: "Resuelve problemas de regularidad, equivalencia y cambio", short: "M2" },
        { id: "mat_form", label: "Resuelve problemas de movimiento, forma y localización", short: "M3" },
        { id: "mat_datos", label: "Resuelve problemas de gestión de datos e incertidumbre", short: "M4" }
      ]
    },
    {
      key: "personal_social",
      label: "Personal Social",
      competencias: [
        { id: "ps_identidad", label: "Construye su identidad", short: "PS1" },
        { id: "ps_convive", label: "Convive y participa democráticamente", short: "PS2" },
        { id: "ps_hist_interp", label: "Construye interpretaciones históricas", short: "PS3" },
        { id: "ps_espacio_ambiente", label: "Gestiona responsablemente el espacio y el ambiente", short: "PS4" },
        { id: "ps_recursos_economicos", label: "Gestiona responsablemente los recursos económicos", short: "PS5" }
      ]
    },
    {
      key: "ciencia_tecnologia",
      label: "Ciencia y Tecnología",
      competencias: [
        { id: "ct_ind", label: "Indaga mediante métodos científicos para construir conocimientos", short: "CT1" },
        {
          id: "ct_exp",
          label:
            "Explica el mundo natural y artificial en base a conocimientos sobre los seres vivos; materia y energía; biodiversidad, Tierra y Universo",
          short: "CT2"
        },
        {
          id: "ct_dis",
          label: "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
          short: "CT3"
        }
      ]
    },
    {
      key: "religion",
      label: "Educación Religiosa",
      competencias: [
        {
          id: "rel_identidad_humana",
          label:
            "Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente, comprendiendo la doctrina de su propia religión, abierto al diálogo con las que le son cercanas",
          short: "R1"
        },
        {
          id: "rel_encuentro_proyecto",
          label:
            "Asume la experiencia del encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa",
          short: "R2"
        }
      ]
    },
    {
      key: "arte_cultura",
      label: "Arte y Cultura",
      competencias: [
        { id: "ac_ap", label: "Aprecia críticamente manifestaciones artístico-culturales.", short: "AC1" },
        { id: "ac_crea", label: "Crea proyectos desde los lenguajes artísticos.", short: "AC2" }
      ]
    },
    {
      key: "educacion_fisica",
      label: "Educación Física",
      competencias: [
        { id: "ef_auto", label: "Se desenvuelve de manera autónoma a través de su motricidad", short: "EF1" },
        { id: "ef_vida_saludable", label: "Asume una vida saludable", short: "EF2" },
        { id: "ef_sociomotriz", label: "Interactúa a través de sus habilidades sociomotrices", short: "EF3" }
      ]
    },
    {
      key: "ingles",
      label: "Inglés",
      competencias: [
        { id: "in_oral", label: "Se comunica oralmente en Inglés como lengua extranjera", short: "I1" },
        { id: "in_lee", label: "Lee diversos tipos de textos en Inglés como lengua extranjera", short: "I2" },
        { id: "in_esc", label: "Escribe diversos tipos de textos en Inglés como lengua extranjera", short: "I3" }
      ]
    }
  ];

  /** Orden de menor a mayor logro: C → B → A → AD (valores almacenados sin cambio). */
  const CALIFICATIVO_OPTIONS = [
    { value: "", label: "—" },
    { value: "C", label: "C" },
    { value: "B", label: "B" },
    { value: "A", label: "A" },
    { value: "AD", label: "AD" }
  ];

  /** Tres columnas de calificación por competencia (evaluación 1, 2 y 3). */
  const GRADE_EVAL_MOMENTS = [
    { suffix: "1", sublabel: "1" },
    { suffix: "2", sublabel: "2" },
    { suffix: "3", sublabel: "3" }
  ];

  const emptyBimester = () => ({ closed: false, grades: {} });

  const normalizeRegistry = (raw) => {
    const base = { I: emptyBimester(), II: emptyBimester(), III: emptyBimester(), IV: emptyBimester() };
    if (!raw || typeof raw !== "object") return base;
    for (const id of ["I", "II", "III", "IV"]) {
      const b = raw[id];
      if (b && typeof b === "object") {
        base[id] = {
          closed: Boolean(b.closed),
          grades: b.grades && typeof b.grades === "object" ? JSON.parse(JSON.stringify(b.grades)) : {}
        };
      }
    }
    return base;
  };

  const migrateLegacyGrades = (reg) => {
    let changed = false;
    for (const bid of ["I", "II", "III", "IV"]) {
      const b = reg[bid];
      if (!b.grades) continue;
      for (const dni of Object.keys(b.grades)) {
        const st = b.grades[dni];
        if (!st || typeof st !== "object") continue;
        CNEB_AREAS.forEach((area) => {
          const cell = st[area.key];
          if (typeof cell === "string" && (cell === "AD" || cell === "C" || cell === "B" || cell === "A")) {
            const firstId = area.competencias[0]?.id;
            if (firstId) {
              st[area.key] = { [firstId]: cell };
              changed = true;
            }
          }
        });
      }
    }
    return changed;
  };

  const getAllCnebCompetencyIds = () => {
    const ids = new Set();
    CNEB_AREAS.forEach((area) => {
      [...area.competencias, ...TRANSVERSAL_COMPETENCIAS].forEach((c) => ids.add(c.id));
    });
    return ids;
  };

  const isValidGradeLetter = (v) => v === "AD" || v === "C" || v === "B" || v === "A";

  /** Pasa de tres notas bajo `__ctv___1`… a `ctv_tic` y `ctv_gest_ap`. */
  const migrateLegacyTransversalTripleToDual = (reg) => {
    const legacy1 = `${LEGACY_TRANSVERSAL_ID}_1`;
    const legacy2 = `${LEGACY_TRANSVERSAL_ID}_2`;
    const legacy3 = `${LEGACY_TRANSVERSAL_ID}_3`;
    const areaKeys = new Set(CNEB_AREAS.map((a) => a.key));
    let changed = false;
    for (const bid of ["I", "II", "III", "IV"]) {
      const b = reg[bid];
      if (!b.grades) continue;
      for (const dni of Object.keys(b.grades)) {
        const st = b.grades[dni];
        if (!st || typeof st !== "object") continue;
        for (const areaKey of Object.keys(st)) {
          if (!areaKeys.has(areaKey)) continue;
          const obj = st[areaKey];
          if (!obj || typeof obj !== "object") continue;

          const flatLegacy = obj[LEGACY_TRANSVERSAL_ID];
          if (typeof flatLegacy === "string" && isValidGradeLetter(flatLegacy)) {
            if (!isValidGradeLetter(obj.ctv_tic)) obj.ctv_tic = flatLegacy;
            delete obj[LEGACY_TRANSVERSAL_ID];
            changed = true;
          }

          const hasTriple = [legacy1, legacy2, legacy3].some((k) => k in obj);
          if (!hasTriple) continue;
          const g1 = obj[legacy1];
          const g2 = obj[legacy2];
          const g3 = obj[legacy3];
          if (isValidGradeLetter(g1) && !isValidGradeLetter(obj.ctv_tic)) obj.ctv_tic = g1;
          if (isValidGradeLetter(g2) && !isValidGradeLetter(obj.ctv_gest_ap)) obj.ctv_gest_ap = g2;
          if (isValidGradeLetter(g3) && !isValidGradeLetter(obj.ctv_gest_ap)) obj.ctv_gest_ap = g3;
          delete obj[legacy1];
          delete obj[legacy2];
          delete obj[legacy3];
          changed = true;
        }
      }
    }
    return changed;
  };

  /** Migra { com_oral: "B" } → { com_oral_1: "B" } (una sola columna antigua → primera evaluación). */
  const migrateSingleColumnCompetenciesToTriple = (reg) => {
    const allIds = getAllCnebCompetencyIds();
    let changed = false;
    for (const bid of ["I", "II", "III", "IV"]) {
      const b = reg[bid];
      if (!b.grades) continue;
      for (const dni of Object.keys(b.grades)) {
        const st = b.grades[dni];
        if (!st || typeof st !== "object") continue;
        for (const areaKey of Object.keys(st)) {
          const obj = st[areaKey];
          if (!obj || typeof obj !== "object") continue;
          for (const key of Object.keys(obj)) {
            if (/_1$|_2$|_3$/.test(key)) continue;
            if (TRANSVERSAL_IDS.has(key)) continue;
            if (!allIds.has(key)) continue;
            const val = obj[key];
            if (val === "AD" || val === "C" || val === "B" || val === "A") {
              obj[`${key}_1`] = val;
              delete obj[key];
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  };

  const parseLegacyGrades = () => {
    const raw = localStorage.getItem(gradesCnebStorageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  };

  const loadGradesRegistry = () => {
    const fromDb = getDbValue("gradesCnebBimesters", null);
    const source = fromDb && typeof fromDb === "object" ? fromDb : parseLegacyGrades();
    const reg = normalizeRegistry(source);
    let persist = false;
    if (migrateLegacyGrades(reg)) persist = true;
    if (migrateLegacyTransversalTripleToDual(reg)) persist = true;
    if (migrateSingleColumnCompetenciesToTriple(reg)) persist = true;
    if (persist) {
      setDbValue("gradesCnebBimesters", reg);
      scheduleLegacyMirror(gradesCnebStorageKey, reg);
    }
    return reg;
  };

  let registry = loadGradesRegistry();
  let selectedAreaKey = CNEB_AREAS[0]?.key || "";

  const saveGradesRegistry = () => {
    setDbValue("gradesCnebBimesters", registry);
    scheduleLegacyMirror(gradesCnebStorageKey, registry);
  };

  const getAreaDef = (key) => CNEB_AREAS.find((a) => a.key === key) || null;

  const getCurrentBimesterId = () => bimesterSelect?.value || "I";

  const getBimesterState = () => registry[getCurrentBimesterId()] || emptyBimester();

  const isBimesterClosed = () => getBimesterState().closed;

  const updateBimesterUi = () => {
    const id = getCurrentBimesterId();
    const closed = isBimesterClosed();
    if (bimesterStatusText) {
      bimesterStatusText.textContent = closed
        ? `${BIMESTER_LABELS[id]} — Cerrado (solo lectura).`
        : `${BIMESTER_LABELS[id]} — Abierto al registro.`;
    }
    if (closeBimesterBtn) closeBimesterBtn.classList.toggle("hidden", closed);
    if (reopenBimesterBtn) reopenBimesterBtn.classList.toggle("hidden", !closed);
  };

  const getColumnsForArea = (area) => [...area.competencias, ...TRANSVERSAL_COMPETENCIAS];

  /** Debe coincidir con las clases `.grades-comp-tone--0` … en `styles.css`. */
  const AREA_COMP_TONE_COUNT = 8;

  const getToneClassForAreaCompIndex = (compIndex) =>
    `grades-comp-tone--${compIndex % AREA_COMP_TONE_COUNT}`;

  const getToneClassForTransversal = (transversalId) =>
    transversalId === "ctv_tic" ? "grades-comp-tone--trans-tic" : "grades-comp-tone--trans-gest";

  const getFlatMomentColumnsForArea = (area) => {
    const out = [];
    area.competencias.forEach((c, compIdx) => {
      const toneClass = getToneClassForAreaCompIndex(compIdx);
      GRADE_EVAL_MOMENTS.forEach((m) => {
        out.push({
          storageKey: `${c.id}_${m.suffix}`,
          compShort: c.short,
          sublabel: m.sublabel,
          ariaBase: c.label,
          toneClass
        });
      });
    });
    TRANSVERSAL_COMPETENCIAS.forEach((c) => {
      out.push({
        storageKey: c.id,
        compShort: c.short,
        sublabel: "",
        ariaBase: c.label,
        toneClass: getToneClassForTransversal(c.id)
      });
    });
    return out;
  };

  const getStudentGrade = (dni, areaKey, storageKey) => {
    const cell = getBimesterState().grades[dni]?.[areaKey];
    if (!cell || typeof cell !== "object") return "";
    const v = cell[storageKey];
    return v === "AD" || v === "C" || v === "B" || v === "A" ? v : "";
  };

  const setStudentGrade = (dni, areaKey, storageKey, value) => {
    const bid = getCurrentBimesterId();
    if (!registry[bid]) registry[bid] = emptyBimester();
    if (!registry[bid].grades[dni]) registry[bid].grades[dni] = {};
    if (!registry[bid].grades[dni][areaKey] || typeof registry[bid].grades[dni][areaKey] !== "object") {
      registry[bid].grades[dni][areaKey] = {};
    }
    const obj = registry[bid].grades[dni][areaKey];
    if (value === "AD" || value === "C" || value === "B" || value === "A") {
      obj[storageKey] = value;
    } else {
      delete obj[storageKey];
    }
    if (Object.keys(obj).length === 0) {
      delete registry[bid].grades[dni][areaKey];
      if (Object.keys(registry[bid].grades[dni]).length === 0) {
        delete registry[bid].grades[dni];
      }
    }
    saveGradesRegistry();
  };

  const renderAreaList = () => {
    if (!areaListEl) return;
    areaListEl.innerHTML = CNEB_AREAS.map(
      (a) => `
      <li>
        <button type="button" class="area-list-item${a.key === selectedAreaKey ? " is-active" : ""}" data-area="${a.key}">
          ${a.label}
        </button>
      </li>
    `
    ).join("");
  };

  const updateSelectedAreaHeader = () => {
    const area = getAreaDef(selectedAreaKey);
    if (selectedAreaTitle) {
      selectedAreaTitle.textContent = area ? `${area.label} — ${BIMESTER_LABELS[getCurrentBimesterId()]}` : "—";
    }
    if (selectedAreaSubtitle && gradesEmptyHint) {
      if (area) {
        selectedAreaSubtitle.innerHTML = getColumnsForArea(area)
          .map((c, i) => {
            const isTr = TRANSVERSAL_IDS.has(c.id);
            const toneClass = isTr ? getToneClassForTransversal(c.id) : getToneClassForAreaCompIndex(i);
            const note = isTr ? "" : ' <em class="grades-comp-moments">(3 columnas: eval. 1, 2 y 3)</em>';
            return `<span class="grades-comp-line ${toneClass}"><strong>${i + 1}. ${c.short}</strong> — ${c.label}${note}</span>`;
          })
          .join("");
        selectedAreaSubtitle.classList.remove("hidden");
        gradesEmptyHint.classList.add("hidden");
      } else {
        selectedAreaSubtitle.innerHTML = "";
        selectedAreaSubtitle.classList.add("hidden");
        gradesEmptyHint.classList.remove("hidden");
      }
    }
  };

  const renderGradesThead = (area) => {
    if (!gradesThead) return;
    if (!area) {
      gradesThead.innerHTML = "";
      return;
    }
    const regular = area.competencias;
    const row1Regular = regular
      .map(
        (c, compIdx) =>
          `<th colspan="3" class="grades-th-comp-group ${getToneClassForAreaCompIndex(
            compIdx
          )}" title="${c.label.replace(/"/g, "&quot;")}">${c.short}</th>`
      )
      .join("");
    const row1Trans = TRANSVERSAL_COMPETENCIAS.map(
      (c) =>
        `<th rowspan="2" class="grades-th-transversal ${getToneClassForTransversal(
          c.id
        )}" title="${c.label.replace(/"/g, "&quot;")}">${c.short}</th>`
    ).join("");
    const row2Moments = regular
      .map((_, compIdx) => {
        const tone = getToneClassForAreaCompIndex(compIdx);
        return `<th class="grades-th-moment ${tone}">1</th><th class="grades-th-moment ${tone}">2</th><th class="grades-th-moment ${tone}">3</th>`;
      })
      .join("");
    gradesThead.innerHTML = `
      <tr>
        <th rowspan="2" class="grades-th-sticky">N°</th>
        <th rowspan="2" class="grades-th-sticky">DNI</th>
        <th rowspan="2" class="grades-th-sticky">Estudiante</th>
        ${row1Regular}
        ${row1Trans}
      </tr>
      <tr>${row2Moments}</tr>
    `;
  };

  const renderGrades = () => {
    renderAreaList();
    updateBimesterUi();
    const area = getAreaDef(selectedAreaKey);
    updateSelectedAreaHeader();
    renderGradesThead(area);
    if (!gradesTbody) return;
    if (!area) {
      gradesTbody.innerHTML = "";
      return;
    }
    const students = loadStudents();
    const closed = isBimesterClosed();
    const flatCols = getFlatMomentColumnsForArea(area);

    gradesTbody.innerHTML = students
      .map((student, index) => {
        const cells = flatCols
          .map((col) => {
            const val = getStudentGrade(student.dni, area.key, col.storageKey);
            const options = CALIFICATIVO_OPTIONS.map(
              (opt) => `<option value="${opt.value}" ${opt.value === val ? "selected" : ""}>${opt.label}</option>`
            ).join("");
            const aria = col.sublabel
              ? `${col.ariaBase} — eval. ${col.sublabel} — ${student.fullName}`
              : `${col.ariaBase} — ${student.fullName}`;
            return `<td class="grades-td-moment ${col.toneClass}"><select class="grade-select" data-dni="${student.dni}" data-area="${area.key}" data-grade-key="${col.storageKey}" aria-label="${aria.replace(/"/g, "&quot;")}" ${closed ? "disabled" : ""}>${options}</select></td>`;
          })
          .join("");
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${student.dni}</td>
            <td>${student.fullName}</td>
            ${cells}
          </tr>
        `;
      })
      .join("");
  };

  areaListEl?.addEventListener("click", (event) => {
    const btn = event.target.closest(".area-list-item");
    if (!(btn instanceof HTMLButtonElement)) return;
    const key = btn.dataset.area || "";
    if (!getAreaDef(key)) return;
    selectedAreaKey = key;
    renderGrades();
  });

  gradesTbody?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!target.classList.contains("grade-select")) return;
    if (isBimesterClosed()) return;
    const dni = target.dataset.dni || "";
    const areaKey = target.dataset.area || "";
    const gradeKey = target.dataset.gradeKey || "";
    if (!dni || !areaKey || !gradeKey) return;
    setStudentGrade(dni, areaKey, gradeKey, target.value);
  });

  bimesterSelect?.addEventListener("change", () => {
    registry = loadGradesRegistry();
    renderGrades();
  });

  closeBimesterBtn?.addEventListener("click", () => {
    if (isBimesterClosed()) return;
    const id = getCurrentBimesterId();
    const ok = window.confirm(
      `¿Cerrar ${BIMESTER_LABELS[id]}? No podrá editar calificativos hasta reabrir el bimestre.`
    );
    if (!ok) return;
    registry = loadGradesRegistry();
    if (!registry[id]) registry[id] = emptyBimester();
    registry[id].closed = true;
    saveGradesRegistry();
    renderGrades();
  });

  reopenBimesterBtn?.addEventListener("click", () => {
    if (!isBimesterClosed()) return;
    const id = getCurrentBimesterId();
    const ok = window.confirm(
      `¿Reabrir ${BIMESTER_LABELS[id]}? Use esta opción solo en caso de corrección autorizada.`
    );
    if (!ok) return;
    registry = loadGradesRegistry();
    if (!registry[id]) registry[id] = emptyBimester();
    registry[id].closed = false;
    saveGradesRegistry();
    renderGrades();
  });

  exportGradesPdfBtn?.addEventListener("click", withExportLoadingState(exportGradesPdfBtn, async () => {
    const jspdf = window.jspdf;
    if (!jspdf) {
      window.print();
      return;
    }
    const area = getAreaDef(selectedAreaKey);
    if (!area) {
      showToast("Seleccione un área curricular en la lista.", { type: "warning" });
      return;
    }

    const students = loadStudents();
    registry = loadGradesRegistry();
    const bid = getCurrentBimesterId();
    const bimesterBlock = registry[bid] || emptyBimester();
    const cols = getFlatMomentColumnsForArea(area);
    const { jsPDF } = jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const bimesterTitle = `${BIMESTER_LABELS[bid]}${bimesterBlock.closed ? " (cerrado)" : ""}`;
    const seal = await generateDocumentSeal(
      `Calificaciones · ${area.label}`,
      `grades:${bid}:${area.key}:${students.length}`
    );
    let y = drawPdfInstitutionHeader(doc, `CNEB — ${area.label} — ${bimesterTitle}`);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margin = 14;
    const tableX = margin;
    const cwNum = 11;
    const cwDni = 26;
    const colNameX = tableX + cwNum + cwDni;
    const nameColW = 48;
    const col0 = colNameX + nameColW + 2;
    const gradeZoneW = pageW - margin - col0;
    const colW = Math.min(26, gradeZoneW / Math.max(cols.length, 1));
    const numTextX = tableX + cwNum / 2;
    const dniTextX = tableX + cwNum + cwDni / 2;
    const totalTableW = col0 + cols.length * colW - tableX;

    const headerFs = cols.length > 16 ? 4.2 : cols.length > 10 ? 4.8 : 5.5;
    const headerLineStep = 2.05;
    const headerRow2H = 5.2;
    const mergedCompW = 3 * colW - 0.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(headerFs);
    const compHeaderLineArrays = area.competencias.map((c) =>
      doc.splitTextToSize(c.label, mergedCompW)
    );
    const maxCompLines = Math.max(1, ...compHeaderLineArrays.map((arr) => arr.length));
    let headerRow1H = Math.max(8, maxCompLines * headerLineStep + 3.5);
    const transHeaderFs = Math.min(headerFs, 4.4);
    doc.setFontSize(transHeaderFs);
    const transHeaderLineArrays = TRANSVERSAL_COMPETENCIAS.map((c) =>
      doc.splitTextToSize(c.label, colW - 0.6)
    );
    doc.setFontSize(headerFs);
    const maxTransLines = Math.max(1, ...transHeaderLineArrays.map((arr) => arr.length));
    let headerTotalH = headerRow1H + headerRow2H;
    while (maxTransLines * headerLineStep > headerTotalH - 2.5) {
      headerRow1H += 2;
      headerTotalH = headerRow1H + headerRow2H;
    }
    const nAreaComps = area.competencias.length;
    const transCol0 = col0 + nAreaComps * 3 * colW;

    const pageBottom = pageH - 22;
    const lineStep = 6;
    const nameLineH = 3.2;

    const gridStroke = [52, 73, 102];
    const gridFillHeader = [222, 232, 247];
    const gridFillRowA = [255, 255, 255];
    const gridFillRowB = [245, 248, 252];

    const drawVerticalGridLines = (yy, hh) => {
      doc.setDrawColor(...gridStroke);
      doc.setLineWidth(0.28);
      let vx = tableX + cwNum;
      doc.line(vx, yy, vx, yy + hh);
      vx += cwDni;
      doc.line(vx, yy, vx, yy + hh);
      vx += nameColW;
      doc.line(vx, yy, vx, yy + hh);
      for (let gi = 0; gi <= cols.length; gi += 1) {
        const gx = col0 + gi * colW;
        doc.line(gx, yy, gx, yy + hh);
      }
    };

    const drawHeaderGrid = (yy) => {
      doc.setDrawColor(...gridStroke);
      doc.setLineWidth(0.28);
      let vx = tableX + cwNum;
      doc.line(vx, yy, vx, yy + headerTotalH);
      vx += cwDni;
      doc.line(vx, yy, vx, yy + headerTotalH);
      vx += nameColW;
      doc.line(vx, yy, vx, yy + headerTotalH);
      doc.line(col0, yy, col0, yy + headerRow1H);
      for (let j = 1; j <= nAreaComps; j += 1) {
        const gx = col0 + j * 3 * colW;
        doc.line(gx, yy, gx, yy + headerRow1H);
      }
      for (let t = 1; t < TRANSVERSAL_COMPETENCIAS.length; t += 1) {
        const gx = transCol0 + t * colW;
        doc.line(gx, yy, gx, yy + headerTotalH);
      }
      const ySplit = yy + headerRow1H;
      for (let k = 0; k <= cols.length; k += 1) {
        const gx = col0 + k * colW;
        doc.line(gx, ySplit, gx, yy + headerTotalH);
      }
    };

    const drawHeaderRow = (yy) => {
      doc.setFillColor(...gridFillHeader);
      doc.setDrawColor(...gridStroke);
      doc.setLineWidth(0.28);
      doc.rect(tableX, yy, totalTableW, headerTotalH, "FD");
      drawHeaderGrid(yy);
      doc.setDrawColor(...gridStroke);
      doc.line(tableX, yy + headerRow1H, tableX + totalTableW, yy + headerRow1H);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const stickyMidY = yy + headerTotalH / 2;
      doc.text("N°", numTextX, stickyMidY, { align: "center", baseline: "middle" });
      doc.text("DNI", dniTextX, stickyMidY, { align: "center", baseline: "middle" });
      doc.text("Estudiante", colNameX + nameColW / 2, stickyMidY, { align: "center", baseline: "middle" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(headerFs);
      area.competencias.forEach((c, j) => {
        const xBlock = col0 + j * 3 * colW;
        const lines = compHeaderLineArrays[j] || doc.splitTextToSize(c.label, mergedCompW);
        const blockTop = yy + (headerRow1H - lines.length * headerLineStep) / 2 + headerLineStep * 0.65;
        lines.forEach((ln, li) => {
          doc.text(ln, xBlock + (3 * colW) / 2, blockTop + li * headerLineStep, {
            align: "center",
            maxWidth: mergedCompW
          });
        });
      });

      doc.setFontSize(transHeaderFs);
      TRANSVERSAL_COMPETENCIAS.forEach((c, t) => {
        const xCell = transCol0 + t * colW;
        const lines = transHeaderLineArrays[t] || doc.splitTextToSize(c.label, colW - 0.6);
        const blockTop = yy + (headerTotalH - lines.length * headerLineStep) / 2 + headerLineStep * 0.55;
        lines.forEach((ln, li) => {
          doc.text(ln, xCell + colW / 2, blockTop + li * headerLineStep, {
            align: "center",
            maxWidth: colW - 0.5
          });
        });
      });
      doc.setFontSize(headerFs);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const row2MidY = yy + headerRow1H + headerRow2H / 2;
      area.competencias.forEach((_, j) => {
        for (let k = 0; k < 3; k += 1) {
          doc.text(
            String(k + 1),
            col0 + j * 3 * colW + k * colW + colW / 2,
            row2MidY,
            { align: "center", baseline: "middle" }
          );
        }
      });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      return headerTotalH;
    };

    y += drawHeaderRow(y);

    students.forEach((student, index) => {
      const nameLines = doc.splitTextToSize(student.fullName || "—", nameColW - 1.5);
      const nameBlockH = Math.max(lineStep, nameLines.length * nameLineH);

      if (y + nameBlockH > pageBottom) {
        doc.addPage();
        y = drawPdfInstitutionHeader(doc, `CNEB — ${area.label} — ${bimesterTitle}`);
        y += 4;
        y += drawHeaderRow(y);
      }

      const rowTop = y;
      const fillRgb = index % 2 === 0 ? gridFillRowA : gridFillRowB;
      doc.setFillColor(...fillRgb);
      doc.setDrawColor(...gridStroke);
      doc.setLineWidth(0.22);
      doc.rect(tableX, rowTop, totalTableW, nameBlockH, "FD");
      drawVerticalGridLines(rowTop, nameBlockH);

      const rowMidY = rowTop + nameBlockH / 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(String(index + 1), numTextX, rowMidY, { align: "center", baseline: "middle" });
      doc.text(student.dni, dniTextX, rowMidY, { align: "center", baseline: "middle" });
      const nameStartY =
        rowTop + (nameBlockH - nameLines.length * nameLineH) / 2 + nameLineH * 0.72;
      nameLines.forEach((ln, ni) => {
        doc.text(ln, colNameX + 1.5, nameStartY + ni * nameLineH, { maxWidth: nameColW - 3 });
      });
      cols.forEach((col, i) => {
        const g = bimesterBlock.grades[student.dni]?.[area.key]?.[col.storageKey];
        const cell = g === "AD" || g === "C" || g === "B" || g === "A" ? g : "—";
        doc.text(cell, col0 + i * colW + colW / 2, rowMidY, { align: "center", baseline: "middle" });
      });
      doc.setTextColor(0, 0, 0);
      y += nameBlockH;
    });

    const settingsForPdf = loadSystemSettings();
    const docenteNombre =
      (settingsForPdf.teacherName || "").trim() || (localStorage.getItem(teacherNameStorageKey) || "").trim();
    if (y > pageH - 28) {
      doc.addPage();
      y = 20;
    } else {
      y += 4;
    }
    doc.setFontSize(9);
    doc.text("_______________________________", 180, y);
    doc.text(`Docente: ${docenteNombre || "________________"}`, 180, y + 6);

    drawPdfValidationSeal(doc, seal);
    addPdfPageNumbers(doc, `Calificaciones · ${area.label}`, seal);
    doc.save(`calificaciones-cneb-${bid}-${area.key}.pdf`);
  }));

  exportGradesExcelBtn?.addEventListener("click", () => {
    const area = getAreaDef(selectedAreaKey);
    if (!area) {
      showToast("Seleccione un área curricular en la lista.", { type: "warning" });
      return;
    }
    const students = loadStudents();
    registry = loadGradesRegistry();
    const bid = getCurrentBimesterId();
    const bimesterBlock = registry[bid] || emptyBimester();
    const cols = getFlatMomentColumnsForArea(area);

    const headerColumns = [
      { header: "N°", width: 5 },
      { header: "DNI", width: 12 },
      { header: "Apellidos y Nombres", width: 36 }
    ];
    cols.forEach((col) => {
      const label = col.sublabel ? `${col.compShort} (Ev. ${col.sublabel})` : col.compShort;
      headerColumns.push({ header: label, width: 12 });
    });

    const rows = students.map((student, idx) => {
      const row = [idx + 1, student.dni, student.fullName];
      cols.forEach((col) => {
        const g = bimesterBlock.grades[student.dni]?.[area.key]?.[col.storageKey];
        row.push(g === "AD" || g === "C" || g === "B" || g === "A" ? g : "");
      });
      return row;
    });

    const competencyLegend = [["Competencias del área:"]];
    area.competencias.forEach((c) => competencyLegend.push([`${c.short}: ${c.label}`]));
    TRANSVERSAL_COMPETENCIAS.forEach((c) => competencyLegend.push([`${c.short} (transversal): ${c.label}`]));
    competencyLegend.push([]);

    exportSheetToExcel({
      filename: `calificaciones-cneb-${bid}-${area.key}.xlsx`,
      sheetName: `${BIMESTER_LABELS[bid].slice(0, 18)}`,
      reportTitle: `CNEB — ${area.label} — ${BIMESTER_LABELS[bid]}${bimesterBlock.closed ? " (cerrado)" : ""}`,
      columns: headerColumns,
      rows,
      extraTopRows: [
        [
          `Bimestre: ${BIMESTER_LABELS[bid]}  |  Área: ${area.label}  |  Estado: ${
            bimesterBlock.closed ? "Cerrado" : "Abierto"
          }`
        ],
        ...competencyLegend
      ]
    });
  });

  renderGrades();
}

if (currentPage === "configuracion.html") {
  const systemSettingsForm = document.getElementById("systemSettingsForm");
  const institutionInput = document.getElementById("institution");
  const ieAddressInput = document.getElementById("ieAddress");
  const teacherNameInput = document.getElementById("teacherName");
  const directorInput = document.getElementById("director");
  const institutionLogoInput = document.getElementById("institutionLogo");
  const institutionLogoPreview = document.getElementById("institutionLogoPreview");
  const newAcademicYearInput = document.getElementById("newAcademicYear");
  const createAcademicYearBtn = document.getElementById("createAcademicYearBtn");
  const closeAcademicYearBtn = document.getElementById("closeAcademicYearBtn");
  const academicYearStatusText = document.getElementById("academicYearStatusText");
  const exportDatabaseBtn = document.getElementById("exportDatabaseBtn");
  const importDatabaseBtn = document.getElementById("importDatabaseBtn");
  const importDatabaseInput = document.getElementById("importDatabaseInput");
  const createRestorePointBtn = document.getElementById("createRestorePointBtn");
  const restoreLastPointBtn = document.getElementById("restoreLastPointBtn");
  const backupHistoryStatusText = document.getElementById("backupHistoryStatusText");
  const seedFiftyStudentsBtn = document.getElementById("seedFiftyStudentsBtn");
  const resetDatabaseBtn = document.getElementById("resetDatabaseBtn");
  const seedDataStatusText = document.getElementById("seedDataStatusText");
  const settingsStorageKey = "systemSettings";
  const academicYearsStorageKey = "academicYearsRegistry";
  const teacherNameStorageKey = "teacherSignatureName";

  const getCurrentYear = () => new Date().getFullYear();

  const loadSettings = () => {
    const fromDb = getDbValue("systemSettings", {});
    if (fromDb && typeof fromDb === "object") return fromDb;
    const rawLegacy = localStorage.getItem(settingsStorageKey);
    if (!rawLegacy) return {};
    try {
      const parsed = JSON.parse(rawLegacy);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const saveSettings = (settings) => {
    setDbValue("systemSettings", settings);
    scheduleLegacyMirror(settingsStorageKey, settings);
  };

  const loadAcademicYears = () => {
    const fromDb = getDbValue("academicYears", []);
    if (Array.isArray(fromDb) && fromDb.length) return fromDb;
    const rawLegacy = localStorage.getItem(academicYearsStorageKey);
    if (!rawLegacy) return [{ year: getCurrentYear(), status: "abierto" }];
    try {
      const parsed = JSON.parse(rawLegacy);
      return Array.isArray(parsed) && parsed.length ? parsed : [{ year: getCurrentYear(), status: "abierto" }];
    } catch (error) {
      return [{ year: getCurrentYear(), status: "abierto" }];
    }
  };

  const saveAcademicYears = (years) => {
    setDbValue("academicYears", years);
    scheduleLegacyMirror(academicYearsStorageKey, years);
  };

  const renderBackupHistoryStatus = () => {
    if (!backupHistoryStatusText) return;
    const history = loadBackupHistory();
    if (!history.length) {
      backupHistoryStatusText.textContent = "No hay puntos de restauración guardados.";
      return;
    }
    const latest = history[0];
    const date = new Date(latest.createdAt);
    backupHistoryStatusText.textContent = `Puntos guardados: ${history.length}. Último: ${date.toLocaleString("es-PE")} (${latest.reason}).`;
  };

  const exportSystemDatabase = () => {
    const db = readDatabase();
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "Sistema Docente Primaria",
      key: SYSTEM_DB_KEY,
      data: db
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date();
    const fileDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    a.href = url;
    a.download = `respaldo-sistema-docente-${fileDate}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const restoreSystemDatabase = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawText = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(rawText);
        const importedData = parsed?.data ?? parsed;
        if (!importedData || typeof importedData !== "object") {
          showToast("El archivo no contiene una base de datos válida.", { type: "error" });
          return;
        }

        const ok = window.confirm(
          "Se reemplazarán todos los datos actuales del sistema. Esta acción no se puede deshacer. ¿Desea continuar?"
        );
        if (!ok) return;

        createRestorePoint("auto:before-import");
        const normalized = normalizeDatabase(importedData);
        if (!Array.isArray(normalized.users) || normalized.users.length === 0) {
          const preservedUsers = loadUsers();
          if (preservedUsers.length) {
            normalized.users = preservedUsers;
          }
        }
        restoreFromHistoryEntry({ data: normalized });

        showToast("Respaldo restaurado correctamente. Recargando el sistema...", {
          type: "success",
          duration: 2200
        });
        window.setTimeout(() => window.location.reload(), 1400);
      } catch (error) {
        showToast("No se pudo leer el archivo JSON. Verifique el respaldo e intente nuevamente.", {
          type: "error"
        });
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const getOpenYear = (years) => years.find((item) => item.status === "abierto");

  const renderAcademicYearStatus = () => {
    const years = loadAcademicYears();
    const open = getOpenYear(years);
    if (!academicYearStatusText) return;
    if (open) {
      academicYearStatusText.textContent = `Año academico activo: ${open.year} (abierto).`;
    } else {
      academicYearStatusText.textContent = "No hay año academico abierto. Cree uno nuevo para iniciar.";
    }
  };

  const renderSettings = () => {
    const settings = loadSettings();
    if (institutionInput) institutionInput.value = settings.institutionName || "";
    if (ieAddressInput) ieAddressInput.value = settings.ieAddress || "";
    if (teacherNameInput) teacherNameInput.value = settings.teacherName || "";
    if (directorInput) directorInput.value = settings.directorName || "";
    if (institutionLogoPreview) {
      institutionLogoPreview.src = getInstitutionLogoSrc(settings);
      institutionLogoPreview.classList.remove("hidden");
    }
  };

  const persistSettings = (logoDataUrl) => {
    const current = loadSettings();
    const next = {
      ...current,
      institutionName: institutionInput?.value.trim() || "",
      ieAddress: ieAddressInput?.value.trim() || "",
      teacherName: teacherNameInput?.value.trim() || "",
      directorName: directorInput?.value.trim() || "",
      logoDataUrl: typeof logoDataUrl === "string" ? logoDataUrl : current.logoDataUrl || ""
    };
    delete next.teacherDocenteRegistro;
    saveSettings(next);
    localStorage.removeItem("teacherDocenteRegistro");
    if (next.teacherName) {
      localStorage.setItem(teacherNameStorageKey, next.teacherName);
    }
    showToast("Configuración guardada correctamente.", { type: "success" });
  };

  systemSettingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const logoFile = institutionLogoInput?.files?.[0];
    if (!logoFile) {
      persistSettings();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (institutionLogoPreview && dataUrl) {
        institutionLogoPreview.src = dataUrl;
        institutionLogoPreview.classList.remove("hidden");
      }
      persistSettings(dataUrl);
    };
    reader.readAsDataURL(logoFile);
  });

  createAcademicYearBtn?.addEventListener("click", () => {
    const year = Number(newAcademicYearInput?.value || 0);
    if (!year || year < 2000 || year > 2100) {
      showToast("Ingrese un año académico válido (entre 2000 y 2100).", { type: "warning" });
      newAcademicYearInput?.focus();
      return;
    }

    const years = loadAcademicYears();
    if (years.some((item) => item.year === year)) {
      showToast("Ese año académico ya existe.", { type: "warning" });
      return;
    }

    const open = getOpenYear(years);
    if (open) {
      open.status = "cerrado";
    }

    years.push({ year, status: "abierto" });
    years.sort((a, b) => a.year - b.year);
    saveAcademicYears(years);
    if (newAcademicYearInput) newAcademicYearInput.value = "";
    renderAcademicYearStatus();
    showToast(`Año académico ${year} creado y abierto.`, { type: "success" });
  });

  closeAcademicYearBtn?.addEventListener("click", () => {
    const years = loadAcademicYears();
    const open = getOpenYear(years);
    if (!open) {
      showToast("No existe un año académico abierto.", { type: "info" });
      return;
    }
    const ok = window.confirm(`¿Cerrar el año académico ${open.year}? Solo podrá leer datos hasta abrir uno nuevo.`);
    if (!ok) return;
    open.status = "cerrado";
    saveAcademicYears(years);
    renderAcademicYearStatus();
    showToast(`Año académico ${open.year} cerrado.`, { type: "success" });
  });

  exportDatabaseBtn?.addEventListener("click", () => {
    exportSystemDatabase();
  });

  importDatabaseBtn?.addEventListener("click", () => {
    importDatabaseInput?.click();
  });

  importDatabaseInput?.addEventListener("change", () => {
    const selectedFile = importDatabaseInput.files?.[0];
    if (!selectedFile) return;
    restoreSystemDatabase(selectedFile);
    importDatabaseInput.value = "";
  });

  createRestorePointBtn?.addEventListener("click", () => {
    createRestorePoint("manual:configuracion");
    renderBackupHistoryStatus();
    showToast("Punto de restauración creado correctamente.", { type: "success" });
  });

  restoreLastPointBtn?.addEventListener("click", () => {
    const history = loadBackupHistory();
    const latest = history[0];
    if (!latest) {
      showToast("No hay puntos de restauración disponibles.", { type: "info" });
      return;
    }
    const ok = window.confirm(
      "Se restaurará el último punto guardado y se reemplazarán los datos actuales. ¿Desea continuar?"
    );
    if (!ok) return;
    const restored = restoreFromHistoryEntry(latest);
    if (!restored) {
      showToast("No se pudo restaurar el punto seleccionado.", { type: "error" });
      return;
    }
    showToast("Punto restaurado correctamente. Recargando el sistema...", { type: "success", duration: 2000 });
    window.setTimeout(() => window.location.reload(), 1200);
  });

  const renderSeedStatus = () => {
    if (!seedDataStatusText) return;
    const total = readDatabase().students.length;
    if (total === 0) {
      seedDataStatusText.textContent =
        "Base de datos en cero. Registre estudiantes desde la página Estudiantes o cargue 50 estudiantes de muestra con el botón de arriba para pruebas.";
    } else if (total < SYSTEM_MIN_STUDENTS_CAPACITY) {
      seedDataStatusText.textContent = `Total registrado: ${total} estudiante(s). El sistema soporta hasta varios cientos (capacidad recomendada mínima: ${SYSTEM_MIN_STUDENTS_CAPACITY}).`;
    } else {
      seedDataStatusText.textContent = `Total registrado: ${total} estudiantes.`;
    }
  };

  seedFiftyStudentsBtn?.addEventListener("click", () => {
    const ok = window.confirm(
      "Se agregarán hasta 50 estudiantes de muestra al registro actual (sin DNIs duplicados). ¿Desea continuar?"
    );
    if (!ok) return;
    createRestorePoint("auto:before-seed-50");
    const existing = readDatabase().students;
    const used = new Set(existing.map((s) => String(s.dni).trim()));
    const seed = generateSeedStudents(SYSTEM_MIN_STUDENTS_CAPACITY);
    const additions = [];
    for (const candidate of seed) {
      if (additions.length >= SYSTEM_MIN_STUDENTS_CAPACITY) break;
      if (used.has(candidate.dni)) continue;
      used.add(candidate.dni);
      additions.push(candidate);
    }
    const next = [...existing, ...additions].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" })
    );
    setDbValue("students", next);
    localStorage.setItem("studentsRegistry", JSON.stringify(next));
    renderSeedStatus();
    showToast(
      `Plantilla aplicada. Se incorporaron ${additions.length} estudiantes nuevos. Total actual: ${next.length}.`,
      { type: "success", duration: 5500 }
    );
  });

  resetDatabaseBtn?.addEventListener("click", () => {
    const ok = window.confirm(
      "Esto reinicia la base de datos a CERO: se eliminarán todos los estudiantes, horarios, asistencias, incidencias y calificaciones registrados. " +
      "Las cuentas de usuario y la configuración institucional (logo, nombre, firmas) se conservan. " +
      "Se guardará un punto de restauración antes por seguridad. ¿Desea continuar?"
    );
    if (!ok) return;
    createRestorePoint("auto:before-reset");
    const preservedUsers = loadUsers();
    const preservedSettings = loadSystemSettings();
    const preservedAcademicYears = loadAcademicYearsRegistry();
    const fresh = buildEmptyDatabase();
    fresh.users = preservedUsers;
    fresh.systemSettings = preservedSettings || {};
    fresh.academicYears = preservedAcademicYears.length
      ? preservedAcademicYears
      : [{ year: new Date().getFullYear(), status: "abierto" }];
    restoreFromHistoryEntry({ data: fresh });

    // Limpiamos claves legacy para que no resuciten los datos en la próxima carga.
    const legacyKeysToClear = [
      "studentsRegistry",
      "schedulesRegistry",
      "attendanceRegistry",
      "attendanceClosedMonths",
      "incidentsRegistry",
      "gradesCnebBimesters"
    ];
    legacyKeysToClear.forEach((k) => localStorage.removeItem(k));

    showToast(
      `Base de datos vacía. Lista para registrar estudiantes y calificaciones. Se conservaron ${preservedUsers.length} cuenta(s) y la configuración institucional. Recargando...`,
      { type: "success", duration: 2600 }
    );
    window.setTimeout(() => window.location.reload(), 1500);
  });

  /* ----- Firma digital (pads + verificación) ----- */
  const teacherCanvas = document.getElementById("teacherSignaturePad");
  const directorCanvas = document.getElementById("directorSignaturePad");
  const teacherPad = setupSignaturePad(teacherCanvas);
  const directorPad = setupSignaturePad(directorCanvas);
  const teacherStatus = document.getElementById("teacherSignatureStatus");
  const directorStatus = document.getElementById("directorSignatureStatus");

  const updateSignatureStatus = (statusEl, hasSignature, savedAt) => {
    if (!statusEl) return;
    if (hasSignature) {
      statusEl.classList.add("is-saved");
      statusEl.textContent = savedAt
        ? `Firma registrada · ${new Date(savedAt).toLocaleString("es-PE")}`
        : "Firma registrada en el sistema.";
    } else {
      statusEl.classList.remove("is-saved");
      statusEl.textContent = "Sin firma registrada.";
    }
  };

  const initialSettings = loadSettings();
  if (teacherPad && initialSettings.teacherSignatureImage) {
    teacherPad.loadDataUrl(initialSettings.teacherSignatureImage);
    updateSignatureStatus(teacherStatus, true, initialSettings.teacherSignatureSavedAt);
  } else {
    updateSignatureStatus(teacherStatus, false);
  }
  if (directorPad && initialSettings.directorSignatureImage) {
    directorPad.loadDataUrl(initialSettings.directorSignatureImage);
    updateSignatureStatus(directorStatus, true, initialSettings.directorSignatureSavedAt);
  } else {
    updateSignatureStatus(directorStatus, false);
  }

  const saveSignatureFor = (role) => {
    const pad = role === "teacher" ? teacherPad : directorPad;
    const statusEl = role === "teacher" ? teacherStatus : directorStatus;
    if (!pad) {
      showToast("No se pudo inicializar el panel de firma.", { type: "error" });
      return;
    }
    if (pad.isEmpty()) {
      showToast("Dibuje una firma antes de guardarla.", { type: "warning" });
      return;
    }
    const dataUrl = pad.toDataUrl();
    if (!dataUrl) {
      showToast("La firma quedó vacía. Vuelva a dibujarla.", { type: "warning" });
      return;
    }
    const settings = loadSettings();
    if (role === "teacher") {
      settings.teacherSignatureImage = dataUrl;
      settings.teacherSignatureSavedAt = new Date().toISOString();
    } else {
      settings.directorSignatureImage = dataUrl;
      settings.directorSignatureSavedAt = new Date().toISOString();
    }
    saveSettings(settings);
    updateSignatureStatus(
      statusEl,
      true,
      role === "teacher" ? settings.teacherSignatureSavedAt : settings.directorSignatureSavedAt
    );
    showToast(
      role === "teacher"
        ? "Firma del docente guardada. Se aplicará a los próximos reportes."
        : "Firma del director(a) guardada. Se aplicará a los próximos reportes.",
      { type: "success", duration: 4500 }
    );
  };

  const removeSignatureFor = (role) => {
    const pad = role === "teacher" ? teacherPad : directorPad;
    const statusEl = role === "teacher" ? teacherStatus : directorStatus;
    const ok = window.confirm(
      role === "teacher"
        ? "¿Quitar la firma del docente del sistema?"
        : "¿Quitar la firma del director(a) del sistema?"
    );
    if (!ok) return;
    const settings = loadSettings();
    if (role === "teacher") {
      delete settings.teacherSignatureImage;
      delete settings.teacherSignatureSavedAt;
    } else {
      delete settings.directorSignatureImage;
      delete settings.directorSignatureSavedAt;
    }
    saveSettings(settings);
    if (pad) pad.clear();
    updateSignatureStatus(statusEl, false);
    showToast("Firma eliminada del sistema.", { type: "info" });
  };

  document.getElementById("clearTeacherSignatureBtn")?.addEventListener("click", () => teacherPad?.clear());
  document.getElementById("clearDirectorSignatureBtn")?.addEventListener("click", () => directorPad?.clear());
  document.getElementById("saveTeacherSignatureBtn")?.addEventListener("click", () => saveSignatureFor("teacher"));
  document.getElementById("saveDirectorSignatureBtn")?.addEventListener("click", () => saveSignatureFor("director"));
  document.getElementById("removeTeacherSignatureBtn")?.addEventListener("click", () => removeSignatureFor("teacher"));
  document.getElementById("removeDirectorSignatureBtn")?.addEventListener("click", () => removeSignatureFor("director"));

  /* ----- Verificación del sello digital ----- */
  const verifySealBtn = document.getElementById("verifySealBtn");
  const verifySealInput = document.getElementById("verifySealInput");
  const verifySealTitle = document.getElementById("verifySealTitle");
  const verifySealResult = document.getElementById("verifySealResult");

  const renderVerifyResult = (state, html) => {
    if (!verifySealResult) return;
    verifySealResult.classList.remove("is-valid", "is-invalid");
    verifySealResult.classList.add("is-visible", `is-${state}`);
    verifySealResult.innerHTML = html;
  };

  verifySealBtn?.addEventListener("click", async () => {
    const code = (verifySealInput?.value || "").trim().toUpperCase();
    if (!code) {
      showToast("Ingrese el código de validación impreso en el PDF.", { type: "warning" });
      return;
    }
    verifySealBtn.disabled = true;
    verifySealBtn.classList.add("is-loading");
    try {
      const result = await verifyDocumentSeal(code);
      if (result.status === "format-invalid") {
        renderVerifyResult(
          "invalid",
          `<strong>Formato inválido.</strong> El código esperado tiene la forma <code>NSF-XXXX-XXXX-XXXX-XXXX</code>.`
        );
        return;
      }
      if (result.status === "not-found") {
        renderVerifyResult(
          "invalid",
          `<strong>Sello no reconocido.</strong> El código <code>${escapeHtml(result.code || code)}</code> no figura en el registro de documentos emitidos por este equipo.
          <p style="margin: 8px 0 0;">Posibles causas: el PDF fue emitido en otro dispositivo, la base de datos local se restauró/reinició, o el código fue manipulado.</p>`
        );
        return;
      }
      if (result.status === "tampered") {
        renderVerifyResult(
          "invalid",
          `<strong>El documento parece haber sido modificado.</strong> El hash recalculado no coincide con el sello almacenado. Solicite el PDF original al emisor.`
        );
        return;
      }
      const r = result.record;
      const reportTitleField = (verifySealTitle?.value || "").trim();
      const titleMismatch = reportTitleField && reportTitleField.toLowerCase() !== String(r.reportTitle || "").toLowerCase();
      const qrPayload = [
        "NSF-SISTEMA-DOCENTE",
        `ID:${r.id}`,
        `IE:${r.institution || ""}`,
        `DOC:${r.teacher || ""}`,
        `DIR:${r.director || ""}`,
        `ANIO:${r.academicYear || ""}`,
        `REP:${r.reportTitle || ""}`,
        `TS:${r.timestamp || ""}`,
        `H:${(r.hash || "").slice(0, 32)}`
      ].join("\n");
      const qrDataUrl = await generateQrDataUrl(qrPayload, { width: 260, margin: 1 });
      const emittedAt = r.timestamp ? new Date(r.timestamp).toLocaleString("es-PE") : "—";
      renderVerifyResult(
        "valid",
        `
        <div class="verify-seal-grid">
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Código QR de validación" class="verify-seal-qr" />` : ""}
          <div>
            <strong>Documento auténtico.</strong> El código <code>${escapeHtml(r.id)}</code> coincide con un sello emitido por este sistema y el hash recalculado es idéntico al almacenado.
            <ul style="margin: 8px 0 0 18px; padding: 0;">
              <li><strong>Reporte emitido:</strong> ${escapeHtml(r.reportTitle || "—")}</li>
              <li><strong>Emitido el:</strong> ${escapeHtml(emittedAt)}</li>
              <li><strong>Institución:</strong> ${escapeHtml(r.institution || "—")}</li>
              <li><strong>Docente:</strong> ${escapeHtml(r.teacher || "—")}</li>
              <li><strong>Director(a):</strong> ${escapeHtml(r.director || "—")}</li>
              <li><strong>Año académico:</strong> ${escapeHtml(String(r.academicYear || "—"))}</li>
            </ul>
            ${titleMismatch ? `<p style="margin: 10px 0 0; color: #b45309;"><i class="fa-solid fa-triangle-exclamation"></i> El título consultado no coincide con el reporte almacenado para este código.</p>` : ""}
          </div>
        </div>
      `
      );
    } finally {
      verifySealBtn.disabled = false;
      verifySealBtn.classList.remove("is-loading");
    }
  });

  renderSettings();
  renderAcademicYearStatus();
  renderBackupHistoryStatus();
  renderSeedStatus();
}
