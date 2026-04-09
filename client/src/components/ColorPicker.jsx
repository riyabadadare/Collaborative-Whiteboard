import React from "react";
import "../styles/colorPicker.css";

const SWATCHES = [
  "#d4848a",
  "#d4a96a",
  "#d4c26a",
  "#82b896",
  "#6aada0",
  "#6a9dba",
  "#8090c8",
  "#a080c4",
  "#c480a8",
  "#ffffff",
  "#a8a8a8",
  "#4a4a4a"
];

export default function ColorPicker({ value, onChange }) {
  const customRef = React.useRef(null);

  return (
    <div className="colorPicker" role="group" aria-label="Fill color">
      <div className="colorSwatches">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`colorSwatch${value === hex ? " colorSwatchActive" : ""}`}
            style={{ background: hex }}
            title={hex}
            onClick={() => onChange(hex)}
            aria-label={hex}
            aria-pressed={value === hex}
          />
        ))}
        <button
          type="button"
          className={`colorSwatch colorSwatchCustom${!SWATCHES.includes(value) ? " colorSwatchActive" : ""
            }`}
          title="Custom color"
          aria-label="Custom color"
          onClick={() => customRef.current?.click()}
          style={{
            background: !SWATCHES.includes(value) ? value : "transparent",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M5.5 1v9M1 5.5h9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <input
          ref={customRef}
          type="color"
          className="colorPickerNativeInput"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
