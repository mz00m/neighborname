import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          borderRadius: 40,
          background: "#1c1917",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M60 10L10 50v52a6 6 0 006 6h24V76a6 6 0 016-6h12a6 6 0 016 6v32h24a6 6 0 006-6V50L60 10z"
            fill="#d97706"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
