"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-black text-white px-4 py-2 rounded"
    >
      Print / Export PDF
    </button>
  );
}