export function VektorMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/vektor-mark.png"
      alt=""
      width={28}
      height={28}
      draggable={false}
      aria-hidden="true"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
