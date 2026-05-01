import useFarmStore from "../store/useFarmStore.js";

const WATER_LABELS = {
  low: { label: "Low", icon: "💧", color: "text-blue-300" },
  medium: { label: "Med", icon: "💧💧", color: "text-blue-400" },
  high: { label: "High", icon: "💧💧💧", color: "text-blue-500" },
};

export default function CropPanel() {
  const { crops, selectedZoneId, zones, assignCrop, season } = useFarmStore();

  // The zone currently selected on the canvas
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  const handleCropClick = (cropId) => {
    if (!selectedZoneId) return;
    // Toggle off if the same crop is clicked again
    const isSame = selectedZone?.cropId === cropId;
    assignCrop(selectedZoneId, isSame ? null : cropId);
  };

  return (
    <div className="flex flex-col bg-gray-800 border-b border-gray-700 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>🌱</span>
          Crops
        </h2>
        {selectedZone ? (
          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">
            Assigning to {selectedZone.name}
          </span>
        ) : (
          <span className="text-xs text-gray-500">Select a zone first</span>
        )}
      </div>

      {/* Crop list */}
      <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
        {crops.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading crops…
          </div>
        ) : (
          <ul className="divide-y divide-gray-700">
            {crops.map((crop) => {
              const isAssigned = selectedZone?.cropId === (crop._id ?? crop.id);
              const water = WATER_LABELS[crop.waterNeeds] ?? WATER_LABELS.medium;
              const suitableForSeason = crop.suitableSeason?.includes(season);
              const cropId = crop._id ?? crop.id;

              return (
                <li
                  key={cropId}
                  onClick={() => handleCropClick(cropId)}
                  className={[
                    "flex items-center gap-3 px-4 py-2.5 transition-colors",
                    selectedZoneId
                      ? "cursor-pointer hover:bg-gray-700"
                      : "cursor-default opacity-70",
                    isAssigned
                      ? "bg-green-900/40 border-l-2 border-green-500"
                      : "",
                  ].join(" ")}
                >
                  {/* Crop colour dot */}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20"
                    style={{ backgroundColor: crop.color ?? "#6b7280" }}
                  />

                  {/* Name + season badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">
                        {crop.name}
                      </span>
                      {isAssigned && (
                        <span className="text-green-400 text-xs">✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-xs ${water.color}`}
                        title={`Water needs: ${water.label}`}
                      >
                        {water.icon}
                      </span>
                      <span className="text-xs text-gray-400">
                        {water.label} water
                      </span>
                      {suitableForSeason !== undefined && (
                        <span
                          className={`text-xs px-1.5 py-0 rounded-full ${
                            suitableForSeason
                              ? "bg-green-900/60 text-green-400"
                              : "bg-gray-700 text-gray-500"
                          }`}
                        >
                          {suitableForSeason ? "✓ Season" : "Off-season"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Yield + price mini stats */}
                  <div className="text-right flex-shrink-0 hidden lg:block">
                    <div className="text-xs text-gray-400">
                      {crop.avgYieldPerSqm} kg/m²
                    </div>
                    <div className="text-xs text-gray-500">
                      ${crop.marketPrice}/kg
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
