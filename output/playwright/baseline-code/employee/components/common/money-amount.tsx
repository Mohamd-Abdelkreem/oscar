
interface MoneyAmountProps {
  readonly amount: number;
  readonly currency?: string | undefined;
  readonly showSign?: boolean | undefined;
  readonly size?: "sm" | "md" | "lg" | "xl" | undefined;
  readonly color?: "neutral" | "positive" | "negative" | "inherit" | undefined;
  readonly className?: string | undefined;
}

export function MoneyAmount({
  amount,
  currency = "USDT",
  showSign = false,
  size = "md",
  color = "neutral",
  className = "",
}: MoneyAmountProps) {
  const isPositive = amount > 0;
  const sign = showSign && isPositive ? "+" : "";

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base font-semibold",
    lg: "text-xl font-bold",
    xl: "text-2xl sm:text-3xl font-bold",
  }[size];

  const colorClasses = {
    neutral: "text-slate-900",
    positive: "text-emerald-700",
    negative: "text-rose-700",
    inherit: "",
  }[color];

  const formattedAmount = `${sign}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <span
      className={`inline-flex items-baseline gap-1 font-sans ${sizeClasses} ${colorClasses} ${className}`}
    >
      <bdi dir="ltr" className="font-semibold tracking-tight">
        {formattedAmount}
      </bdi>
      <span className="text-[0.8em] font-medium text-slate-500">{currency}</span>
    </span>
  );
}
