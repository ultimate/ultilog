"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import type { SharedCopyTarget } from "../../lib/db/logbook-database";
import { ModalLayer } from "./ModalLayer";

export type CopyEntry = { id: string; title: string; canIncludeCrew: boolean; canIncludePicture: boolean };
type BoatSummary = { id: string; name: string; archived?: boolean };
type ReviewRow = CopyEntry & {
  copies: SharedCopyTarget[]; targetId: string; includeCrew: boolean; includePicture: boolean;
  previewed?: boolean; status: "loading" | "ready" | "saving" | "success" | "error" | "uncertain";
  error?: string; resultId?: string;
};

export function SharedCopyDialog({ ownerId, entries, returnPath, onClose, single = false }: {
  ownerId: string; entries: CopyEntry[]; returnPath: string; onClose(): void; single?: boolean;
}) {
  const { t } = useI18n();
  const { formatDate } = useDateTimeFormat();
  const router = useRouter();
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [boats, setBoats] = useState<BoatSummary[]>([]);
  const [boatId, setBoatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>(() => entries.map(entry => ({ ...entry, copies: [], targetId: "", includeCrew: false, includePicture: false, status: "loading" })));
  const endpoint = (id: string) => `/api/shared/logbooks/${encodeURIComponent(ownerId)}/${encodeURIComponent(id)}/copy`;
  const patch = (id: string, change: Partial<ReviewRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...change } : row));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/logbook", { cache: "no-store" });
        if (!response.ok) throw new Error("load");
        const payload = await response.json() as { boats?: BoatSummary[] };
        const available = (payload.boats ?? []).filter(boat => !boat.archived);
        if (active) { setBoats(available); setBoatId(available[0]?.id ?? ""); }
      } catch { if (active) setLoadError(t("sharedCopy.loadError")); }
      // Load previews in sequence to avoid flooding the database for large selections.
      for (const entry of entries) {
        if (!active) return;
        try {
          const response = await fetch(`/api/shared/logbooks/${encodeURIComponent(ownerId)}/${encodeURIComponent(entry.id)}/copy`, { cache: "no-store" });
          if (!response.ok) throw new Error("preview");
          const payload = await response.json() as { copies: SharedCopyTarget[] };
          if (active) setRows(current => current.map(row => row.id === entry.id ? { ...row, copies: payload.copies, targetId: payload.copies[0]?.id ?? "", previewed: true, status: "ready" } : row));
        } catch { if (active) setRows(current => current.map(row => row.id === entry.id ? { ...row, status: "error", error: t("sharedCopy.previewError") } : row)); }
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [entries, ownerId, t]);

  async function reviewAgain(row: ReviewRow) {
    patch(row.id, { status: "loading" });
    try {
      const response = await fetch(endpoint(row.id), { cache: "no-store" });
      if (!response.ok) throw new Error("preview");
      const { copies } = await response.json() as { copies: SharedCopyTarget[] };
      patch(row.id, { previewed: true, copies, targetId: copies.some(copy => copy.id === row.targetId) ? row.targetId : copies[0]?.id ?? "", status: "ready", error: undefined });
    } catch { patch(row.id, { status: "error", error: t("sharedCopy.previewError") }); }
  }

  const pending = rows.filter(row => row.status === "ready");
  const newCount = pending.filter(row => !row.targetId).length;
  const updateCount = pending.length - newCount;
  const canSubmit = !loading && !loadError && !submitting && !rows.some(row => row.status === "loading") && pending.length > 0 && (newCount === 0 || Boolean(boatId));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      for (const row of pending) {
        patch(row.id, { status: "saving", error: undefined });
        const target = row.copies.find(copy => copy.id === row.targetId);
        try {
          const response = await fetch(endpoint(row.id), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destinationBoatId: target?.boatId ?? boatId, includeCrew: row.includeCrew, includePicture: row.includePicture,
              ...(target ? { action: "update", targetCopyId: target.id, expectedRevision: target.revision, expectedContentVersion: target.contentVersion }
                : { action: "create", allowDuplicate: row.copies.length > 0 }),
            }),
          });
          const payload = await response.json().catch(() => ({})) as { id?: string };
          if (!response.ok) {
            patch(row.id, { status: response.status >= 500 ? "uncertain" : "error", error: t(response.status >= 500 ? "sharedCopy.uncertain" : response.status === 409 ? "sharedCopy.conflict" : response.status === 401 || response.status === 403 ? "sharedCopy.authorizationError" : "sharedCopy.validationError") });
            continue;
          }
          if (!payload.id) { patch(row.id, { status: "uncertain", error: t("sharedCopy.uncertain") }); continue; }
          patch(row.id, { status: "success", resultId: payload.id });
          if (single) router.push(`/details/${encodeURIComponent(payload.id)}`);
        } catch {
          // A lost response can hide a successful commit. Never automatically repeat a create.
          patch(row.id, { status: "uncertain", error: t("sharedCopy.uncertain") });
        }
      }
    } finally { busy.current = false; setSubmitting(false); }
  }

  return <ModalLayer className="share-logsheet-modal" role="dialog" aria-modal="true" aria-labelledby="shared-copy-title">
    <form className="share-logsheet-panel shared-copy-panel" onSubmit={submit}>
      <div className="share-logsheet-heading"><h2 id="shared-copy-title">{t("sharedCopy.title")}</h2><button type="button" className="secondary-action" disabled={submitting} aria-label={t("sharedCopy.close")} onClick={onClose}>×</button></div>
      <p>{t("sharedCopy.manualUpdates")}</p><p>{t("sharedCopy.deletion")}</p>
      <p className="shared-copy-warning">{t("sharedCopy.overwrite")}</p>
      <p>{t("sharedCopy.optionalReplacement")}</p>
      {loading ? <p role="status">{t("sharedCopy.reviewLoading")}</p> : null}
      {loadError ? <p role="alert">{loadError}</p> : !loading && newCount > 0 && boats.length === 0 ? <p>{t("sharedCopy.noBoats")} <Link href={`/boats?returnTo=${encodeURIComponent(returnPath)}`}>{t("sharedCopy.createBoat")}</Link></p> : null}
      {newCount > 0 && boats.length > 0 ? <label>{t("sharedCopy.destination")}<select value={boatId} disabled={submitting} onChange={event => setBoatId(event.target.value)}>{boats.map(boat => <option key={boat.id} value={boat.id}>{boat.name}</option>)}</select></label> : null}
      <div className="shared-copy-rows">{rows.map(row => {
        const target = row.copies.find(copy => copy.id === row.targetId);
        return <fieldset className="shared-copy-row" key={row.id} disabled={submitting || row.status !== "ready"}>
          <legend>{row.title}</legend>
          {row.previewed && row.status !== "loading" ? <strong className="shared-copy-badge">{target ? t("sharedCopy.updateExisting") : t("sharedCopy.newCopy")}</strong> : null}
          {row.copies.length > 0 ? <label>{t("sharedCopy.chooseAction")}<select value={row.targetId} onChange={event => patch(row.id, { targetId: event.target.value })}>
            <option value="">{t("sharedCopy.newCopy")}</option>
            {row.copies.map(copy => <option key={copy.id} value={copy.id}>{t("sharedCopy.updateExisting")}: {copy.title} · {copy.boatName} · {formatDate(copy.copiedAt)}</option>)}
          </select></label> : null}
          {target ? <p>{target.title} · {target.boatName} · {formatDate(target.copiedAt)}</p> : row.copies.length > 0 ? <p>{t("sharedCopy.duplicateMileage")}</p> : null}
          {row.canIncludeCrew ? <label className="checkbox-row"><input type="checkbox" checked={row.includeCrew} onChange={event => patch(row.id, { includeCrew: event.target.checked })} />{t("sharedCopy.includeCrew")}</label> : null}
          {row.canIncludePicture ? <label className="checkbox-row"><input type="checkbox" checked={row.includePicture} onChange={event => patch(row.id, { includePicture: event.target.checked })} />{t("sharedCopy.includePicture")}</label> : null}
          {row.status === "saving" ? <p role="status">{t("sharedCopy.copying")}</p> : null}
          {row.status === "success" ? <p role="status">{t("sharedCopy.saved")} <Link href={`/details/${encodeURIComponent(row.resultId!)}`}>{t("sharedCopy.openSaved")}</Link></p> : null}
          {row.error ? <p role="alert">{row.error}</p> : null}
        </fieldset>;
      })}</div>
      {rows.filter(row => row.status === "error" || row.status === "uncertain").map(row => <button type="button" className="secondary-action" key={row.id} disabled={submitting} onClick={() => void reviewAgain(row)}>{t("sharedCopy.reviewAgain")}: {row.title}</button>)}
      <div className="modal-actions"><button type="button" className="secondary-action" disabled={submitting} onClick={onClose}>{t("sharedCopy.close")}</button><button type="submit" className="primary-action" disabled={!canSubmit}>{submitting ? t("sharedCopy.copying") : t("sharedCopy.confirmCounts").replace("{new}", String(newCount)).replace("{updates}", String(updateCount))}</button></div>
    </form>
  </ModalLayer>;
}
