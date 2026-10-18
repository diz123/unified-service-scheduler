/** Original mark: a clock face with a small wrench at its edge (service + time). Monochrome, `currentColor`. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="9.5" />
      <path d="M14 9v5l3.2 2.1" />
      <path d="M20.8 20.8 25.6 25.6" />
      <path d="M24 29a3.4 3.4 0 1 0 5-5l-1.8 1.8-1.4-.2-.2-1.4L27.4 22.4" />
    </svg>
  );
}
