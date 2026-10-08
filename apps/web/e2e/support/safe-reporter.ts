import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  TestError,
} from "@playwright/test/reporter";

export default class SafeReporter implements Reporter {
  private scenario = 0;
  printsToStdio(): boolean {
    return true;
  }
  onTestEnd(_test: TestCase, result: TestResult): void {
    this.scenario++;
    process.stdout.write(
      `P03-SCENARIO-${String(this.scenario)} ${result.status}${result.errors.length === 0 ? "" : ` ${this.failureCode(result.errors[0])}`}\n`,
    );
  }
  private failureCode(error: TestError | undefined): string {
    const message = error?.message ?? "";
    const locationCode = message.match(/^P03_CHECK_FAILED_AT_\d+_\d+$/u)?.[0];
    if (locationCode !== undefined) return locationCode;
    if (message === "P03_CHECK_FAILED" && error?.location !== undefined)
      return `P03_CHECK_FAILED_AT_${String(error.location.line)}_${String(error.location.column)}`;
    const fixtureCode = message.match(
      /^P05_FIXTURE_(?:DATABASE|MIGRATION|SNAPSHOT|LINUX_LAUNCH|DEPENDENCIES|API_BOOT)$/u,
    )?.[0];
    if (fixtureCode !== undefined) return fixtureCode;
    const known = [
      "P03_BUILD_FAILED",
      "P03_WEB_START_FAILED",
      "P03_API_START_FAILED",
      "P03_API_FAILED",
      "P03_IPC_TIMEOUT",
      "P03_API_EXITED",
    ];
    for (const code of known) if (message.includes(code)) return code;
    if (message.includes("Executable doesn't exist"))
      return "P03_BROWSER_UNAVAILABLE";
    return "P03_CHECK_FAILED";
  }
  onError(error: TestError): void {
    process.stdout.write(`${this.failureCode(error)}\n`);
  }
  onEnd(result: FullResult): void {
    process.stdout.write(`P03-RUN ${result.status}\n`);
  }
}
