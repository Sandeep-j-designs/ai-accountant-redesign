/** SyncEngine is mounted at the app root, next to RunWatcher and for the same
 *  reason: a push to Tally finishes wherever the operator happens to be
 *  standing. Before this existed the run lived in SyncModal's local state and
 *  died on unmount — closing the modal, opening a bill, or switching company
 *  silently cancelled the push, and the vouchers never landed.
 *
 *  It drives EVERY company's run, not just the active one. That is what makes
 *  the scenario work: start a sync in Acme, switch to Northwind and start one
 *  there, and both keep counting down while the settings page reports each. */

import { useEffect, useRef } from "react"
import { useBill, companySync, syncElapsed } from "@/state/store"
import { COMPANIES } from "@/data/companies"

export function SyncEngine() {
  const { state, dispatch } = useBill()

  // The ticker reads state through a ref, never a closure. Keying the effect on
  // `state` would tear down and rebuild the interval on EVERY dispatch — and an
  // interval that restarts faster than it fires never fires, which would strand
  // exactly the runs this component exists to land.
  const latest = useRef(state)
  latest.current = state

  // the set of live runs, as a stable string: the effect re-subscribes when a
  // run starts or ends, and at no other time
  const live = COMPANIES.map((c) => (companySync(state, c.id).phase === "syncing" ? c.id : ""))
    .filter(Boolean)
    .join(",")

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      // re-read per tick — two companies can come due in the same interval
      for (const companyId of live.split(",")) {
        if (syncElapsed(companySync(latest.current, companyId))) {
          dispatch({ type: "SYNC_LAND", companyId })
        }
      }
    }, 200)
    return () => clearInterval(id)
  }, [live, dispatch])

  return null
}
