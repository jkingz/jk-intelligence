import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
}: {
  title?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-md rounded-2xl bg-elevated">
      <CardHeader className="gap-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-serif text-xl font-bold text-primary-foreground">
          J
        </div>
        <CardTitle className="font-serif text-xl">JK Intelligence</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {title ? (
          <h1 className="font-serif text-lg text-foreground">{title}</h1>
        ) : null}
        {children}
        <p className="text-center text-xs text-muted-foreground">
          Access is limited to authorized accounts. Data stays isolated per client.
        </p>
      </CardContent>
    </Card>
  );
}