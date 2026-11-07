import { Notice } from "./ui";

// Shows ?error= / ?ok= messages that server actions pass back through the URL.
export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div className="mb-6">
      {error && <Notice tone="error">{error}</Notice>}
      {ok && <Notice tone="success">{ok}</Notice>}
    </div>
  );
}
