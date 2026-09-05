import { TECHNICAL_CHECK_STATUSES } from "../../../domain/logbook/technical-log";
import { EntityImage } from "../EntityImage";
import { useI18n } from "../../../lib/i18n";
import { useDateTimeFormat } from "../../../lib/DateTimeFormatProvider";
import { formatMiles } from "../../../lib/format-number";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type {
  Boat,
  LineForm,
  SheetForm,
  LogLine,
  LogSheet,
  LogSheetShareSettings,
  PersistedLogbook,
  ScannerWarning,
} from "../../../models/logbook";
import { coordinateToInput, decimalToDdmParts, decimalToDmsParts, ddmPartsToDecimal, dmsPartsToDecimal, nextCoordinateFormat, parseCoordinate, type CoordinateFormat, type DmsParts } from "../../../domain/nautical/coordinates";
import { boatToForm, sheetToForm } from "../forms";
import { dateTimeLocalFromParts, isoDateTimeWithTimezone, splitDateTimeLocal, timeZoneOffsetOptions, timezoneOffsetFromStamp, dateTimeLocalFromStamp } from "../date-utils";
import { updateLogLineFormForInput } from "../../../domain/log-lines/log-line-editor";
import { LogLinesMapView } from "../OpenSeaMapView";
import type { TranslationKey } from "../../../lib/i18n";
import { fileToStoredImage } from "../image-utils";
import { defaultLogSheetShareSettings } from "../../../models/logbook";
import { uploadStoredImage } from "../persistence";
import { indexScannerWarnings } from "../../../lib/logbook-scanner/warning-fields";
import { formatScannerWarning } from "../../../lib/logbook-scanner/format-warning";
import type { LineFormField } from "../../../models/logbook-forms";

type CourseColumn = {
  field: keyof Pick<
    LineForm,
    | "compassCourse"
    | "deviation"
    | "magneticCourse"
    | "variation"
    | "trueCourse"
    | "windDrift"
    | "courseThroughWater"
    | "currentDrift"
    | "courseOverGround"
  >;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  min: number;
  max: number;
  isOptional: boolean;
};

function nonNegativeInputValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed < 0 ? "0" : value;
}

const signedCourseInput = { min: -180, max: 180 } as const;
const unsignedCourseInput = { min: 0, max: 359 } as const;

const courseConversionColumns = [
  { field: "compassCourse", labelKey: "details.course.compass", descriptionKey: "details.course.compass.description", ...unsignedCourseInput, isOptional: false },
  { field: "deviation", labelKey: "details.course.deviation", descriptionKey: "details.course.deviation.description", ...signedCourseInput, isOptional: true },
  { field: "magneticCourse", labelKey: "details.course.magnetic", descriptionKey: "details.course.magnetic.description", ...unsignedCourseInput, isOptional: true },
  { field: "variation", labelKey: "details.course.variation", descriptionKey: "details.course.variation.description", ...signedCourseInput, isOptional: true },
  { field: "trueCourse", labelKey: "details.course.true", descriptionKey: "details.course.true.description", ...unsignedCourseInput, isOptional: true },
  { field: "windDrift", labelKey: "details.course.windDrift", descriptionKey: "details.course.windDrift.description", ...signedCourseInput, isOptional: true },
  { field: "courseThroughWater", labelKey: "details.course.throughWater", descriptionKey: "details.course.throughWater.description", ...unsignedCourseInput, isOptional: true },
  { field: "currentDrift", labelKey: "details.course.currentDrift", descriptionKey: "details.course.currentDrift.description", ...signedCourseInput, isOptional: true },
  { field: "courseOverGround", labelKey: "details.course.overGround", descriptionKey: "details.course.overGround.description", ...unsignedCourseInput, isOptional: false },
] as const satisfies readonly CourseColumn[];

type LogbookDetailsPageProps = Record<string, any>;

export function LogbookDetailsPage(props: LogbookDetailsPageProps) {
  const { t } = useI18n();
  const { formatTime } = useDateTimeFormat();
  const {
    isBackendReady,
    hasSelectedSheet,
    showNewSheet,
    editingSheetId,
    saveSheet,
    sheetForm,
    setSheetForm,
    setSelectedBoatId,
    setEditingBoatId,
    setBoatForm,
    setShowBoatManager,
    navigate,
    cancelSheetEdit,
    renderInlineTextField,
    isActiveSheetLocked,
    updateActiveSheetStatus,
    updateActiveSheetShare,
    updateScannerWarningAcknowledgment,
    renderInlineBoatField,
    renderInlineDateField,
    activeSheetSummary,
    showCourseColumns,
    startAddingLine,
    startAddingLineAtCoordinates,
    startAddingSmartLine,
    smartLineStatus,
    smartMotionStatus,
    saveLineFromFields,
    cancelLineEdit,
    startEditingLine,
    deleteLine,
    updateCrewAssignment,
    moveCrewOnActiveSheet,
    deleteCrewFromActiveSheet,
    addCrewToActiveSheet,
    addTechnicalCheck,
    updateTechnicalCheck,
    deleteTechnicalCheck,
    updateEngineHourCounter,
    onPrintSheet,
  } = props;
  const activeBoat = props.activeBoat as Boat;
  const printActiveSheet = onPrintSheet as () => void;
  const sharingOwnerId = props.userId as string | undefined;
  const isDemo = Boolean(props.isDemo);
  const onDemoFeatureBlocked = props.onDemoFeatureBlocked as (feature: "sharing" | "images") => void;
  const updateShare = updateActiveSheetShare as (share: LogSheetShareSettings) => Promise<void>;
  const updateWarningAcknowledgment = updateScannerWarningAcknowledgment as (warningId: string, acknowledged: boolean) => Promise<void>;
  const activeSheet = props.activeSheet as LogSheet;
  const lineForms = props.lineForms as Record<string, { form: LineForm; isNew: boolean }>;
  const setDraftLineForm = props.setLineForm as (draftId: string, update: LineForm | ((current: LineForm) => LineForm)) => void;
  const logbook = props.logbook as PersistedLogbook;
  const technicalCheckSuggestions = props.technicalCheckSuggestions as string[];
  const technicalCheckSuggestionsId = "technical-log-suggestions";
  const defaultCoordinateFormat = props.coordinateFormat as CoordinateFormat;
  const onShowCourseColumnsChange = props.onShowCourseColumnsChange as (show: boolean) => void;
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareDraftState, setShareDraftState] = useState<{ sheetId: string; share: LogSheetShareSettings }>({ sheetId: "", share: defaultLogSheetShareSettings });
  const [newTechnicalCheck, setNewTechnicalCheck] = useState("");
  const [technicalCheckDraftState, setTechnicalCheckDraftState] = useState<{ sheetId: string; drafts: Record<number, string> }>({ sheetId: "", drafts: {} });
  const [openCourseTooltip, setOpenCourseTooltip] = useState<TranslationKey | null>(null);
  const [courseTooltipPosition, setCourseTooltipPosition] = useState({ left: 0, top: 0 });
  const [openScannerWarning, setOpenScannerWarning] = useState<{ key: string; warnings: ScannerWarning[]; left: number; top: number; above: boolean } | null>(null);
  const scannerWarningTriggerRef = useRef<HTMLTableCellElement>(null);
  const scannerWarningDialogRef = useRef<HTMLDivElement>(null);
  const scannerWarningFirstActionRef = useRef<HTMLButtonElement>(null);
  const focusScannerWarningActionOnOpenRef = useRef(false);
  const [acknowledgedWarningVisibility, setAcknowledgedWarningVisibility] = useState({ sheetId: "", show: false });
  const [coordinateFormatOverride, setCoordinateFormatOverride] = useState<{ sheetId: string; format: CoordinateFormat } | null>(null);
  const coordinateFormat = coordinateFormatOverride?.sheetId === activeSheet.id ? coordinateFormatOverride.format : defaultCoordinateFormat;
  const technicalCheckDrafts = technicalCheckDraftState.sheetId === activeSheet.id ? technicalCheckDraftState.drafts : {};
  const scannerWarnings = activeSheet.scannerWarnings ?? [];
  const scannerWarningText = (warning: ScannerWarning) => formatScannerWarning(warning, t);
  const activeScannerWarningCount = scannerWarnings.filter((warning) => !warning.acknowledgedAt).length;
  const showAcknowledgedWarnings = acknowledgedWarningVisibility.sheetId === activeSheet.id
    ? acknowledgedWarningVisibility.show
    : false;
  const visibleScannerWarnings = showAcknowledgedWarnings
    ? scannerWarnings
    : scannerWarnings.filter((warning) => !warning.acknowledgedAt);
  const indexedScannerWarnings = indexScannerWarnings(visibleScannerWarnings);
  const noticeScannerWarnings = [
    ...indexedScannerWarnings.unmatched,
    ...[...indexedScannerWarnings.lineWarnings.values()].flatMap((warnings) => warnings),
  ];

  const renderScannerWarningAction = (warning: ScannerWarning, isFirstAction = false) => (
    <button
      ref={isFirstAction ? scannerWarningFirstActionRef : undefined}
      type="button"
      className="scanner-warning-action"
      onClick={(event) => {
        event.stopPropagation();
        setOpenScannerWarning(null);
        void updateWarningAcknowledgment(warning.id, !warning.acknowledgedAt);
      }}
    >
      {warning.acknowledgedAt ? t("details.scanner.restoreWarning") : t("details.scanner.acknowledge")}
    </button>
  );
  const logLineEngines = (activeBoat.engines ?? []).filter((engine) => engine.role === "propulsion" && (!engine.archived || activeSheet.lines.some((line) => Number(line.engineHours?.[engine.id]) > 0)));
  const counterEngines = (activeBoat.engines ?? []).filter((engine) => !engine.archived || activeSheet.engineHourCounters?.[engine.id]);
  const share = activeSheet.share ?? defaultLogSheetShareSettings;
  const shareDraft = shareDraftState.sheetId === activeSheet.id ? shareDraftState.share : share;
  const sharePath = sharingOwnerId ? `/share/${encodeURIComponent(sharingOwnerId)}/${encodeURIComponent(activeSheet.id)}` : `/share/${encodeURIComponent(activeSheet.id)}`;
  const shareUrl = typeof window === "undefined" ? sharePath : `${window.location.origin}${sharePath}`;
  const setShare = (patch: Partial<LogSheetShareSettings>) => {
    const nextShare = { ...shareDraft, ...patch };
    setShareDraftState({ sheetId: activeSheet.id, share: nextShare });
    void updateShare(nextShare);
  };
  const isSharingEnabled = Object.values(shareDraft).some((privacy) => privacy !== "private");
  const shareOptions = [
    ["masterData", "Master data (from/to/boat)"],
    ["picture", "Picture"],
    ["logLines", "Loglines"],
    ["metrics", "Metrics (time and miles)"],
    ["technicalLog", "Technical log"],
    ["skipper", "Skipper"],
    ["crew", "Crew information"],
  ] as const;
  const showScannerDraftNotice = activeSheet.source === "scanner";
  const courseConversionSequences = useRef<Record<string, number>>({});
  const sheetImageInputRef = useRef<HTMLInputElement>(null);

  async function submitTechnicalCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newTechnicalCheck.trim();
    if (!value) return;
    await addTechnicalCheck(value);
    setNewTechnicalCheck("");
  }

  function updateTechnicalCheckDraft(index: number, value: string) {
    setTechnicalCheckDraftState((current) => ({
      sheetId: activeSheet.id,
      drafts: { ...(current.sheetId === activeSheet.id ? current.drafts : {}), [index]: value },
    }));
  }

  async function saveTechnicalCheckDraft(index: number) {
    await updateTechnicalCheck(index, technicalCheckDrafts[index] ?? activeSheet.technicalChecks[index]?.text ?? "");
    setTechnicalCheckDraftState((current) => {
      const { [index]: _discarded, ...next } = current.sheetId === activeSheet.id ? current.drafts : {};
      return { sheetId: activeSheet.id, drafts: next };
    });
  }

  function cancelTechnicalCheckDraft(index: number) {
    setTechnicalCheckDraftState((current) => {
      const { [index]: _discarded, ...next } = current.sheetId === activeSheet.id ? current.drafts : {};
      return { sheetId: activeSheet.id, drafts: next };
    });
  }

  useEffect(() => {
    if (!isMapExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (!openCourseTooltip) return;

    const closeTooltip = () => setOpenCourseTooltip(null);
    window.addEventListener("resize", closeTooltip);
    window.addEventListener("scroll", closeTooltip, true);

    return () => {
      window.removeEventListener("resize", closeTooltip);
      window.removeEventListener("scroll", closeTooltip, true);
    };
  }, [openCourseTooltip]);

  useEffect(() => {
    if (!openScannerWarning || !focusScannerWarningActionOnOpenRef.current) return;
    focusScannerWarningActionOnOpenRef.current = false;
    scannerWarningFirstActionRef.current?.focus();
  }, [openScannerWarning]);

  const renderNumberInput = (draftId: string, field: Exclude<keyof LineForm, "engineHours" | "id">, options?: { min?: number; max?: number; step?: string }) => {
    const lineForm = lineForms[draftId].form;
    return <input type="number" min={options?.min} max={options?.max} step={options?.step ?? "1"} value={lineForm[field]} onChange={(e) => setDraftLineForm(draftId, { ...lineForm, [field]: e.target.value })} />;
  };
  const renderTextInput = (draftId: string, field: Exclude<keyof LineForm, "engineHours" | "id">, label?: string) => {
    const lineForm = lineForms[draftId].form;
    return <input aria-label={label} value={lineForm[field]} onChange={(e) => setDraftLineForm(draftId, { ...lineForm, [field]: e.target.value })} />;
  };


  const updateLineFormField = (draftId: string, field: Exclude<keyof LineForm, "engineHours" | "id">, value: string) => {
    const lineForm = lineForms[draftId].form;
    const sequence = (courseConversionSequences.current[draftId] ?? 0) + 1;
    courseConversionSequences.current[draftId] = sequence;
    const updated = updateLogLineFormForInput(lineForm, { field, value }, { boat: activeBoat });
    Promise.resolve(updated)
      .then((result) => {
        if (courseConversionSequences.current[draftId] !== sequence) return;
        setDraftLineForm(draftId, result);
      })
      .catch(() => setDraftLineForm(draftId, { ...lineForm, [field]: value }));
  };

  const renderCourseInput = (draftId: string, field: Exclude<keyof LineForm, "engineHours" | "id">, options: { min?: number; max?: number }) => {
    const lineForm = lineForms[draftId].form;
    return <span className="smart-field-wrap">
    <input
      type="number"
      min={options.min}
      max={options.max}
      step="1"
      value={lineForm[field]}
      onChange={(e) => updateLineFormField(draftId, field, e.target.value)}
      aria-busy={field === "courseOverGround" && smartMotionStatus === "tracking"}
    />
    {field === "courseOverGround" && smartMotionStatus === "tracking" ? <span className="smart-field-spinner" role="status" aria-label={t("details.trackingMotion")} /> : null}
    </span>;
  };

  const toggleCourseTooltip = (descriptionKey: TranslationKey, event: MouseEvent<HTMLButtonElement>) => {
    if (openCourseTooltip === descriptionKey) {
      setOpenCourseTooltip(null);
      return;
    }

    const { bottom, left, width } = event.currentTarget.getBoundingClientRect();
    setCourseTooltipPosition({
      left: left + width / 2,
      top: bottom + 8,
    });
    setOpenCourseTooltip(descriptionKey);
  };

  const renderCourseHeader = (column: CourseColumn) => {
    const isOpen = openCourseTooltip === column.descriptionKey;
    return (
      <th key={column.labelKey} className="course-tooltip-header">
        <span className="course-tooltip">
          <button
            type="button"
            className="course-tooltip-trigger"
            aria-label={t(column.descriptionKey)}
            aria-describedby={isOpen ? `${column.descriptionKey}-tooltip` : undefined}
            aria-expanded={isOpen}
            onClick={(event) => toggleCourseTooltip(column.descriptionKey, event)}
          >
            {t(column.labelKey)}
            <span aria-hidden="true" className="course-tooltip-icon">?</span>
          </button>
          {isOpen && (
            <span
              id={`${column.descriptionKey}-tooltip`}
              role="tooltip"
              className="course-tooltip-bubble"
              style={{
                "--course-tooltip-left": `${courseTooltipPosition.left}px`,
                "--course-tooltip-top": `${courseTooltipPosition.top}px`,
              } as CSSProperties}
            >
              {t(column.descriptionKey)}
            </span>
          )}
        </span>
      </th>
    );
  };


  const updateCoordinateField = (draftId: string, field: "latitude" | "longitude", value: string) => {
    if (!value.trim()) {
      updateLineFormField(draftId, field, "");
      return;
    }
    updateLineFormField(draftId, field, value);
  };

  const renderCoordinateInput = (draftId: string, field: "latitude" | "longitude", label: string) => {
    const lineForm = lineForms[draftId].form;
    if (coordinateFormat === "decimal") return <input aria-label={label} value={lineForm[field]} onChange={(e) => updateCoordinateField(draftId, field, e.target.value)} />;
    if (coordinateFormat === "ddm") {
      const parts = decimalToDdmParts(parseCoordinate(lineForm[field]));
      return (
        <div
          className="compound-inputs dms-inputs"
          aria-label={label}
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
            updateCoordinateField(draftId, field, String(ddmPartsToDecimal({
              degrees: dmsInputValue(event.currentTarget, "degrees"),
              minutes: dmsInputValue(event.currentTarget, "minutes"),
            })));
          }}
        >
          <label><span>[°]</span><input aria-label={`${label} degrees`} type="text" inputMode="decimal" data-dms-part="degrees" defaultValue={parts.degrees} /></label>
          <label><span>[&prime;]</span><input aria-label={`${label} decimal minutes`} type="text" inputMode="decimal" data-dms-part="minutes" defaultValue={parts.minutes} /></label>
        </div>
      );
    }
    const parts = decimalToDmsParts(parseCoordinate(lineForm[field]));
    const commitDmsInput = (container: HTMLDivElement) => {
      updateCoordinateField(draftId, field, String(dmsPartsToDecimal({
        degrees: dmsInputValue(container, "degrees"),
        minutes: dmsInputValue(container, "minutes"),
        seconds: dmsInputValue(container, "seconds"),
      })));
    };
    return (
      <div
        className="compound-inputs dms-inputs"
        aria-label={label}
        onBlur={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          commitDmsInput(event.currentTarget);
        }}
      >
        <label><span>[°]</span><input aria-label={`${label} degrees`} type="text" inputMode="decimal" data-dms-part="degrees" defaultValue={parts.degrees} /></label>
        <label><span>[&prime;]</span><input aria-label={`${label} minutes`} type="text" inputMode="decimal" data-dms-part="minutes" defaultValue={parts.minutes} /></label>
        <label><span>[&Prime;]</span><input aria-label={`${label} seconds`} type="text" inputMode="decimal" data-dms-part="seconds" defaultValue={parts.seconds} /></label>
      </div>
    );
  };
  const renderClampedLogText = (label: string, value: string | number | undefined) => {
    const text = String(value ?? "").trim();
    if (!text) return null;

    return (
      <span className="log-line-clamped-text-wrap">
        <span className="log-line-clamped-text">{text}</span>
        <span className="log-line-text-tooltip" tabIndex={0} aria-label={`${label}: ${text}`}>
          <span aria-hidden="true">ⓘ</span>
          <span className="log-line-text-tooltip-bubble" role="tooltip">{text}</span>
        </span>
      </span>
    );
  };

  const scannerWarningCellProps = (lineNumber: number, fields: LineFormField[], className?: string) => {
    const fieldWarnings = indexedScannerWarnings.lineFields.get(lineNumber);
    const warnings = [...new Map(fields.flatMap((field) => fieldWarnings?.get(field) ?? []).map((warning) => [warning.id, warning])).values()];
    if (warnings.length === 0) return { className };
    const warningIds = warnings.map((warning) => warning.id);
    const title = warnings.map(scannerWarningText).join("\n");
    const key = warningIds.join(":");
    const hasActiveWarning = warnings.some((warning) => !warning.acknowledgedAt);
    const closeDialogAndRestoreFocus = () => {
      setOpenScannerWarning(null);
      scannerWarningTriggerRef.current?.focus();
    };
    const openDialog = (cell: HTMLTableCellElement, openedByKeyboard = false) => {
      if (openScannerWarning?.key === key) {
        if (openedByKeyboard) closeDialogAndRestoreFocus();
        else setOpenScannerWarning(null);
        return;
      }
      scannerWarningTriggerRef.current = cell;
      focusScannerWarningActionOnOpenRef.current = openedByKeyboard;
      const rect = cell.getBoundingClientRect();
      const above = rect.bottom > window.innerHeight - 130;
      setOpenScannerWarning({ key, warnings, left: rect.left + rect.width / 2, top: above ? rect.top - 8 : rect.bottom + 8, above });
    };
    return {
      className: [className, "scanner-warning-field", hasActiveWarning ? null : "acknowledged"].filter(Boolean).join(" "),
      title,
      tabIndex: 0,
      "aria-expanded": openScannerWarning?.key === key,
      "aria-controls": "scanner-warning-dialog",
      "aria-haspopup": "dialog" as const,
      onClick: (event: MouseEvent<HTMLTableCellElement>) => {
        if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a, [role=button], .log-line-text-tooltip")) return;
        openDialog(event.currentTarget);
      },
      onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDialog(event.currentTarget, true);
        } else if (event.key === "Escape") {
          closeDialogAndRestoreFocus();
        }
      },
      onBlur: (event: FocusEvent<HTMLTableCellElement>) => {
        if (event.relatedTarget instanceof Node && scannerWarningDialogRef.current?.contains(event.relatedTarget)) return;
        setOpenScannerWarning(null);
      },
    };
  };


  const renderLineEditor = (draftId: string, lineNumber: number) => {
    const lineForm = lineForms[draftId].form;
    const isNew = lineForms[draftId].isNew;
    const setLineForm = (form: LineForm) => setDraftLineForm(draftId, form);
    return (
    <tr key={draftId} className="inline-line-row">
      <td>{lineNumber}</td>
      <td><div className="compound-inputs"><input type="datetime-local" value={dateTimeLocalFromStamp(lineForm.time)} onChange={(e) => updateLineFormField(draftId, "time", isoDateTimeWithTimezone(e.target.value, timezoneOffsetFromStamp(lineForm.time)))} /><select aria-label="Line time zone" value={timezoneOffsetFromStamp(lineForm.time)} onChange={(e) => updateLineFormField(draftId, "time", isoDateTimeWithTimezone(dateTimeLocalFromStamp(lineForm.time), e.target.value))}>{timeZoneOffsetOptions.map((offset) => <option key={offset} value={offset}>UTC{offset}</option>)}</select></div></td><td>{renderCoordinateInput(draftId, "latitude", t("details.lat"))}</td><td>{renderCoordinateInput(draftId, "longitude", t("details.lon"))}</td>
      <td><select value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })}><option value="">—</option>{weatherEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      <td>{renderTextInput(draftId, "weatherRemark", t("details.weatherRemark"))}</td>
      <td><div className="compound-inputs">{renderNumberInput(draftId, "temperature", { step: "0.1" })}<select value={lineForm.temperatureUnit} onChange={(e) => setLineForm({ ...lineForm, temperatureUnit: e.target.value })}><option value="°C">°C</option><option value="°F">°F</option></select></div></td>
      <td>{renderNumberInput(draftId, "barometer", { min: 800, max: 1200 })}</td>
      <td><div className="compound-inputs"><select aria-label={t("details.windDirection")} value={lineForm.windDirection} onChange={(e) => setLineForm({ ...lineForm, windDirection: e.target.value })}><option value="">—</option>{compassDirections.map((direction) => <option key={direction} value={direction}>{direction}</option>)}</select>{renderNumberInput(draftId, "windStrength")}<select value={lineForm.windUnit} onChange={(e) => setLineForm({ ...lineForm, windUnit: e.target.value })}><option value="bft">bft</option><option value="kn">kn</option><option value="km/h">km/h</option><option value="mp/h">mp/h</option><option value="m/s">m/s</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput(draftId, "waves", { step: "0.1" })}<select value={lineForm.seaUnit} onChange={(e) => setLineForm({ ...lineForm, seaUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><div className="compound-inputs">{renderNumberInput(draftId, "tide", { step: "0.1" })}<select value={lineForm.tideUnit} onChange={(e) => setLineForm({ ...lineForm, tideUnit: e.target.value })}><option value="m">m</option><option value="ft">ft</option></select></div></td>
      <td><select value={lineForm.moon} onChange={(e) => setLineForm({ ...lineForm, moon: e.target.value })}><option value="">—</option>{moonEmojis.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}</select></td>
      {courseConversionColumns.map((column) => (!column.isOptional || showCourseColumns) && (
        <td className={column.isOptional ? "optional-course-cell" : undefined} key={column.field}>
          {renderCourseInput(draftId, column.field, { min: column.min, max: column.max })}
        </td>
      ))}<td><span className="smart-field-wrap">{renderNumberInput(draftId, "speedKn", { step: "0.1" })}{smartMotionStatus === "tracking" ? <span className="smart-field-spinner" role="status" aria-label={t("details.trackingMotion")} /> : null}</span></td><td>{renderNumberInput(draftId, "logNm", { step: "0.1" })}</td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[nm]</span>{renderNumberInput(draftId, "sailMiles", { step: "0.1" })}</label><label><span>[note]</span>{renderTextInput(draftId, "sailNote", t("details.sailNote"))}</label></div></td>
      <td><div className="compound-inputs labeled-inputs"><label><span>[nm]</span>{renderNumberInput(draftId, "motorMiles", { step: "0.1" })}</label>{logLineEngines.map((engine) => <label key={engine.id}><span>{engine.label} [h]</span><input aria-label={`${engine.name} ${t("details.engineRuntime")}`} type="number" min="0" step="0.1" value={lineForm.engineHours?.[engine.id] ?? ""} onChange={(event) => setLineForm({ ...lineForm, engineHours: { ...lineForm.engineHours, [engine.id]: nonNegativeInputValue(event.target.value) } })} /></label>)}<label><span>[note]</span>{renderTextInput(draftId, "motorNote", t("details.motorNote"))}</label></div></td>
      <td>{renderTextInput(draftId, "remarks")}</td><td colSpan={2}><div className="table-actions"><button type="button" onClick={() => saveLineFromFields(draftId)}>{isNew ? t("details.saveLine") : "💾"}</button><button type="button" className="ghost-button" onClick={() => cancelLineEdit(draftId)}>{t("common.cancel")}</button></div></td>
    </tr>
    );
  };

  return (
    <>
      {!isBackendReady && (
        <section className="sheet-detail" aria-label={t("details.loadingAria")}>
          <form className="sheet-title-row inline-edit-card">
            <div className="inline-edit-grid">
              <p className="eyebrow">{t("details.loading")}</p>
              <label>
                {t("common.title")}
                <input disabled value="" readOnly />
              </label>
              <div className="header-edit-row">
                <span>{t("common.boat")}</span>
                <select aria-label={t("common.boat")} disabled value="">
                  <option value=""> </option>
                </select>
                <button type="button" className="edit-chip" disabled>
                  {t("details.jumpToBoat")}
                </button>
              </div>
              <div className="header-edit-row">
                <span>{t("common.from")}</span>
                <input
                  aria-label={t("details.fromDateTime")}
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label={t("details.fromPosition")} disabled value="" readOnly />
              </div>
              <div className="header-edit-row">
                <span>{t("common.to")}</span>
                <input
                  aria-label={t("details.toDateTime")}
                  type="datetime-local"
                  disabled
                  value=""
                  readOnly
                />
                <input aria-label={t("details.toPosition")} disabled value="" readOnly />
              </div>
            </div>
          </form>
        </section>
      )}

      {isBackendReady && !hasSelectedSheet && !showNewSheet && !editingSheetId && (
        <section className="sheet-detail" aria-label={t("details.selectSheet")}>
          <p className="empty-state">{t("details.selectSheet")}</p>
        </section>
      )}

      {isBackendReady && (hasSelectedSheet || showNewSheet || editingSheetId) && (
        <section className="sheet-detail" aria-labelledby="sheet-title">
          {showNewSheet || editingSheetId ? (
            <form
              className="sheet-title-row inline-edit-card"
              onSubmit={saveSheet}
            >
              <div className="inline-edit-grid">
                <p className="eyebrow">
                  {editingSheetId ? t("details.editSheet") : t("details.newSheet")}
                </p>
                <label>
                  Title
                  <input
                    required
                    value={sheetForm.title}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, title: e.target.value })
                    }
                  />
                </label>
                <div className="header-edit-row">
                  <span>{t("common.boat")}</span>
                  <select
                    aria-label={t("common.boat")}
                    value={sheetForm.boatId}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, boatId: e.target.value })
                    }
                  >
                    {logbook.boats.filter((boat) => !boat.archived || (Boolean(editingSheetId) && boat.id === sheetForm.boatId)).map((boat) => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name}
                      </option>
                    ))}
                  </select>
                  {editingSheetId && (
                    <button
                      type="button"
                      className="edit-chip"
                      onClick={() => {
                        setSelectedBoatId(sheetForm.boatId);
                        setEditingBoatId(sheetForm.boatId);
                        const boat = logbook.boats.find(
                          (candidate) => candidate.id === sheetForm.boatId,
                        );
                        if (boat) setBoatForm(boatToForm(boat));
                        setShowBoatManager(false);
                        navigate("boats", sheetForm.boatId);
                      }}
                    >
                      Jump to boat
                    </button>
                  )}
                </div>
                <div className="header-edit-row route-edit-row">
                  <span>{t("common.from")}</span>
                  <input
                    aria-label={t("details.fromDateTime")}
                    type="datetime-local"
                    value={dateTimeLocalFromParts(
                      sheetForm.fromDate,
                      sheetForm.fromTime,
                    )}
                    onChange={(e) => {
                      const { date, time } = splitDateTimeLocal(e.target.value);
                      setSheetForm({
                        ...sheetForm,
                        fromDate: date || sheetForm.fromDate,
                        fromTime: time,
                        fromTimezone: sheetForm.fromTimezone,
                      });
                    }}
                  />
                  <select aria-label="From time zone" value={sheetForm.fromTimezone} onChange={(e) => setSheetForm({ ...sheetForm, fromTimezone: e.target.value })}>
                    {timeZoneOffsetOptions.map((offset) => <option key={offset} value={offset}>UTC{offset}</option>)}
                  </select>
                  <input
                    aria-label={t("details.fromPosition")}
                    value={sheetForm.from}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, from: e.target.value })
                    }
                  />
                </div>
                <div className="header-edit-row route-edit-row">
                  <span>{t("common.to")}</span>
                  <input
                    aria-label={t("details.toDateTime")}
                    type="datetime-local"
                    value={dateTimeLocalFromParts(
                      sheetForm.toDate,
                      sheetForm.toTime,
                    )}
                    onChange={(e) => {
                      const { date, time } = splitDateTimeLocal(e.target.value);
                      setSheetForm({
                        ...sheetForm,
                        toDate: date || sheetForm.toDate,
                        toTime: time,
                        toTimezone: sheetForm.toTimezone,
                      });
                    }}
                  />
                  <select aria-label="To time zone" value={sheetForm.toTimezone} onChange={(e) => setSheetForm({ ...sheetForm, toTimezone: e.target.value })}>
                    {timeZoneOffsetOptions.map((offset) => <option key={offset} value={offset}>UTC{offset}</option>)}
                  </select>
                  <input
                    aria-label={t("details.toPosition")}
                    value={sheetForm.to}
                    onChange={(e) =>
                      setSheetForm({ ...sheetForm, to: e.target.value })
                    }
                  />
                </div>
              </div>

                <div className="image-form-field wide-field">
                  <p className="eyebrow">Image</p>
                  <div className="image-preview-frame">
                    <EntityImage
                      image={sheetForm.image}
                      entityType="sheet"
                      alt={`${sheetForm.title || t("details.newSheet")} preview`}
                      variant="preview"
                    />
                  </div>
                  <input
                    ref={sheetImageInputRef}
                    type="file"
                    accept="image/*"
                    className="visually-hidden-file-input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const image = await uploadStoredImage(await fileToStoredImage(file));
                        setSheetForm((current: SheetForm) => ({ ...current, image }));
                      } catch (error) {
                        alert(error instanceof Error ? error.message : "Image could not be processed.");
                      } finally {
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <div className="image-actions">
                    <button type="button" className="ghost-button" onClick={() => isDemo ? onDemoFeatureBlocked("images") : sheetImageInputRef.current?.click()}>
                      {sheetForm.image ? "Change image" : "Upload image"}
                    </button>
                    {sheetForm.image ? (
                      <button type="button" className="ghost-button" onClick={() => setSheetForm((current: SheetForm) => ({ ...current, image: undefined }))}>
                        Remove image
                      </button>
                    ) : null}
                  </div>
                  {sheetForm.image ? <small>{sheetForm.image.width} × {sheetForm.image.height} · {sheetForm.image.mimeType}</small> : null}
                </div>
              <div className="inline-edit-actions">
                <button type="submit">{t("common.save")}</button>
                {showNewSheet ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      cancelSheetEdit();
                      navigate("logbooks");
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setSheetForm(sheetToForm(activeSheet))}
                  >
                    Discard changes
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <section
                className="sheet-title-row logbook-section sheet-master-header"
                aria-label={t("details.headerAria")}
              >
                <EntityImage
                  image={activeSheet.image}
                  entityType="sheet"
                  alt={`${activeSheet.title || t("details.untitled")} thumbnail`}
                  variant="header"
                />
                <div className="sheet-master-title">
                  <h2 id="sheet-title">
                    {renderInlineTextField(
                      "title",
                      activeSheet.title,
                      t("details.untitled"),
                    )}
                  </h2>
                </div>
                <div className="inline-edit-actions sheet-master-actions">
                  <span className="status-pill">{activeSheet.status}</span>
                  <button
                    type="button"
                    className="edit-chip compact-chip"
                    aria-label={t("details.printSheet")}
                    title={t("details.printSheet")}
                    onClick={printActiveSheet}
                  >
                    {t("details.printSheet")}
                  </button>
                  <button
                    type="button"
                    className="edit-chip compact-chip"
                    aria-label="Share logsheet"
                    title="Share"
                    onClick={() => isDemo ? onDemoFeatureBlocked("sharing") : setIsShareDialogOpen(true)}
                  >
                    <span aria-hidden="true">↗</span> Share
                  </button>
                  {isActiveSheetLocked ? (
                    <button
                      type="button"
                      className="edit-chip compact-chip"
                      onClick={() => updateActiveSheetStatus("Draft")}
                    >
                      Unlock
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="edit-chip compact-chip"
                      onClick={() => updateActiveSheetStatus("Locked")}
                    >
                      Lock
                    </button>
                  )}
                </div>
                <div className="paper-header header-table">
                  <div className="header-table-row">
                    <span>{t("common.boat")}</span>
                    <strong>{renderInlineBoatField()}</strong>
                    <button
                      type="button"
                      className="edit-chip icon-chip"
                      aria-label={t("details.jumpToBoat")}
                      title={t("details.jumpToBoat")}
                      onClick={() => {
                        setSelectedBoatId(activeBoat.id);
                        setEditingBoatId(activeBoat.id);
                        setBoatForm(boatToForm(activeBoat));
                        setShowBoatManager(false);
                        navigate("boats", activeBoat.id);
                      }}
                    >
                      ↗
                    </button>
                  </div>
                  <div className="header-table-row">
                    <span>{t("common.from")}</span>
                    <strong>
                      {renderInlineDateField(
                        "departed",
                        activeSheet.route.departed,
                      )}
                    </strong>
                    <strong>
                      {renderInlineTextField("from", activeSheet.route.from)}
                    </strong>
                  </div>
                  <div className="header-table-row">
                    <span>{t("common.to")}</span>
                    <strong>
                      {renderInlineDateField(
                        "arrived",
                        activeSheet.route.arrived,
                      )}
                    </strong>
                    <strong>
                      {renderInlineTextField("to", activeSheet.route.to)}
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {!showNewSheet && (
            <>
              {showScannerDraftNotice && (
                <aside
                  className="scanner-draft-notice logbook-section"
                  aria-label={t("details.scanner.verificationNotice")}
                >
                  <div className="scanner-draft-notice-icon" aria-hidden="true">
                    ⚠️
                  </div>
                  <div>
                    <h3>{activeSheet.status === "Draft" ? t("details.scanner.verificationDraftHeading") : t("details.scanner.verificationHeading")}</h3>
                    <p className="scanner-warning-progress">
                      {activeScannerWarningCount} {t("details.scanner.activeWarnings")} {t("details.scanner.ofWarnings")} {scannerWarnings.length} {t("details.scanner.totalWarnings")}
                    </p>
                    {scannerWarnings.length > 0 && (
                      <label className="scanner-warning-visibility">
                        <input
                          type="checkbox"
                          checked={showAcknowledgedWarnings}
                          onChange={(event) => setAcknowledgedWarningVisibility({ sheetId: activeSheet.id, show: event.target.checked })}
                        />
                        {t("details.scanner.showAcknowledgedWarnings")}
                      </label>
                    )}
                    {noticeScannerWarnings.length > 0 && (
                      <ul>
                        {noticeScannerWarnings.map((warning) => (
                          <li
                            key={warning.id}
                            className={warning.acknowledgedAt ? "acknowledged" : undefined}
                            aria-label={`${warning.acknowledgedAt ? t("details.scanner.acknowledgedWarning") : t("details.scanner.activeWarning")}: ${scannerWarningText(warning)}`}
                          >
                            {scannerWarningText(warning)}
                            {renderScannerWarningAction(warning)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>
                      {t("details.scanner.correctionHelp")}
                    </p>
                  </div>
                </aside>
              )}


              {isShareDialogOpen && (
                <div className="share-logsheet-modal" role="dialog" aria-modal="true" aria-labelledby="share-logsheet-title">
                  <div className="share-logsheet-panel">
                    <div className="share-logsheet-heading">
                      <h2 id="share-logsheet-title">Share logsheet</h2>
                      <button className="edit-chip" type="button" onClick={() => setIsShareDialogOpen(false)}>Close</button>
                    </div>
                    <div className="share-logsheet-url">
                      {isSharingEnabled ? (
                        <>
                          <span>Share URL</span>
                          <a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a>
                        </>
                      ) : (
                        <p>Set at least one part to public or registered users to enable this share link.</p>
                      )}
                    </div>
                    <fieldset className="share-logsheet-options">
                      <legend>Privacy by logsheet part</legend>
                      {shareOptions.map(([field, label]) => (
                        <label key={field} className="share-logsheet-option">
                          <span>{label}</span>
                          <select
                            value={shareDraft[field]}
                            onChange={(event) => setShare({ [field]: event.currentTarget.value } as Partial<LogSheetShareSettings>)}
                          >
                            <option value="private">Private</option>
                            <option value="registered">Registered users only</option>
                            <option value="public">Public to everyone</option>
                          </select>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                </div>
              )}

              <section
                className="entry-metrics logbook-section"
                aria-label={t("details.summaryAria")}
              >
                <article>
                  <span>{t("compliance.motorMiles")}</span>
                  <strong>{formatMiles(activeSheetSummary.motorMiles)} nm</strong>
                </article>
                <article>
                  <span>{t("compliance.sailMiles")}</span>
                  <strong>{formatMiles(activeSheetSummary.sailMiles)} nm</strong>
                </article>
                <article>
                  <span>{t("logbooks.totalMiles")}</span>
                  <strong>{formatMiles(activeSheetSummary.totalMiles)} nm</strong>
                </article>
                <article>
                  <span>{t("dashboard.overallDuration")}</span>
                  <strong>{activeSheetSummary.duration}</strong>
                </article>
                <article>
                  <span>{t("dashboard.motionDuration")}</span>
                  <strong>{activeSheetSummary.motionDuration}</strong>
                </article>
                <article>
                  <span>{t("dashboard.totalEngineHours")}</span>
                  <strong>{activeSheetSummary.motorHoursDuration}</strong>
                </article>
                <article>
                  <span>{t("dashboard.propulsionDuration")}</span>
                  <strong>{activeSheetSummary.propulsionDuration}</strong>
                </article>
              </section>

              <article className="table-card">
                <div className="table-header">
                  <div><h3>{t("details.logTitle")}</h3></div>
                  <div className="table-actions">
                    <button type="button" onClick={() => setCoordinateFormatOverride({ sheetId: activeSheet.id, format: nextCoordinateFormat(coordinateFormat) })}>{t("details.coordinates")}: {coordinateFormat === "decimal" ? t("profile.coordinateDecimal") : coordinateFormat === "ddm" ? t("profile.coordinateDdm") : t("profile.coordinateDms")}</button>
                    <button type="button" onClick={() => onShowCourseColumnsChange(!showCourseColumns)}>{showCourseColumns ? t("details.hide") : t("details.show")} {t("details.courseColumns")}</button>
                    <button type="button" disabled={isActiveSheetLocked} onClick={startAddingLine}>{t("details.addLine")}</button>
                    <button type="button" disabled={isActiveSheetLocked || smartLineStatus === "loading"} onClick={() => void startAddingSmartLine()}>{smartLineStatus === "loading" ? t("details.addSmartLineLoading") : t("details.addSmartLine")}</button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className={showCourseColumns ? "log-lines-table with-course-columns" : "log-lines-table"}>
                    <thead>
                      <tr className="column-groups">
                        <th colSpan={4}>{t("details.timePos")}</th><th colSpan={8}>{t("details.weatherSea")}</th><th colSpan={showCourseColumns ? 9 : 2}>{t("details.course")}</th><th colSpan={4}>{t("details.travel")}</th><th>{t("details.remarks")}</th><th colSpan={2}>{t("details.actions")}</th>
                      </tr>
                      <tr>
                        <th scope="col" aria-label="Log line number">#</th><th>{t("details.time")}</th><th>{t("details.lat")}</th><th>{t("details.lon")}</th><th>{t("details.weather")}</th><th>{t("details.weatherRemark")}</th><th>{t("details.temperature")}</th><th>{t("details.baro")}</th><th>{t("details.wind")}</th><th>{t("details.sea")}</th><th>{t("details.tide")}</th><th>{t("details.moon")}</th>{courseConversionColumns.map((column) => (!column.isOptional || showCourseColumns) && renderCourseHeader(column))}<th>{t("details.speed")}</th><th>{t("details.log")}</th><th>{t("details.sail")}</th><th>{t("details.motor")}</th><th>{t("details.remarksEvent")}</th><th>{t("details.edit")}</th><th>{t("common.delete")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSheet.lines.map((line, index) => lineForms[line.id] ? renderLineEditor(line.id, index + 1) : (
                        <tr key={line.id}>
                          <td>{index + 1}</td><td {...scannerWarningCellProps(index + 1, ["time"])}>{formatTime(line.time)}</td><td {...scannerWarningCellProps(index + 1, ["latitude", "position"])}>{coordinateToInput(line.latitude, "lat", coordinateFormat)}</td><td {...scannerWarningCellProps(index + 1, ["longitude", "position"])}>{coordinateToInput(line.longitude, "lon", coordinateFormat)}</td><td {...scannerWarningCellProps(index + 1, ["weather"])}>{line.weather}</td><td {...scannerWarningCellProps(index + 1, ["weatherRemark"])}>{renderClampedLogText(t("details.weatherRemark"), line.weatherRemark)}</td><td {...scannerWarningCellProps(index + 1, ["temperature", "temperatureUnit"])}>{line.temperature} {line.temperatureUnit}</td><td {...scannerWarningCellProps(index + 1, ["barometer"])}>{line.barometer}</td><td {...scannerWarningCellProps(index + 1, ["windDirection", "windStrength", "windUnit"])}>{line.windDirection} {line.windStrength} {line.windUnit}</td><td {...scannerWarningCellProps(index + 1, ["waves", "seaUnit"])}>{line.waves} {line.seaUnit}</td><td {...scannerWarningCellProps(index + 1, ["tide", "tideUnit"])}>{line.tide} {line.tideUnit}</td><td {...scannerWarningCellProps(index + 1, ["moon"])}>{line.moon}</td>
                          {courseConversionColumns.map((column) => (!column.isOptional || showCourseColumns) && (
                            <td {...scannerWarningCellProps(index + 1, [column.field], column.isOptional ? "optional-course-cell" : undefined)} key={`${line.id}-${column.field}`}>{line[column.field]}</td>
                          ))}
                          <td {...scannerWarningCellProps(index + 1, ["speedKn"])}>{line.speedKn}</td><td {...scannerWarningCellProps(index + 1, ["logNm"])}>{line.logNm}</td><td {...scannerWarningCellProps(index + 1, ["sailMiles", "sailNote"])}><span className="log-line-distance-summary">{line.sailMiles} nm</span>{renderClampedLogText(t("details.sailNote"), line.sailNote)}</td><td {...scannerWarningCellProps(index + 1, ["motorMiles", "motorHours", "motorNote"])}><span className="log-line-distance-summary">{line.motorMiles} nm · {Object.entries(line.engineHours ?? {}).map(([id, hours]) => `${activeBoat.engines?.find((engine) => engine.id === id)?.label ?? id} ${hours} h`).join(" · ") || `${line.motorHours ?? 0} h`}</span>{renderClampedLogText(t("details.motorNote"), line.motorNote)}</td><td {...scannerWarningCellProps(index + 1, ["remarks"])}>{renderClampedLogText(t("details.remarksEvent"), line.remarks)}</td>
                          <td><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => startEditingLine(line)}>✏️</button></td>
                          <td><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => deleteLine(line.id)}>🗑️</button></td>
                        </tr>
                      ))}
                      {Object.entries(lineForms).filter(([, draft]) => draft.isNew).map(([draftId], index) => renderLineEditor(draftId, activeSheet.lines.length + index + 1))}
                    </tbody>
                  </table>
                </div>
                {openScannerWarning && typeof document !== "undefined" && createPortal(
                  <div
                    ref={scannerWarningDialogRef}
                    id="scanner-warning-dialog"
                    role="dialog"
                    aria-label={openScannerWarning.warnings.map(scannerWarningText).join("; ")}
                    className={`scanner-warning-tooltip${openScannerWarning.above ? " above" : ""}`}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenScannerWarning(null);
                      scannerWarningTriggerRef.current?.focus();
                    }}
                    onBlur={(event) => {
                      if (event.relatedTarget instanceof Node && (
                        event.currentTarget.contains(event.relatedTarget)
                        || scannerWarningTriggerRef.current?.contains(event.relatedTarget)
                      )) return;
                      setOpenScannerWarning(null);
                    }}
                    style={{
                      "--scanner-warning-left": `${openScannerWarning.left}px`,
                      "--scanner-warning-top": `${openScannerWarning.top}px`,
                    } as CSSProperties}
                  >
                    {openScannerWarning.warnings.map((warning, index) => (
                      <span
                        key={warning.id}
                        className={warning.acknowledgedAt ? "acknowledged" : undefined}
                        aria-label={`${warning.acknowledgedAt ? t("details.scanner.acknowledgedWarning") : t("details.scanner.activeWarning")}: ${scannerWarningText(warning)}`}
                      >
                        {scannerWarningText(warning)}
                        {renderScannerWarningAction(warning, index === 0)}
                      </span>
                    ))}
                  </div>,
                  document.body,
                )}
              </article>

              <section
                className="sheet-support-grid logbook-section"
                aria-label={t("details.sheetSupport")}
              >
                <article className="info-card logbook-section">
                  <h3>{t("crew.list")}</h3>
                  <ul className="stack-list crew-assignment-list">
                    {activeSheet.crew.map((person, index) => {
                      return (
                        <li key={`${person.id}-${index}`}>
                          <div className="crew-assignment-main">
                            <strong>
                              {index + 1}. {index === 0 ? `⭐ ${t("crew.skipper")} · ` : ""}
                              {person.name}
                            </strong>
                            <span>
                              {person.nationality} · {person.role}
                            </span>
                            <div className="crew-assignment-fields">
                              <span>{t("common.from")}</span>
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.fromDateTime")}`}
                                type="datetime-local"
                                disabled={isActiveSheetLocked}
                                value={person.embarkationDateTime}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "embarkationDateTime",
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.fromPosition")}`}
                                disabled={isActiveSheetLocked}
                                value={person.embarkationPosition}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "embarkationPosition",
                                    e.target.value,
                                  )
                                }
                              />
                              <span>{t("common.to")}</span>
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.toDateTime")}`}
                                type="datetime-local"
                                disabled={isActiveSheetLocked}
                                value={person.disembarkationDateTime}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "disembarkationDateTime",
                                    e.target.value,
                                  )
                                }
                              />
                              <input
                                aria-label={`${t("crew.label")} ${index + 1} ${t("details.toPosition")}`}
                                disabled={isActiveSheetLocked}
                                value={person.disembarkationPosition}
                                onChange={(e) =>
                                  updateCrewAssignment(
                                    index,
                                    "disembarkationPosition",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="crew-assignment-actions">
                            <button
                              type="button"
                              className="edit-chip"
                              disabled={isActiveSheetLocked || index === 0}
                              onClick={() => moveCrewOnActiveSheet(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="edit-chip"
                              disabled={
                                isActiveSheetLocked ||
                                index === activeSheet.crew.length - 1
                              }
                              onClick={() => moveCrewOnActiveSheet(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="edit-chip"
                              aria-label={`Delete ${person.name}`}
                              disabled={isActiveSheetLocked}
                              onClick={() => deleteCrewFromActiveSheet(index)}
                            >
                              🗑️
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <label>
                    {t("crew.addMember")}
                    <select
                      disabled={isActiveSheetLocked}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          addCrewToActiveSheet(e.target.value);
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="">{t("crew.select")}</option>
                      {logbook.crewMembers
                        .filter(
                          (member) =>
                            !activeSheet.crew.some(
                              (crew) => crew.id === member.id,
                            ),
                        )
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </article>
                <article className="info-card logbook-section">
                  <h3>{t("details.technicalLog")}</h3>
                  {counterEngines.length ? (
                    <section className="engine-hour-counter-section">
                      <h4>{t("details.engineHourCounters")}</h4>
                      <div className="table-scroll"><table className="engine-hour-counter-table">
                        <thead><tr><th scope="col">{t("details.counterReading")}</th>{counterEngines.map((engine) => <th scope="col" key={engine.id}>{engine.label}</th>)}</tr></thead>
                        <tbody>
                          {(["start", "end"] as const).map((boundary) => <tr key={boundary}><th scope="row">{t(boundary === "start" ? "details.counterStart" : "details.counterEnd")}</th>{counterEngines.map((engine) => <td key={engine.id}><input aria-label={`${engine.name} ${t(boundary === "start" ? "details.counterStart" : "details.counterEnd")}`} type="number" min="0" step="0.1" disabled={isActiveSheetLocked} defaultValue={activeSheet.engineHourCounters?.[engine.id]?.[boundary] ?? ""} onBlur={(event) => { const value = event.currentTarget.value === "" ? undefined : Number(event.currentTarget.value); if (value === undefined || Number.isFinite(value)) updateEngineHourCounter(engine.id, boundary, value); }} /></td>)}</tr>)}
                          <tr><th scope="row">{t("details.counterDifference")}</th>{counterEngines.map((engine) => { const reading = activeSheet.engineHourCounters?.[engine.id]; const difference = reading?.start === undefined || reading.end === undefined ? undefined : reading.end - reading.start; return <td key={engine.id} className={difference !== undefined && difference < 0 ? "counter-mismatch" : ""}>{difference === undefined ? "—" : `${difference.toFixed(1)} h`}</td>; })}</tr>
                          <tr><th scope="row">{t("details.trackedOnSheet")}</th>{counterEngines.map((engine) => <td key={engine.id}>{(activeSheetSummary.engineHours?.[engine.id] ?? 0).toFixed(1)} h</td>)}</tr>
                        </tbody>
                      </table></div>
                    </section>
                  ) : null}
                  <h4>{t("details.checks")}</h4>
                  {activeSheet.technicalChecks.length ? (
                    <ul className="stack-list">
                      {activeSheet.technicalChecks.map((item, index) => {
                        const draft = technicalCheckDrafts[index] ?? item.text;
                        return (
                          <li key={`${item.text}-${index}`} className="technical-check-row">
                            <select aria-label={`Check status ${index + 1}`} disabled={isActiveSheetLocked} value={item.status} onChange={(event) => updateTechnicalCheck(index, draft, event.target.value)}>
                              {TECHNICAL_CHECK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <input
                              aria-label={`${t("details.technicalLogEntry")} ${index + 1}`}
                              disabled={isActiveSheetLocked}
                              list={technicalCheckSuggestionsId}
                              value={draft}
                              onChange={(event) => updateTechnicalCheckDraft(index, event.target.value)}
                            />
                            <span className="inline-value-actions">
                              <button
                                type="button"
                                aria-label={`${t("common.save")} ${t("details.technicalLogEntry")} ${index + 1}`}
                                disabled={isActiveSheetLocked || draft === item.text}
                                onClick={() => saveTechnicalCheckDraft(index)}
                              >
                                💾
                              </button>
                              <button
                                type="button"
                                aria-label={`${t("common.cancel")} ${t("details.technicalLogEntry")} ${index + 1}`}
                                disabled={isActiveSheetLocked || draft === item.text}
                                onClick={() => cancelTechnicalCheckDraft(index)}
                              >
                                ❎
                              </button>
                              <button
                                type="button"
                                aria-label={`${t("details.deleteTechnicalLogEntry")} ${index + 1}`}
                                disabled={isActiveSheetLocked}
                                onClick={() => deleteTechnicalCheck(index)}
                              >
                                🗑️
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>{t("details.noTechnicalLogEntries")}</p>
                  )}
                  {technicalCheckSuggestions.length ? (
                    <datalist id={technicalCheckSuggestionsId}>
                      {technicalCheckSuggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  ) : null}
                  <form className="inline-edit-actions" onSubmit={submitTechnicalCheck}>
                    <input
                      aria-label={t("details.newTechnicalLogEntry")}
                      disabled={isActiveSheetLocked}
                      list={technicalCheckSuggestionsId}
                      value={newTechnicalCheck}
                      onChange={(event) => setNewTechnicalCheck(event.target.value)}
                      placeholder={t("details.addTechnicalLogEntry")}
                    />
                    <button type="submit" disabled={isActiveSheetLocked || !newTechnicalCheck.trim()}>
                      {t("details.addTechnicalLogEntry")}
                    </button>
                  </form>
                </article>
                <article className="map-card logbook-section logbook-sheet-map-section">
                  <div className="logbook-map-heading">
                    <h3>{t("details.positions")}</h3>
                    <button
                      className="edit-chip"
                      type="button"
                      onClick={() => setIsMapExpanded(true)}
                    >
                      {t("details.fullMap")}
                    </button>
                  </div>
                  <LogLinesMapView
                    logLines={activeSheet.lines}
                    onAddLogLineAt={isActiveSheetLocked ? undefined : startAddingLineAtCoordinates}
                  />
                </article>
              </section>
              {isMapExpanded && (
                <div
                  className="logbook-map-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="logbook-map-modal-title"
                >
                  <div className="logbook-map-modal-panel">
                    <div className="logbook-map-modal-heading">
                      <h2 id="logbook-map-modal-title">
                        {t("details.positions")}
                      </h2>
                      <button
                        className="edit-chip"
                        type="button"
                        onClick={() => setIsMapExpanded(false)}
                      >
                        {t("details.closeMap")}
                      </button>
                    </div>
                    <LogLinesMapView
                      className="open-seamap-expanded"
                      logLines={activeSheet.lines}
                      onAddLogLineAt={isActiveSheetLocked ? undefined : startAddingLineAtCoordinates}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}

const compassDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const weatherEmojis = ["☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️", "🌨️", "🌩️", "🌪️", "🌫️", "☀️", "❄️", "⭐"];
const moonEmojis = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌘"];

function dmsInputValue(container: HTMLElement, part: keyof DmsParts) {
  const input = container.querySelector<HTMLInputElement>(`[data-dms-part="${part}"]`);
  return input?.value.trim().replace(",", ".") ?? "";
}
