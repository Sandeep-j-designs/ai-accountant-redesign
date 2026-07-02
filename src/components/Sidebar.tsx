import { useState, type ReactNode } from "react"
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Truck,
  CreditCard,
  Coins,
  FileText,
  Users,
  BookOpen,
  LayoutList,
  ScrollText,
  BarChart3,
  ShieldCheck,
  Percent,
  FileCheck,
  Landmark,
  ChevronRight,
  Settings,
  Sun,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useBill } from "@/state/store"
import { useTheme } from "@/hooks/useTheme"
import { BrandMark } from "@/components/icons"
import { CURRENT_USER } from "@/data/invoice"

type Leaf = {
  key: string
  icon: ReactNode
  label: string
  badge?: string
  tag?: string
  signal?: boolean
  nav?: boolean
}
type Node =
  | { kind: "item"; key: string; icon: ReactNode; label: string }
  | { kind: "group"; key: string; icon: ReactNode; label: string; children: Leaf[] }

const NAV: Node[] = [
  { kind: "item", key: "dashboard", icon: <LayoutDashboard />, label: "Dashboard" },
  {
    kind: "group",
    key: "payables",
    icon: <Wallet />,
    label: "Payables",
    children: [
      { key: "bills", icon: <ReceiptText />, label: "Bills", badge: "1", signal: true, nav: true },
      { key: "vendors", icon: <Truck />, label: "Vendors" },
      { key: "payments", icon: <CreditCard />, label: "Payments" },
    ],
  },
  {
    kind: "group",
    key: "receivables",
    icon: <Coins />,
    label: "Receivables",
    children: [
      { key: "invoices", icon: <FileText />, label: "Invoices" },
      { key: "customers", icon: <Users />, label: "Customers" },
    ],
  },
  {
    kind: "group",
    key: "accounting",
    icon: <BookOpen />,
    label: "Accounting",
    children: [
      { key: "coa", icon: <LayoutList />, label: "Chart of Accounts" },
      { key: "journals", icon: <ScrollText />, label: "Journals" },
      { key: "reports", icon: <BarChart3 />, label: "Reports" },
    ],
  },
  {
    kind: "group",
    key: "compliance",
    icon: <ShieldCheck />,
    label: "Compliance",
    children: [
      { key: "gst", icon: <Percent />, label: "GST Returns", tag: "GSTR-2B" },
      { key: "einv", icon: <FileCheck />, label: "e-Invoicing" },
    ],
  },
  { kind: "item", key: "banking", icon: <Landmark />, label: "Banking" },
]

export function Sidebar() {
  const { state, dispatch } = useBill()
  const billsActive = ["bills", "entry", "read", "cockpit"].includes(state.screen)
  // only the group holding the current route is open by default (persist in local state)
  const [open, setOpen] = useState<Record<string, boolean>>({ payables: true })
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const goBills = () => dispatch({ type: "SHOW", screen: "bills" })

  const initials = CURRENT_USER.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="flex h-full w-[240px] flex-none flex-col border-r border-line bg-page">
      {/* brand head — accent tile + workspace, 1px bottom rule */}
      <div className="flex h-14 flex-none items-center gap-2.5 border-b border-line px-4">
        <span className="grid size-7 flex-none place-items-center rounded-md bg-accent-sig text-white">
          <BrandMark size={15} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13.5px] font-semibold text-ink">AiA · Acme</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
            Payables
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pt-4">
        {/* uniform spacing — all top-level rows sit the same distance apart, no
            section breaks. Every row is h-10, so a single flex gap spaces them
            evenly (Dashboard through Banking). */}
        <nav className="flex flex-col gap-1">
          {NAV.map((node) => (
            <div key={node.key}>
              {node.kind === "item" ? (
                <LeafRow icon={node.icon} label={node.label} />
              ) : (
                <Group
                  node={node}
                  open={!!open[node.key]}
                  onToggle={() => toggle(node.key)}
                  activeChild={node.key === "payables" && billsActive ? "bills" : null}
                  onNav={goBills}
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* bottom block — 20px gutter, 12px gap between Settings and the user card */}
      <div className="flex-none pb-5 pt-2">
        <ThemeToggleRow />
        <LeafRow icon={<Settings />} label="Settings" />
        <div className="mt-3 flex items-center gap-3 px-5 py-1.5">
          <span className="grid size-8 flex-none place-items-center rounded-lg bg-panel-2 text-[11px] font-medium text-muted-ink">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-medium text-ink">{CURRENT_USER.name}</span>
            <span className="block truncate text-[12px] text-faint">{CURRENT_USER.role}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}

function Group({
  node,
  open,
  onToggle,
  activeChild,
  onNav,
}: {
  node: Extract<Node, { kind: "group" }>
  open: boolean
  onToggle: () => void
  activeChild: string | null
  onNav: () => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="group relative flex h-10 w-full items-center gap-3 pl-5 pr-4 text-[14px] font-normal text-body transition-colors duration-150 hover:bg-panel"
      >
        <span className="flex-none text-faint transition-colors group-hover:text-body [&>svg]:size-[18px] [&>svg]:stroke-[1.75]">
          {node.icon}
        </span>
        <span className="flex-1 text-left">{node.label}</span>
        <ChevronRight
          className={cn("size-3.5 flex-none text-faint transition-transform duration-200", open && "rotate-90")}
          strokeWidth={1.75}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="relative pb-1 pt-1">
            {/* mercury guide rail — a 1px hairline descending through the nested
                segment, sitting in the gutter to the left of the item pills */}
            <span aria-hidden className="absolute left-[22px] top-1 bottom-3 w-px bg-line" />
            <div className="flex flex-col gap-0.5">
              {node.children.map((c) => (
                <ChildRow
                  key={c.key}
                  child={c}
                  active={activeChild === c.key}
                  onSelect={c.nav ? onNav : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChildRow({
  child,
  active,
  onSelect,
}: {
  child: Leaf
  active: boolean
  onSelect?: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative ml-[32px] mr-2 flex h-9 items-center gap-3 rounded-md pl-3 pr-3 text-[13.5px] transition-colors duration-150",
        active
          ? "bg-accent-subtle font-medium text-accent-sig-ink"
          : "font-normal text-body hover:bg-panel",
      )}
    >
      {/* mercury highlight — lights only this item's segment of the guide rail */}
      {active && (
        <span
          aria-hidden
          className="absolute left-[-10px] inset-y-1 w-[2px] rounded-full bg-accent-sig"
        />
      )}
      <span
        className={cn(
          "flex-none [&>svg]:size-[16px] [&>svg]:stroke-[1.75]",
          active ? "text-accent-sig" : "text-faint group-hover:text-body",
        )}
      >
        {child.icon}
      </span>
      <span className="flex-1 truncate text-left">{child.label}</span>
      {child.tag && (
        <span className="flex-none rounded-md border border-line px-1.5 py-px font-mono text-[9.5px] text-faint">
          {child.tag}
        </span>
      )}
      {child.badge && (
        <span
          className={cn(
            "flex-none rounded-md px-1.5 py-px font-mono text-[10.5px] font-medium tabular-nums",
            active ? "bg-accent-sig text-white" : "bg-accent-subtle text-accent-sig-ink",
          )}
        >
          {child.badge}
        </span>
      )}
    </button>
  )
}

/** Appearance / theme control — lives with Settings in the sidebar footer. */
function ThemeToggleRow() {
  const { theme, toggle } = useTheme()
  const dark = theme === "dark"
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      className="group relative flex h-10 w-full items-center gap-3 pl-5 pr-4 text-[14px] font-normal text-body transition-colors duration-150 hover:bg-panel"
    >
      <span className="flex-none text-faint transition-colors group-hover:text-body [&>svg]:size-[18px] [&>svg]:stroke-[1.75]">
        {dark ? <Moon /> : <Sun />}
      </span>
      <span className="flex-1 text-left">Appearance</span>
      <span className="flex-none rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium capitalize text-faint">
        {theme}
      </span>
    </button>
  )
}

function LeafRow({
  icon,
  label,
  active = false,
}: {
  icon: ReactNode
  label: string
  active?: boolean
}) {
  return (
    <button
      className={cn(
        "group relative flex h-10 w-full items-center gap-3 pl-5 pr-4 text-[14px] transition-colors duration-150",
        active ? "font-medium text-ink" : "font-normal text-body hover:bg-panel",
      )}
    >
      {/* active top-level item → 2px accent bar flush to the sidebar's left edge */}
      {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-accent-sig" />}
      <span
        className={cn(
          "flex-none [&>svg]:size-[18px] [&>svg]:stroke-[1.75]",
          active ? "text-ink" : "text-faint group-hover:text-body",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}
