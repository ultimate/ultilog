"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type MouseEventHandler } from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  normalizeDeviationTable,
  normalizeWindDriftTable,
  type Boat,
  type BoatType,
  type BoatForm,
  type CrewForm,
  type LineForm,
  type LogLine,
  type LogSheet,
  type LogSheetShareSettings,
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
  emptyBoat,
  emptySheet,
  lineToForm,
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
  isoDateTimeWithTimezone,
  routeStamp,
  routeStampFromDateTimeLocal,
  splitDateTimeLocal,
  timeZoneOffsetOptions,
  timezoneOffsetFromStamp,
} from "./logbook/date-utils";
import { ManagerShell } from "./managers/ManagerShell";
import { courseConversionColumns } from "../domain/nautical/course-conversion";
import { calculateLogSheetMetrics, formatLogSheetDuration } from "../domain/logbook/sheet-metrics";
import { activeBoats } from "../domain/boats/boat-policy";
import { lineFormToLogLine } from "../domain/log-lines/log-line-form";
import type { MeteoLogLineAutofill, MeteoSourceRemarkPart } from "../domain/meteo";
import { ModuleTabs, type ActiveView } from "../templates/ModuleTabs";
import { useI18n, type TranslationKey } from "../lib/i18n";
import { PasswordField } from "./PasswordField";
import { CompliancePage } from "./logbook/pages/CompliancePage";
import { LogbookListPage } from "./logbook/pages/LogbookListPage";
import { UserListPage } from "./logbook/pages/UserListPage";
import { LogbookDetailsPage } from "./logbook/pages/LogbookDetailsPage";
import { LogSheetPrintView } from "./logbook/LogSheetPrintView";
import { BoatManagerPage } from "./logbook/pages/BoatManagerPage";
import { DashboardPage } from "./logbook/pages/DashboardPage";
import { CrewManagerPage } from "./logbook/pages/CrewManagerPage";
import { ProfilePage } from "./logbook/pages/ProfilePage";
import { ListPagination, ListSearch, SortableColumnHeader, useSortableList } from "./logbook/SortableList";
import { OnboardingChecklist } from "./onboarding/OnboardingChecklist";
import { useOnboardingProfile } from "./onboarding/useOnboardingProfile";
import type { OnboardingTaskId } from "../lib/onboarding/tasks";
import type { ProfilePreferences } from "./onboarding/useOnboardingProfile";

type AdminUser = { id: string; name: string; email: string; groups: string[] };
const adminUserColumns = [
  { key: "name", value: (user: AdminUser) => user.name },
  { key: "email", value: (user: AdminUser) => user.email },
  { key: "groups", value: (user: AdminUser) => user.groups },
];
type SocialUser = { id: string; username: string; avatar?: string; sailMiles: number; motorMiles: number; logbookSheets: number; boats: number };
type PrintTarget = { mode: "filled"; sheetId: string; showCourseColumns: boolean } | { mode: "empty"; showCourseColumns: boolean } | null;
type DemoRestrictedFeature = "sharing" | "scanner" | "images";

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
  const availableBoats = activeBoats(logbook.boats);
  return availableBoats.some((boat) => boat.id === preferences.defaultBoatId)
    ? preferences.defaultBoatId
    : (availableBoats[0]?.id ?? "");
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

function monthLabelForSheet(sheet: LogSheet) {
  const source = sheet.route.departed || sheet.dateRange;
  const isoMatch = source.match(/(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const parsed = Date.parse(source.replace(",", ""));
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return sheet.dateRange;
}

function withCalculatedSheetMetrics(sheet: LogSheet, motionStationaryThresholdNm: number): LogSheet {
  return { ...sheet, metrics: calculateLogSheetMetrics(sheet.lines, sheet.route, { stationaryDistanceThresholdNm: motionStationaryThresholdNm }) };
}

function calculateSheetSummary(sheet: LogSheet, motionStationaryThresholdNm: number) {
  const metrics = calculateLogSheetMetrics(sheet.lines, sheet.route, { stationaryDistanceThresholdNm: motionStationaryThresholdNm });
  return {
    motorMiles: metrics.motorMiles,
    sailMiles: metrics.sailMiles,
    totalMiles: metrics.totalMiles,
    duration: formatLogSheetDuration(metrics.overallDurationMinutes ?? metrics.durationMinutes),
    motionDuration: formatLogSheetDuration(metrics.motionDurationMinutes),
    motorHours: metrics.motorHours,
    motorHoursDuration: formatLogSheetDuration(metrics.motorHours * 60),
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
    defaultLogbook.sheets[0]?.id ?? "",
  );
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [routePath, setRoutePath] = useState(pathname);
  const [activeModule, setActiveModule] = useState<ActiveView>("dashboard");
  const [showCourseColumnsOverride, setShowCourseColumnsOverride] = useState<{
    sheetId: string;
    isVisible: boolean;
  } | null>(null);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null);
  const [demoRestrictedFeature, setDemoRestrictedFeature] = useState<DemoRestrictedFeature | null>(null);
  const [showBoatManager, setShowBoatManager] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [sheetForm, setSheetForm] = useState<SheetForm>(
    defaultSheetForm(""),
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
  const [sheetInlineTimezoneDraft, setSheetInlineTimezoneDraft] = useState(timezoneOffsetFromStamp(""));
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [selectedBoatId, setSelectedBoatId] = useState(
    defaultLogbook.boats[0]?.id ?? "",
  );
  const [scannerBoatId, setScannerBoatId] = useState(defaultLogbook.boats[0]?.id ?? "");
  const [logsheetBoatFilterId, setLogsheetBoatFilterId] = useState("");
  const [selectedScannerFiles, setSelectedScannerFiles] = useState<File[]>([]);
  const [isScannerPrivacyConfirmed, setIsScannerPrivacyConfirmed] =
    useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [selectedCrewIndex, setSelectedCrewIndex] = useState(-2);
  const [lastCrewIndex, setLastCrewIndex] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [smartLineStatus, setSmartLineStatus] = useState<"idle" | "loading" | "error">("idle");
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
  const [directoryUsers, setDirectoryUsers] = useState<SocialUser[]>([]);
  const [knownGroups, setKnownGroups] = useState<string[]>(userGroups);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const logbookRef = useRef(logbook);
  const hasUnsavedLogbookChangesRef = useRef(false);

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
    isAccountEmailVerified,
    isOnboardingComplete,
    isSavingOnboarding,
    onboardingCompletedTasks,
    onboardingCompletion,
    preferences,
    profileAvatar,
    hasUploadedAvatar,
    setAccountEmail,
    setIsAccountEmailVerified,
    setAccountName,
    setProfileAvatar,
    setHasUploadedAvatar,
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
    t,
  });
  const adminList = useSortableList(adminUsers, adminUserColumns, preferences.defaultPageSize);

  async function logout() {
    setSaveError(null);
    setIsLoggingOut(true);
    if (hasUnsavedLogbookChangesRef.current) {
      await persistLogbook(logbookRef.current).catch(() => undefined);
    }
    await signOut({ redirect: false });
    window.location.assign("/login");
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

  const updateCoordinateFormatPreference = useCallback(
    (coordinateFormat: ProfilePreferences["coordinateFormat"]) => {
      void updatePreferences({ coordinateFormat });
    },
    [updatePreferences],
  );

  const updateShowCourseColumnsDisplay = useCallback(
    (isVisible: boolean) => {
      setShowCourseColumnsOverride({ sheetId: activeSheetId, isVisible });
    },
    [activeSheetId],
  );

  async function saveLogbookNow(nextLogbook: PersistedLogbook) {
    logbookRef.current = nextLogbook;
    hasUnsavedLogbookChangesRef.current = true;
    setLogbook(nextLogbook);
    setSaveError(null);
    if (!isBackendReady) return true;
    const response = await persistLogbook(nextLogbook).catch(() => undefined);
    if (response?.ok) {
      hasUnsavedLogbookChangesRef.current = false;
      return true;
    }
    setSaveError(t("logbook.saveError"));
    return false;
  }

  useEffect(() => {
    let isMounted = true;
    async function loadLogbook() {
      const response = await fetch("/api/logbook");
      if (response.status === 401) {
        await signOut({ redirect: false });
        window.location.assign("/login");
        return;
      }
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
        normalizedLogbook.sheets[0] ?? emptySheet;
      const availableStoredBoats = activeBoats(normalizedLogbook.boats);
      const fallbackBoat = availableStoredBoats[0] ?? normalizedLogbook.boats[0] ?? emptyBoat;
      const nextSheet = routedSheet ?? fallbackSheet;
      const nextBoat = routedBoat ?? fallbackBoat;

      logbookRef.current = normalizedLogbook;
      hasUnsavedLogbookChangesRef.current = false;
      setLogbook(normalizedLogbook);
      setActiveSheetId(nextSheet.id);
      setSheetForm(
        routedSheet
          ? sheetToForm(routedSheet)
          : (current) => ({ ...current, boatId: fallbackBoat.id }),
      );
      setSelectedBoatId(nextBoat.id);
      setScannerBoatId(
        availableStoredBoats.length === 1
          ? availableStoredBoats[0].id
          : (availableStoredBoats.some((boat) => boat.id === nextBoat.id) ? nextBoat.id : availableStoredBoats[0]?.id ?? ""),
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

  const loadDirectoryUsers = useCallback(async () => {
    const response = await fetch("/api/users");
    const payload = (await response.json().catch(() => ({}))) as { users?: SocialUser[] };
    if (!response.ok) return;
    setDirectoryUsers(payload.users ?? []);
  }, []);

  useEffect(() => {
    if (activeModule !== "users" || directoryUsers.length > 0) return;
    const timeout = window.setTimeout(() => {
      loadDirectoryUsers().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeModule, directoryUsers.length, loadDirectoryUsers]);

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
    if (!isBackendReady || !hasUnsavedLogbookChangesRef.current) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      persistLogbook(logbook, { signal: controller.signal }).catch(
        () => undefined,
      ).then((response) => {
        if (response?.ok) hasUnsavedLogbookChangesRef.current = false;
      });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isBackendReady, logbook]);

  useEffect(() => {
    if (!isBackendReady) return;
    const saveBeforeLeaving = () => {
      if (!hasUnsavedLogbookChangesRef.current) return;
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
    if (userGroups.includes("demo")) {
      setDemoRestrictedFeature("scanner");
      return;
    }
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
    emptySheet;
  const activeBoat =
    logbook.boats.find((boat) => boat.id === activeSheet.boatId) ??
    logbook.boats[0] ??
    emptyBoat;
  const showCourseColumns =
    showCourseColumnsOverride?.sheetId === activeSheet.id
      ? showCourseColumnsOverride.isVisible
      : preferences.showCourseConversionTable;
  const selectedBoat =
    logbook.boats.find((boat) => boat.id === selectedBoatId) ??
    logbook.boats[0] ??
    emptyBoat;
  const selectedCrew =
    logbook.crewMembers[selectedCrewIndex] ?? logbook.crewMembers[0];
  const availableBoats = activeBoats(logbook.boats);
  const effectiveScannerBoatId =
    availableBoats.length === 1
      ? availableBoats[0].id
      : availableBoats.some((boat) => boat.id === scannerBoatId)
        ? scannerBoatId
        : preferredBoatId;
  const isAdmin = userGroups.includes("admin");
  const isActiveSheetLocked = activeSheet.status === "Locked";
  const activeSheetSummary = useMemo(
    () => calculateSheetSummary(activeSheet, preferences.motionStationaryThresholdNm),
    [activeSheet, preferences.motionStationaryThresholdNm],
  );
  const printSheet = printTarget?.mode === "filled"
    ? logbook.sheets.find((sheet) => sheet.id === printTarget.sheetId)
    : undefined;
  const printBoat = printSheet
    ? logbook.boats.find((boat) => boat.id === printSheet.boatId)
    : activeBoat;
  const printSummary = printSheet ? calculateSheetSummary(printSheet, preferences.motionStationaryThresholdNm) : undefined;

  useEffect(() => {
    if (!printTarget) return;

    const clearPrintTarget = () => setPrintTarget(null);
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 0);
    const fallbackTimer = window.setTimeout(clearPrintTarget, 60_000);

    window.addEventListener("afterprint", clearPrintTarget);

    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", clearPrintTarget);
    };
  }, [printTarget]);
  const canEditActiveSheetMasterData = activeSheet.status === "Draft";
  const sheetInlineActions = editingSheetField ? (
    <span className="inline-value-actions">
      <button
        type="button"
        aria-label={t("details.approveChange")}
        onClick={saveSheetInlineField as MouseEventHandler<HTMLButtonElement>}
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
          {availableBoats.map((boat) => (
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
        <select
          aria-label={`${t("details.edit")} ${field} time zone`}
          value={sheetInlineTimezoneDraft}
          onChange={(event) => setSheetInlineTimezoneDraft(event.target.value)}
        >
          {timeZoneOffsetOptions.map((offset) => (
            <option key={offset} value={offset}>
              UTC{offset}
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
        onClick={() =>
          startEditingSheetField(
            field,
            dateTimeLocalFromStamp(stamp),
            timezoneOffsetFromStamp(stamp),
          )
        }
      >
        {stamp || activeSheet.dateRange}
      </button>
    );
  const technicalCheckSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const sheet of logbook.sheets) {
      for (const item of sheet.technicalChecks) {
        const suggestion = item.trim();
        const key = suggestion.toLocaleLowerCase();
        if (!suggestion || seen.has(key)) continue;
        seen.add(key);
        suggestions.push(suggestion);
      }
    }
    return suggestions;
  }, [logbook.sheets]);

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
    const sheetsWithMetrics = logbook.sheets.map((sheet) => ({
      sheet,
      metrics: calculateLogSheetMetrics(sheet.lines, sheet.route, { stationaryDistanceThresholdNm: preferences.motionStationaryThresholdNm }),
    }));
    const totalNm = sheetsWithMetrics.reduce((sum, item) => sum + item.metrics.totalMiles, 0);
    const sailNm = sheetsWithMetrics.reduce((sum, item) => sum + item.metrics.sailMiles, 0);
    const motorNm = sheetsWithMetrics.reduce((sum, item) => sum + item.metrics.motorMiles, 0);
    const durationMinutes = sheetsWithMetrics.reduce((sum, item) => sum + (item.metrics.overallDurationMinutes ?? item.metrics.durationMinutes ?? 0), 0);
    const motionDurationMinutes = sheetsWithMetrics.reduce((sum, item) => sum + item.metrics.motionDurationMinutes, 0);
    const motorHours = sheetsWithMetrics.reduce((sum, item) => sum + item.metrics.motorHours, 0);
    const timeline = sheetsWithMetrics
      .slice().sort((a, b) => a.sheet.dateRange.localeCompare(b.sheet.dateRange))
      .map((item) => ({ label: monthLabelForSheet(item.sheet), totalNm: item.metrics.totalMiles, sailNm: item.metrics.sailMiles, motorNm: item.metrics.motorMiles, overallMinutes: item.metrics.overallDurationMinutes ?? item.metrics.durationMinutes ?? 0, motionMinutes: item.metrics.motionDurationMinutes, motorMinutes: item.metrics.motorHours * 60 }));
    const boatDistribution = logbook.boats.map((boat) => ({
      boatName: boat.name,
      totalNm: sheetsWithMetrics
        .filter((item) => item.sheet.boatId === boat.id)
        .reduce((sum, item) => sum + item.metrics.totalMiles, 0),
    })).filter((item) => item.totalNm > 0);
    return {
      totalNm,
      sailNm,
      motorNm,
      durationMinutes,
      motionDurationMinutes,
      motorHours,
      timeline,
      boatDistribution,
      sheets: logbook.sheets.length,
      boats: logbook.boats.length,
    };
  }, [logbook, preferences.motionStationaryThresholdNm]);

  async function saveBoat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = editingBoatId ?? createId();
    const currentLogbook = logbookRef.current;
    const previousBoat = currentLogbook.boats.find((boat) => boat.id === id);
    const boat: Boat = {
      id,
      archived: previousBoat?.archived ?? false,
      name: boatForm.name,
      type: boatForm.type,
      registration: boatForm.registration,
      flagState: boatForm.flagState,
      homePort: boatForm.homePort,
      owner: boatForm.owner,
      dimensions: boatForm.dimensions,
      logfactor: boatForm.logfactor,
      deviationTable: normalizeDeviationTable(boatForm.deviationTable),
      windDriftTable: normalizeWindDriftTable(boatForm.windDriftTable),
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
      image: boatForm.image,
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
    const base = existingSheet ?? emptySheet;
    const id = editingSheetId ?? createId();
    const route = {
      from: sheetForm.from,
      to: sheetForm.to,
      departed: routeStamp(sheetForm.dateRange, sheetForm.fromTime, sheetForm.fromTimezone),
      arrived: routeStamp(sheetForm.dateRange, sheetForm.toTime, sheetForm.toTimezone),
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
      image: sheetForm.image,
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

  async function setSelectedBoatArchived(archived: boolean) {
    if (!selectedBoat?.id) return;
    const nextBoats = logbookRef.current.boats.map((boat) =>
      boat.id === selectedBoat.id ? { ...boat, archived } : boat,
    );
    await saveLogbookNow({ ...logbookRef.current, boats: nextBoats });
  }

  function showSelectedBoatLogsheets() {
    if (!selectedBoat?.id) return;
    setLogsheetBoatFilterId(selectedBoat.id);
    navigate("logbooks");
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

  async function updateActiveSheetShare(share: LogSheetShareSettings) {
    const nextLogbook = {
      ...logbookRef.current,
      sheets: logbookRef.current.sheets.map((sheet) =>
        sheet.id === activeSheet.id ? { ...sheet, share } : sheet,
      ),
    };
    await saveLogbookNow(nextLogbook);
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
  function startEditingSheetField(
    field: SheetInlineField,
    value: string,
    timezone = timezoneOffsetFromStamp(""),
  ) {
    if (activeSheet.status !== "Draft") return;
    setEditingSheetField(field);
    setSheetInlineDraft(value);
    setSheetInlineTimezoneDraft(timezone);
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
                routeStampFromDateTimeLocal(value, sheetInlineTimezoneDraft) || sheet.route.departed,
            },
          };
        }
        const { date } = splitDateTimeLocal(value);
        return {
          ...sheet,
          dateRange: sheet.dateRange || date,
          route: {
            ...sheet.route,
            arrived: routeStampFromDateTimeLocal(value, sheetInlineTimezoneDraft) || sheet.route.arrived,
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
    setSheetInlineTimezoneDraft(timezoneOffsetFromStamp(""));
  }

  function cancelSheetEdit() {
    setEditingSheetId(null);
    setSheetForm(sheetDefaults);
    setShowNewSheet(false);
  }

  async function saveLineFromFields() {
    if (activeSheet.status === "Locked") return;
    const line = lineFormToLogLine({ ...lineForm, time: isoDateTimeWithTimezone(dateTimeLocalFromStamp(lineForm.time), timezoneOffsetFromStamp(lineForm.time)) });
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
        return withCalculatedSheetMetrics({ ...sheet, lines: sortLogLines(lines) }, preferences.motionStationaryThresholdNm);
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

  async function startAddingLineAtCoordinates(coordinate: { latitude: number; longitude: number }) {
    await startAddingSmartLine(coordinate);
  }

  async function startAddingSmartLine(coordinate?: { latitude: number; longitude: number }) {
    if (activeSheet.status === "Locked" || smartLineStatus === "loading") return;
    const now = new Date();
    const time = dateTimeLocalFromDate(now);
    setEditingLineIndex(null);
    setLineForm({
      ...lineDefaults,
      time,
      ...(coordinate
        ? {
            latitude: String(Number(coordinate.latitude.toFixed(6))),
            longitude: String(Number(coordinate.longitude.toFixed(6))),
          }
        : {}),
    });
    setShowAddLine(true);
    setSmartLineStatus("loading");
    setSaveError(null);

    try {
      const linePosition = coordinate ?? await currentGeolocationCoordinates();
      const latitude = linePosition.latitude;
      const longitude = linePosition.longitude;
      const latitudeValue = String(Number(latitude.toFixed(6)));
      const longitudeValue = String(Number(longitude.toFixed(6)));
      setLineForm((current) => ({ ...current, latitude: latitudeValue, longitude: longitudeValue }));

      const response = await fetch("/api/meteo/log-line-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          timestamp: now.toISOString(),
          temperatureUnit: preferences.temperatureUnit,
          windUnit: preferences.windUnit,
          seaUnit: preferences.waterHeightUnit,
          tideUnit: preferences.waterHeightUnit,
        }),
      });
      const payload = await response.json() as Partial<MeteoLogLineAutofill> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to fetch meteo data.");

      setLineForm((current) => ({
        ...current,
        ...(payload.fields ?? {}),
        latitude: latitudeValue,
        longitude: longitudeValue,
        time,
        weatherRemark: formatMeteoWeatherRemark(payload.remarkParts ?? [], t),
      }));
      setSmartLineStatus("idle");
    } catch {
      setSmartLineStatus("error");
      setSaveError(t("details.addSmartLineError"));
    }
  }

  async function deleteLine(indexToDelete: number) {
    if (activeSheet.status === "Locked") return;
    const currentLogbook = logbookRef.current;
    await saveLogbookNow({
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) =>
        sheet.id === activeSheet.id
          ? withCalculatedSheetMetrics({ ...sheet, lines: sheet.lines.filter((_, index) => index !== indexToDelete) }, preferences.motionStationaryThresholdNm)
          : sheet,
      ),
    });
  }

  function cancelLineEdit() {
    setEditingLineIndex(null);
    setLineForm(lineDefaults);
    setShowAddLine(false);
  }

  async function addTechnicalCheck(value: string) {
    if (activeSheet.status === "Locked") return;
    const technicalCheck = value.trim();
    if (!technicalCheck) return;
    const currentLogbook = logbookRef.current;
    await saveLogbookNow({
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) =>
        sheet.id === activeSheet.id
          ? { ...sheet, technicalChecks: [...sheet.technicalChecks, technicalCheck] }
          : sheet,
      ),
    });
  }

  async function updateTechnicalCheck(indexToUpdate: number, value: string) {
    if (activeSheet.status === "Locked") return;
    const technicalCheck = value.trim();
    const currentLogbook = logbookRef.current;
    await saveLogbookNow({
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) => {
        if (sheet.id !== activeSheet.id) return sheet;
        return {
          ...sheet,
          technicalChecks: sheet.technicalChecks
            .map((item, index) => (index === indexToUpdate ? technicalCheck : item))
            .filter(Boolean),
        };
      }),
    });
  }

  async function deleteTechnicalCheck(indexToDelete: number) {
    if (activeSheet.status === "Locked") return;
    const currentLogbook = logbookRef.current;
    await saveLogbookNow({
      ...currentLogbook,
      sheets: currentLogbook.sheets.map((sheet) =>
        sheet.id === activeSheet.id
          ? { ...sheet, technicalChecks: sheet.technicalChecks.filter((_, index) => index !== indexToDelete) }
          : sheet,
      ),
    });
  }

  async function saveCrew() {
    const id = selectedCrewIndex === -1 ? createId() : crewForm.id;
    const previousCrew = logbookRef.current.crewMembers.find((candidate) => candidate.id === id);
    const crew = {
      ...previousCrew,
      id,
      name: crewForm.name.trim(),
      nationality: crewForm.nationality,
      role: crewForm.role,
      address: crewForm.address,
      certificate: crewForm.certificate,
      dateOfBirth: crewForm.dateOfBirth,
      placeOfBirth: crewForm.placeOfBirth,
      gender: crewForm.gender,
      identityDocumentType: crewForm.identityDocumentType,
      identityDocumentNumber: crewForm.identityDocumentNumber,
      identityDocumentIssuingDate: crewForm.identityDocumentIssuingDate,
      identityDocumentExpiryDate: crewForm.identityDocumentExpiryDate,
      isPrimary: crewForm.isPrimary,
      image: crewForm.image,
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
    if (taskId === "verify_email") navigate("profile");
    else if (taskId === "read_compliance") navigate("compliance");
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
      emailVerified?: boolean;
      error?: string;
    };
    if (!response.ok) {
      setProfileError(payload.error ?? t("profile.unableUpdateEmail"));
      return;
    }
    setAccountEmail(payload.email ?? emailForm.email);
    setIsAccountEmailVerified(payload.emailVerified ?? false);
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

  async function resetDemoData() {
    setProfileError(null);
    setProfileMessage(null);
    const response = await fetch("/api/demo-reset", { method: "POST" }).catch(() => undefined);
    const payload = (await response?.json().catch(() => ({})) ?? {}) as { logbook?: PersistedLogbook; error?: string };
    if (!response?.ok || !payload.logbook) {
      setProfileError(payload.error ?? t("profile.demoResetError"));
      return false;
    }

    const { logbook: resetLogbook } = normalizeLogbookIds(payload.logbook);
    const firstBoat = resetLogbook.boats[0] ?? emptyBoat;
    const firstSheet = resetLogbook.sheets[0] ?? emptySheet;
    logbookRef.current = resetLogbook;
    hasUnsavedLogbookChangesRef.current = false;
    setLogbook(resetLogbook);
    setActiveSheetId(firstSheet.id);
    setSelectedBoatId(firstBoat.id);
    setScannerBoatId(firstBoat.id);
    setSheetForm(firstSheet.id ? sheetToForm(firstSheet) : defaultSheetForm(firstBoat.id));
    setBoatForm(firstBoat.id ? boatToForm(firstBoat) : defaultBoatForm);
    setCrewForm(crewToForm(resetLogbook.crewMembers[0] ?? defaultCrewForm));
    setEditingBoatId(null);
    setEditingSheetId(null);
    setEditingLineIndex(null);
    setSelectedCrewIndex(resetLogbook.crewMembers.length ? 0 : -2);
    setProfileMessage(t("profile.demoResetSuccess"));
    return true;
  }

  return (
    <>
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
        userAvatar={profileAvatar}
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
              isDemo={userGroups.includes("demo")}
              onDemoFeatureBlocked={setDemoRestrictedFeature}
              activeBoat={activeBoat}
              scannerBoatId={effectiveScannerBoatId}
              selectedScannerFiles={selectedScannerFiles}
              isScanning={isScanning}
              scannerError={scannerError}
              isScannerPrivacyConfirmed={isScannerPrivacyConfirmed}
              calculateSheetSummary={(sheet) => calculateSheetSummary(sheet, preferences.motionStationaryThresholdNm)}
              logbook={logbook}
              boatFilterId={logsheetBoatFilterId}
              onBoatFilterChange={setLogsheetBoatFilterId}
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
              defaultPageSize={preferences.defaultPageSize}
              onPrintSheet={(sheetId) => setPrintTarget({ mode: "filled", sheetId, showCourseColumns: preferences.showCourseConversionTable })}
              onPrintEmptySheet={() => setPrintTarget({ mode: "empty", showCourseColumns: preferences.showCourseConversionTable })}
            />
          )}

          {activeModule === "details" && (
            <LogbookDetailsPage
              isDemo={userGroups.includes("demo")}
              onDemoFeatureBlocked={setDemoRestrictedFeature}
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
              userId={userId}
              renderInlineTextField={renderInlineTextField}
              isActiveSheetLocked={isActiveSheetLocked}
              updateActiveSheetStatus={updateActiveSheetStatus}
              updateActiveSheetShare={updateActiveSheetShare}
              renderInlineBoatField={renderInlineBoatField}
              activeBoat={activeBoat}
              renderInlineDateField={renderInlineDateField}
              activeSheetSummary={activeSheetSummary}
              showCourseColumns={showCourseColumns}
              coordinateFormat={preferences.coordinateFormat}
              onCoordinateFormatChange={updateCoordinateFormatPreference}
              onShowCourseColumnsChange={updateShowCourseColumnsDisplay}
              startAddingLine={startAddingLine}
              startAddingLineHereNow={startAddingLineHereNow}
              startAddingLineAtCoordinates={startAddingLineAtCoordinates}
              startAddingSmartLine={startAddingSmartLine}
              smartLineStatus={smartLineStatus}
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
              addTechnicalCheck={addTechnicalCheck}
              updateTechnicalCheck={updateTechnicalCheck}
              deleteTechnicalCheck={deleteTechnicalCheck}
              technicalCheckSuggestions={technicalCheckSuggestions}
              onPrintSheet={() => setPrintTarget({ mode: "filled", sheetId: activeSheet.id, showCourseColumns })}
            />
          )}

          {activeModule === "boats" && (
            <BoatManagerPage
              isDemo={userGroups.includes("demo")}
              onDemoFeatureBlocked={setDemoRestrictedFeature}
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
              setSelectedBoatArchived={setSelectedBoatArchived}
              showSelectedBoatLogsheets={showSelectedBoatLogsheets}
              setSelectedBoatId={setSelectedBoatId}
              pushAppPath={pushAppPath}
              defaultPageSize={preferences.defaultPageSize}
            />
          )}

          {activeModule === "crew" && (
            <CrewManagerPage
              isDemo={userGroups.includes("demo")}
              onDemoFeatureBlocked={setDemoRestrictedFeature}
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
              defaultPageSize={preferences.defaultPageSize}
            />
          )}

          {activeModule === "users" && (
            <UserListPage users={directoryUsers} defaultPageSize={preferences.defaultPageSize} />
          )}

          {activeModule === "profile" && (
            <ProfilePage
              logout={logout}
              isLoggingOut={isLoggingOut}
              accountName={accountName}
              accountEmail={accountEmail}
              isAccountEmailVerified={isAccountEmailVerified}
              userGroups={userGroups}
              profileMessage={profileMessage}
              profileError={profileError}
              avatar={profileAvatar}
              setAvatar={setProfileAvatar}
              hasUploadedAvatar={hasUploadedAvatar}
              setHasUploadedAvatar={setHasUploadedAvatar}
              updateName={updateName}
              updateEmail={updateEmail}
              updatePassword={updatePassword}
              resetDemoData={resetDemoData}
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
              <article className="table-card admin-users-table-card">
                <div className="table-header">
                  <div>
                    <p className="eyebrow">{t("admin.tagStyleGroups")}</p>
                    <h3>{t("users.title")}</h3>
                    <p>
                      {t("admin.existingGroups")}:{" "}
                      {knownGroups.length ? knownGroups.join(", ") : t("admin.noneYet")}
                    </p>
                  </div>
                  <ListSearch value={adminList.query} onChange={adminList.setQuery} />
                </div>
                <div className="table-scroll admin-users-table-scroll">
                  <table className="logbook-table admin-users-table">
                    <thead>
                      <tr>
                        <SortableColumnHeader columnKey="name" activeKey={adminList.sort.key} direction={adminList.sort.direction} onSort={adminList.setSortKey}>{t("users.username")}</SortableColumnHeader>
                        <SortableColumnHeader columnKey="email" activeKey={adminList.sort.key} direction={adminList.sort.direction} onSort={adminList.setSortKey}>{t("auth.email")}</SortableColumnHeader>
                        <SortableColumnHeader columnKey="groups" activeKey={adminList.sort.key} direction={adminList.sort.direction} onSort={adminList.setSortKey}>{t("admin.groups")}</SortableColumnHeader>
                        <th></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminList.pageItems.map((user) => (
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
                <ListPagination list={adminList} />
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
      {demoRestrictedFeature && (
        <div className="share-logsheet-modal" role="dialog" aria-modal="true" aria-labelledby="demo-feature-title">
          <div className="share-logsheet-panel">
            <div className="share-logsheet-heading">
              <h2 id="demo-feature-title">{t("demoLimits.title")}</h2>
              <button className="edit-chip" type="button" onClick={() => setDemoRestrictedFeature(null)}>{t("demoLimits.close")}</button>
            </div>
            <p>{t(`demoLimits.${demoRestrictedFeature}` as TranslationKey)}</p>
            <p>{t("demoLimits.register")}</p>
            <div className="inline-edit-actions">
              <button type="button" className="primary-action" onClick={() => window.location.assign("/register")}>{t("demoLimits.createAccount")}</button>
            </div>
          </div>
        </div>
      )}
      <div className="print-only print-root" aria-hidden={!printTarget}>
        {printTarget?.mode === "empty" ? (
          <LogSheetPrintView mode="empty" boat={printBoat} showCourseColumns={printTarget?.showCourseColumns ?? preferences.showCourseConversionTable} />
        ) : printSheet ? (
          <LogSheetPrintView mode="filled" sheet={printSheet} boat={printBoat} summary={printSummary} showCourseColumns={printTarget?.showCourseColumns ?? preferences.showCourseConversionTable} />
        ) : null}
      </div>
    </>
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

async function currentGeolocationCoordinates() {
  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

function formatMeteoWeatherRemark(parts: MeteoSourceRemarkPart[], translate: (key: TranslationKey) => string) {
  return parts.map((part) => {
    const fields = humanList(part.fields.map((field) => translate(`meteo.field.${field}` as TranslationKey)));
    const provider = part.provenance.providerLabel ?? part.provenance.provider;
    const sourceType = translate(`meteo.sourceType.${part.provenance.sourceType}` as TranslationKey);
    const station = part.provenance.station?.id ? ` · ${part.provenance.station.id}` : "";
    const distance = typeof part.provenance.station?.distanceNm === "number" ? ` · ${part.provenance.station.distanceNm.toFixed(1)} NM` : "";
    return `${fields}: ${provider}${station}${distance} · ${sourceType}`;
  }).join("; ");
}

function humanList(items: string[]) {
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, -1).join(", ")}, ${items[items.length - 1]}`;
}
