export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}
export interface Shape {
  id: string;
  layerId: string;
  d: string;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  opacity: number;
  fillRule: "evenodd" | "nonzero";
  transform: string;
  visible: boolean;
}
export interface Document {
  version: 1;
  width: number;
  height: number;
  physicalWidth: number;
  registrationMarks?: boolean;
  layers: Layer[];
  shapes: Shape[];
}
export interface Settings {
  palette: string[];
  geometry: "stacked" | "cutout" | "solid";
  mode: "spline" | "polygon" | "pixel";
  speckle: number;
  simplify: number;
  edgeQuality?: number;
  fillHoles?: number;
  resize?: number;
  crop?: { left: number; top: number; width: number; height: number };
}
export interface Prepared {
  width: number;
  height: number;
  palette: string[];
  original: string;
  preview: string;
}
export interface Project {
  document: Document;
  settings: Settings;
  original?: string;
  source?: string;
}
declare global {
  interface Window {
    localtrace: {
      prepare: (
        bytes: Uint8Array,
        count: number,
        options: Partial<Settings>,
      ) => Promise<Prepared>;
      trace: (bytes: Uint8Array, settings: Settings) => Promise<Document>;
      cancel: () => Promise<void>;
      merge: (doc: Document, ids: string[]) => Promise<Document>;
      importSVG: (text: string) => Promise<Document>;
      save: (
        doc: Document | Project,
        kind: string,
        layerId?: string,
      ) => Promise<boolean>;
      openProject: () => Promise<Project | null>;
    };
  }
}
