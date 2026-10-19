// Prototype room list. Only the four STRC entries are real (STRC lobby directory, photographed 2026-10-19).
// Every other room is a sample in the real code format, marked `sample: true` and shown as "Sample room".
window.ROOM_DATA = (() => {
  "use strict";
  const real = [
    ["ST311", "Surface Physics Lab"],
    ["ST402", "Stock Room"],
    ["ST404", "Biology Lab"],
    ["ST406", "Biology Lab"],
  ].map(([code, name]) => ({ code, name, sample: false }));

  const sampleCodes = [
    "ST201", "ST305", "ST310", "ST315A",
    "AG704", "AG1104", "AG1806", "EY409", "EY603", "SJ304", "SJ501", "VL202", "VL405",
    "SM301", "SM312", "LS206", "LS308", "ER702", "G211", "G304", "MM101", "MM203",
  ];
  const samples = sampleCodes.map((code) => ({ code, name: "Sample room", sample: true }));

  // Printed or older prefixes that mean the same building (docs/ARCHITECTURE.md §3.3).
  const aliases = { C: "ST", VE: "VL" };
  // Known floor labels. Other buildings' labels are still open (ARCHITECTURE §9), so they use "1F", "2F"…
  const floorLabels = { strc: { 1: "G" } };

  return { rooms: [...real, ...samples], aliases, floorLabels };
})();
