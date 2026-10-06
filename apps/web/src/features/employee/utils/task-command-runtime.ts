import {
  createTaskCommandRuntime,
  type TaskRuntimeEnvironment,
} from "@/features/proofs/task-command-runtime";
import { getBrowserTaskCommandRuntime } from "@/features/proofs/browser-task-command-runtime";

export const createEmployeeTaskCommandRuntime = (
  environment: TaskRuntimeEnvironment,
) => createTaskCommandRuntime("USER", environment);
export const getEmployeeTaskCommandRuntime = () =>
  getBrowserTaskCommandRuntime("USER");
