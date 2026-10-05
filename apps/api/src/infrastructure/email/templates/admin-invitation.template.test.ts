import { describe, expect, it } from "vitest";

import {
  adminInvitationTemplate,
  adminInvitationUrl,
} from "./admin-invitation.template.js";

describe("administrator invitation email", () => {
  it("escapes recipient/name and preserves the configured origin and encoded credential", () => {
    const url = adminInvitationUrl(
      "https://approved.example.com/invitation",
      "https://approved.example.com",
      'token<&"test',
    );
    expect(new URL(url).searchParams.get("token")).toBe('token<&"test');
    expect(new URL(url).origin).toBe("https://approved.example.com");
    const html = adminInvitationTemplate(
      "<script>name</script>",
      "a&b@example.com",
      url,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("a&amp;b@example.com");
    expect(html).toContain("&lt;script&gt;");
  });
  it.each([
    null,
    "https://unapproved.example.com/invitation",
    "javascript:alert(1)",
    "https://user:password@approved.example.com/invitation",
  ])("refuses a missing or unapproved destination", (destination) => {
    expect(() =>
      adminInvitationUrl(
        destination,
        "https://approved.example.com",
        "credential",
      ),
    ).toThrow();
  });
});
