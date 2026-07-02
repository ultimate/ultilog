import type { Dispatch, SetStateAction } from "react";
import type { Boat, LogSheet, PersistedLogbook, SheetForm } from "../../../models/logbook";
import { defaultSheetForm, sheetToForm } from "../forms";
import { legalRequirements } from "../../../templates/compliance";

type Navigate = (module: "details" | "logbooks", itemId?: string | number) => void;

type SocialUser = { username: string; sailMiles: number; motorMiles: number; logbookSheets: number; boats: number };

type SheetSummary = { motorMiles: number; sailMiles: number };

export function LogbooksPage({
  activeBoat,
  calculateSheetSummary,
  logbook,
  navigate,
  setActiveSheetId,
  setEditingSheetId,
  setSheetForm,
  setShowNewSheet,
}: {
  activeBoat: Boat;
  calculateSheetSummary: (sheet: LogSheet) => SheetSummary;
  logbook: PersistedLogbook;
  navigate: Navigate;
  setActiveSheetId: Dispatch<SetStateAction<string>>;
  setEditingSheetId: Dispatch<SetStateAction<string | null>>;
  setSheetForm: Dispatch<SetStateAction<SheetForm>>;
  setShowNewSheet: Dispatch<SetStateAction<boolean>>;
}) {
  return <section className="logbook-page module-panel" aria-label="Log sheets">
    <div className="page-heading">
      <div><h1>Logbooks</h1><p>Manage all your logbook entries</p></div>
      <button type="button" className="primary-action" onClick={() => { setEditingSheetId(null); setSheetForm(defaultSheetForm(activeBoat.id)); setShowNewSheet(true); navigate("details"); }}>+ New sheet</button>
    </div>
    <div className="logbook-toolbar"><input aria-label="Search logbooks" placeholder="Search logbooks…" readOnly /><select aria-label="Vessel filter" defaultValue="All vessels"><option>All vessels</option></select><select aria-label="Time filter" defaultValue="All time"><option>All time</option></select></div>
    <article className="table-card logbook-list-card">
      <div className="table-scroll"><table className="logbook-table"><thead><tr><th>Date</th><th>Entry</th><th>Vessel</th><th>From → To</th><th>Sail miles</th><th>Motor miles</th><th>Total miles</th><th></th></tr></thead><tbody>{logbook.sheets.map((sheet) => {
        const boat = logbook.boats.find((candidate) => candidate.id === sheet.boatId);
        const totalMiles = Math.max(0, ...sheet.lines.map((line) => line.logNm));
        const sheetSummary = calculateSheetSummary(sheet);
        const motorMiles = sheetSummary.motorMiles;
        const sailMiles = sheetSummary.sailMiles;
        return <tr key={sheet.id}><td>{sheet.dateRange}</td><td><button className="table-title-button" onClick={() => { setActiveSheetId(sheet.id); setSheetForm(sheetToForm(sheet)); navigate("details", sheet.id); }} type="button">{sheet.title}</button></td><td><span className="table-vessel"><span className="picture-thumb" aria-hidden="true" />{boat?.name}</span></td><td>{sheet.route.from} → {sheet.route.to}</td><td>{sailMiles} nm</td><td>{motorMiles} nm</td><td>{totalMiles} nm</td><td><button className="edit-chip" onClick={() => { setActiveSheetId(sheet.id); setSheetForm(sheetToForm(sheet)); navigate("details", sheet.id); }} type="button">Open</button></td></tr>;
      })}</tbody></table></div>
      <div className="pagination-mock" aria-hidden="true"><span className="active">1</span><span>2</span><span>3</span><span>…</span><span>8</span><span>›</span></div>
    </article>
  </section>;
}

export function UsersPage({ mockSocialUsers }: { mockSocialUsers: SocialUser[] }) {
  return <section className="module-panel" aria-label="Users page">
    <div className="page-heading"><div><h1>Users</h1><p>Discover other ultilog sailors and compare high-level logbook activity.</p></div></div>
    <article className="table-card">
      <div className="table-header"><div><p className="eyebrow">Community directory</p><h3>All users</h3><p>Mocked summary data until shared profile statistics are connected.</p></div></div>
      <div className="table-scroll"><table className="logbook-table users-table"><thead><tr><th>Username</th><th>Total sail mileage</th><th>Total motor mileage</th><th>Logbook sheets</th><th>Boats</th></tr></thead><tbody>{mockSocialUsers.map((user) => <tr key={user.username}><td><strong>{user.username}</strong></td><td>{user.sailMiles.toLocaleString()} nm</td><td>{user.motorMiles.toLocaleString()} nm</td><td>{user.logbookSheets}</td><td>{user.boats}</td></tr>)}</tbody></table></div>
    </article>
  </section>;
}

export function CompliancePage() {
  return <section className="sheet-detail module-panel"><div className="page-heading"><div><h1>Compliance</h1><p>ICC / Hochseeausweis requirements</p></div><button className="secondary-action" type="button">Download report</button></div><article className="compliance-board"><section className="compliance-summary"><h3>Overall progress</h3><div className="progress-layout"><div className="progress-ring"><strong>72%</strong><span>Complete</span></div><dl><div><dt>You have</dt><dd>2,173 nm</dd></div><div><dt>Required</dt><dd>3,000 nm</dd></div><div><dt>Remaining</dt><dd>827 nm</dd></div></dl></div></section><section className="requirement-panel"><h3>Requirement checklist</h3>{legalRequirements.map((requirement, index) => <div className="requirement-row" key={requirement}><span>✓</span><strong>{requirement}</strong><progress value={[2173,1650,1020,1250,1120,860][index] ?? 860} max={[3000,1500,1000,1000,1400,500][index] ?? 500} /></div>)}</section></article><div className="mileage-breakdown"><article><span>△</span><strong>Sail miles</strong><b>1,650 nm</b><small>70%</small></article><article><span>✚</span><strong>Motor miles</strong><b>523 nm</b><small>24%</small></article><article><span>⛵</span><strong>Ocean passages</strong><b>1,120 nm</b><small>30%</small></article><article><span>♙</span><strong>As skipper</strong><b>860 nm</b><small>40%</small></article></div></section>;
}
