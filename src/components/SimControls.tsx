import { useBill } from "@/state/store"

/** Demo-only edge-case triggers. Hidden in production; enable with ?demo in the URL. */
export function SimControls() {
  const { state, dispatch } = useBill()
  const demoEnabled =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("demo")
  const inFlow = state.screen === "cockpit" || state.screen === "read" || state.screen === "entry"
  if (!inFlow || !demoEnabled) return null

  const btn =
    "rounded-md border border-line px-2.5 py-[5px] text-xs text-body transition-colors hover:border-line-strong hover:text-ink"
  const toggle = (on: boolean) =>
    on
      ? "rounded-md border border-accent-sig/50 bg-accent-wash px-2.5 py-[5px] text-xs font-medium text-accent-sig-ink"
      : btn

  const costReq = state.companyFlags.costAllocationMandatory

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-lg border border-line bg-card py-1.5 pl-3.5 pr-2 text-xs text-faint shadow-lift">
      <b className="mr-0.5 font-medium text-body">Demo:</b>
      {state.screen === "cockpit" ? (
        <>
          <button className={btn} onClick={() => dispatch({ type: "SIM_DUP" })}>
            Duplicate voucher
          </button>
          <button className={btn} onClick={() => dispatch({ type: "SIM_BALANCE" })}>
            Doesn&rsquo;t balance
          </button>
          <button className={btn} onClick={() => dispatch({ type: "SIM_LEDGER" })}>
            Ledger not found
          </button>
          <span className="mx-0.5 h-4 w-px bg-line-2" aria-hidden />
          <button
            className={toggle(costReq)}
            aria-pressed={costReq}
            onClick={() =>
              dispatch({ type: "SET_COMPANY_FLAG", flag: "costAllocationMandatory", value: !costReq })
            }
          >
            Cost centre required: {costReq ? "on" : "off"}
          </button>
          <button
            className={toggle(state.additionalOpen)}
            aria-pressed={state.additionalOpen}
            onClick={() => dispatch({ type: "TOGGLE_ADDITIONAL" })}
          >
            Additional tail
          </button>
        </>
      ) : (
        <>
          <button className={btn} onClick={() => dispatch({ type: "SIM_READ", kind: "unreadable" })}>
            Unreadable PDF
          </button>
          <button className={btn} onClick={() => dispatch({ type: "SIM_READ", kind: "faint" })}>
            Faint scan
          </button>
          <button className={btn} onClick={() => dispatch({ type: "SIM_READ", kind: "vendor" })}>
            Vendor not found
          </button>
        </>
      )}
    </div>
  )
}
