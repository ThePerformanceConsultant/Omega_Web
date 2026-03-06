export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
