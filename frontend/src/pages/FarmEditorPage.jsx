import Toolbar from "../components/Toolbar.jsx";
import CanvasMap from "../components/CanvasMap.jsx";
import CropPanel from "../components/CropPanel.jsx";
import InsightPanel from "../components/InsightPanel.jsx";

export default function FarmEditorPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden">
          <CanvasMap />
        </div>

        {/* Right panel */}
        <aside className="w-80 flex flex-col border-l border-gray-700 bg-gray-800 overflow-hidden flex-shrink-0">
          <CropPanel />
          <InsightPanel />
        </aside>
      </div>
    </div>
  );
}
