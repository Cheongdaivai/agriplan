import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFarmStore from "../store/useFarmStore.js";
import { farmsApi, zonesApi, layoutsApi } from "../utils/api.js";
import { calculateAreaSqm, calculateFarmStats } from "../utils/calculations.js";

const SOIL_TYPES = [
  { value: "clay", label: "Clay" },
  { value: "sandy", label: "Sandy" },
  { value: "loam", label: "Loam" },
  { value: "silt", label: "Silt" },
  { value: "peaty", label: "Peaty" },
];

export default function SaveFarmModal({ onClose }) {
  const {
    farmName,
    season,
    soilType,
    boundary,
    zones,
    crops,
    setFarmMeta,
    setSavedFarmId,
  } = useFarmStore();

  const navigate = useNavigate();

  const [localName, setLocalName] = useState(farmName);
  const [localSoil, setLocalSoil] = useState(soilType);
  const [localSeason, setLocalSeason] = useState(season);

  const [status, setStatus] = useState("idle"); // "idle" | "saving" | "success" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const [layoutErrorMsg, setLayoutErrorMsg] = useState("");
  const [resultId, setResultId] = useState(null);
  const [resultLayoutId, setResultLayoutId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!localName.trim()) return;

    setStatus("saving");
    setErrorMsg("");

    try {
      // 1. Persist metadata to store
      setFarmMeta({
        farmName: localName,
        season: localSeason,
        soilType: localSoil,
      });

      // 2. Create the farm record
      const farmRes = await farmsApi.create({
        name: localName.trim(),
        soilType: localSoil,
        season: localSeason,
        boundary,
      });

      const farmId = farmRes.data?.data?._id ?? farmRes.data?.data?.id
                   ?? farmRes.data?._id ?? farmRes.data?.id;
      setSavedFarmId(farmId);
      setResultId(farmId);

      // 3. Create each zone record
      await Promise.all(
        zones.map((zone) =>
          zonesApi.create({
            farmId,
            name: zone.name,
            coordinates: zone.coordinates,
            cropId: zone.cropId ?? undefined,
            area: calculateAreaSqm(zone.coordinates),
            color: zone.color,
          }),
        ),
      );

      // 4. Save as Layout Template
      const stats = calculateFarmStats(zones, crops);

      let layoutId = null;
      try {
        const layoutPayload = {
          name: localName.trim() + " — Layout",
          farmId,
          boundary,
          zones: zones.map((zone) => {
            const crop =
              crops.find(
                (c) => c._id === zone.cropId || c.id === zone.cropId,
              ) ?? null;
            return {
              zoneId: zone.id,
              name: zone.name,
              cropName: crop?.name ?? null,
              cropColor: crop?.color ?? zone.color,
              areaSqm: calculateAreaSqm(zone.coordinates),
              coordinates: zone.coordinates,
              rowPlan: {
                rows: 0,
                columns: 0,
                spacingM: 0.5,
                orientation: "horizontal",
              },
            };
          }),
          metadata: {
            totalAreaSqm: stats.totalArea,
            totalYieldKg: stats.totalYield,
            totalRevenue: stats.totalRevenue,
            totalWaterL: stats.totalWater,
            season: localSeason,
            soilType: localSoil,
            zoneCount: zones.length,
          },
          isTemplate: false,
        };

        const layoutRes = await layoutsApi.create(layoutPayload);
        const layoutData = layoutRes.data?.data ?? layoutRes.data;
        layoutId = layoutData?._id ?? layoutData?.id ?? null;
      } catch (layoutErr) {
        // Layout save is non-fatal — farm was already saved successfully
        layoutId = null;
        setLayoutErrorMsg(
          layoutErr.message ?? "Layout template could not be saved."
        );
      }

      setResultLayoutId(layoutId);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.message ?? "Failed to save farm. Is the backend running?",
      );
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>💾</span>
            Save Farm
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* Success state */}
        {status === "success" ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <h3 className="text-white font-semibold text-lg">Farm saved!</h3>
            <p className="text-gray-400 text-sm">
              Your farm and {zones.length} zone{zones.length !== 1 ? "s" : ""}{" "}
              have been saved to the database.
            </p>

            {/* Farm ID */}
            <div className="bg-gray-900 rounded-lg px-4 py-2 inline-block">
              <p className="text-xs text-gray-500 mb-1">Farm ID</p>
              <code className="text-green-400 text-xs font-mono break-all">
                {resultId}
              </code>
            </div>

            {/* Layout ID (if saved) */}
            {resultLayoutId ? (
              <div className="bg-gray-900 rounded-lg px-4 py-2 inline-block ml-2">
                <p className="text-xs text-gray-500 mb-1">Layout ID</p>
                <code className="text-blue-400 text-xs font-mono break-all">
                  {resultLayoutId}
                </code>
              </div>
            ) : layoutErrorMsg ? (
              <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg px-3 py-2 text-xs text-yellow-300 text-left">
                <p className="font-semibold mb-0.5">⚠️ Layout not saved</p>
                <p className="text-yellow-400/80">{layoutErrorMsg}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 pt-1">
              {resultLayoutId ? (
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/management?layoutId=${resultLayoutId}`);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 font-medium transition-colors"
                >
                  View in Management →
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    navigate("/management");
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white rounded-lg px-4 py-2 font-medium transition-colors"
                >
                  Go to Management →
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Farm name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Farm Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                required
                placeholder="e.g. Sunrise Farm"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            {/* Soil type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Soil Type
              </label>
              <select
                value={localSoil}
                onChange={(e) => setLocalSoil(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 transition-colors cursor-pointer"
              >
                {SOIL_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Season */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Season
              </label>
              <div className="flex gap-2">
                {["dry", "rainy"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLocalSeason(s)}
                    className={[
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border",
                      localSeason === s
                        ? "bg-green-600 border-green-500 text-white"
                        : "bg-gray-900 border-gray-600 text-gray-300 hover:border-gray-500",
                    ].join(" ")}
                  >
                    {s === "dry" ? "☀️ Dry" : "🌧 Rainy"}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-900 rounded-lg px-4 py-3 space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Boundary points</span>
                <span className="text-gray-200">{boundary.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Zones to save</span>
                <span className="text-gray-200">{zones.length}</span>
              </div>
            </div>

            {/* Error */}
            {status === "error" && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
                {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "saving" || !localName.trim()}
                className={[
                  "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  status === "saving" || !localName.trim()
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-500 text-white",
                ].join(" ")}
              >
                {status === "saving" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin text-base">⟳</span>
                    Saving…
                  </span>
                ) : (
                  "Save Farm"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
