import { illustrationAssetSchema } from "@template/contracts";
import { createPrivateImageApi } from "./private-image.api";

export const taskIllustrationsApi = createPrivateImageApi({
  purpose: "TASK_ILLUSTRATION",
  uploadPath: "/admin/task-illustrations",
  readPath: "/task-illustrations",
  schema: illustrationAssetSchema,
});
