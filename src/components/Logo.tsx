const sizes = {
  sm: { mark: "h-9 w-9 text-sm", word: "text-xs", tag: "text-[10px]" },
  lg: { mark: "h-14 w-14 text-xl", word: "text-xl", tag: "text-xs" },
} as const;

export function Logo({
  size = "sm",
  stacked = false,
  showTagline = false,
}: {
  size?: keyof typeof sizes;
  stacked?: boolean;
  showTagline?: boolean;
}) {
  const s = sizes[size];
  return (
    <div className={`flex ${stacked ? "flex-col items-start gap-2" : "items-center gap-3"}`}>
      <div
        className={`flex ${s.mark} shrink-0 items-center justify-center rounded-full font-bold text-white`}
        style={{
          background: "linear-gradient(135deg, var(--brand-navy), var(--brand))",
        }}
      >
        PS
      </div>
      <div>
        <p className={`${s.word} font-semibold tracking-wide text-brand`}>
          PORTSIMEX SERVICES
        </p>
        {showTagline && (
          <p className={`${s.tag} text-zinc-500`}>Your World brought closer</p>
        )}
      </div>
    </div>
  );
}
