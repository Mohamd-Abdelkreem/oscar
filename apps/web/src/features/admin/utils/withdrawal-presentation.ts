import type { AdminWithdrawalRequest } from "../api/withdrawals.api";

export {
  withdrawalStates,
  withdrawalActions,
  withdrawalBlockers,
  withdrawalInstant,
  withdrawalRate,
} from "../../employee/utils/withdrawal-presentation";
export function canChangeWithdrawal(
  row: AdminWithdrawalRequest,
  kind: "EXTEND" | "REJECT",
) {
  return (
    row.state === "SCHEDULED" &&
    (kind === "EXTEND" ? row.canExtend : row.canReject)
  );
}
