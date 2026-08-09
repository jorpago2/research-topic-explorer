import { AlertTriangle } from "lucide-react";

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="error-notice" role="alert">
      <AlertTriangle size={19} aria-hidden="true" />
      <div><strong>Analysis could not be completed.</strong><p>{message}</p></div>
    </div>
  );
}
