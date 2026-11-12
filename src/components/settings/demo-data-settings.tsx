"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { resetDemoAccountAction } from "@/actions/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Restore the account to its opening balance and sample history. */
export function DemoDataSettings({ sharedDemoProfile }: { sharedDemoProfile: boolean }) {
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () =>
    startTransition(async () => {
      const result = await resetDemoAccountAction(confirmation);
      if (!result.ok) return void toast.error(result.error.message);
      toast.success("Account restored to ₦45,140,708.60");
      setOpen(false);
      setConfirmation("");
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Reset account</CardTitle>
          <CardDescription>Erase your transaction history and restore the opening balance of ₦45,140,708.60 with fresh sample transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <RotateCcw className="size-4" /> Reset account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  All your transactions, beneficiaries, notifications and card settings will be replaced with the original sample data. {sharedDemoProfile ? "Because this is the shared demo profile, its transaction PIN is cleared too." : "Your profile, password and PIN are kept."} This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">
                  Type <span className="font-mono font-semibold">RESET</span> to confirm
                </Label>
                <Input id="reset-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    reset();
                  }}
                  disabled={confirmation !== "RESET" || pending}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {pending ? "Resetting…" : "Reset account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
