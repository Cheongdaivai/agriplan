import { create } from "zustand";

const useManagementStore = create((set, get) => ({
  layouts: [],
  activeLayout: null,
  selectedZoneId: null,
  sensorData: {}, // { [zoneId]: { [sensorType]: { value, unit, recordedAt } } }
  devices: [],
  lastRefresh: null,

  setLayouts: (layouts) => set({ layouts }),
  // Use loadLayout when switching layouts.
  // Preserves selectedZoneId if the same layout is re-loaded (e.g. Strict Mode double-invoke).
  loadLayout: (layout) => {
    const newId = layout?._id ?? layout?.id;
    const curId = get().activeLayout?._id ?? get().activeLayout?.id;
    if (newId && newId === curId) {
      // Same layout already active — just refresh data, keep zone selection
      set({ activeLayout: layout });
    } else {
      // Switching to a different layout — reset zone selection
      console.log('[ManagementStore] loadLayout switching layout → clearing selectedZoneId', newId);
      set({ activeLayout: layout, selectedZoneId: null });
    }
  },
  // Use setActiveLayout for in-place updates (e.g. optimistic rowPlan update) — keeps selection
  setActiveLayout: (layout) => set({ activeLayout: layout }),
  setSelectedZone: (id) => {
    if (!id) console.log('[ManagementStore] setSelectedZone → null (deselecting)');
    set({ selectedZoneId: id });
  },
  setSensorData: (data) => set({ sensorData: data }),
  setDevices: (devices) => set({ devices }),
  updateSensorReading: (zoneId, sensorType, reading) =>
    set((state) => ({
      sensorData: {
        ...state.sensorData,
        [zoneId]: {
          ...(state.sensorData[zoneId] ?? {}),
          [sensorType]: reading,
        },
      },
    })),
  setLastRefresh: () => set({ lastRefresh: new Date() }),
}));

export default useManagementStore;
