import { useState } from "react"
import { useBill } from "@/state/store"
import {
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTag } from "./parts"

export function ReadFailDialog() {
  const { dispatch } = useBill()
  return (
    <>
      <DialogHeader>
        <InfoTag tone="danger">Read failed</InfoTag>
        <DialogTitle className="mt-2.5 text-xl">
          Scan too faint to extract amounts.
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm leading-relaxed text-body">
          Amounts could not be read with confidence. Re-scan, or capture the
          essentials by hand.
        </p>
      </DialogBody>
      <DialogFooter className="justify-start gap-2.5">
        <Button
          onClick={() => {
            dispatch({ type: "CLOSE_DIALOG" })
            dispatch({ type: "START_READ" })
          }}
        >
          Try again
        </Button>
        <Button variant="outline" onClick={() => dispatch({ type: "START_MANUAL" })}>
          Enter manually
        </Button>
      </DialogFooter>
    </>
  )
}

export function DiscardDialog() {
  const { dispatch } = useBill()
  return (
    <>
      <DialogHeader>
        <InfoTag tone="danger">Discard</InfoTag>
        <DialogTitle className="mt-2.5 text-xl">Discard this bill?</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="text-sm leading-relaxed text-body">
          The read and your decisions are lost. This cannot be undone.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => dispatch({ type: "CLOSE_DIALOG" })}>
          Keep
        </Button>
        <Button variant="destructive" onClick={() => dispatch({ type: "RESET" })}>
          Discard
        </Button>
      </DialogFooter>
    </>
  )
}

const MANUAL_STEPS = [
  {
    tag: "Who",
    title: "Supplier",
    body: "No document to read. Capture the essentials, one field at a time.",
    label: "Supplier name",
    val: "Sundar Logistics Pvt Ltd",
  },
  {
    tag: "What",
    title: "Line item",
    body: "A description and amount is enough to start.",
    label: "Line description",
    val: "Freight — inbound raw material",
  },
  {
    tag: "Tax",
    title: "Taxable value",
    body: "Enter the taxable value; the tax heads follow.",
    label: "Taxable value (₹)",
    val: "1,56,000",
  },
]

export function ManualDialog({ step }: { step: number }) {
  const { dispatch } = useBill()
  const s = MANUAL_STEPS[Math.min(step, 2)]
  const [value, setValue] = useState(s.val)
  const last = step >= 2

  return (
    <>
      <DialogHeader>
        <InfoTag>
          {s.tag} · {Math.min(step, 2) + 1} of 3
        </InfoTag>
        <DialogTitle className="mt-2.5 text-xl">{s.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="mb-4 text-sm leading-relaxed text-body">{s.body}</p>
        <Label htmlFor="manual-field" className="mb-1.5">
          {s.label} <span className="text-danger">*</span>
        </Label>
        <Input
          id="manual-field"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </DialogBody>
      <DialogFooter>
        <Button
          onClick={() =>
            dispatch(last ? { type: "FINISH_MANUAL" } : { type: "MANUAL_NEXT" })
          }
        >
          {last ? "Done — review" : "Continue"}
        </Button>
        <Button variant="outline" onClick={() => dispatch({ type: "CLOSE_DIALOG" })}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  )
}
