import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFarmStore from "../store/useFarmStore.js";
import SaveFarmModal from "./SaveFarmModal.jsx";

const MODES = [
  { id: "boundary", label: "Draw Boundary", icon: "⬡" },
  { id: "zone", label: "Draw Zone", icon: "⬢" },
  { id: "select", label: "Select", icon: "↖" },
];

export default function Toolbar() {
  const { mode, setMode, resetAll, season, setFarmMeta, boundary } =
    useFarmStore();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const navigate = useNavigate();

  const handleSeasonChange = (e) => {
    setFarmMeta({ season: e.target.value });
  };

  return (
    <>
      <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-4 flex-shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-4">
          <span className="text-xl">🌾</span>
          <span className="text-white font-bold text-lg tracking-tight">
            AgriPlan
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Mode buttons */}
        <div className="flex items-center gap-2">
          {MODES.map(({ id, label, icon }) => {
            const isActive = mode === id;
            // Zone drawing requires a boundary to exist
            const isDisabled = id === "zone" && boundary.length < 3;

            return (
              <button
                key={id}
                onClick={() => !isDisabled && setMode(id)}
                disabled={isDisabled}
                title={isDisabled ? "Draw a boundary first" : label}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  isActive
                    ? "bg-green-600 text-white shadow-lg shadow-green-900/40"
                    : isDisabled
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : "bg-gray-700 text-gray-200 hover:bg-gray-600",
                ].join(" ")}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-600" />

        {/* Season selector */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wide">
            Season
          </label>
          <select
            value={season}
            onChange={handleSeasonChange}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-green-500 cursor-pointer"
          >
            <option value="dry">☀️ Dry</option>
            <option value="rainy">🌧 Rainy</option>
          </select>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/management")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
            title="Go to Farm Management"
          >
            <span>🌿</span>
            <span className="hidden sm:inline">Management</span>
          </button>

          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-gray-700 text-gray-200 hover:bg-red-800 hover:text-white transition-colors"
            title="Clear all drawing data"
          >
            <span>✕</span>
            <span className="hidden sm:inline">Clear All</span>
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            disabled={boundary.length < 3}
            title={
              boundary.length < 3
                ? "Draw a boundary first"
                : "Save farm to backend"
            }
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors",
              boundary.length >= 3
                ? "bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/40"
                : "bg-gray-800 text-gray-600 cursor-not-allowed",
            ].join(" ")}
          >
            <span>💾</span>
            <span className="hidden sm:inline">Save Farm</span>
          </button>
        </div>
      </header>

      {showSaveModal && (
        <SaveFarmModal onClose={() => setShowSaveModal(false)} />
      )}
    </>
  );
}
