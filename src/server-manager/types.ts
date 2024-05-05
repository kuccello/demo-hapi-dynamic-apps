import { ProcessStatus } from "../process-manager/types";

export type AppStatus = {
  name: string;
  status?: ProcessStatus;
  mem?: number;
  cpu?: number;
}