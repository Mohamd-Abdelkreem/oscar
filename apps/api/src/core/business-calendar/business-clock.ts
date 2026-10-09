import {
  businessDateSchema,
  countedHoursToMilliseconds,
  countedWorkDatesSchema,
  financialInstantSchema,
} from "@template/contracts";
import { DateTime } from "luxon";

const BUSINESS_ZONE = "Asia/Baghdad";
const UTC_ZONE = "UTC";
const FIRST_SUPPORTED_YEAR = 1;
const LAST_SUPPORTED_YEAR = 9999;
const LAST_WORKDAY = 5;
const TASK_OPEN_HOUR = 12;
const TASK_CLOSE_HOUR = 18;
const SUBSCRIPTION_WORK_DATES = 365;
const INITIAL_WITHDRAWAL_COUNTED_HOURS = "72";
const MAX_SAFE_MILLISECONDS = BigInt(Number.MAX_SAFE_INTEGER);

const supportedDateTime = (instant: DateTime): DateTime => {
  if (
    !instant.isValid ||
    instant.year < FIRST_SUPPORTED_YEAR ||
    instant.year > LAST_SUPPORTED_YEAR
  )
    throw new RangeError("Unsupported business calendar instant.");
  return instant;
};
const baghdadInstant = (rawInstant: unknown): DateTime => {
  const parsed = financialInstantSchema.safeParse(rawInstant);
  if (!parsed.success)
    throw new RangeError("Invalid business calendar instant.");
  return supportedDateTime(
    DateTime.fromISO(parsed.data, { setZone: true }).setZone(BUSINESS_ZONE),
  );
};
const utcInstant = (instant: DateTime): string => {
  const serialized = supportedDateTime(instant.setZone(UTC_ZONE)).toISO();
  if (serialized === null)
    throw new RangeError("Unsupported UTC calendar instant.");
  const parsed = financialInstantSchema.safeParse(serialized);
  if (!parsed.success)
    throw new RangeError("Unsupported UTC calendar instant.");
  return parsed.data;
};
const businessDate = (instant: DateTime): string => {
  const parsed = businessDateSchema.safeParse(
    supportedDateTime(instant).toISODate(),
  );
  if (!parsed.success) throw new RangeError("Unsupported business date.");
  return parsed.data;
};
const isWorkday = (instant: DateTime): boolean =>
  instant.weekday <= LAST_WORKDAY;
const nextWorkdayStart = (instant: DateTime): DateTime => {
  let next = supportedDateTime(instant.plus({ days: 1 }).startOf("day"));
  while (!isWorkday(next)) next = supportedDateTime(next.plus({ days: 1 }));
  return next;
};

export type SubscriptionTerm = {
  activationAt: string;
  firstWorkDate: string;
  finalWorkDate: string;
  expiresAt: string;
};

export class BusinessClock {
  constructor(private readonly clock: () => Date) {}

  now(): string {
    return utcInstant(baghdadInstant(this.clock().toISOString()));
  }

  businessDate(instant: unknown): string {
    return businessDate(baghdadInstant(instant));
  }

  isTaskWindowOpen(instant: unknown): boolean {
    const local = baghdadInstant(instant);
    return (
      isWorkday(local) &&
      local.hour >= TASK_OPEN_HOUR &&
      local.hour < TASK_CLOSE_HOUR
    );
  }

  taskCalendar(instant: unknown) {
    const local = baghdadInstant(instant);
    const opens = local.startOf("day").set({ hour: TASK_OPEN_HOUR });
    const closes = local.startOf("day").set({ hour: TASK_CLOSE_HOUR });
    const calendarState = !isWorkday(local)
      ? "HOLIDAY"
      : local < opens
        ? "UPCOMING"
        : local < closes
          ? "OPEN"
          : "CLOSED";
    const next =
      isWorkday(local) && local < opens
        ? opens
        : nextWorkdayStart(local).set({ hour: TASK_OPEN_HOUR });
    return {
      businessDate: businessDate(local),
      calendarState,
      window: {
        opensAt: utcInstant(opens),
        closesAt: utcInstant(closes),
        nextOpeningAt: utcInstant(next),
      },
    };
  }

  taskWindow(publicationDate: unknown, observedAt: unknown) {
    const date = businessDateSchema.parse(publicationDate);
    const local = supportedDateTime(
      DateTime.fromISO(date, { zone: BUSINESS_ZONE }),
    );
    return {
      opensAt: utcInstant(local.set({ hour: TASK_OPEN_HOUR })),
      closesAt: utcInstant(local.set({ hour: TASK_CLOSE_HOUR })),
      nextOpeningAt: this.taskCalendar(observedAt).window.nextOpeningAt,
    };
  }

  subscriptionTerm(
    activation: unknown,
    countedWorkDates = SUBSCRIPTION_WORK_DATES,
  ): SubscriptionTerm {
    const duration = countedWorkDatesSchema.safeParse(countedWorkDates);
    if (!duration.success)
      throw new RangeError("Invalid counted work-date duration.");
    const local = baghdadInstant(activation);
    const first =
      isWorkday(local) && local.hour < TASK_CLOSE_HOUR
        ? local.startOf("day")
        : nextWorkdayStart(local);
    const remainingDates = duration.data - 1;
    const wholeWeeks = Math.floor(remainingDates / LAST_WORKDAY);
    let final = supportedDateTime(first.plus({ days: wholeWeeks * 7 }));
    for (let counted = 0; counted < remainingDates % LAST_WORKDAY; counted += 1)
      final = nextWorkdayStart(final);
    const expiry = supportedDateTime(final.plus({ days: 1 }).startOf("day"));
    return {
      activationAt: utcInstant(local),
      firstWorkDate: businessDate(first),
      finalWorkDate: businessDate(final),
      expiresAt: utcInstant(expiry),
    };
  }

  isSubscriptionActive(term: SubscriptionTerm, instant: unknown): boolean {
    const observed = baghdadInstant(instant).toMillis();
    const activation = baghdadInstant(term.activationAt).toMillis();
    const expiry = baghdadInstant(term.expiresAt).toMillis();
    return observed >= activation && observed < expiry;
  }

  initialWithdrawalDeadline(acceptedAt: unknown): string {
    return this.extendDeadline(acceptedAt, INITIAL_WITHDRAWAL_COUNTED_HOURS);
  }

  remainingCountedMilliseconds(observedAt: unknown, deadline: unknown): bigint {
    let cursor = baghdadInstant(observedAt);
    const end = baghdadInstant(deadline);
    if (cursor >= end) return 0n;
    let remaining = 0n;
    while (cursor < end) {
      if (!isWorkday(cursor)) {
        cursor = nextWorkdayStart(cursor);
        continue;
      }
      const next = cursor.plus({ days: 1 }).startOf("day");
      const stop = next < end ? next : end;
      remaining += BigInt(stop.toMillis() - cursor.toMillis());
      cursor = stop;
    }
    return remaining;
  }

  extendDeadline(existingDeadline: unknown, countedHours: unknown): string {
    let cursor = baghdadInstant(existingDeadline);
    const duration = countedHoursToMilliseconds(countedHours);
    if (duration > MAX_SAFE_MILLISECONDS)
      throw new RangeError("Unsupported counted duration.");
    let remaining = Number(duration);
    const lastInstant = DateTime.fromObject(
      { year: LAST_SUPPORTED_YEAR },
      { zone: BUSINESS_ZONE },
    ).endOf("year");
    if (remaining > lastInstant.toMillis() - cursor.toMillis())
      throw new RangeError("Unsupported resulting deadline.");
    while (remaining > 0) {
      if (!isWorkday(cursor)) cursor = nextWorkdayStart(cursor);
      const availableMilliseconds =
        cursor.endOf("day").toMillis() + 1 - cursor.toMillis();
      if (remaining <= availableMilliseconds)
        return utcInstant(
          supportedDateTime(cursor.plus({ milliseconds: remaining })),
        );
      remaining -= availableMilliseconds;
      cursor = supportedDateTime(cursor.plus({ days: 1 }).startOf("day"));
    }
    throw new RangeError("Invalid counted duration.");
  }

  normalizeNewDispatch(earliest: unknown): string {
    const local = baghdadInstant(earliest);
    return utcInstant(isWorkday(local) ? local : nextWorkdayStart(local));
  }
}
