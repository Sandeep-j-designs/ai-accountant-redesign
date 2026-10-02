import { Mail, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Gated preview (?demo=button) for the primary "lit edge" style — a solid
 * petrol fill wrapped in a 1px lighter same-hue border — and the shared
 * Button API: variant="primary", loading, icon, iconRight.
 * Shown on both registers (dark canvas like the reference, and the app's
 * light canvas) so the edge reads in each.
 */
function Row() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Button rest</Button>
      <Button variant="primary" loading>
        Button loading
      </Button>
      <Button variant="primary" icon={<Mail />}>
        Button icon
      </Button>
      <Button variant="primary" iconRight={<Mail />}>
        Button iconRight
      </Button>
    </div>
  )
}

export function ButtonDemo() {
  return (
    <div className="min-h-screen">
      {/* dark register — matches the reference screenshots */}
      <div className="dark bg-page px-10 py-12">
        <div className="mx-auto max-w-[760px]">
          <span className="eyebrow">Dark</span>
          <div className="mt-3">
            <Row />
          </div>
        </div>
      </div>

      {/* light register — the app's own canvas */}
      <div className="bg-page px-10 py-12">
        <div className="mx-auto max-w-[760px]">
          <span className="eyebrow">Light</span>
          <div className="mt-3">
            <Row />
          </div>
          {/* sizes + disabled on the light canvas */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary">Default</Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button variant="primary" size="icon" aria-label="Confirm">
              <Check className="size-4" strokeWidth={2.4} />
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
