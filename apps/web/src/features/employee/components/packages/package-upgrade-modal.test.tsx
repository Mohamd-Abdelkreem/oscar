import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { it, expect } from "vitest";
import { purchaseQuoteSchema } from "@template/contracts";
import { quote, reply, purchase } from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { PackageUpgradeModal } from "./package-upgrade-modal";

cleanupQueries();
it("pending dismissal cannot create a second purchase; remount keeps original recovery", async () => {
  const gate = deferred<undefined>();
  let writes = 0;
  const h = queryHarness("USER", async (config) => {
    writes++;
    await gate.promise;
    return reply(
      config,
      {
        purchase: {
          ...purchase,
          subscriptionAtPurchase: {
            ...purchase.subscriptionAtPurchase,
            terms: funded.terms,
          },
        },
        replayed: false,
      },
      201,
    );
  });
  const funded = purchaseQuoteSchema.parse({
    ...quote,
    terms: {
      ...quote.terms,
      version: 2,
      dailyReward: "3.000001",
      conditionalGross: "1095.000365",
      withdrawalFeeBps: 1001,
    },
    canPurchase: true,
    blockReason: null,
    usableFunds: "60",
    fundedAllocation: { referral: "10", nonReferral: "50", total: "60" },
    requiredTopUp: "0",
  });
  const open = () =>
    render(
      <PackageUpgradeModal
        quote={funded}
        isOpen
        loading={false}
        quoteError={null}
        onClose={() => undefined}
      />,
      { wrapper: h.wrapper },
    );
  const first = open();
  expect(screen.getByRole("dialog")).toHaveTextContent("3.000001");
  expect(screen.getByRole("dialog")).toHaveTextContent("10.01%");
  expect(screen.getByRole("dialog")).toHaveTextContent("Asia/Baghdad");
  expect(screen.getByRole("dialog")).toHaveTextContent("1, 2, 3, 4, 5");
  expect(screen.getByRole("dialog")).toHaveTextContent("18:00");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "قبل تكلفة الباقة ورسوم السحب",
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    funded.preview.firstWorkDate,
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    funded.preview.finalWorkDate,
  );
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "تأكيد الشراء وخصم السعر كاملاً" }),
    ).toBeEnabled();
  });
  fireEvent.click(
    screen.getByRole("button", { name: "تأكيد الشراء وخصم السعر كاملاً" }),
  );
  await waitFor(() => {
    expect(writes).toBe(1);
  });
  first.unmount();
  open();
  expect(
    screen.getByRole("button", { name: "تأكيد الشراء وخصم السعر كاملاً" }),
  ).toBeDisabled();
  gate.resolve(undefined);
  await waitFor(() => {
    expect(localStorage.length).toBe(0);
  });
  expect(writes).toBe(1);
});
