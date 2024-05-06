import { ProcessStatus } from "../../lib/system";

export type AppStatus = {
  name: string;
  status?: ProcessStatus;
  mem?: number;
  cpu?: number;
}