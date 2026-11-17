import "./browser";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "./store";
import type { Prepared, Settings, Document } from "./model";
import "./style.css";
import { PathNodes, pathOperation } from "./pathEditor";
const presets: Record<string, Partial<Settings>> = {
  Logo: { mode: "spline", speckle: 0, simplify: 0.25, edgeQuality: 4 },
  "Cricut / Vinyl": {
    mode: "spline",
    speckle: 0,
    simplify: 0.5,
    edgeQuality: 4,
    geometry: "cutout",
  },
  Illustration: { mode: "spline", speckle: 0, simplify: 0.25, edgeQuality: 3 },
  "High Detail": { mode: "spline", speckle: 0, simplify: 0, edgeQuality: 4 },
  "Black & White": {
    mode: "spline",
    speckle: 0,
    simplify: 0.25,
    edgeQuality: 4,
    palette: ["#000000", "#ffffff"],
  },
  "Pixel Art": { mode: "pixel", speckle: 0, simplify: 0 },
};
function toBase64(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i += 32768)
    str += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(str);
}
function App() {
  const { doc, past, future, selected, setDoc, edit, undo, redo, select } =
    useStore();
  const [prepared, setPrepared] = useState<Prepared | null>(null),
    [bytes, setBytes] = useState<Uint8Array | null>(null),
    [filename, setFilename] = useState("No image loaded"),
    [settings, setSettings] = useState<Settings>({
      palette: [],
      geometry: "stacked",
      mode: "spline",
      speckle: 0,
      simplify: 0.25,
      edgeQuality: 4,
      fillHoles: 0,
    }),
    [count, setCount] = useState(6),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(
      "Open an image to begin. Everything stays on your computer.",
    ),
    [zoom, setZoom] = useState(1),
    [comparison, setComparison] = useState("vector"),
    [tool, setTool] = useState("select"),
    [checker, setChecker] = useState(true),
    [expanded, setExpanded] = useState<string[]>([]),
    [bounds, setBounds] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null),
    [cleanThreshold, setCleanThreshold] = useState(4),
    [cleanup, setCleanup] = useState<string[] | null>(null),
    [nodeMode, setNodeMode] = useState(false),
    [nodeText, setNodeText] = useState(""),
    [pendingDoc, setPendingDoc] = useState<Document | null>(null),
    [solo, setSolo] = useState("");
  const input = useRef<HTMLInputElement>(null),
    svg = useRef<SVGSVGElement>(null),
    canvas = useRef<HTMLDivElement>(null),
    original = useRef<HTMLImageElement>(null),
    drag = useRef<{
      x: number;
      y: number;
      ids: string[];
      pan?: boolean;
      scrollX?: number;
      scrollY?: number;
    } | null>(null);
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  async function load(file: File) {
    await run("Opening image", async () => {
      const data = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".svg")) {
        setDoc(
          await window.localtrace.importSVG(new TextDecoder().decode(data)),
        );
        setBytes(null);
        setPrepared(null);
      } else {
        const result = await window.localtrace.prepare(data, count, {
          mode: settings.mode,
          edgeQuality: settings.edgeQuality,
          fillHoles: settings.fillHoles,
        });
        setPrepared(result);
        setBytes(data);
        patch({ palette: result.palette, resize: undefined, crop: undefined });
        useStore.setState({ doc: null, selected: [] });
      }
      setFilename(file.name);
      setMessage("Ready. Adjust the palette, then convert.");
    });
  }
  async function refreshPalette(useCurrent = false, palette?: string[]) {
    if (!bytes) return;
    await run("Preparing palette", async () => {
      const result = await window.localtrace.prepare(bytes, count, {
        ...settings,
        palette: palette ?? (useCurrent ? settings.palette : undefined),
      });
      setPrepared(result);
      patch({ palette: result.palette });
      if (palette) setComparison("quantized");
      setMessage(
        palette
          ? "Black and white preview ready. Click Convert to update paths. Detect colors restores the source palette."
          : "Quantized preview updated. Convert to apply changes to paths.",
      );
    });
  }
  async function convert() {
    if (!bytes) return;
    await run("Tracing image locally", async () => {
      const result = await window.localtrace.trace(bytes, settings);
      setDoc(result);
      setComparison("vector");
      setMessage(
        `${result.shapes.length} editable paths in ${result.layers.length} ordered color layers.`,
      );
    });
  }
  const editableIds = () =>
    selected.filter((id) => {
      const shape = doc?.shapes.find((s) => s.id === id);
      return shape && !doc?.layers.find((l) => l.id === shape.layerId)?.locked;
    });
  const remove = () => {
    const ids = editableIds();
    edit((d) => {
      d.shapes = d.shapes.filter((s) => !ids.includes(s.id));
    });
    select([]);
  };
  const transform = (value: string) => {
    const ids = editableIds();
    edit((d) =>
      d.shapes.forEach((s) => {
        if (ids.includes(s.id)) s.transform = value + " " + s.transform;
      }),
    );
  };
  const recolor = (color: string) => {
    const ids = editableIds();
    edit((d) =>
      d.shapes.forEach((s) => {
        if (ids.includes(s.id)) s.fill = color;
      }),
    );
  };
  async function save(kind: string, layerId?: string) {
    if (!doc) return;
    await run("Saving", async () => {
      const ok = await window.localtrace.save(
        kind.startsWith("project")
          ? {
              document: doc,
              settings,
              original: prepared?.original,
              source: bytes ? toBase64(bytes) : undefined,
            }
          : doc,
        kind,
        layerId,
      );
      if (ok) setMessage("Saved successfully.");
    });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete") remove();
      else if (e.key === "Escape") {
        select([]);
        setTool("select");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, doc]);
  useEffect(() => {
    if (!svg.current || !selected.length) {
      setBounds(null);
      return;
    }
    const boxes = selected
      .map((id) => {
        const el = svg.current!.querySelector(
          `[data-id="${id}"]`,
        ) as SVGGraphicsElement | null;
        if (!el) return null;
        const b = el.getBBox(),
          m = el.getCTM(),
          root = svg.current!.getCTM();
        if (!m || !root) return null;
        const matrix = root.inverse().multiply(m);
        return [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      })
      .filter(Boolean)
      .flat() as DOMPoint[];
    if (boxes.length) {
      const x = Math.min(...boxes.map((p) => p.x)),
        y = Math.min(...boxes.map((p) => p.y));
      setBounds({
        x,
        y,
        width: Math.max(...boxes.map((p) => p.x)) - x,
        height: Math.max(...boxes.map((p) => p.y)) - y,
      });
    }
  }, [doc, selected]);
  function pointerDown(e: React.PointerEvent) {
    if (tool === "pan") {
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        ids: [],
        pan: true,
        scrollX: canvas.current!.scrollLeft,
        scrollY: canvas.current!.scrollTop,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const id = (e.target as Element).getAttribute("data-id");
    if (!id) {
      select([]);
      return;
    }
    const shape = doc?.shapes.find((s) => s.id === id);
    if (doc?.layers.find((l) => l.id === shape?.layerId)?.locked) return;
    const ids = e.shiftKey
      ? selected.includes(id)
        ? selected.filter((v) => v !== id)
        : [...selected, id]
      : selected.includes(id)
        ? selected
        : [id];
    select(ids);
    drag.current = { x: e.clientX, y: e.clientY, ids };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d?.pan && canvas.current) {
      canvas.current.scrollLeft = d.scrollX! - (e.clientX - d.x);
      canvas.current.scrollTop = d.scrollY! - (e.clientY - d.y);
    }
  }
  function pointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pan || !svg.current) return;
    const matrix = svg.current.getScreenCTM();
    if (!matrix) return;
    const a = new DOMPoint(d.x, d.y).matrixTransform(matrix.inverse()),
      b = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 0.1)
      edit((doc) =>
        doc.shapes.forEach((s) => {
          if (d.ids.includes(s.id))
            s.transform = `translate(${b.x - a.x} ${b.y - a.y}) ` + s.transform;
        }),
      );
  }
  function fit() {
    if (doc && canvas.current)
      setZoom(
        Math.min(
          (canvas.current.clientWidth - 80) / doc.width,
          (canvas.current.clientHeight - 80) / doc.height,
        ),
      );
  }
  function cleanupPreview() {
    if (!svg.current) return;
    const ids = doc!.shapes
      .filter((s) => {
        const el = svg.current!.querySelector(
          `[data-id="${s.id}"]`,
        ) as SVGGraphicsElement | null;
        const b = el?.getBBox();
        return (
          b &&
          b.width * b.height < cleanThreshold &&
          !doc!.layers.find((l) => l.id === s.layerId)?.locked
        );
      })
      .map((s) => s.id);
    setCleanup(ids);
    setMessage(
      `${ids.length} shapes have bounding-box area below ${cleanThreshold} px². Review highlighted paths before applying.`,
    );
  }
  const displayDoc = pendingDoc || doc;
  const first = doc?.shapes.find((s) => s.id === selected[0]);
  const pathEdit = (operation: string) => {
    const ids = editableIds();
    edit((d) => {
      const additions: Document["shapes"] = [];
      d.shapes.forEach((s) => {
        if (!ids.includes(s.id)) return;
        const paths = pathOperation(s.d, operation);
        s.d = paths[0];
        paths.slice(1).forEach((path) =>
          additions.push({
            ...s,
            id: "shape-" + crypto.randomUUID(),
            d: path,
          }),
        );
      });
      d.shapes.push(...additions);
    });
  };
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void load(f);
      }}
    >
      <header>
        <div className="brand">
          <span className="logo">L</span>
          <strong>LocalTrace</strong>
          <span className="badge">OFFLINE</span>
        </div>
        <div className="toolbar">
          <button onClick={() => input.current?.click()}>Open image</button>
          <button
            className="primary"
            disabled={!bytes || !!busy}
            onClick={() => void convert()}
          >
            Convert
          </button>
          <span className="divider" />
          <button
            className={tool === "select" ? "active" : ""}
            onClick={() => setTool("select")}
          >
            Select / Move
          </button>
          <button
            className={tool === "pan" ? "active" : ""}
            onClick={() => setTool("pan")}
          >
            Pan
          </button>
          <button disabled={!selected.length} onClick={remove}>
            Delete
          </button>
          <button disabled={!past.length} onClick={undo}>
            Undo
          </button>
          <button disabled={!future.length} onClick={redo}>
            Redo
          </button>
          <button disabled={!doc} onClick={() => void save("project")}>
            Save
          </button>
          <button disabled={!doc} onClick={() => void save("projectAs")}>
            Save as
          </button>
          <button
            onClick={() =>
              void run("Opening project", async () => {
                const p = await window.localtrace.openProject();
                if (p) {
                  setDoc(p.document);
                  setSettings(p.settings);
                  setBytes(
                    p.source
                      ? Uint8Array.from(atob(p.source), (c) => c.charCodeAt(0))
                      : null,
                  );
                  setPrepared(
                    p.original
                      ? {
                          original: p.original,
                          preview: p.original,
                          width: p.document.width,
                          height: p.document.height,
                          palette: p.settings.palette,
                        }
                      : null,
                  );
                  setFilename("Saved project");
                }
              })
            }
          >
            Open project
          </button>
          <button
            className="primary"
            disabled={!doc}
            onClick={() => void save("svg")}
          >
            Export SVG
          </button>
        </div>
      </header>
      <input
        ref={input}
        hidden
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,.svg"
        onChange={(e) => {
          if (e.target.files?.[0]) void load(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <main>
        <aside className="left">
          <section>
            <h2>Source image</h2>
            <button className="dropzone" onClick={() => input.current?.click()}>
              {prepared ? (
                <img
                  ref={original}
                  src={prepared.original}
                  onClick={(e) => {
                    if (tool !== "eyedropper") return;
                    e.stopPropagation();
                    const img = e.currentTarget,
                      r = img.getBoundingClientRect(),
                      c = document.createElement("canvas");
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    const ctx = c.getContext("2d")!;
                    ctx.drawImage(img, 0, 0);
                    const p = ctx.getImageData(
                      Math.floor(((e.clientX - r.left) / r.width) * c.width),
                      Math.floor(((e.clientY - r.top) / r.height) * c.height),
                      1,
                      1,
                    ).data;
                    const color =
                      "#" +
                      [...p]
                        .slice(0, 3)
                        .map((v) => v.toString(16).padStart(2, "0"))
                        .join("");
                    if (p[3] < 128)
                      setMessage("Transparent pixel: no opaque color added.");
                    else if (settings.palette.length < 16)
                      patch({ palette: [...settings.palette, color] });
                    setTool("select");
                  }}
                />
              ) : (
                <span>
                  ＋<br />
                  Drop artwork here
                  <br />
                  <small>PNG · JPEG · WebP · BMP · GIF · SVG</small>
                </span>
              )}
            </button>
            <p className="muted truncate">{filename}</p>
            <small className="muted">
              {prepared
                ? `${prepared.width} × ${prepared.height} px`
                : doc
                  ? `${doc.width} × ${doc.height} px`
                  : "Up to 16 megapixels · 40 MB"}
            </small>
            <button
              disabled={!bytes || !!busy}
              onClick={() => void refreshPalette(false, ["#000000", "#ffffff"])}
            >
              Make black and white
            </button>
            <small className="muted">
              Preview with black and white only, preserving transparency. Click
              Convert to trace it, or Detect colors to return to color.
            </small>
          </section>
          <section>
            <h2>
              Color palette <span>{settings.palette.length}</span>
            </h2>
            <label>
              Detected colors{" "}
              <input
                aria-label="Color count"
                type="number"
                min="2"
                max="16"
                value={count}
                onChange={(e) => setCount(+e.target.value)}
              />
            </label>
            <div className="row">
              <button
                disabled={!bytes || !!busy}
                onClick={() => void refreshPalette()}
              >
                Detect colors
              </button>
              <button
                disabled={!prepared}
                onClick={() => setTool("eyedropper")}
              >
                Eyedropper
              </button>
            </div>
            {tool === "eyedropper" && (
              <small>Click the source image to add a color.</small>
            )}
            <div className="palette">
              {settings.palette.map((color, i) => (
                <div key={i} className="color-row">
                  <input
                    aria-label={`Palette color ${i + 1}`}
                    type="color"
                    value={color}
                    onChange={(e) =>
                      patch({
                        palette: settings.palette.map((c, j) =>
                          i === j ? e.target.value : c,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`HEX ${i + 1}`}
                    value={color}
                    onChange={(e) => {
                      if (/^#[0-9a-f]{6}$/i.test(e.target.value))
                        patch({
                          palette: settings.palette.map((c, j) =>
                            i === j ? e.target.value : c,
                          ),
                        });
                    }}
                  />
                  <button
                    title="Remove this color; pixels will map to remaining colors"
                    disabled={settings.palette.length <= 1}
                    onClick={() =>
                      patch({
                        palette: settings.palette.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="row">
              <button
                disabled={settings.palette.length >= 16}
                onClick={() =>
                  patch({ palette: [...settings.palette, "#808080"] })
                }
              >
                ＋ Color
              </button>
              <button
                disabled={!bytes || !!busy}
                onClick={() => void refreshPalette(true)}
              >
                Preview palette
              </button>
            </div>
          </section>
          <section>
            <h2>Trace settings</h2>
            <label>
              Edge sampling
              <select
                value={settings.edgeQuality ?? 4}
                disabled={settings.mode === "pixel"}
                onChange={(e) => patch({ edgeQuality: +e.target.value })}
              >
                <option value="1">Original resolution</option>
                <option value="2">2× · smoother contours</option>
                <option value="3">3× · high quality</option>
                <option value="4">4× · highest sampling</option>
              </select>
            </label>
            <label>
              Fill tiny transparent holes (px²)
              <input
                type="number"
                min="0"
                max="256"
                value={settings.fillHoles ?? 0}
                onChange={(e) => patch({ fillHoles: +e.target.value })}
              />
            </label>
            <small className="muted">
              0 preserves intentional holes. Try 4–16 for small unfilled spots.
              Large images cap edge sampling to limit memory.
            </small>
            <label>
              Preset
              <select onChange={(e) => patch(presets[e.target.value])}>
                {Object.keys(presets).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Geometry
              <select
                value={settings.geometry}
                onChange={(e) =>
                  patch({ geometry: e.target.value as Settings["geometry"] })
                }
              >
                <option value="stacked">Stacked · preserve overlaps</option>
                <option value="cutout">Cutout · shared boundaries</option>
                <option value="solid">Solid · filled color silhouettes</option>
              </select>
            </label>
            <label>
              Curve mode
              <select
                value={settings.mode}
                onChange={(e) =>
                  patch({ mode: e.target.value as Settings["mode"] })
                }
              >
                <option value="spline">Smooth curves</option>
                <option value="polygon">Polygons</option>
                <option value="pixel">Pixel edges</option>
              </select>
            </label>
            <label>
              Remove specks <span>{settings.speckle} px</span>
              <input
                type="range"
                min="0"
                max="32"
                value={settings.speckle}
                onChange={(e) => patch({ speckle: +e.target.value })}
              />
            </label>
            <label>
              Simplify tolerance <span>{settings.simplify} px</span>
              <input
                type="range"
                min="0"
                max="5"
                step=".1"
                value={settings.simplify}
                onChange={(e) => patch({ simplify: +e.target.value })}
              />
            </label>
            <label>
              Resize width (optional)
              <input
                type="number"
                min="16"
                max="4096"
                placeholder="Keep original"
                value={settings.resize || ""}
                onChange={(e) =>
                  patch({
                    resize: e.target.value ? +e.target.value : undefined,
                  })
                }
              />
            </label>
            <details>
              <summary>Crop source (pixels)</summary>
              <div className="grid2">
                {(["left", "top", "width", "height"] as const).map((k) => (
                  <label key={k}>
                    {k}
                    <input
                      type="number"
                      min={k === "left" || k === "top" ? 0 : 1}
                      value={
                        settings.crop?.[k] ??
                        (k === "width"
                          ? prepared?.width
                          : k === "height"
                            ? prepared?.height
                            : 0)
                      }
                      onChange={(e) =>
                        patch({
                          crop: {
                            left: 0,
                            top: 0,
                            width: prepared?.width || 1,
                            height: prepared?.height || 1,
                            ...settings.crop,
                            [k]: +e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button onClick={() => patch({ crop: undefined })}>
                Reset crop
              </button>
            </details>
          </section>
        </aside>
        <div className="workspace">
          <div className="canvasbar">
            <div className="tabs">
              {["vector", "original", "quantized"].map((v) => (
                <button
                  key={v}
                  className={comparison === v ? "active" : ""}
                  onClick={() => setComparison(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="inline">
              <input
                type="checkbox"
                checked={checker}
                onChange={(e) => setChecker(e.target.checked)}
              />{" "}
              Transparency grid
            </label>
          </div>
          <div
            ref={canvas}
            className={`canvas ${checker ? "checker" : ""}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={() => (drag.current = null)}
          >
            {comparison !== "vector" && prepared ? (
              <img
                className="artwork"
                draggable={false}
                src={
                  comparison === "original"
                    ? prepared.original
                    : prepared.preview
                }
                style={{
                  width: prepared.width * zoom,
                  height: prepared.height * zoom,
                }}
              />
            ) : doc ? (
              <svg
                ref={svg}
                className="artwork"
                width={doc.width * zoom}
                height={doc.height * zoom}
                viewBox={`0 0 ${doc.width} ${doc.height}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                {displayDoc!.layers
                  .filter(
                    (l) =>
                      l.visible &&
                      (!solo ||
                        !displayDoc!.layers.some((a) => a.id === solo) ||
                        l.id === solo),
                  )
                  .map((l) => (
                    <g key={l.id}>
                      {displayDoc!.shapes
                        .filter((s) => s.layerId === l.id && s.visible)
                        .map((s) => (
                          <path
                            key={s.id}
                            data-id={s.id}
                            d={s.d}
                            transform={s.transform}
                            fill={s.fill}
                            stroke={
                              selected.includes(s.id)
                                ? "#8ea8ff"
                                : cleanup?.includes(s.id)
                                  ? "#ff5577"
                                  : s.stroke
                            }
                            strokeWidth={
                              selected.includes(s.id) || cleanup?.includes(s.id)
                                ? 1 / zoom
                                : (s.strokeWidth ?? 1)
                            }
                            opacity={s.opacity}
                            fillRule={s.fillRule}
                            style={{
                              cursor: l.locked ? "not-allowed" : "move",
                            }}
                          />
                        ))}
                    </g>
                  ))}
                {nodeMode && first && editableIds().includes(first.id) && (
                  <PathNodes
                    d={first.d}
                    transform={first.transform}
                    zoom={zoom}
                    onChange={(value) =>
                      edit((d) => {
                        d.shapes.find((s) => s.id === first.id)!.d = value;
                      })
                    }
                  />
                )}{" "}
                {bounds && (
                  <rect
                    {...bounds}
                    fill="none"
                    stroke="#8ea8ff"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                    pointerEvents="none"
                  />
                )}
              </svg>
            ) : (
              <div className="empty">
                <div className="empty-icon">◈</div>
                <h1>Your artwork, in vectors.</h1>
                <p>Drop an image to create editable color layers.</p>
                <button
                  className="primary"
                  onClick={() => input.current?.click()}
                >
                  Open an image
                </button>
                <small>Private by design. No uploads. No account.</small>
              </div>
            )}
          </div>
          <div className="zoombar">
            <button onClick={() => setZoom((z) => Math.max(0.02, z / 1.25))}>
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(20, z * 1.25))}>
              ＋
            </button>
            <button onClick={fit}>Fit</button>
            <button onClick={() => setZoom(1)}>Actual size</button>
            <span className="muted">{selected.length} selected</span>
          </div>
        </div>
        <aside className="right">
          <section>
            <h2>
              Color layers <span>{doc?.layers.length || 0}</span>
            </h2>
            {!doc && (
              <p className="muted">Your traced layers will appear here.</p>
            )}
            {doc?.layers.map((l, i) => (
              <div className="layer" key={l.id}>
                <div className="layer-head">
                  <button
                    onClick={() =>
                      setExpanded((v) =>
                        v.includes(l.id)
                          ? v.filter((id) => id !== l.id)
                          : [...v, l.id],
                      )
                    }
                  >
                    {expanded.includes(l.id) ? "▾" : "▸"}
                  </button>
                  <input
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#000000"
                    }
                    onChange={(e) =>
                      edit((d) => {
                        d.layers.find((a) => a.id === l.id)!.color =
                          e.target.value;
                        d.shapes
                          .filter((s) => s.layerId === l.id)
                          .forEach((s) => (s.fill = e.target.value));
                      })
                    }
                  />
                  <input
                    className="layer-name"
                    value={l.name}
                    onChange={(e) =>
                      edit((d) => {
                        d.layers.find((a) => a.id === l.id)!.name =
                          e.target.value;
                      })
                    }
                  />
                  <button
                    title="Select layer shapes"
                    disabled={l.locked}
                    onClick={() =>
                      select(
                        doc.shapes
                          .filter((s) => s.layerId === l.id)
                          .map((s) => s.id),
                      )
                    }
                  >
                    {doc.shapes.filter((s) => s.layerId === l.id).length}
                  </button>
                </div>
                <div className="layer-actions">
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={l.visible}
                      onChange={(e) =>
                        edit((d) => {
                          d.layers.find((a) => a.id === l.id)!.visible =
                            e.target.checked;
                        })
                      }
                    />
                    Visible
                  </label>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={l.locked}
                      onChange={(e) =>
                        edit((d) => {
                          d.layers.find((a) => a.id === l.id)!.locked =
                            e.target.checked;
                        })
                      }
                    />
                    Lock
                  </label>
                  <button
                    disabled={i === 0}
                    onClick={() =>
                      edit((d) => {
                        [d.layers[i - 1], d.layers[i]] = [
                          d.layers[i],
                          d.layers[i - 1],
                        ];
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    disabled={i === doc.layers.length - 1}
                    onClick={() =>
                      edit((d) => {
                        [d.layers[i + 1], d.layers[i]] = [
                          d.layers[i],
                          d.layers[i + 1],
                        ];
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    title="Export this layer"
                    onClick={() => void save("svg", l.id)}
                  >
                    ↗
                  </button>
                </div>
                {expanded.includes(l.id) &&
                  doc.shapes
                    .filter((s) => s.layerId === l.id)
                    .map((s) => (
                      <button
                        key={s.id}
                        disabled={l.locked}
                        className={`shape-row ${selected.includes(s.id) ? "active" : ""}`}
                        onClick={(e) =>
                          select(
                            e.shiftKey
                              ? [...new Set([...selected, s.id])]
                              : [s.id],
                          )
                        }
                      >
                        <span style={{ background: s.fill }} />
                        {s.id}
                      </button>
                    ))}
              </div>
            ))}
            {doc && (
              <small className="muted">
                Layers paint top to bottom. Repeated colors retain separate
                ordered runs to preserve overlaps.
              </small>
            )}
          </section>
          <section>
            <h2>Shape properties</h2>
            {first ? (
              <>
                <div className="grid2">
                  <label>
                    Fill
                    <input
                      type="color"
                      value={
                        /^#[0-9a-f]{6}$/i.test(first.fill)
                          ? first.fill
                          : "#000000"
                      }
                      onChange={(e) => recolor(e.target.value)}
                    />
                  </label>
                  <label>
                    Stroke
                    <input
                      type="color"
                      value={
                        /^#[0-9a-f]{6}$/i.test(first.stroke)
                          ? first.stroke
                          : "#000000"
                      }
                      onChange={(e) => {
                        const ids = editableIds();
                        edit((d) =>
                          d.shapes.forEach((s) => {
                            if (ids.includes(s.id)) s.stroke = e.target.value;
                          }),
                        );
                      }}
                    />
                  </label>
                </div>
                <label>
                  Opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={first.opacity}
                    onChange={(e) => {
                      const ids = editableIds();
                      edit((d) =>
                        d.shapes.forEach((s) => {
                          if (ids.includes(s.id)) s.opacity = +e.target.value;
                        }),
                      );
                    }}
                  />
                </label>
                <div className="row">
                  <button
                    onClick={() =>
                      transform(
                        `rotate(15 ${bounds ? bounds.x + bounds.width / 2 : 0} ${bounds ? bounds.y + bounds.height / 2 : 0})`,
                      )
                    }
                  >
                    Rotate +15°
                  </button>
                  <button
                    onClick={() => {
                      const x = bounds?.x || 0,
                        y = bounds?.y || 0;
                      transform(
                        `translate(${x} ${y}) scale(1.1) translate(${-x} ${-y})`,
                      );
                    }}
                  >
                    Scale +10%
                  </button>
                </div>
                <label>
                  Move to layer
                  <select
                    value={first.layerId}
                    onChange={(e) => {
                      const ids = editableIds();
                      edit((d) =>
                        d.shapes.forEach((s) => {
                          if (ids.includes(s.id)) s.layerId = e.target.value;
                        }),
                      );
                    }}
                  >
                    {doc!.layers.map((l) => (
                      <option key={l.id} value={l.id} disabled={l.locked}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    const ids = editableIds();
                    edit((d) => {
                      d.shapes.push(
                        ...d.shapes
                          .filter((s) => ids.includes(s.id))
                          .map((s) => ({
                            ...s,
                            id: "shape-" + crypto.randomUUID(),
                            transform: "translate(10 10) " + s.transform,
                          })),
                      );
                    });
                  }}
                >
                  Duplicate selection
                </button>
                <button
                  onClick={() => {
                    setNodeMode(!nodeMode);
                    setNodeText(first.d);
                  }}
                >
                  {nodeMode ? "Finish node editing" : "Edit nodes & handles"}
                </button>
                {nodeMode && (
                  <>
                    <small className="muted">
                      Drag anchors or gold control handles. Double-click an
                      anchor to remove it.
                    </small>
                    <div className="row">
                      {["close", "break", "straighten", "smooth", "add"].map(
                        (op) => (
                          <button key={op} onClick={() => pathEdit(op)}>
                            {op}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
                {nodeMode && (
                  <>
                    <textarea
                      value={nodeText}
                      onChange={(e) => setNodeText(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        void run("Validating path", async () => {
                          const temp = await window.localtrace.importSVG(
                            `<svg width="${doc!.width}" height="${doc!.height}"><path d="${nodeText.replace(/["<>]/g, "")}"/></svg>`,
                          );
                          const ids = editableIds();
                          edit((d) => {
                            const s = d.shapes.find((s) => s.id === first.id);
                            if (s && ids.includes(s.id)) s.d = temp.shapes[0].d;
                          });
                        })
                      }
                    >
                      Apply path data
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="muted">
                Select a shape on the canvas or expand a layer. Shift-click to
                select several.
              </p>
            )}
          </section>
          <section>
            <h2>Cleanup</h2>
            <label>
              Small shape threshold (px²)
              <input
                type="number"
                min="0"
                value={cleanThreshold}
                onChange={(e) =>
                  setCleanThreshold(Math.max(0, +e.target.value))
                }
              />
            </label>
            <button disabled={!doc} onClick={cleanupPreview}>
              Preview small shapes
            </button>
            <div className="row">
              <button
                disabled={!first}
                onClick={() => {
                  setCleanup(
                    doc!.shapes
                      .filter(
                        (s) =>
                          s.fill === first!.fill &&
                          !doc!.layers.find((l) => l.id === s.layerId)?.locked,
                      )
                      .map((s) => s.id),
                  );
                }}
              >
                Preview remove color
              </button>
              <button
                disabled={selected.length < 2 || !!busy}
                onClick={() =>
                  void run("Preparing merge preview", async () => {
                    setPendingDoc(
                      await window.localtrace.merge(doc!, editableIds()),
                    );
                    setMessage(
                      "Merge preview: curves flattened to 0.2 px tolerance. Apply or cancel.",
                    );
                  })
                }
              >
                Preview merge
              </button>
            </div>
            {pendingDoc && (
              <div className="row">
                <button
                  onClick={() => {
                    edit((d) => {
                      d.shapes = pendingDoc.shapes;
                    });
                    setPendingDoc(null);
                  }}
                >
                  Apply merge
                </button>
                <button onClick={() => setPendingDoc(null)}>
                  Cancel preview
                </button>
              </div>
            )}
            {cleanup && (
              <div className="row">
                <button
                  onClick={() => {
                    edit((d) => {
                      d.shapes = d.shapes.filter(
                        (s) => !cleanup.includes(s.id),
                      );
                    });
                    setCleanup(null);
                  }}
                >
                  Remove {cleanup.length} shapes
                </button>
                <button onClick={() => setCleanup(null)}>Cancel</button>
              </div>
            )}
          </section>
          <section>
            <h2>Export & manufacturing</h2>
            <label>
              Preview layer
              <select
                value={solo}
                onChange={(e) => {
                  setSolo(e.target.value);
                  select([]);
                  setComparison("vector");
                }}
              >
                <option value="">All visible layers</option>
                {doc?.layers.map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Physical width (mm)
              <input
                type="number"
                min=".1"
                step=".1"
                value={doc ? Number(doc.physicalWidth.toFixed(3)) : 100}
                disabled={!doc}
                onChange={(e) => {
                  if (+e.target.value > 0)
                    edit((d) => {
                      d.physicalWidth = +e.target.value;
                    });
                }}
              />
            </label>
            {doc && (
              <small className="muted">
                Height{" "}
                {((doc.physicalWidth * doc.height) / doc.width).toFixed(2)} mm ·
                aspect ratio preserved
              </small>
            )}
            <label className="inline">
              <input
                type="checkbox"
                checked={doc?.registrationMarks || false}
                disabled={!doc}
                onChange={(e) =>
                  edit((d) => {
                    d.registrationMarks = e.target.checked;
                  })
                }
              />
              Registration marks (5 mm margin)
            </label>
            <div className="row">
              <button disabled={!doc} onClick={() => void save("colors")}>
                All color SVGs
              </button>
              <button disabled={!doc} onClick={() => void save("pdf")}>
                PDF
              </button>
              <button disabled={!doc} onClick={() => void save("dxf")}>
                DXF polylines
              </button>
            </div>
            <small className="muted">
              DXF flattens curves to 0.15 px tolerance; fills, opacity and
              stroke styling are omitted.
            </small>
            <div className="row">
              <button disabled={!doc} onClick={() => void save("svg")}>
                Layered SVG
              </button>
              <button disabled={!doc} onClick={() => void save("png")}>
                PNG preview
              </button>
            </div>
            {doc && (
              <p className="muted">
                {doc.shapes.filter((s) => !/[zZ]\s*$/.test(s.d)).length} paths
                may be open. Check thin features before cutting. Use each
                layer’s ↗ button for separate SVGs.
              </p>
            )}
          </section>
        </aside>
      </main>
      <footer>
        <span className={busy ? "working" : ""}>
          {busy ? `◌ ${busy}…` : message}
        </span>
        {busy && (
          <button onClick={() => void window.localtrace.cancel()}>
            Cancel
          </button>
        )}
        <span className="muted">Local processing · VTracer</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
