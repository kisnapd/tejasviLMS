"use client"

// Global feedback layer: branded confirm dialogs and toast notifications.
// Mounted once in app/layout.tsx. Use `askConfirm()` from "@/components/ui/confirm-dialog"
// and `toast` from "sonner" anywhere in the app.

import { Toaster } from "@/components/ui/sonner"
import { ConfirmHost } from "@/components/ui/confirm-dialog"

export function AppFeedback() {
  return (
    <>
      <ConfirmHost />
      <Toaster theme="light" position="top-center" closeButton richColors={false} toastOptions={{ className: "tj-toast" }} />
    </>
  )
}
