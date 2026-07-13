/** Glifo OSNAP extremo — cuadrado hueco (estilo AutoCAD). */
export function OsnapEndpointIcon({ size = 14, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/** Glifo OSNAP sobre línea — perpendicular (estilo AutoCAD). */
export function OsnapLineIcon({ size = 14, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M2 9.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 9.5V3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Imán a intersecciones de cuadrícula. */
export function OsnapGridSnapIcon({ size = 14, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M1 5h12M1 9h12M5 1v12M9 1v12" stroke="currentColor" strokeWidth="1.1" opacity="0.45" />
      <circle cx="5" cy="5" r="1.35" fill="currentColor" />
      <circle cx="9" cy="5" r="1.35" fill="currentColor" />
      <circle cx="5" cy="9" r="1.35" fill="currentColor" />
      <circle cx="9" cy="9" r="1.35" fill="currentColor" />
    </svg>
  );
}

/** Cuadrícula visual. */
export function GridToggleIcon({ size = 14, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M1 5h12M1 9h12M5 1v12M9 1v12" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
