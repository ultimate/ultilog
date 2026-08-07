import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { defaultBoatForm } from "../../app/components/logbook/forms";
import { BoatManagerPage } from "../../app/components/logbook/pages/BoatManagerPage";
import { I18nProvider } from "../../app/lib/i18n";
import type { Boat, PersistedLogbook } from "../../app/models/logbook";

const boat: Boat = {
  id: "boat-1",
  archived: false,
  name: "Aurora",
  type: "Sail",
  registration: "CH-1",
  flagState: "🇨🇭",
  homePort: "Basel",
  owner: "Owner",
  dimensions: "10m",
  logfactor: 1,
  yachtData: {},
  deviationTable: [],
};

function renderManager(logbook: PersistedLogbook, selectedBoat: Boat) {
  return renderToStaticMarkup(<I18nProvider><BoatManagerPage
    logbook={logbook}
    selectedBoat={selectedBoat}
    showBoatManager={false}
    editingBoatId={selectedBoat.id}
    boatForm={defaultBoatForm}
    setBoatForm={vi.fn()}
    setEditingBoatId={vi.fn()}
    setSelectedBoatId={vi.fn()}
    setShowBoatManager={vi.fn()}
    saveBoat={vi.fn()}
    cancelBoatEdit={vi.fn()}
    deleteSelectedBoat={vi.fn()}
    setSelectedBoatArchived={vi.fn()}
    showSelectedBoatLogsheets={vi.fn()}
    pushAppPath={vi.fn()}
    defaultPageSize={25}
    isDemo={false}
    onDemoFeatureBlocked={vi.fn()}
  /></I18nProvider>);
}

describe("BoatManagerPage archiving", () => {
  it("offers archiving and a logsheet link instead of deletion for a referenced boat", () => {
    const logbook: PersistedLogbook = {
      boats: [boat],
      crewMembers: [],
      sheets: [{ id: "sheet-1", title: "Passage", status: "Draft", boatId: boat.id, route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] }],
    };

    const markup = renderManager(logbook, boat);

    expect(markup).toContain("Archive boat");
    expect(markup).toContain("cannot be deleted");
    expect(markup).toContain("View logsheets");
    expect(markup).not.toContain(">Delete boat<");
  });

  it("offers restoration for an archived boat", () => {
    const archivedBoat = { ...boat, archived: true };
    const markup = renderManager({ boats: [archivedBoat], crewMembers: [], sheets: [] }, archivedBoat);

    expect(markup).toContain("Restore boat");
    expect(markup).toContain("Delete boat");
    expect(markup).not.toContain("Archive boat</button>");
  });
});
