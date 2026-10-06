import {
  createTaskCommandRuntime,
  type TaskRuntimeEnvironment,
} from "@/features/proofs/task-command-runtime";
import { getBrowserTaskCommandRuntime } from "@/features/proofs/browser-task-command-runtime";

export const createAdminTaskCommandRuntime = (
  environment: TaskRuntimeEnvironment,
) => createTaskCommandRuntime("ADMIN", environment);
export const getAdminTaskCommandRuntime = () =>
  getBrowserTaskCommandRuntime("ADMIN");
