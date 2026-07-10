"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  normalizeDeviationTable,
  type Boat,
  type BoatType,
  type BoatForm,
  type CrewForm,
  type LineForm,
  type LogLine,
  type LogSheet,
  type PersistedLogbook,
  type SheetForm,
} from "../models/logbook";
import {
  boatToForm,
  crewToForm,
  defaultBoatForm,
  defaultCrewForm,
  defaultLineForm,
  defaultLogbook,
  defaultSheetForm,
  lineToForm,
  seedBoats,
  seedSheets,
  sheetToForm,
} from "./logbook/forms";
import {
  createId,
  modulePath,
  normalizeLogbookIds,
  persistLogbook,
  routeFromPathname,
} from "./logbook/persistence";
import {
  dateTimeLocalFromParts,
  dateTimeLocalFromStamp,
  routeStamp,
  routeStampFromDateTimeLocal,
  splitDateTimeLocal,
} from "./logbook/date-utils";
import { ManagerShell } from "./managers/ManagerShell";
import { courseConversionColumns } from "../domain/nautical/course-conversion";
import { lineFormToLogLine } from "../domain/log-lines/log-line-form";
import { ModuleTabs, type ActiveView } from "../templates/ModuleTabs";
import { useI18n } from "../lib/i18n";
import { PasswordField } from "./PasswordField";
import { CompliancePage } from "./logbook/pages/CompliancePage";
import { LogbookListPage } from "./logbook/pages/LogbookListPage";
import { UserListPage } from "./logbook/pages/UserListPage";
import { LogbookDetailsPage } from "./logbook/pages/LogbookDetailsPage";
import { BoatManagerPage } from "./logbook/pages/BoatManagerPage";
import { DashboardPage } from "./logbook/pages/DashboardPage";
import { CrewManagerPage } from "./logbook/pages/CrewManagerPage";
import { ProfilePage } from "./logbook/pages/ProfilePage";
import { OnboardingChecklist } from "./onboarding/OnboardingChecklist";
import { useOnboardingProfile } from "./onboarding/useOnboardingProfile";
import type { OnboardingTaskId } from "../lib/onboarding/tasks";
import type { ProfilePreferences } from "./onboarding/useOnboardingProfile";

type AdminUser = { id: string; name: string; email: string; groups: string[] };
type SocialUser = {
  username: string;
  sailMiles: number;
  motorMiles: number;
  logbookSheets: number;
  boats: number;
};
type SheetInlineField =
  | "title"
  | "boatId"
  | "departed"
  | "from"
  | "arrived"
  | "to";

type SheetFormPreferences = Pick<ProfilePreferences, "defaultBoatId">;
type LineFormPreferences = Pick<
  ProfilePreferences,
  "windUnit" | "waterHeightUnit" | "temperatureUnit"
>;

const fallbackLinePreferences: LineFormPreferences = {
  windUnit: "bft",
  waterHeightUnit: "m",
  temperatureUnit: "°C",
};

function resolvePreferredBoatId(
  logbook: PersistedLogbook,
  preferences: SheetFormPreferences,
) {
  return logbook.boats.some((boat) => boat.id === preferences.defaultBoatId)
    ? preferences.defaultBoatId
    : (logbook.boats[0]?.id ?? seedBoats[0].id);
}

function createDefaultSheetForm(
  logbook: PersistedLogbook,
  preferences: SheetFormPreferences,
) {
  return defaultSheetForm(resolvePreferredBoatId(logbook, preferences));
}

function createDefaultLineForm(preferences: LineFormPreferences): LineForm {
  return {
    ...defaultLineForm,
    windUnit: preferences.windUnit,
    seaUnit: preferences.waterHeightUnit,
    tideUnit: preferences.waterHeightUnit,
    temperatureUnit: preferences.temperatureUnit,
  };
}

const mockSocialUsers: SocialUser[] = [
  {
    username: "amelia.salt",
    sailMiles: 1842,
    motorMiles: 326,
    logbookSheets: 18,
    boats: 2,
  },
  {
    username: "harbor-hugo",
    sailMiles: 967,
    motorMiles: 214,
    logbookSheets: 11,
    boats: 1,
  },
  {
    username: "nora.nautic",
    sailMiles: 2410,
    motorMiles: 502,
    logbookSheets: 27,
    boats: 3,
  },
  {
    username: "tidewalker",
    sailMiles: 705,
    motorMiles: 688,
    logbookSheets: 9,
    boats: 1,
  },
  {
    username: "bluewater-max",
    sailMiles: 3196,
    motorMiles: 431,
    logbookSheets: 34,
    boats: 2,
  },
];

function parseLogTimeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function logLineDistanceDeltas(lines: LogLine[]) {
  return lines.map((line, index) =>
    Math.max(0, line.logNm - (lines[index - 1]?.logNm ?? 0)),
  );
}

function calculateSheetSummary(sheet: LogSheet) {
  const deltas = logLineDistanceDeltas(sheet.lines);
  const motorMiles = deltas.reduce(
    (sum, delta, index) =>
      sum + ((sheet.lines[index]?.motorHours ?? 0) > 0 || (sheet.lines[index]?.motorMiles ?? 0) > 0 ? delta : 0),
    0,
  );
  const totalMiles = deltas.reduce((sum, delta) => sum + delta, 0);
  const sailMiles = Math.max(0, totalMiles - motorMiles);
  const firstTime = parseLogTimeMinutes(sheet.lines[0]?.time ?? "");
  const lastTime = parseLogTimeMinutes(sheet.lines.at(-1)?.time ?? "");
  const durationMinutes =
    firstTime === undefined || lastTime === undefined
      ? undefined
      : lastTime >= firstTime
        ? lastTime - firstTime
        : lastTime + 24 * 60 - firstTime;

  return {
    motorMiles,
    sailMiles,
    totalMiles,
    duration:
      durationMinutes === undefined ? "—" : formatDuration(durationMinutes),
  };
}

export function LogbookApp({
  userId,
  userEmail,
  userName,
  userGroups = [],
}: {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userGroups?: string[];
}) {
  const { t, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [logbook, setLogbook] = useState<PersistedLogbook>(defaultLogbook);
  const [activeSheetId, setActiveSheetId] = useState(
    defaultLogbook.sheets[0].id,
  );
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [routePath, setRoutePath] = useState(pathname);
  const [activeModule, setActiveModule] = useState<ActiveView>("dashboard");
  const [showCourseColumns, setShowCourseColumns] = useState(true);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [showBoatManager, setShowBoatManager] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [sheetForm, setSheetForm] = useState<SheetForm>(
    sheetToForm(defaultLogbook.sheets[0]),
  );
  const [boatForm, setBoatForm] = useState<BoatForm>(defaultBoatForm);
  const [lineForm, setLineForm] = useState<LineForm>(() =>
    createDefaultLineForm(fallbackLinePreferences),
  );
  const [crewForm, setCrewForm] = useState<CrewForm>(defaultCrewForm);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetField, setEditingSheetField] =
    useState<SheetInlineField | null>(null);
  const [sheetInlineDraft, setSheetInlineDraft] = useState("");
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [selectedBoatId, setSelectedBoatId] = useState(
    defaultLogbook.boats[0].id,
  );
  const [scannerBoatId, setScannerBoatId] = useState(defaultLogbook.boats[0].id);
  const [selectedScannerFiles, setSelectedScannerFiles] = useState<File[]>([]);
  const [isScannerPrivacyConfirmed, setIsScannerPrivacyConfirmed] =
    useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [selectedCrewIndex, setSelectedCrewIndex] = useState(-2);
  const [lastCrewIndex, setLastCrewIndex] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nameForm, setNameForm] = useState({
    name: userName ?? "",
    currentPassword: "",
  });
  const [emailForm, setEmailForm] = useState({
    email: userEmail ?? "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteForm, setDeleteForm] = useState({
    currentPassword: "",
    confirmation: "",
  });
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [knownGroups, setKnownGroups] = useState<string[]>(userGroups);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const logbookRef = useRef(logbook);

  function pushAppPath(path: string) {
    if (path === routePath) return;
    window.history.pushState(null, "", path);
    setRoutePath(path);
  }

  function navigate(module: ActiveView, itemId?: string | number) {
    if (module === "admin" && !userGroups.includes("admin")) return;
    setActiveModule(module);
    pushAppPath(modulePath(module, itemId));
  }

  useEffect(() => {
    logbookRef.current = logbook;
  }, [logbook]);

  const {
    accountEmail,
    accountName,
    isNavSlim,
    isOnboardingComplete,
    isSavingOnboarding,
    onboardingCompletedTasks,
    onboardingCompletion,
    preferences,
    setAccountEmail,
    setAccountName,
    theme,
    updateOnboardingCompletedTasks,
    updatePreferences,
  } = useOnboardingProfile({
    activeModule,
    initialEmail: userEmail,
    initialName: userName,
    logbook,
    onProfileError: setProfileError,
    onProfileMessage: setProfileMessage,
    onLocaleChange: setLocale,
    onCourseConversionPreferenceChange: setShowCourseColumns,
    t,
  });


  async function logout() {
    setSaveError(null);
    setIsLoggingOut(true);
    await persistLogbook(logbookRef.current).catch(() => undefined);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  const preferredBoatId = resolvePreferredBoatId(logbook, preferences);
  const preferredCrewMemberIds = preferences.defaultCrewMemberIds.filter((crewId) =>
    logbook.crewMembers.some((crew) => crew.id === crewId),
  );
  const sheetDefaults = useMemo(
    () => createDefaultSheetForm(logbook, preferences),
    [logbook, preferences],
  );
  const lineDefaults = useMemo(
    () => createDefaultLineForm(preferences),
    [preferences],
  );

  async function saveLogbookNow(nextLogbook: PersistedLogbook) {
    logbookRef.current = nextLogbook;
    setLogbook(nextLogbook);
    setSaveError(null);
    if (!isBackendReady) return true;
    const response = await persistLogbook(nextLogbook).catch(() => undefined);
    if (response?.ok) return true;
    setSaveError(t("logbook.saveError"));
    return false;
  }

  useEffect(() => {
    let isMounted = true;
    async function loadLogbook() {
      const response = await fetch("/api/logbook");
      if (!response.ok) throw new Error("Unable to load logbook");
      const storedLogbook = (await response.json()) as PersistedLogbook;
      const {
        logbook: normalizedLogbook,
        changed,
        boatIds,
        sheetIds,
      } = normalizeLogbookIds(storedLogbook);
      if (!isMounted) return;
      const route = routeFromPathname(window.location.pathname);
      const normalizedItemId =
        route.view === "boats" && route.itemId
          ? boatIds.get(route.itemId)
          : route.itemId &&
              (route.view === "details" || route.view === "logbooks")
            ? sheetIds.get(route.itemId)
            : undefined;
      const nextRoute = normalizedItemId
        ? { ...route, itemId: normalizedItemId }
        : route;
      const nextRoutePath = normalizedItemId
        ? modulePath(route.view, normalizedItemId)
        : window.location.pathname;
      const routedSheet =
        nextRoute.itemId &&
        (nextRoute.view === "details" || nextRoute.view === "logbooks")
          ? normalizedLogbook.sheets.find(
              (sheet) => sheet.id === nextRoute.itemId,
            )
          : undefined;
      const routedBoat =
        nextRoute.itemId && nextRoute.view === "boats"
          ? normalizedLogbook.boats.find((boat) => boat.id === nextRoute.itemId)
          : undefined;
      const fallbackSheet =
        normalizedLogbook.sheets[0] ?? defaultLogbook.sheets[0];
      const fallbackBoat = normalizedLogbook.boats[0] ?? seedBoats[0];
      const nextSheet = routedSheet ?? fallbackSheet;
      const nextBoat = routedBoat ?? fallbackBoat;

      logbookRef.current = normalizedLogbook;
      setLogbook(normalizedLogbook);
      setActiveSheetId(nextSheet.id);
      setSheetForm(
        routedSheet
          ? sheetToForm(routedSheet)
          : (current) => ({ ...current, boatId: fallbackBoat.id }),
      );
      setSelectedBoatId(nextBoat.id);
      setScannerBoatId(
        normalizedLogbook.boats.length === 1
          ? normalizedLogbook.boats[0].id
          : nextBoat.id,
      );
      if (routedBoat) {
        setEditingBoatId(routedBoat.id);
        setBoatForm(boatToForm(routedBoat));
        setShowBoatManager(false);
      }
      if (nextRoute.view === "crew" && nextRoute.itemId) {
        const crewIndex = Number.parseInt(nextRoute.itemId, 10);
        if (
          Number.isInteger(crewIndex) &&
          crewIndex >= 0 &&
          crewIndex < normalizedLogbook.crewMembers.length
        ) {
          setSelectedCrewIndex(crewIndex);
          setLastCrewIndex(crewIndex);
          setCrewForm(
            crewToForm(
              normalizedLogbook.crewMembers[crewIndex] ?? defaultCrewForm,
            ),
          );
        }
      }
      if (normalizedItemId) {
        window.history.replaceState(null, "", nextRoutePath);
        setRoutePath(nextRoutePath);
      }
      if (changed) persistLogbook(normalizedLogbook).catch(() => undefined);
      setIsBackendReady(true);
    }
    loadLogbook().catch(() => setIsBackendReady(true));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Keep direct Next.js navigations and browser history changes in sync without
    // using router.push for in-app module changes, which would remount/refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoutePath(pathname);
  }, [pathname]);

  useEffect(() => {
    const syncFromHistory = () => setRoutePath(window.location.pathname);
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && routePath !== window.location.pathname)
      return;
    const { view, itemId } = routeFromPathname(routePath);
    // Route changes are the source of truth for browser back/forward and bookmarks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModule(view);
    if (
      view === "details" &&
      itemId &&
      logbook.sheets.some((sheet) => sheet.id === itemId)
    ) {
      const sheet = logbook.sheets.find((candidate) => candidate.id === itemId);
      setActiveSheetId(itemId);
      if (sheet) setSheetForm(sheetToForm(sheet));
    }
    if (
      view === "logbooks" &&
      itemId &&
      logbook.sheets.some((sheet) => sheet.id === itemId)
    ) {
      const sheet = logbook.sheets.find((candidate) => candidate.id === itemId);
      setActiveSheetId(itemId);
      if (sheet) setSheetForm(sheetToForm(sheet));
    }
    if (view === "boats" && !itemId && !showBoatManager) {
      setEditingBoatId(null);
      setShowBoatManager(false);
    }
    if (
      view === "boats" &&
      itemId &&
      logbook.boats.some((boat) => boat.id === itemId)
    ) {
      const boat = logbook.boats.find((candidate) => candidate.id === itemId);
      setSelectedBoatId(itemId);
      setEditingBoatId(itemId);
      if (boat) setBoatForm(boatToForm(boat));
      setShowBoatManager(false);
    }
    if (view === "crew" && !itemId && selectedCrewIndex !== -1) {
      setSelectedCrewIndex(-2);
      setCrewForm(defaultCrewForm);
    }
    if (view === "crew" && itemId) {
      const index = Number.parseInt(itemId, 10);
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < logbook.crewMembers.length
      ) {
        setSelectedCrewIndex(index);
        setLastCrewIndex(index);
        setCrewForm(crewToForm(logbook.crewMembers[index] ?? defaultCrewForm));
      }
    }
  }, [routePath, logbook, activeSheetId, selectedCrewIndex, showBoatManager]);

  const loadAdminUsers = useCallback(async () => {
    await Promise.resolve();
    setAdminError(null);
    const response = await fetch("/api/admin/users");
    const payload = (await response.json().catch(() => ({}))) as {
      users?: AdminUser[];
      groups?: string[];
      error?: string;
    };
    if (!response.ok) {
      setAdminError(payload.error ?? t("admin.unableLoadUsers"));
      return;
    }
    setAdminUsers(payload.users ?? []);
    setKnownGroups(payload.groups ?? []);
  }, [t]);

  useEffect(() => {
    if (
      activeModule !== "admin" ||
      !userGroups.includes("admin") ||
      adminUsers.length > 0
    ) return;
    const timeout = window.setTimeout(() => {
      loadAdminUsers().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeModule, adminUsers.length, loadAdminUsers, userGroups]);

  useEffect(() => {
    if (!isBackendReady) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      persistLogbook(logbook, { signal: controller.signal }).catch(
        () => undefined,
      );
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isBackendReady, logbook]);

  useEffect(() => {
    if (!isBackendReady) return;
    const saveBeforeLeaving = () => {
      persistLogbook(logbookRef.current, { keepalive: true }).catch(
        () => undefined,
      );
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [isBackendReady]);


  async function refreshLogbookAfterScan(sheetId: string) {
    const response = await fetch("/api/logbook");
    if (!response.ok) throw new Error("Unable to refresh scanned logbook");
    const storedLogbook = (await response.json()) as PersistedLogbook;
    const { logbook: normalizedLogbook } = normalizeLogbookIds(storedLogbook);
    const scannedSheet = normalizedLogbook.sheets.find(
      (sheet) => sheet.id === sheetId,
    );
    logbookRef.current = normalizedLogbook;
    setLogbook(normalizedLogbook);
    if (scannedSheet) {
      setActiveSheetId(scannedSheet.id);
      setSheetForm(sheetToForm(scannedSheet));
      navigate("details", scannedSheet.id);
    }
  }

  function selectScannerFiles(files: FileList | File[] | null, boatId: string) {
    if (!files?.length) return;
    if (!boatId) {
      const message = t("logbooks.createBoatBeforeScan");
      setScannerError(message);
      setSaveError(message);
      return;
    }
    setScannerBoatId(boatId);
    setSelectedScannerFiles(Array.from(files));
    setIsScannerPrivacyConfirmed(false);
    setScannerError(null);
  }

  function cancelScannerUpload() {
    setSelectedScannerFiles([]);
    setIsScannerPrivacyConfirmed(false);
  }

  async function createSheetFromScan(files: File[], boatId: string) {
    if (!boatId) {
      const message = t("logbooks.createBoatBeforeScan");
      setScannerError(message);
      setSaveError(message);
      return;
    }
    if (files.length === 0) return;

    const upload = new FormData();
    upload.append("boatId", boatId);
    files.forEach((file) => upload.append("files", file));

    setIsScannerPrivacyConfirmed(true);
    setIsScanning(true);
    setScannerError(null);
    setSaveError(null);
    try {
      const response = await fetch("/api/logbook/scanner", {
        method: "POST",
        body: upload,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sheetId?: string;
        error?: string;
      };
      if (!response.ok || !payload.sheetId) {
        throw new Error(payload.error ?? t("logbooks.scanUploadError"));
      }
      await refreshLogbookAfterScan(payload.sheetId);
      setSelectedScannerFiles([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("logbooks.scanUploadError");
      setScannerError(message);
      setSaveError(message);
      setIsScannerPrivacyConfirmed(false);
    } finally {
      setIsScanning(false);
    }
  }

  const activeSheet =
    logbook.sheets.find((sheet) => sheet.id === activeSheetId) ??
    logbook.sheets[0] ??
    seedSheets[0];
  const activeBoat =
    logbook.boats.find((boat) => boat.id === activeSheet.boatId) ??
    logbook.boats[0] ??
    seedBoats[0];
  const selectedBoat =
    logbook.boats.find((boat) => boat.id === selectedBoatId) ??
    logbook.boats[0] ??
    seedBoats[0];
  const selectedCrew =
    logbook.crewMembers[selectedCrewIndex] ?? logbook.crewMembers[0];
  const effectiveScannerBoatId =
    logbook.boats.length === 1
      ? logbook.boats[0].id
      : logbook.boats.some((boat) => boat.id === scannerBoatId)
        ? scannerBoatId
        : preferredBoatId;
  const isAdmin = userGroups.includes("admin");
  const isActiveSheetLocked = activeSheet.status === "Locked";
  const activeSheetSummary = useMemo(
    () => calculateSheetSummary(activeSheet),
    [activeSheet],
  );
  const canEditActiveSheetMasterData = activeSheet.status === "Draft";
  const sheetInlineActions = editingSheetField ? (
    <span className="inline-value-actions">
      <button
        type="button"
        aria-label={t("details.approveChange")}
        onClick={saveSheetInlineField}
      >
        ✅
      </button>
      <button
        type="button"
        aria-label={t("details.cancelChange")}
        onClick={cancelSheetInlineEdit}
      >
        ❎
      </button>
    </span>
  ) : null;
  const renderInlineTextField = (
    field: SheetInlineField,
    value: string,
    fallback = "—",
    inputType = "text",
  ) =>
    editingSheetField === field ? (
      <span className={`inline-value-editor inline-value-editor-${field}`}>
        <input
          type={inputType}
          aria-label={`${t("details.edit")} ${field}`}
          value={sheetInlineDraft}
          onChange={(event) => setSheetInlineDraft(event.target.value)}
          autoFocus
        />
        {sheetInlineActions}
      </span>
    ) : (
      <button
        type="button"
        className="inline-value-button"
        disabled={!canEditActiveSheetMasterData}
        onClick={() => startEditingSheetField(field, value)}
      >
        {value || fallback}
      </button>
    );
  const renderInlineBoatField = () =>
    editingSheetField === "boatId" ? (
      <span className="inline-value-editor inline-value-editor-boatId">
        <select
          aria-label={t("details.editBoat")}
          value={sheetInlineDraft}
          onChange={(event) => setSheetInlineDraft(event.target.value)}
          autoFocus
        >
          {logbook.boats.map((boat) => (
            <option key={boat.id} value={boat.id}>
              {boat.name}
            </option>
          ))}
        </select>
        {sheetInlineActions}
      </span>
    ) : (
      <button
        type="button"
        className="inline-value-button"
        disabled={!canEditActiveSheetMasterData}
        onClick={() => startEditingSheetField("boatId", activeSheet.boatId)}
      >
        {activeBoat.name}
      </button>
    );
  const renderInlineDateField = (field: SheetInlineField, stamp: string) =>
    editingSheetField === field ? (
      <span className={`inline-value-editor inline-value-editor-${field}`}>
        <input
          type="datetime-local"
          aria-label={`${t("details.edit")} ${field}`}
          value={sheetInlineDraft}
          onChange={(event) => setSheetInlineDraft(event.target.value)}
          autoFocus
        />
        {sheetInlineActions}
      </span>
    ) : (
      <button
        type="button"
        className="inline-value-button"
        disabled={!canEditActiveSheetMasterData}
        onClick={() =>
          startEditingSheetField(field, dateTimeLocalFromStamp(stamp))
        }
      >
        {stamp || activeSheet.dateRange}
      </button>
    );
  const crewAssignments = useMemo(
    () =>
      logbook.crewMembers.map((member) => ({
        member,
        sheets: logbook.sheets.flatMap((sheet) =>
          sheet.crew.findIndex((crew) => crew.id === member.id) >= 0
            ? [
                {
                  sheet,
                  isSkipper:
                    sheet.crew.findIndex((crew) => crew.id === member.id) === 0,
                },
              ]
            : [],
        ),
      })),
    [logbook],
  );

  const stats = useMemo(() => {
    const totalNm = logbook.sheets.reduce(
      (sum, sheet) =>
        sum + Math.max(0, ...sheet.lines.map((line) => line.logNm)),
      0,
    );
    const sailNm = logbook.sheets
      .filter(
        (sheet) =>
          logbook.boats.find((boat) => boat.id === sheet.boatId)?.type ===
          "Sail",
      )
      .reduce(
        (sum, sheet) =>
          sum + Math.max(0, ...sheet.lines.map((line) => line.logNm)),
        0,
      );
    return {
      totalNm,
      sailNm,
      motorNm: totalNm - sailNm,
      sheets: logbook.sheets.length,
      boats: logbook.boats.length,
    };
  }, [logbook]);

  async function saveBoat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = editingBoatId ?? createId();
    const currentLogbook = logbookRef.current;
    const previousBoat = currentLogbook.boats.find((boat) => boat.id === id);
    const boat: Boat = {
      id,
      name: boatForm.name,
      type: boatForm.type,
      registration: boatForm.registration,
      flagState: boatForm.flagState,
      homePort: boatForm.homePort,
      owner: boatForm.owner,
      dimensions: boatForm.dimensions,
      deviationTable: normalizeDeviationTable(boatForm.deviationTable),
      yachtData: {
        "Class / type":
          boatForm.type === "Sail" ? "Cruising yacht" : "Motor yacht",
        MMSI: boatForm.mmsi || "—",
        Manufacturer: boatForm.manufacturer || "—",
        "Hull length": boatForm.dimensions || "—",
        Beam: previousBoat?.yachtData.Beam ?? "—",
        Draft: previousBoat?.yachtData.Draft ?? "—",
        Displacement: previousBoat?.yachtData.Displacement ?? "—",
        "Rig / sail area": boatForm.type === "Sail" ? "To be completed" : "n/a",
        Engine: boatForm.engine || "—",
        Propeller: previousBoat?.yachtData.Propeller ?? "—",
        Electronics: previousBoat?.yachtData.Electronics ?? "To be completed",
        Safety: boatForm.safety || "To be completed",
      },
    };
    const nextLogbook = {
      ...currentLogbook,
      boats: editingBoatId
        ? currentLogbook.boats.map((candidate) =>
            candidate.id === editingBoatId ? boat : candidate,
          )
        : [...currentLogbook.boats, boat],
    };
    if (!(await saveLogbookNow(nextLogbook))) return;
    setBoatForm(defaultBoatForm);
    setEditingBoatId(null);
    setShowBoatManager(false);
    pushAppPath(modulePath("boats", id));
    setSelectedBoatId(id);
    setSheetForm((current) => ({ ...current, boatId: id }));
  }

  async function saveSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentLogbook = logbookRef.current;
    const existingSheet = editingSheetId
      ? currentLogbook.sheets.find((sheet) => sheet.id === editingSheetId)
      : undefined;
    const base = existingSheet ?? seedSheets[0];
    const id = editingSheetId ?? createId();
    const route = {
      from: sheetForm.from,
      to: sheetForm.to,
      departed: routeStamp(sheetForm.dateRange, sheetForm.fromTime),
      arrived: routeStamp(sheetForm.dateRange, sheetForm.toTime),
    };
    const currentUserCrew = currentLogbook.crewMembers.find(
      (crew) => crew.isPrimary,
    ) ??
      currentLogbook.crewMembers.find((crew) => crew.id === "me") ?? {
        id: "me",
        name: accountName || userName || "Current user",
        nationality: "",
        role: "Owner",
        address: "",
        certificate: "",
        isPrimary: true,
      };
    const crewMembers = currentLogbook.crewMembers.some(
      (crew) => crew.id === currentUserCrew.id,
    )
      ? currentLogbook.crewMembers
      : [currentUserCrew, ...currentLogbook.crewMembers];
    const defaultCrewMembers = preferredCrewMemberIds
      .map((crewId) => crewMembers.find((crew) => crew.id === crewId))
      .filter((crew): crew is typeof crewMembers[number] => Boolean(crew));
    const initialCrewSource = defaultCrewMembers.length ? defaultCrewMembers : [currentUserCrew];
    const initialCrew = initialCrewSource.map((crew) => ({
      ...crew,
      embarkationDateTime: dateTimeLocalFromStamp(route.departed),
      embarkationPosition: route.from,
      disembarkationDateTime: dateTimeLocalFromStamp(route.arrived),
      disembarkationPosition: route.to,
    }));
    const sheet: LogSheet = {
      ...base,
      id,
      title: sheetForm.title || "Untitled sheet",
      dateRange: sheetForm.dateRange,
      status: sheetForm.status,
      boatId: sheetForm.boatId,
      route,
      crew: existingSheet?.crew ?? initialCrew,
      watchPlan: existingSheet?.watchPlan ?? [],
      technicalChecks: existingSheet?.technicalChecks ?? [],
      lines: existingSheet?.lines ?? [],
    };
    const nextLogbook = {
      ...currentLogbook,
      crewMembers,
      sheets: editingSheetId
        ? currentLogbook.sheets.map((candidate) =>
            candidate.id === editingSheetId ? sheet : candidate,
          )
        : [sheet, ...currentLogbook.sheets],
    };
    if (!(await saveLogbookNow(nextLogbook))) return;
    setActiveSheetId(id);
    setEditingSheetId(null);
    setSheetForm(sheetToForm(sheet));
    setShowNewSheet(false);
    pushAppPath(modulePath("details", id));
  }

  async function deleteSelectedBoat() {
    if (
      !selectedBoat ||
      logbookRef.current.sheets.some(
        (sheet) => sheet.boatId === selectedBoat.id,
      )
    )
      return;
    const nextBoats = logbookRef.current.boats.filter(
      (boat) => boat.id !== selectedBoat.id,
    );
    if (!(await saveLogbookNow({ ...logbookRef.current, boats: nextBoats })))
      return;
    setSelectedBoatId(nextBoats[0]?.id ?? "");
    setEditingBoatId(nextBoats[0]?.id ?? null);
  }

  function startEditingBoat(boat: Boat) {
    setShowBoatManager(false);
    setEditingBoatId(boat.id);
    setBoatForm(boatToForm(boat));
  }

  function cancelBoatEdit() {
    setShowBoatManager(false);
    setEditingBoatId(selectedBoat.id);
    setBoatForm(boatToForm(selectedBoat));
  }

  function startEditingSheet(sheet: LogSheet) {
    if (sheet.status === "Locked") return;
    setActiveSheetId(sheet.id);
    setShowNewSheet(false);
    setEditingSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
  }

  async function updateActiveSheetStatus(status: LogSheet["status"]) {
    if (status === "Locked") cancelSheetInlineEdit();
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) =>
        sheet.id === activeSheet.id ? { ...sheet, status } : sheet,
      ),
    };
    await saveLogbookNow(nextLogbook);
  }
  function startEditingSheetField(field: SheetInlineField, value: string) {
    if (activeSheet.status !== "Draft") return;
    setEditingSheetField(field);
    setSheetInlineDraft(value);
  }

  async function saveSheetInlineField() {
    if (!editingSheetField || activeSheet.status !== "Draft") return;
    const field = editingSheetField;
    const value = sheetInlineDraft;
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        if (field === "title")
          return { ...sheet, title: value.trim() || "Untitled sheet" };
        if (field === "boatId") return { ...sheet, boatId: value };
        if (field === "from")
          return { ...sheet, route: { ...sheet.route, from: value } };
        if (field === "to")
          return { ...sheet, route: { ...sheet.route, to: value } };
        if (field === "departed") {
          const { date } = splitDateTimeLocal(value);
          return {
            ...sheet,
            dateRange: date || sheet.dateRange,
            route: {
              ...sheet.route,
              departed:
                routeStampFromDateTimeLocal(value) || sheet.route.departed,
            },
          };
        }
        const { date } = splitDateTimeLocal(value);
        return {
          ...sheet,
          dateRange: sheet.dateRange || date,
          route: {
            ...sheet.route,
            arrived: routeStampFromDateTimeLocal(value) || sheet.route.arrived,
          },
        };
      }),
    };
    setEditingSheetField(null);
    setSheetInlineDraft("");
    await saveLogbookNow(nextLogbook);
  }

  function cancelSheetInlineEdit() {
    setEditingSheetField(null);
    setSheetInlineDraft("");
  }

  function cancelSheetEdit() {
    setEditingSheetId(null);
    setSheetForm(sheetDefaults);
    setShowNewSheet(false);
  }

  async function saveLineFromFields() {
    if (activeSheet.status === "Locked") return;
    const line = lineFormToLogLine(lineForm);
    const currentLogbook = logbookRef.current;
    const nextLogbook = {
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        const lines =
          editingLineIndex === null
            ? [...sheet.lines, line]
            : sheet.lines.map((candidate, index) =>
                index === editingLineIndex ? line : candidate,
              );
        return { ...sheet, lines: sortLogLines(lines) };
      }),
    };
    if (!(await saveLogbookNow(nextLogbook))) return;
    setLineForm(lineDefaults);
    setEditingLineIndex(null);
    setShowAddLine(false);
  }

  async function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveLineFromFields();
  }

  function startEditingLine(line: LogLine, index: number) {
    if (activeSheet.status === "Locked") return;
    setEditingLineIndex(index);
    setLineForm(lineToForm(line));
    setShowAddLine(false);
  }

  function startAddingLine() {
    if (activeSheet.status === "Locked") return;
    setEditingLineIndex(null);
    setLineForm(lineDefaults);
    setShowAddLine((show) => !show);
  }

  function startAddingLineHereNow() {
    if (activeSheet.status === "Locked") return;
    const now = new Date();
    const time = dateTimeLocalFromDate(now);
    setEditingLineIndex(null);
    setLineForm({ ...lineDefaults, time });
    setShowAddLine(true);
    navigator.geolocation?.getCurrentPosition((position) => {
      setLineForm((current) => ({
        ...current,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      }));
    });
  }

  async function deleteLine(indexToDelete: number) {
    if (activeSheet.status === "Locked") return;
    const currentLogbook = logbookRef.current;
    await saveLogbookNow({
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) =>
        sheet.id === activeSheet.id
          ? { ...sheet, lines: sheet.lines.filter((_, index) => index !== indexToDelete) }
          : sheet,
      ),
    });
  }

  function cancelLineEdit() {
    setEditingLineIndex(null);
    setLineForm(lineDefaults);
    setShowAddLine(false);
  }

  async function saveCrew() {
    const id = selectedCrewIndex === -1 ? createId() : crewForm.id;
    const crew = {
      id,
      name: crewForm.name,
      nationality: crewForm.nationality,
      role: crewForm.role,
      address: crewForm.address,
      certificate: crewForm.certificate,
      isPrimary: crewForm.isPrimary,
    };
    const currentLogbook = logbookRef.current;
    const nextLogbook = {
      ...currentLogbook,
      crewMembers:
        selectedCrewIndex === -1
          ? [...currentLogbook.crewMembers, crew]
          : currentLogbook.crewMembers.map((candidate) =>
              candidate.id === id ? crew : candidate,
            ),
    };
    if (!(await saveLogbookNow(nextLogbook))) return;
    if (selectedCrewIndex === -1)
      setSelectedCrewIndex(nextLogbook.crewMembers.length - 1);
  }

  async function addCrewToActiveSheet(crewId: string) {
    if (activeSheet.status === "Locked") return;
    const member = logbookRef.current.crewMembers.find(
      (crew) => crew.id === crewId,
    );
    if (!member) return;
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) =>
        sheet.id === activeSheet.id &&
        !sheet.crew.some((crew) => crew.id === crewId)
          ? {
              ...sheet,
              crew: [
                ...sheet.crew,
                {
                  ...member,
                  embarkationDateTime: dateTimeLocalFromStamp(
                    sheet.route.departed,
                  ),
                  embarkationPosition: sheet.route.from,
                  disembarkationDateTime: dateTimeLocalFromStamp(
                    sheet.route.arrived,
                  ),
                  disembarkationPosition: sheet.route.to,
                },
              ],
            }
          : sheet,
      ),
    };
    await saveLogbookNow(nextLogbook);
  }

  async function updateCrewAssignment(
    index: number,
    field:
      | "embarkationDateTime"
      | "embarkationPosition"
      | "disembarkationDateTime"
      | "disembarkationPosition",
    value: string,
  ) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        return {
          ...sheet,
          crew: sheet.crew.map((crew, crewIndex) =>
            crewIndex === index ? { ...crew, [field]: value } : crew,
          ),
        };
      }),
    };
    await saveLogbookNow(nextLogbook);
  }

  async function moveCrewOnActiveSheet(index: number, direction: -1 | 1) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        const crew = [...sheet.crew];
        const target = index + direction;
        if (target < 0 || target >= crew.length) return sheet;
        [crew[index], crew[target]] = [crew[target], crew[index]];
        return { ...sheet, crew };
      }),
    };
    await saveLogbookNow(nextLogbook);
  }

  async function deleteCrewFromActiveSheet(index: number) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        return {
          ...sheet,
          crew: sheet.crew.filter((_, crewIndex) => crewIndex !== index),
        };
      }),
    };
    await saveLogbookNow(nextLogbook);
  }

  async function deleteSelectedCrew() {
    if (
      !selectedCrew ||
      selectedCrew.isPrimary ||
      selectedCrew.id === "me" ||
      crewAssignments.find((entry) => entry.member.id === selectedCrew.id)
        ?.sheets.length
    )
      return;
    const nextCrewMembers = logbookRef.current.crewMembers.filter(
      (crew) => crew.id !== selectedCrew.id,
    );
    if (
      !(await saveLogbookNow({
        ...logbookRef.current,
        crewMembers: nextCrewMembers,
      }))
    )
      return;
    setSelectedCrewIndex(0);
  }

  function selectCrew(index: number) {
    setSelectedCrewIndex(index);
    setLastCrewIndex(index);
    setCrewForm(crewToForm(logbook.crewMembers[index] ?? defaultCrewForm));
  }

  function cancelCrewEdit() {
    const nextIndex = Math.min(
      lastCrewIndex,
      Math.max(logbook.crewMembers.length - 1, 0),
    );
    setSelectedCrewIndex(nextIndex);
    setCrewForm(crewToForm(logbook.crewMembers[nextIndex] ?? defaultCrewForm));
  }

  function openOnboardingTask(taskId: OnboardingTaskId) {
    if (taskId === "read_compliance") navigate("compliance");
    else if (taskId === "complete_primary_crew") {
      const meIndex = Math.max(logbookRef.current.crewMembers.findIndex((crew) => crew.isPrimary), 0);
      selectCrew(meIndex);
      navigate("crew", meIndex);
    } else if (taskId === "personalize_view") navigate("profile");
    else if (taskId === "create_first_boat") navigate("boats");
    else if (taskId === "create_first_logsheet") navigate("logbooks");
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "name", ...nameForm }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      name?: string;
      error?: string;
    };
    if (!response.ok) {
      setProfileError(payload.error ?? t("profile.unableUpdateName"));
      return;
    }
    setAccountName(payload.name ?? nameForm.name);
    setNameForm({ name: payload.name ?? nameForm.name, currentPassword: "" });
    setProfileMessage(t("profile.usernameUpdated"));
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "email", ...emailForm }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      email?: string;
      error?: string;
    };
    if (!response.ok) {
      setProfileError(payload.error ?? t("profile.unableUpdateEmail"));
      return;
    }
    setAccountEmail(payload.email ?? emailForm.email);
    setEmailForm({
      email: payload.email ?? emailForm.email,
      currentPassword: "",
    });
    setProfileMessage(t("profile.emailUpdatedLogin"));
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError(t("profile.newPasswordsMismatch"));
      return;
    }
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "password",
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setProfileError(payload.error ?? t("profile.unableUpdatePassword"));
      return;
    }
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setProfileMessage(t("profile.passwordUpdated"));
  }

  function addAdminUserGroup(userId: string) {
    const draft = groupDrafts[userId]?.trim();
    if (!draft) return;
    const group = draft.toLowerCase().replace(/\s+/g, "-");
    setAdminUsers((users) =>
      users.map((user) =>
        user.id === userId && !user.groups.includes(group)
          ? {
              ...user,
              groups: [...user.groups, group].sort((a, b) =>
                a.localeCompare(b),
              ),
            }
          : user,
      ),
    );
    setGroupDrafts((drafts) => ({ ...drafts, [userId]: "" }));
  }

  function canRemoveAdminUserGroup(targetUserId: string, group: string) {
    return !(targetUserId === userId && group === "admin");
  }

  function removeAdminUserGroup(targetUserId: string, group: string) {
    if (!canRemoveAdminUserGroup(targetUserId, group)) return;
    setAdminUsers((users) =>
      users.map((user) =>
        user.id === targetUserId
          ? {
              ...user,
              groups: user.groups.filter((candidate) => candidate !== group),
            }
          : user,
      ),
    );
  }

  function handleGroupDraftKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    userId: string,
  ) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addAdminUserGroup(userId);
  }

  async function saveAdminUserGroups(userId: string, groupsText: string) {
    setAdminError(null);
    setAdminMessage(null);
    const groups = groupsText
      .split(",")
      .map((group) => group.trim())
      .filter(Boolean);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, groups }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      user?: AdminUser;
      groups?: string[];
      error?: string;
    };
    if (!response.ok) {
      setAdminError(payload.error ?? t("admin.unableSaveGroups"));
      return;
    }
    if (payload.user)
      setAdminUsers((users) =>
        users.map((user) =>
          user.id === payload.user?.id ? payload.user : user,
        ),
      );
    setKnownGroups(payload.groups ?? groups);
    setAdminMessage(t("admin.groupsSaved"));
  }

  async function deleteAdminUser(targetUser: AdminUser) {
    setAdminError(null);
    setAdminMessage(null);
    const confirmationName = window.prompt(
      `${t("admin.confirmDeletePromptPrefix")} ${targetUser.name} ${t("admin.confirmDeletePromptSuffix")}`,
    );
    if (confirmationName === null) return;
    if (confirmationName !== targetUser.name) {
      setAdminError(t("admin.confirmDeleteUsername"));
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUser.id, confirmationName }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setAdminError(payload.error ?? t("admin.unableDeleteUser"));
      return;
    }
    setAdminUsers((users) => users.filter((user) => user.id !== targetUser.id));
    setAdminMessage(`${t("admin.deletedUser")} ${targetUser.name}.`);
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (deleteForm.confirmation !== "DELETE") {
      setProfileError(t("profile.confirmDeleteQuoted"));
      return;
    }
    const response = await fetch("/api/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: deleteForm.currentPassword }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setProfileError(payload.error ?? t("profile.unableDeleteAccount"));
      return;
    }
    await signOut({ redirect: false });
    router.push("/register");
    router.refresh();
  }

  return (
    <main
      className="app-shell"
      data-theme={theme}
      data-nav={isNavSlim ? "slim" : "full"}
    >
      {profileMessage && (
        <div className="toast-notification" role="status" aria-live="polite">
          {profileMessage}
        </div>
      )}
      <ModuleTabs
        activeModule={activeModule}
        onSelectModule={(module) => navigate(module)}
        onOpenProfile={() => navigate("profile")}
        theme={theme}
        onToggleTheme={() => updatePreferences({ theme: theme === "dark" ? "light" : "dark" })}
        userEmail={accountEmail || userEmail}
        userName={accountName || userName}
        userGroups={userGroups}
        isNavSlim={isNavSlim}
        onToggleNavSlim={() => updatePreferences({ isNavSlim: !isNavSlim })}
        onLogout={logout}
        isLoggingOut={isLoggingOut}
      />
      <section className="app-content">
        {saveError && <p className="save-error">{saveError}</p>}

        {activeModule === "dashboard" && (
          <DashboardPage
            stats={stats}
            onboardingChecklist={!isOnboardingComplete ? (
              <OnboardingChecklist
                completion={onboardingCompletion}
                manualCompletedTasks={onboardingCompletedTasks}
                onManualCompletedTasksChange={updateOnboardingCompletedTasks}
                onOpenTask={openOnboardingTask}
                isSaving={isSavingOnboarding}
                compact
              />
            ) : null}
          />
        )}

        <section className="workspace module-workspace">
          {activeModule === "logbooks" && (
            <LogbookListPage
              activeBoat={activeBoat}
              scannerBoatId={effectiveScannerBoatId}
              selectedScannerFiles={selectedScannerFiles}
              isScanning={isScanning}
              scannerError={scannerError}
              isScannerPrivacyConfirmed={isScannerPrivacyConfirmed}
              calculateSheetSummary={calculateSheetSummary}
              logbook={logbook}
              navigate={navigate}
              onScanFilesSelected={selectScannerFiles}
              onScannerUploadConfirmed={createSheetFromScan}
              onScannerUploadCanceled={cancelScannerUpload}
              onScannerBoatChange={setScannerBoatId}
              onCreateBoatRequested={() => {
                setShowBoatManager(true);
                setEditingBoatId(null);
                setBoatForm(defaultBoatForm);
                navigate("boats");
              }}
              setActiveSheetId={setActiveSheetId}
              setEditingSheetId={setEditingSheetId}
              setSheetForm={setSheetForm}
              setShowNewSheet={setShowNewSheet}
              createDefaultSheetForm={() => sheetDefaults}
            />
          )}

          {activeModule === "details" && (
            <LogbookDetailsPage
              isBackendReady={isBackendReady}
              showNewSheet={showNewSheet}
              editingSheetId={editingSheetId}
              saveSheet={saveSheet}
              sheetForm={sheetForm}
              setSheetForm={setSheetForm}
              logbook={logbook}
              setSelectedBoatId={setSelectedBoatId}
              setEditingBoatId={setEditingBoatId}
              setBoatForm={setBoatForm}
              setShowBoatManager={setShowBoatManager}
              navigate={navigate}
              cancelSheetEdit={cancelSheetEdit}
              activeSheet={activeSheet}
              renderInlineTextField={renderInlineTextField}
              isActiveSheetLocked={isActiveSheetLocked}
              updateActiveSheetStatus={updateActiveSheetStatus}
              renderInlineBoatField={renderInlineBoatField}
              activeBoat={activeBoat}
              renderInlineDateField={renderInlineDateField}
              activeSheetSummary={activeSheetSummary}
              setShowCourseColumns={setShowCourseColumns}
              showCourseColumns={showCourseColumns}
              coordinateFormat={preferences.coordinateFormat}
              startAddingLine={startAddingLine}
              startAddingLineHereNow={startAddingLineHereNow}
              showAddLine={showAddLine}
              lineForm={lineForm}
              setLineForm={setLineForm}
              saveLineFromFields={saveLineFromFields}
              editingLineIndex={editingLineIndex}
              cancelLineEdit={cancelLineEdit}
              startEditingLine={startEditingLine}
              deleteLine={deleteLine}
              updateCrewAssignment={updateCrewAssignment}
              moveCrewOnActiveSheet={moveCrewOnActiveSheet}
              deleteCrewFromActiveSheet={deleteCrewFromActiveSheet}
              addCrewToActiveSheet={addCrewToActiveSheet}
            />
          )}

          {activeModule === "boats" && (
            <BoatManagerPage
              logbook={logbook}
              selectedBoat={selectedBoat}
              setEditingBoatId={setEditingBoatId}
              setBoatForm={setBoatForm}
              setShowBoatManager={setShowBoatManager}
              showBoatManager={showBoatManager}
              boatForm={boatForm}
              saveBoat={saveBoat}
              editingBoatId={editingBoatId}
              cancelBoatEdit={cancelBoatEdit}
              deleteSelectedBoat={deleteSelectedBoat}
              setSelectedBoatId={setSelectedBoatId}
              pushAppPath={pushAppPath}
            />
          )}

          {activeModule === "crew" && (
            <CrewManagerPage
              selectedCrewIndex={selectedCrewIndex}
              lastCrewIndex={lastCrewIndex}
              setLastCrewIndex={setLastCrewIndex}
              setSelectedCrewIndex={setSelectedCrewIndex}
              selectCrew={selectCrew}
              pushAppPath={pushAppPath}
              saveCrew={saveCrew}
              cancelCrewEdit={cancelCrewEdit}
              deleteSelectedCrew={deleteSelectedCrew}
              crewForm={crewForm}
              setCrewForm={setCrewForm}
              crewAssignments={crewAssignments}
              logbook={logbook}
            />
          )}

          {activeModule === "users" && (
            <UserListPage mockSocialUsers={mockSocialUsers} />
          )}

          {activeModule === "profile" && (
            <ProfilePage
              logout={logout}
              isLoggingOut={isLoggingOut}
              accountName={accountName}
              accountEmail={accountEmail}
              userGroups={userGroups}
              profileMessage={profileMessage}
              profileError={profileError}
              updateName={updateName}
              updateEmail={updateEmail}
              updatePassword={updatePassword}
              deleteAccount={deleteAccount}
              selectCrew={selectCrew}
              navigate={navigate}
              theme={theme}
              preferences={preferences}
              updateViewPreferences={updatePreferences}
              onboardingChecklist={
                <OnboardingChecklist
                  completion={onboardingCompletion}
                  manualCompletedTasks={onboardingCompletedTasks}
                  onManualCompletedTasksChange={updateOnboardingCompletedTasks}
                  onOpenTask={openOnboardingTask}
                  isSaving={isSavingOnboarding}
                />
              }
              logbook={logbook}
              activeBoat={activeBoat}
              nameForm={nameForm}
              setNameForm={setNameForm}
              emailForm={emailForm}
              setEmailForm={setEmailForm}
              passwordForm={passwordForm}
              setPasswordForm={setPasswordForm}
              deleteForm={deleteForm}
              setDeleteForm={setDeleteForm}
            />
          )}

          {activeModule === "admin" && isAdmin && (
            <section className="module-panel" aria-label={t("admin.aria")}>
              <div className="page-heading">
                <div>
                  <h1>{t("admin.title")}</h1>
                  <p>{t("admin.subtitle")}</p>
                </div>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={loadAdminUsers}
                >
                  {t("admin.refreshUsers")}
                </button>
              </div>
              {(adminMessage || adminError) && (
                <article className="info-card">
                  {adminMessage && (
                    <p className="save-success">{adminMessage}</p>
                  )}
                  {adminError && <p className="save-error">{adminError}</p>}
                </article>
              )}
              <article className="table-card">
                <div className="table-header">
                  <div>
                    <p className="eyebrow">{t("admin.tagStyleGroups")}</p>
                    <h3>{t("users.title")}</h3>
                    <p>
                      {t("admin.existingGroups")}:{" "}
                      {knownGroups.length ? knownGroups.join(", ") : t("admin.noneYet")}
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="logbook-table">
                    <thead>
                      <tr>
                        <th>{t("users.username")}</th>
                        <th>{t("auth.email")}</th>
                        <th>{t("admin.groups")}</th>
                        <th></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <div
                              className="tag-editor"
                              aria-label={`${t("admin.groupsFor")} ${user.email}`}
                            >
                              {user.groups.length > 0 && (
                                <div className="tag-editor-tags">
                                  {user.groups.map((group) => (
                                    <span key={group}>
                                      {group}
                                      <button
                                        type="button"
                                        aria-label={`${t("admin.removeGroup")} ${group} ${t("admin.from")} ${user.email}`}
                                        disabled={
                                          !canRemoveAdminUserGroup(
                                            user.id,
                                            group,
                                          )
                                        }
                                        title={
                                          !canRemoveAdminUserGroup(
                                            user.id,
                                            group,
                                          )
                                            ? t("admin.cannotRemoveOwnAdmin")
                                            : undefined
                                        }
                                        onClick={() =>
                                          removeAdminUserGroup(user.id, group)
                                        }
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="tag-editor-add">
                                <input
                                  aria-label={`${t("admin.addGroupFor")} ${user.email}`}
                                  list="known-groups"
                                  placeholder={t("admin.groupPlaceholder")}
                                  value={groupDrafts[user.id] ?? ""}
                                  onChange={(event) =>
                                    setGroupDrafts((drafts) => ({
                                      ...drafts,
                                      [user.id]: event.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) =>
                                    handleGroupDraftKeyDown(event, user.id)
                                  }
                                />
                                <button
                                  type="button"
                                  className="edit-chip"
                                  onClick={() => addAdminUserGroup(user.id)}
                                >
                                  {t("admin.add")}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="edit-chip"
                              onClick={() =>
                                saveAdminUserGroups(
                                  user.id,
                                  user.groups.join(", "),
                                )
                              }
                            >
                              {t("admin.save")}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={user.id === userId}
                              title={
                                user.id === userId
                                  ? t("admin.deleteOwnOnProfile")
                                  : undefined
                              }
                              onClick={() => deleteAdminUser(user)}
                            >
                              {t("admin.delete")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <datalist id="known-groups">
                  {knownGroups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </article>
            </section>
          )}

          {activeModule === "compliance" && <CompliancePage />}
        </section>
      </section>
    </main>
  );
}


function lineTimeValue(line: LogLine) {
  const parsed = Date.parse(line.time);
  if (Number.isFinite(parsed)) return parsed;
  const match = line.time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function sortLogLines(lines: LogLine[]) {
  return [...lines].sort((a, b) => lineTimeValue(a) - lineTimeValue(b));
}

function dateTimeLocalFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
