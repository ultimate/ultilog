"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "../../lib/i18n";
import type { CopyRequiredSection } from "../../domain/logbook/share-policy";

type BoatSummary = { id: string; name: string; archived?: boolean };
type PreviousCopySummary = { id: string; title: string; copiedAt: string };
type Props = {
  ownerId: string;
  sheetId: string;
  isAuthenticated: boolean;
  canCopy: boolean;
  requiresAuthentication: boolean;
  missingRequiredSections: CopyRequiredSection[];
  canIncludeCrew: boolean;
  canIncludePicture: boolean;
  returnPath: string;
};

export function eligibleBoats(value: unknown): BoatSummary[] {
  if (!value || typeof value !== "object") return [];
  const boats = (value as { boats?: unknown }).boats;
  if (!Array.isArray(boats)) return [];
  return boats.filter((boat): boat is BoatSummary => Boolean(boat && typeof boat === "object"
    && typeof (boat as BoatSummary).id === "string" && typeof (boat as BoatSummary).name === "string"
    && !(boat as BoatSummary).archived));
}

export function copiedSheetPath(id: string) {
  return `/details/${encodeURIComponent(id)}`;
}

export function copyActionDisabled(isAuthenticated: boolean, canCopy: boolean, boats: BoatSummary[] | null) {
  return !isAuthenticated || !canCopy || boats === null || boats.length === 0;
}

export function SharedLogbookCopy(props: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [boats, setBoats] = useState<BoatSummary[] | null>(null);
  const [destinationBoatId, setDestinationBoatId] = useState("");
  const [includeCrew, setIncludeCrew] = useState(false);
  const [includePicture, setIncludePicture] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previousCopy, setPreviousCopy] = useState<PreviousCopySummary | null>(null);

  useEffect(() => {
    if (!props.isAuthenticated || !props.canCopy) return;
    let active = true;
    fetch("/api/logbook").then(async response => {
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "authorization" : "load");
      return response.json();
    }).then(payload => {
      if (!active) return;
      const available = eligibleBoats(payload);
      setBoats(available);
      setDestinationBoatId(available[0]?.id ?? "");
    }).catch(reason => {
      if (!active) return;
      setBoats([]);
      setError(reason instanceof Error && reason.message === "authorization" ? t("sharedCopy.authorizationError") : t("sharedCopy.loadError"));
    });
    return () => { active = false; };
  }, [props.canCopy, props.isAuthenticated, t]);

  const missingSectionLabels: Record<CopyRequiredSection, string> = {
    masterData: t("sharedCopy.requiredMasterData"),
    logLines: t("sharedCopy.requiredLogLines"),
    technicalLog: t("sharedCopy.requiredTechnicalLog"),
  };
  const isDisabled = copyActionDisabled(props.isAuthenticated, props.canCopy, boats);
  const unavailableMessage = props.missingRequiredSections.length > 0 && !props.requiresAuthentication
    ? `${t("sharedCopy.missingRequiredPrefix")} ${props.missingRequiredSections.map(section => missingSectionLabels[section]).join(", ")}. ${t("sharedCopy.askOwner")}`
    : "";

  if (!props.isAuthenticated) return <section className="logbook-section shared-copy-action" aria-describedby="shared-copy-guidance">
    <button type="button" disabled>{t("sharedCopy.action")}</button>
    <p id="shared-copy-guidance">{unavailableMessage || t("sharedCopy.signInExplanation")}</p>
    {(props.canCopy || props.requiresAuthentication) ? <Link className="button-link" href={`/login?callbackUrl=${encodeURIComponent(props.returnPath)}`}>{t("sharedCopy.signIn")}</Link> : null}
  </section>;
  if (!props.canCopy) return <section className="logbook-section shared-copy-action" aria-describedby="shared-copy-guidance">
    <button type="button" disabled>{t("sharedCopy.action")}</button>
    <p id="shared-copy-guidance">{unavailableMessage}</p>
  </section>;
  if (boats === null) return <section className="logbook-section shared-copy-action"><button type="button" disabled>{t("sharedCopy.action")}</button><p>{t("sharedCopy.loadingBoats")}</p></section>;
  if (boats.length === 0) return <section className="logbook-section shared-copy-action"><button type="button" disabled>{t("sharedCopy.action")}</button><div><h2>{t("sharedCopy.noBoatsTitle")}</h2><p>{error || t("sharedCopy.noBoats")}</p></div><Link className="button-link" href={`/boats?returnTo=${encodeURIComponent(props.returnPath)}`}>{t("sharedCopy.createBoat")}</Link></section>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !destinationBoatId) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/shared/logbooks/${encodeURIComponent(props.ownerId)}/${encodeURIComponent(props.sheetId)}/copy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationBoatId, ...(props.canIncludeCrew ? { includeCrew } : {}), ...(props.canIncludePicture ? { includePicture } : {}), ...(previousCopy ? { allowDuplicate: true } : {}) }),
      });
      const payload = await response.json().catch(() => ({})) as { id?: string; code?: string; previousCopy?: PreviousCopySummary };
      if (response.status === 409 && payload.code === "duplicate_shared_copy" && payload.previousCopy) {
        setPreviousCopy(payload.previousCopy);
        return;
      }
      if (!response.ok || !payload.id) {
        setError(response.status === 401 || response.status === 403 ? t("sharedCopy.authorizationError") : response.status === 400 || response.status === 409 || response.status === 422 ? t("sharedCopy.validationError") : t("sharedCopy.requestError"));
        return;
      }
      router.push(copiedSheetPath(payload.id));
    } catch {
      setError(t("sharedCopy.requestError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <section className="logbook-section shared-copy-action">
    <button type="button" disabled={isDisabled} onClick={() => setIsOpen(true)}>{t("sharedCopy.action")}</button>
    {isOpen ? <div className="share-logsheet-modal" role="dialog" aria-modal="true" aria-labelledby="shared-copy-title">
      <form className="share-logsheet-panel" onSubmit={submit}>
        <div className="share-logsheet-heading"><div><p className="eyebrow">{t("sharedCopy.eyebrow")}</p><h2 id="shared-copy-title">{t("sharedCopy.title")}</h2></div><button type="button" aria-label={t("sharedCopy.close")} onClick={() => setIsOpen(false)}>×</button></div>
        <p>{t("sharedCopy.independent")}</p><p>{t("sharedCopy.deletion")}</p><p><strong>{t("sharedCopy.emptyCrew")}</strong></p>
        <label>{t("sharedCopy.destination")}<select required value={destinationBoatId} onChange={event => setDestinationBoatId(event.target.value)}>{boats.map(boat => <option key={boat.id} value={boat.id}>{boat.name}</option>)}</select></label>
        {props.canIncludeCrew ? <label className="checkbox-row"><input type="checkbox" checked={includeCrew} onChange={event => setIncludeCrew(event.target.checked)} />{t("sharedCopy.includeCrew")}</label> : null}
        {props.canIncludePicture ? <label className="checkbox-row"><input type="checkbox" checked={includePicture} onChange={event => setIncludePicture(event.target.checked)} />{t("sharedCopy.includePicture")}</label> : null}
        {previousCopy ? <div className="auth-error" role="alert"><strong>{t("sharedCopy.previouslyCopied")}</strong><p>{t("sharedCopy.duplicateMileage")}</p><p>{previousCopy.title}</p></div> : null}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div className="modal-actions"><button type="button" disabled={isSubmitting} onClick={() => setIsOpen(false)}>{t("sharedCopy.cancel")}</button><button type="submit" disabled={isSubmitting || !destinationBoatId}>{isSubmitting ? t("sharedCopy.copying") : previousCopy ? t("sharedCopy.confirmDuplicate") : t("sharedCopy.confirm")}</button></div>
      </form>
    </div> : null}
  </section>;
}
