import { useMemo, useState } from "react";
import svgpath from "svgpath";
type Segment = (string | number)[];
export function segments(d: string): Segment[] {
  const result: Segment[] = [];
  svgpath(d)
    .abs()
    .unshort()
    .unarc()
    .iterate((s, _i, x, y) => {
      if (s[0] === "H") result.push(["L", s[1], y]);
      else if (s[0] === "V") result.push(["L", x, s[1]]);
      else if (s[0] === "Q") {
        const [, cx, cy, ex, ey] = s as ["Q", number, number, number, number];
        result.push([
          "C",
          x + (2 / 3) * (cx - x),
          y + (2 / 3) * (cy - y),
          ex + (2 / 3) * (cx - ex),
          ey + (2 / 3) * (cy - ey),
          ex,
          ey,
        ]);
      } else result.push([...s]);
    });
  return result;
}
export const serialize = (s: Segment[]) => s.map((v) => v.join(" ")).join(" ");
function endpoint(s: Segment): [number, number] {
  return [Number(s[s.length - 2]), Number(s[s.length - 1])];
}
export function PathNodes({
  d,
  transform,
  zoom,
  onChange,
}: {
  d: string;
  transform: string;
  zoom: number;
  onChange: (d: string) => void;
}) {
  const data = useMemo(() => segments(d), [d]),
    [active, setActive] = useState<number | null>(null);
  function move(
    e: React.PointerEvent<SVGCircleElement>,
    index: number,
    offset: number,
  ) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const element = e.currentTarget;
    const matrix = element.parentElement as unknown as SVGGElement;
    const initial = structuredClone(data);
    const start = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.getScreenCTM()!.inverse(),
    );
    element.onpointerup = (event) => {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.getScreenCTM()!.inverse(),
      );
      const delta = [point.x - start.x, point.y - start.y];
      initial[index][offset] = Number(initial[index][offset]) + delta[0];
      initial[index][offset + 1] =
        Number(initial[index][offset + 1]) + delta[1];
      onChange(serialize(initial));
      element.onpointerup = null;
    };
  }
  return (
    <g transform={transform} onPointerDown={(e) => e.stopPropagation()}>
      {data.map((s, i) => {
        if (s.length < 3) return null;
        const [x, y] = endpoint(s);
        return (
          <g key={i}>
            {s[0] === "C" && (
              <>
                <line
                  x1={Number(s[1])}
                  y1={Number(s[2])}
                  x2={i ? endpoint(data[i - 1])[0] : 0}
                  y2={i ? endpoint(data[i - 1])[1] : 0}
                  stroke="#f6c76e"
                  strokeWidth={1 / zoom}
                />
                <line
                  x1={Number(s[3])}
                  y1={Number(s[4])}
                  x2={x}
                  y2={y}
                  stroke="#f6c76e"
                  strokeWidth={1 / zoom}
                />
                {[1, 3].map((offset) => (
                  <circle
                    key={offset}
                    cx={Number(s[offset])}
                    cy={Number(s[offset + 1])}
                    r={3 / zoom}
                    fill="#f6c76e"
                    onPointerDown={(e) => move(e, i, offset)}
                  />
                ))}
              </>
            )}
            <circle
              cx={x}
              cy={y}
              r={(active === i ? 5 : 3.5) / zoom}
              fill={active === i ? "#ffffff" : "#8ea8ff"}
              stroke="#17203c"
              strokeWidth={1 / zoom}
              onPointerDown={(e) => {
                setActive(i);
                move(e, i, s.length - 2);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (i > 0) {
                  const copy = structuredClone(data);
                  copy.splice(i, 1);
                  onChange(serialize(copy));
                }
              }}
            />
          </g>
        );
      })}
    </g>
  );
}
export function pathOperation(d: string, operation: string): string[] {
  const data = segments(d);
  if (operation === "close") {
    const result: Segment[] = [];
    for (const s of data) {
      if (s[0] === "M" && result.length && result[result.length - 1][0] !== "Z")
        result.push(["Z"]);
      result.push(s);
    }
    if (result[result.length - 1][0] !== "Z") result.push(["Z"]);
    return [serialize(result)];
  }
  if (operation === "break") {
    const groups: Segment[][] = [];
    data.forEach((s) => {
      if (s[0] === "M") groups.push([]);
      groups[groups.length - 1]?.push(s);
    });
    return groups.map(serialize);
  }
  if (operation === "straighten")
    return [
      serialize(data.map((s) => (s[0] === "C" ? ["L", ...endpoint(s)] : s))),
    ];
  if (operation === "smooth") {
    const groups: Segment[][] = [];
    data.forEach((s) => {
      if (s[0] === "M") groups.push([]);
      groups.at(-1)?.push(s);
    });
    return [
      groups
        .map((group) => {
          const closed = String(group.at(-1)?.[0]).toUpperCase() === "Z",
            anchors = group.filter((s) => s.length >= 3).map(endpoint);
          if (anchors.length < 2) return serialize(group);
          const out: Segment[] = [["M", ...anchors[0]]];
          const total = closed ? anchors.length : anchors.length - 1;
          for (let i = 0; i < total; i++) {
            const a = anchors[i],
              b = anchors[(i + 1) % anchors.length],
              prev = anchors[i - 1] || (closed ? anchors.at(-1)! : a),
              next =
                anchors[i + 2] ||
                (closed ? anchors[(i + 2) % anchors.length] : b);
            out.push([
              "C",
              a[0] + (b[0] - prev[0]) / 6,
              a[1] + (b[1] - prev[1]) / 6,
              b[0] - (next[0] - a[0]) / 6,
              b[1] - (next[1] - a[1]) / 6,
              ...b,
            ]);
          }
          if (closed) out.push(["Z"]);
          return serialize(out);
        })
        .join(" "),
    ];
  }
  if (operation === "add") {
    const out: Segment[] = [];
    data.forEach((s, i) => {
      if (i && s[0] === "L") {
        const [x, y] = endpoint(data[i - 1]),
          [ex, ey] = endpoint(s);
        out.push(["L", (x + ex) / 2, (y + ey) / 2]);
      } else if (i && s[0] === "C") {
        const [x, y] = endpoint(data[i - 1]),
          [a, b, c, e, f, g] = s.slice(1).map(Number);
        const q0 = [(x + a) / 2, (y + b) / 2],
          q1 = [(a + c) / 2, (b + e) / 2],
          q2 = [(c + f) / 2, (e + g) / 2],
          r0 = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2],
          r1 = [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2],
          mid = [(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2];
        out.push(["C", ...q0, ...r0, ...mid], ["C", ...r1, ...q2, f, g]);
        return;
      }
      out.push(s);
    });
    return [serialize(out)];
  }
  return [d];
}
