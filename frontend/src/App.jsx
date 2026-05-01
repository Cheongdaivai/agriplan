import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import useFarmStore, { FALLBACK_CROPS } from "./store/useFarmStore.js";
import { cropsApi } from "./utils/api.js";
import FarmEditorPage from "./pages/FarmEditorPage.jsx";
import FarmManagementPage from "./pages/FarmManagementPage.jsx";

export default function App() {
  const { setCrops } = useFarmStore();

  // Load crops from the API on mount; fall back to hardcoded list if unavailable
  useEffect(() => {
    let cancelled = false;

    cropsApi
      .getAll()
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        // Normalise: support { crops: [...] } or plain array
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.crops)
            ? data.crops
            : Array.isArray(data?.data)
              ? data.data
              : [];

        if (list.length > 0) {
          // Attach a fallback color if the backend crop doesn't have one
          const withColors = list.map((c, i) => ({
            ...c,
            color:
              c.color ??
              FALLBACK_CROPS[i % FALLBACK_CROPS.length]?.color ??
              "#6b7280",
          }));
          setCrops(withColors);
        } else {
          setCrops(FALLBACK_CROPS);
        }
      })
      .catch(() => {
        if (!cancelled) setCrops(FALLBACK_CROPS);
      });

    return () => {
      cancelled = true;
    };
  }, [setCrops]);

  return (
    <Routes>
      <Route path="/" element={<FarmEditorPage />} />
      <Route path="/management" element={<FarmManagementPage />} />
      <Route path="/management/:layoutId" element={<FarmManagementPage />} />
    </Routes>
  );
}
