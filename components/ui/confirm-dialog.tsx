"use client"

// A branded replacement for window.confirm().
//   if (!(await askConfirm("Delete this deck permanently?"))) return
// Mount <ConfirmHost /> once (the root layout does this through <AppFeedback />).

import * as React from "react"
import { CircleHelp, TriangleAlert } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type ConfirmOptions = {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type Request = ConfirmOptions & { message: string; resolve: (ok: boolean) => void }

// Verbs that mean "this removes or undoes something" get a red button labelled with that verb.
const DANGER = /^(Delete|Remove|Revoke|Reject|Withdraw|Discard|Archive|Cancel|Close|Leave|Return|Replace)\b/i

function derive(message: string, o: ConfirmOptions) {
  const verb = message.match(DANGER)?.[1]
  const destructive = o.destructive ?? (!!verb && !/^(Replace|Return|Close)$/i.test(verb))
  const label = o.confirmLabel ?? (verb ? verb[0].toUpperCase() + verb.slice(1).toLowerCase() : "Continue")
  // "Remove this card from the draft? Extra detail." → title "Remove this card from the draft?", body "Extra detail."
  const cut = message.indexOf("?")
  const title = o.title ?? (cut > 0 && cut < message.length - 1 ? message.slice(0, cut + 1) : message)
  const body = o.title ? message : title === message ? "" : message.slice(cut + 1).trim()
  return { destructive, label, title, body }
}

let push: ((r: Request) => void) | null = null

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  // Falls back to the browser dialog if the host is not mounted (e.g. an isolated page).
  if (!push) return Promise.resolve(typeof window !== "undefined" && window.confirm(message))
  return new Promise(resolve => push!({ ...options, message, resolve }))
}

export function ConfirmHost() {
  const [queue, setQueue] = React.useState<Request[]>([])
  React.useEffect(() => {
    push = r => setQueue(q => [...q, r])
    return () => { push = null }
  }, [])
  const current = queue[0]
  const settle = (ok: boolean) => {
    if (!current) return
    current.resolve(ok)
    setQueue(q => q.slice(1))
  }
  if (!current) return null
  const { destructive, label, title, body } = derive(current.message, current)
  return (
    <AlertDialog open onOpenChange={open => { if (!open) settle(false) }}>
      <AlertDialogContent size="sm" className="tj-confirm">
        <AlertDialogHeader>
          <AlertDialogMedia className={destructive ? "tj-confirm-media danger" : "tj-confirm-media"}>
            {destructive ? <TriangleAlert /> : <CircleHelp />}
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {body && <AlertDialogDescription>{body}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>{current.cancelLabel ?? "Go back"}</AlertDialogCancel>
          <AlertDialogAction
            autoFocus={!destructive}
            variant={destructive ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
