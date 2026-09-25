import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ConnectionRow({
  label,
  detail,
  status,
  showConnectButton = true,
}: {
  label: string;
  detail: string;
  status: string;
  showConnectButton?: boolean;
}) {
  const linked = status !== "Not connected" && status !== "Coming soon";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs text-text-muted">{detail}</span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={linked ? "default" : "secondary"}>{status}</Badge>
        {showConnectButton ? (
          <Button
            size="sm"
            variant="outline"
            disabled
            className="text-xs"
            title="Recording a connection needs a write path that does not exist yet"
          >
            Connect
          </Button>
        ) : null}
      </div>
    </div>
  );
}
