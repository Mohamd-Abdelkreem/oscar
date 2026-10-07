import { proofAssetSchema } from "@template/contracts";
import { createPrivateImageApi } from "./private-image.api";

export const proofsApi = createPrivateImageApi({
  purpose: "PROOF",
  uploadPath: "/proofs",
  readPath: "/proofs",
  schema: proofAssetSchema,
});
