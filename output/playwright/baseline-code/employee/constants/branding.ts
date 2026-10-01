export const BRANDING = {
  nameAr: "أوسكار",
  nameEn: "OSCAR",
  titleSuffix: "منصة أوسكار لمهام الموظفين",
  supportEmail: "support@example.com",
  demoAddressWarning: "عنوان تجريبي - لا ترسل أموالًا حقيقية",
  defaultDepositAddress: "TQj1xP8mB9k8Z7Y6X5W4V3U2T1S0R9Q8P7",
  defaultNetwork: "TRON (TRC20)",
  defaultCurrency: "USDT",
} as const;

export const FINANCIAL_RULES = {
  withdrawalMinAmount: 16,
  withdrawalMaxAmount: 500,
  withdrawalFeeRate: 0.21, // 21%
  withdrawalCooldownHours: 24,
  withdrawalProcessingHours: 72,
  referralRates: [
    { level: 1, rate: 0.12, percentage: "12%" },
    { level: 2, rate: 0.06, percentage: "6%" },
    { level: 3, rate: 0.04, percentage: "4%" },
    { level: 4, rate: 0.02, percentage: "2%" },
    { level: 5, rate: 0.02, percentage: "2%" },
  ] as const,
  taskTimeWindow: {
    start: "12:00",
    end: "18:00",
    timezone: "Asia/Baghdad",
    timezoneLabel: "توقيت بغداد (GMT+3)",
  },
} as const;
