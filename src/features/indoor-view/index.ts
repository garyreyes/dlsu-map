// The indoor view's public surface. Other features and the app shell import only from here (ARCHITECTURE §6).
export { BuildingCutaway } from './components/BuildingCutaway';
export { FloorModel } from './components/FloorModel';
export { FloorRail } from './components/FloorRail';
export { useCutaway, type CutawayStep, type CutawayView } from './components/useCutaway';
export { useCutSlide } from './components/useCutSlide';
export { useIndoor, type IndoorState } from './components/useIndoor';
export { cutMarks } from './marks';
export { CUT_ABOVE_FLOOR, RAIL_ROWS, type Cutaway, type CutMarks, type RailRow } from './cutaway';
export { SLIDE_MS, type CutMove, type CutSlide, type ShownCut } from './transition';
