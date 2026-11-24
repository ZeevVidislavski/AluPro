// Schematic window drawing (frame, sashes, opening-direction marks and
// dimensions) generated from the opening type and the item's width/height.
// Plain inline SVG so html2canvas can rasterise it for the PDF.

const FRAME = "#1e293b";
const GLASS = "#dbeafe";
const MARK = "#dc2626";

export default function WindowSketch({ type, widthCm, heightCm, maxW = 150, maxH = 110 }) {
  const w = parseFloat(widthCm) || 100;
  const h = parseFloat(heightCm) || 100;
  const scale = Math.min(maxW / w, maxH / h);
  const dw = Math.max(20, w * scale);
  const dh = Math.max(20, h * scale);
  const padL = 26; // room for the height label
  const padT = 16; // room for the width label
  const W = dw + padL + 6;
  const H = dh + padT + 6;
  const x = padL;
  const y = padT;

  const sashes = type === "slide3" ? 3 : type === "slide2" ? 2 : 1;
  const sw = dw / sashes;
  const t = Math.min(4, dw / 12);

  const marks = [];
  for (let i = 0; i < sashes; i++) {
    const sx = x + i * sw;
    const cx = sx + sw / 2;
    const cy = y + dh / 2;
    if (type === "casement") {
      marks.push(<polyline key={i} points={`${sx + t},${y + t} ${sx + sw - t},${cy} ${sx + t},${y + dh - t}`} fill="none" stroke={MARK} strokeWidth="1" />);
    } else if (type === "kip") {
      marks.push(<polyline key={i} points={`${sx + t},${y + dh - t} ${cx},${y + t} ${sx + sw - t},${y + dh - t}`} fill="none" stroke={MARK} strokeWidth="1" />);
    } else if (type === "door") {
      marks.push(<polyline key={i} points={`${sx + sw - t},${y + t} ${sx + t},${cy} ${sx + sw - t},${y + dh - t}`} fill="none" stroke={MARK} strokeWidth="1" />);
    } else if (sashes > 1) {
      // sliding: arrow in alternating directions
      const dir = i % 2 === 0 ? 1 : -1;
      const a = cx - dir * sw * 0.2;
      const b = cx + dir * sw * 0.2;
      marks.push(
        <g key={i} stroke={MARK} strokeWidth="1" fill="none">
          <line x1={a} y1={cy} x2={b} y2={cy} />
          <polyline points={`${b - dir * 4},${cy - 3} ${b},${cy} ${b - dir * 4},${cy + 3}`} />
        </g>
      );
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <rect x={x} y={y} width={dw} height={dh} fill={GLASS} stroke={FRAME} strokeWidth="2" />
      {Array.from({ length: sashes }).map((_, i) => (
        <rect key={i} x={x + i * sw + t / 2} y={y + t / 2} width={sw - t} height={dh - t} fill="none" stroke={FRAME} strokeWidth="1" />
      ))}
      {marks}
      {/* width label */}
      <text x={x + dw / 2} y={y - 5} fontSize="9" textAnchor="middle" fill={FRAME}>{Math.round(w)}</text>
      {/* height label */}
      <text x={x - 6} y={y + dh / 2} fontSize="9" textAnchor="middle" fill={FRAME} transform={`rotate(-90 ${x - 6} ${y + dh / 2})`}>{Math.round(h)}</text>
    </svg>
  );
}
