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

export function ClientDialog({
  mode,
}: {
  mode: "create" | "rename";
  name?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" disabled />}>
        {mode === "create" ? "Create client" : "Rename"}
      </DialogTrigger>
      <DialogContent overlayClassName="bg-black/50 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New client" : "Rename client"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "The domain is fixed once created."
              : "The domain cannot be changed after creation."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
