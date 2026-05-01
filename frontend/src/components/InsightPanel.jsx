import { useMemo } from "react";
import useFarmStore from "../store/useFarmStore.js";
import { calculateFarmStats } from "../utils/calculations.js";

function StatRow({ label, value, unit, icon }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-400 text-xs flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className="text-white text-sm font-medium tabular-nums">
        {value}
        {unit && <span className="text-gray-500 text-xs ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export default function InsightPanel() {
  const { zones, crops, deleteZone, selectedZoneId, selectZone } =
    useFarmStore();

  const stats = useMemo(() => calculateFarmStats(zones, crops), [zones, crops]);

  const hasZones = zones.length > 0;

  return (
    <div className="flex flex-col bg-gray-800 flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>📊</span>
          Farm Insights
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Farm-wide totals */}
        <section>
          <div className="space-y-0.5">
            <StatRow
              label="Total Area"
              value={stats.totalArea.toLocaleString()}
              unit="m²"
              icon="📐"
            />
            <StatRow
              label="Total Yield"
              value={stats.totalYield.toLocaleString()}
              unit="kg"
              icon="🌾"
            />
            <StatRow
              label="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString()}`}
              icon="💰"
            />
            <StatRow
              label="Water Usage"
              value={stats.totalWater.toLocaleString()}
              unit="L"
              icon="💧"
            />
          </div>
        </section>

        {/* Divider */}
        {hasZones && (
          <div className="border-t border-gray-700 pt-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Per Zone
            </h3>

            <div className="space-y-2">
              {stats.zoneStats.map(
                ({ zone, crop, areaSqm, yieldKg, revenue }) => {
                  const isSelected = zone.id === selectedZoneId;

                  return (
                    <div
                      key={zone.id}
                      onClick={() => selectZone(isSelected ? null : zone.id)}
                      className={[
                        "rounded p-2.5 cursor-pointer transition-colors group",
                        isSelected
                          ? "bg-green-900/40 ring-1 ring-green-600"
                          : "bg-gray-750 hover:bg-gray-700",
                      ].join(" ")}
                      style={{
                        backgroundColor: isSelected
                          ? undefined
                          : "rgba(31,41,55,0.5)",
                      }}
                    >
                      {/* Zone header row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {/* Zone colour swatch */}
                          <span
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{
                              backgroundColor: crop?.color ?? zone.color,
                            }}
                          />
                          <span className="text-xs font-semibold text-white">
                            {zone.name}
                          </span>
                          {crop ? (
                            <span className="text-xs text-green-400 font-medium">
                              [{crop.name}]
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 italic">
                              — No crop
                            </span>
                          )}
                        </div>

                        {/* Delete button (visible on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteZone(zone.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition-opacity p-0.5"
                          title={`Delete ${zone.name}`}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Stats row */}
                      <div className="flex gap-3 flex-wrap">
                        <span className="text-xs text-gray-400">
                          <span className="text-gray-200 font-medium">
                            {areaSqm.toFixed(1)}
                          </span>{" "}
                          m²
                        </span>
                        {crop && (
                          <>
                            <span className="text-xs text-gray-400">
                              <span className="text-gray-200 font-medium">
                                {yieldKg.toFixed(1)}
                              </span>{" "}
                              kg
                            </span>
                            <span className="text-xs text-gray-400">
                              <span className="text-gray-200 font-medium">
                                ${revenue.toFixed(2)}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasZones && (
          <div className="text-center py-8 text-gray-600">
            <div className="text-2xl mb-2">🗺️</div>
            <p className="text-sm">Draw zones to see insights</p>
          </div>
        )}
      </div>
    </div>
  );
}
