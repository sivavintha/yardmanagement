import React from "react";

/**
 * Small branded loading indicator: a truck driving across a dashed road,
 * looping. Used anywhere the app is waiting on a network request longer
 * than an instant (route transitions, first data fetch on a page).
 */
export default function LoadingTruck({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="relative w-40 h-10 overflow-hidden mb-3">
        <div className="absolute inset-x-0 bottom-1 border-t-2 border-dashed border-slate-300" />
        <div className="absolute bottom-1 text-2xl animate-truck-drive" aria-hidden>
          🚚
        </div>
      </div>
      <div className="text-sm">{label}</div>
      <style>{`
        @keyframes truck-drive {
          0% { transform: translateX(-10%) scaleX(-1); }
          45% { transform: translateX(150%) scaleX(-1); }
          50% { transform: translateX(150%) scaleX(1); }
          95% { transform: translateX(-10%) scaleX(1); }
          100% { transform: translateX(-10%) scaleX(-1); }
        }
        .animate-truck-drive {
          animation: truck-drive 3.2s linear infinite;
        }
      `}</style>
    </div>
  );
}
