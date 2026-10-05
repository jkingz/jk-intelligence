"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PendingAccount } from "@/lib/admin/provisioning";

export function AttachMemberDialog({ accounts }: { accounts: PendingAccount[] }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" disabled />}>
        Attach account
      </DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Attach account</DialogTitle>
          <DialogDescription>
            Give a signed-up account a role
            {accounts.length > 0
              ? `, starting with ${accounts[0].email ?? "an unnamed account"}.`
              : "."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
