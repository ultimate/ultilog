"use client";

import { SharedCopyDialog } from "./SharedCopyDialog";
import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "../../lib/use-hydrated";
import { useI18n } from "../../lib/i18n";
import type { CopyRequiredSection } from "../../domain/logbook/share-policy";

type BoatSummary = { id: string; name: string; archived?: boolean };
type Props = {
  ownerId: string;
  sheetId: string;
  title?: string;
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
  const hydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const missingSectionLabels: Record<CopyRequiredSection, string> = {
    masterData: t("sharedCopy.requiredMasterData"), logLines: t("sharedCopy.requiredLogLines"), technicalLog: t("sharedCopy.requiredTechnicalLog"),
  };
  const unavailableMessage = props.missingRequiredSections.length > 0 && !props.requiresAuthentication
    ? `${t("sharedCopy.missingRequiredPrefix")} ${props.missingRequiredSections.map(section => missingSectionLabels[section]).join(", ")}. ${t("sharedCopy.askOwner")}` : "";
  if (!props.isAuthenticated) return <section className="logbook-section shared-copy-action">
    <button type="button" disabled>{t("sharedCopy.action")}</button>
    <p>{unavailableMessage || t("sharedCopy.signInExplanation")}</p>
    {(props.canCopy || props.requiresAuthentication) ? <Link className="button-link" href={`/login?callbackUrl=${encodeURIComponent(props.returnPath)}`}>{t("sharedCopy.signIn")}</Link> : null}
  </section>;
  if (!props.canCopy) return <section className="logbook-section shared-copy-action"><button type="button" disabled>{t("sharedCopy.action")}</button><p>{unavailableMessage}</p></section>;
  return <section className="logbook-section shared-copy-action">
    <button type="button" disabled={!hydrated} onClick={() => setIsOpen(true)}>{t("sharedCopy.action")}</button>
    {isOpen ? <SharedCopyDialog ownerId={props.ownerId} entries={[{ id: props.sheetId, title: props.title ?? props.sheetId, canIncludeCrew: props.canIncludeCrew, canIncludePicture: props.canIncludePicture }]} returnPath={props.returnPath} onClose={() => setIsOpen(false)} single /> : null}
  </section>;
}
