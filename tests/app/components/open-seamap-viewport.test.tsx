import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { OpenSeaMapLeaflet, type MapRoute } from "../../../app/components/logbook/OpenSeaMapLeaflet";

const map = vi.hoisted(() => ({ fitBounds: vi.fn(), setView: vi.fn(), invalidateSize: vi.fn(), getContainer: vi.fn(() => ({})) }));
vi.mock("leaflet", () => ({ default: { divIcon: vi.fn() } }));
vi.mock("react-leaflet", () => {
  const Container = ({ children }: { children?: ReactNode }) => children;
  return { MapContainer: Container, Marker: Container, Polyline: Container, Popup: Container, Tooltip: Container, TileLayer: () => null, useMap: () => map, useMapEvents: () => map };
});
vi.mock("../../../app/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("preserves the viewport for marker toggles and highlights, but refits changed coordinates", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const route: MapRoute = { id: "sheet", title: "Passage", detailLevel: "summary", points: [
    { id: "a", label: "1", title: "A", latitude: 42, longitude: 8 },
    { id: "b", label: "2", title: "B", latitude: 43, longitude: 9 },
  ] };
  await act(async () => { renderer = create(<OpenSeaMapLeaflet routes={[route]} />); });
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  for (const visible of [false, true]) {
    await act(async () => renderer.update(<OpenSeaMapLeaflet routes={[{ ...route, points: route.points.map((point) => ({ ...point })) }]} showEndpointMarkers={visible} highlightedRouteId={visible ? "sheet" : null} />));
  }
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect(map.setView).not.toHaveBeenCalled();
  await act(async () => renderer.update(<OpenSeaMapLeaflet routes={[{ ...route, points: [{ ...route.points[0], latitude: 44 }, route.points[1]] }]} />));
  expect(map.fitBounds).toHaveBeenCalledTimes(2);
  await act(async () => renderer.update(<OpenSeaMapLeaflet routes={[{ ...route, points: [route.points[0]] }]} />));
  expect(map.setView).toHaveBeenCalledWith([42, 8], 11, { animate: false });
});
