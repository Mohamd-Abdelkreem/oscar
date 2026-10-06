import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { BusinessClock } from "./business-clock.js";

const BAGHDAD_ZONE = "Asia/Baghdad";
const clock = new BusinessClock(() => new Date("2026-10-02T09:00:00.000Z"));
const local = (instant: string) =>
  DateTime.fromISO(instant, { setZone: true }).setZone(BAGHDAD_ZONE).toISO();

describe("Baghdad business boundaries", () => {
  it.each([
    ["2026-10-09T08:59:59.999Z", "UPCOMING", "2026-10-09T09:00:00.000Z"],
    ["2026-10-09T09:00:00Z", "OPEN", "2026-10-12T09:00:00.000Z"],
    ["2026-10-09T14:59:59.999Z", "OPEN", "2026-10-12T09:00:00.000Z"],
    ["2026-10-09T15:00:00Z", "CLOSED", "2026-10-12T09:00:00.000Z"],
    ["2026-10-10T09:00:00Z", "HOLIDAY", "2026-10-12T09:00:00.000Z"],
    ["2026-10-11T09:00:00Z", "HOLIDAY", "2026-10-12T09:00:00.000Z"],
  ])(
    "projects the calendar at %s without consulting the host clock",
    (instant, state, next) => {
      const observed = clock.taskCalendar(instant);
      expect(observed).toMatchObject({
        calendarState: state,
        window: { nextOpeningAt: next },
      });
      expect(
        clock.taskCalendar(
          DateTime.fromISO(instant).setZone("America/New_York").toISO(),
        ),
      ).toEqual(observed);
      expect(clock.taskWindow("2026-10-09", instant)).toMatchObject({
        opensAt: "2026-10-09T09:00:00.000Z",
        closesAt: "2026-10-09T15:00:00.000Z",
        nextOpeningAt: next,
      });
    },
  );
  it.each([
    [1, "2026-10-02"],
    [2, "2026-10-05"],
    [5, "2026-10-08"],
    [6, "2026-10-09"],
    [10, "2026-10-15"],
    [11, "2026-10-16"],
  ])(
    "counts %s future work dates from Friday inclusively",
    (duration, finalWorkDate) => {
      const term = clock.subscriptionTerm("2026-10-02T09:00:00Z", duration);
      expect(term.firstWorkDate).toBe("2026-10-02");
      expect(term.finalWorkDate).toBe(finalWorkDate);
      expect(local(term.expiresAt)).toBe(
        DateTime.fromISO(finalWorkDate, { zone: BAGHDAD_ZONE })
          .plus({ days: 1 })
          .startOf("day")
          .toISO(),
      );
    },
  );
  it("preserves default duration and rejects unsupported duration/result without an unbounded loop", () => {
    const activation = "2026-10-05T09:00:00Z";
    expect(clock.subscriptionTerm(activation, 365)).toEqual(
      clock.subscriptionTerm(activation),
    );
    for (const duration of [0, -1, 1.5, 2147483648, 2147483647, NaN, Infinity])
      expect(() => clock.subscriptionTerm(activation, duration)).toThrow(
        RangeError,
      );
    expect(() => clock.subscriptionTerm("9999-12-31T09:00:00Z", 1)).toThrow(
      RangeError,
    );
  });
  it.each([
    ["2026-10-02T11:59:59.999+03:00", false],
    ["2026-10-02T12:00:00+03:00", true],
    ["2026-10-02T17:59:59.999+03:00", true],
    ["2026-10-02T18:00:00+03:00", false],
    ["2026-10-03T12:00:00+03:00", false],
    ["2026-10-04T12:00:00+03:00", false],
    ["2026-10-05T12:00:00+03:00", true],
  ])("task eligibility at %s is %s", (instant, expected) => {
    expect(clock.isTaskWindowOpen(instant)).toBe(expected);
  });

  it.each([
    ["2026-10-02T17:59:59.999+03:00", "2026-10-02"],
    ["2026-10-02T18:00:00+03:00", "2026-10-05"],
    ["2026-10-02T18:00:00.001+03:00", "2026-10-05"],
    ["2026-10-03T08:00:00+03:00", "2026-10-05"],
    ["2026-10-04T08:00:00+03:00", "2026-10-05"],
    ["2026-10-05T08:00:00+03:00", "2026-10-05"],
  ])(
    "separates immediate activation from the first counted date for %s",
    (instant, expected) => {
      const subscription = clock.subscriptionTerm(instant);
      expect(subscription.activationAt).toBe(new Date(instant).toISOString());
      expect(subscription.firstWorkDate).toBe(expected);
    },
  );

  it("counts exactly 365 weekdays including date one and expires on the following calendar date even Saturday", () => {
    const term = clock.subscriptionTerm("2026-10-05T09:00:00+03:00");
    const first = DateTime.fromISO(term.firstWorkDate, { zone: BAGHDAD_ZONE });
    const final = DateTime.fromISO(term.finalWorkDate, { zone: BAGHDAD_ZONE });
    const countedDates: string[] = [];
    for (let day = first; day <= final; day = day.plus({ days: 1 })) {
      if (day.weekday <= 5) countedDates.push(day.toISODate() ?? "invalid");
    }
    expect(countedDates).toHaveLength(365);
    expect(countedDates[0]).toBe(term.firstWorkDate);
    expect(countedDates.at(-1)).toBe(term.finalWorkDate);
    expect(final.weekday).toBe(5);
    expect(local(term.expiresAt)).toBe(
      final.plus({ days: 1 }).startOf("day").toISO(),
    );
    expect(
      clock.isSubscriptionActive(
        term,
        DateTime.fromISO(term.expiresAt).minus({ milliseconds: 1 }).toISO() ??
          "invalid",
      ),
    ).toBe(true);
    expect(clock.isSubscriptionActive(term, term.expiresAt)).toBe(false);
    expect(
      clock.isSubscriptionActive(
        term,
        DateTime.fromISO(term.activationAt)
          .minus({ milliseconds: 1 })
          .toISO() ?? "invalid",
      ),
    ).toBe(false);
  });

  it.each([
    ["2026-10-02T12:00:00+03:00", "72", "2026-10-07T12:00:00.000+03:00"],
    ["2026-10-02T23:30:00+03:00", "1.5", "2026-10-05T01:00:00.000+03:00"],
    ["2026-10-02T23:30:00+03:00", "0001.5000", "2026-10-05T01:00:00.000+03:00"],
    ["2026-10-03T12:00:00+03:00", "1", "2026-10-05T01:00:00.000+03:00"],
    ["2026-10-05T12:00:00+03:00", "0.0000025", "2026-10-05T12:00:00.009+03:00"],
    ["2024-02-28T23:00:00+03:00", "2", "2024-02-29T01:00:00.000+03:00"],
    ["2026-12-31T23:30:00+03:00", "1.5", "2027-01-01T01:00:00.000+03:00"],
  ])("adds exact counted hours %s + %s", (deadline, hours, expected) => {
    expect(local(clock.extendDeadline(deadline, hours))).toBe(expected);
  });

  it("keeps an exact Saturday deadline separate from new-dispatch normalization and weekend confirmations", () => {
    const earliest = clock.extendDeadline("2026-10-02T23:00:00+03:00", "1");
    expect(local(earliest)).toBe("2026-10-03T00:00:00.000+03:00");
    expect(local(clock.normalizeNewDispatch(earliest))).toBe(
      "2026-10-05T00:00:00.000+03:00",
    );
    expect(clock.businessDate("2026-10-03T15:00:00+03:00")).toBe("2026-10-03");
    expect(clock.initialWithdrawalDeadline("2026-10-02T12:00:00+03:00")).toBe(
      clock.extendDeadline("2026-10-02T12:00:00+03:00", "72"),
    );
    expect(clock.now()).toBe("2026-10-02T09:00:00.000Z");
  });

  it.each([
    "0.0000001",
    "0.000001",
    "0",
    "-1",
    "1e2",
    " 1",
    "",
    1.5,
    undefined,
  ])(
    "rejects unsupported extension %s without changing the existing deadline",
    (hours) => {
      const deadline = "2026-10-02T23:30:00+03:00";
      expect(() => clock.extendDeadline(deadline, hours)).toThrow(RangeError);
      expect(deadline).toBe("2026-10-02T23:30:00+03:00");
    },
  );

  it.each([
    "2026-10-02T12:00:00",
    "2026-02-30T12:00:00Z",
    "2026-10-02T12:00:00.0001Z",
    "0000-01-01T00:00:00Z",
    "9999-12-31T23:00:00Z",
    "0001-01-01T00:00:00+14:00",
  ])(
    "rejects malformed or unsupported input/intermediate instant %s",
    (instant) => {
      expect(() => clock.businessDate(instant)).toThrow(RangeError);
    },
  );

  it("preserves years 0001-0099 and fails explicitly on dates or UTC results outside supported years", () => {
    expect(clock.businessDate("0001-01-01T12:00:00Z")).toBe("0001-01-01");
    expect(clock.subscriptionTerm("0099-01-01T12:00:00Z").firstWorkDate).toBe(
      "0099-01-01",
    );
    expect(clock.extendDeadline("0001-01-01T12:00:00Z", "0.0000025")).toBe(
      "0001-01-01T12:00:00.009Z",
    );
    expect(
      clock.extendDeadline("9999-12-31T23:59:59.990+03:00", "0.0000025"),
    ).toBe("9999-12-31T20:59:59.999Z");
    for (const hours of ["1", "99999999"])
      expect(() =>
        clock.extendDeadline("9999-12-31T23:59:59.999+03:00", hours),
      ).toThrow(RangeError);
    expect(() => clock.subscriptionTerm("9999-12-31T12:00:00+03:00")).toThrow(
      RangeError,
    );
  });
});
