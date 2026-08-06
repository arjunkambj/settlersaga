interface LiveMessageProps { message: string; }
export function LiveMessage({ message }: LiveMessageProps) {
  if (!message) return null;
  return <p aria-live="polite" className="text-sm text-destructive">{message}</p>;
}
