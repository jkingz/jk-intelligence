import { toast } from "@/components/ui/toast";

export interface StatusToastOutcome {
  status: "success" | "error";
  title: string;
  description: string;
  timeout?: number;
}

export function startStatusToast(
  title: string,
  description = "Processing your request…",
): string {
  return toast.add({ type: "loading", title, description, timeout: 0 });
}

export function finishStatusToast(id: string, outcome: StatusToastOutcome): void {
  toast.update(id, {
    type: outcome.status,
    title: outcome.title,
    description: outcome.description,
    // Persist confirmation messages (timeout 0); otherwise auto-dismiss within a few seconds.
    timeout: outcome.timeout ?? (outcome.status === "error" ? 8000 : 6000),
  });
}