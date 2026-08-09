declare module "vosviewer-online" {
  import type { ComponentType } from "react";
  import type { VosviewerData } from "./domain";

  export const VOSviewerOnline: ComponentType<{
    data?: VosviewerData;
    parameters?: Record<string, unknown>;
  }>;
}
