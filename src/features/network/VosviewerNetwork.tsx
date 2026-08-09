import { VOSviewerOnline } from "vosviewer-online";
import type { VosviewerData } from "../../types/domain";

export default function VosviewerNetwork({ data }: { data: VosviewerData }) {
  return <VOSviewerOnline data={data} />;
}
