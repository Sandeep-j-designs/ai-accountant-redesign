import { useEffect, useState, type ReactNode } from "react"
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
  PanelLeftClose,
  PanelLeftOpen,
  Boxes,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { companyById } from "@/data/companies"
import { useBill, type Screen } from "@/state/store"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import brandMark from "@/assets/brand/ai-accountant-mark.png"

type Leaf = {
  key: string
  icon: ReactNode
  label: string
  tag?: string
  /** the screen this leaf routes to — leaves without one are placeholders */
  nav?: Screen
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
      { key: "bills", icon: <ReceiptText />, label: "Bills", nav: "bills" },
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
      { key: "coa", icon: <LayoutList />, label: "Chart of Accounts", nav: "coa" },
      { key: "journals", icon: <ScrollText />, label: "Journals" },
      { key: "reports", icon: <BarChart3 />, label: "Reports" },
    ],
  },
  {
    kind: "group",
    key: "inventory",
    icon: <Boxes />,
    label: "Inventory",
    children: [
      { key: "stock", icon: <Package />, label: "Stock items", nav: "inventory" },
      { key: "godowns", icon: <Package />, label: "Godowns" },
      { key: "stock-journals", icon: <ScrollText />, label: "Stock journals" },
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

const COLLAPSE_KEY = "aia:sidebar-collapsed"

export function Sidebar() {
  const { state, dispatch } = useBill()
  // which leaf is lit — the bill flow screens all live under Bills
  const activeLeaf = ["bills", "entry", "read", "cockpit", "billDetail"].includes(state.screen)
    ? "bills"
    : state.screen === "coa"
      ? "coa"
      : state.screen === "inventory"
        ? "stock"
        : null
  const activeGroup = NAV.find((n) => n.kind === "group" && n.children.some((c) => c.key === activeLeaf))?.key
  // only the group holding the current route is open by default (persist in local state)
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeGroup ? { [activeGroup]: true } : {}))
  // routing into a group from elsewhere (palette, deep link) opens it too
  useEffect(() => {
    if (activeGroup) setOpen((o) => (o[activeGroup] ? o : { ...o, [activeGroup]: true }))
  }, [activeGroup])
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const go = (screen: Screen) => dispatch({ type: "SHOW", screen })

  // collapsed → a 64px icon-only rail; persisted across reloads
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== "undefined" && (localStorage.getItem(COLLAPSE_KEY) === "1" || window.matchMedia("(max-width: 1050px)").matches),
  )
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  // collapsed group icon → expand the rail and open that group so children show
  const expandInto = (key: string) => {
    setCollapsed(false)
    setOpen((o) => ({ ...o, [key]: true }))
  }

  return (
    <aside
      className={cn(
        "workbench-sidebar flex h-full flex-none flex-col border-r border-line bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px]" : "w-[216px]",
      )}
    >
      {/* brand head — mark glides to center as the wordmark collapses in sync with the rail */}
      <div className="flex h-14 flex-none items-center justify-center border-b border-line px-4">
        <div
          className={cn(
            "flex items-center overflow-hidden transition-[gap] duration-200 ease-out",
            collapsed ? "gap-0" : "gap-2.5",
          )}
        >
          <img
            src={brandMark}
            alt="AI Accountant"
            className="h-9 w-auto flex-none object-contain dark:brightness-0 dark:invert"
          />
          <span
            aria-hidden={collapsed}
            className={cn(
              "font-display text-[19px] font-bold tracking-[-0.01em] whitespace-nowrap text-ink",
              "transition-[max-width,opacity,transform] duration-200 ease-out",
              collapsed
                ? "max-w-0 -translate-x-1 opacity-0"
                : "max-w-[180px] translate-x-0 opacity-100",
            )}
          >
            AI Accountant
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-4">
        <nav className="flex flex-col gap-1">
          {NAV.map((node) => (
            <div key={node.key}>
              {node.kind === "item" ? (
                <LeafRow icon={node.icon} label={node.label} collapsed={collapsed} />
              ) : (
                <Group
                  node={node}
                  collapsed={collapsed}
                  open={!!open[node.key]}
                  onToggle={() => toggle(node.key)}
                  onExpandInto={() => expandInto(node.key)}
                  activeChild={node.key === activeGroup ? activeLeaf : null}
                  onNav={go}
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {!collapsed && <div className="sidebar-workspace"><span className="sidebar-workspace-mark">{companyById(state.activeCompanyId).short}</span><div><b>{companyById(state.activeCompanyId).name}</b><span>Accounts workspace</span></div></div>}
      {/* collapse / expand toggle — pinned to the bottom of the rail */}
      <div
        className={cn(
          "flex flex-none items-center border-t border-line py-3",
          collapsed ? "justify-center px-0" : "justify-end px-4",
        )}
      >
        <RowTip collapsed={collapsed} label="Expand sidebar">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-7 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-[rgba(21,26,38,0.05)] hover:text-body"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        </RowTip>
      </div>
    </aside>
  )
}

/** Wraps a row in a right-side tooltip while the rail is collapsed. */
function RowTip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean
  label: ReactNode
  children: ReactNode
}) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function Group({
  node,
  collapsed,
  open,
  onToggle,
  onExpandInto,
  activeChild,
  onNav,
}: {
  node: Extract<Node, { kind: "group" }>
  collapsed: boolean
  open: boolean
  onToggle: () => void
  onExpandInto: () => void
  activeChild: string | null
  onNav: (screen: Screen) => void
}) {
  // collapsed: a single icon; clicking expands the rail and opens this group
  if (collapsed) {
    return (
      <RowTip collapsed label={node.label}>
        <button
          onClick={onExpandInto}
          aria-label={node.label}
          className="group relative flex h-10 w-full items-center justify-center transition-colors duration-150 hover:bg-[rgba(21,26,38,0.05)]"
        >
          <span className="relative flex-none text-faint transition-colors group-hover:text-body [&>svg]:size-[20px] [&>svg]:stroke-[1.75]">
            {node.icon}
          </span>
        </button>
      </RowTip>
    )
  }

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="group relative flex h-10 w-full items-center gap-3 pl-4 pr-3 text-[14px] font-normal text-body transition-colors duration-150 hover:bg-[rgba(21,26,38,0.05)] hover:text-ink"
      >
        <span className="flex-none text-faint transition-colors group-hover:text-body [&>svg]:size-[20px] [&>svg]:stroke-[1.75]">
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
            {/* guide rail — descends from the group icon through the nested segment */}
            <span aria-hidden className="absolute left-[25px] top-1 bottom-2 w-px bg-line" />
            <div className="flex flex-col gap-0.5">
              {node.children.map((c) => (
                <ChildRow
                  key={c.key}
                  child={c}
                  active={activeChild === c.key}
                  onSelect={c.nav ? () => onNav(c.nav!) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Nested sub-item — TEXT-ONLY: the group icon + indent guide already carry
 *  the hierarchy, so children drop their icons and any counts/badges. The
 *  active row's segment of the guide lights up in brand-vivid. */
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative ml-[36px] mr-2 flex h-8 items-center rounded-md border px-3 text-[13px] transition-colors duration-[120ms]",
        active
          ? "border-transparent bg-brand-tint font-semibold text-brand"
          : "border-transparent font-medium text-body hover:bg-[rgba(21,26,38,0.05)] hover:text-ink",
      )}
    >
      {/* active highlight — lights this item's segment of the guide rail */}
      {active && (
        <span
          aria-hidden
          className="absolute left-[-12px] inset-y-1.5 w-[3px] rounded-full bg-brand"
        />
      )}
      <span className="flex-1 truncate text-left">{child.label}</span>
      {child.tag && (
        <span className="flex-none rounded-md border border-line px-1.5 py-px text-[11px] font-semibold uppercase tracking-[0.03em] text-faint">
          {child.tag}
        </span>
      )}
    </button>
  )
}

function LeafRow({
  icon,
  label,
  active = false,
  collapsed,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  collapsed: boolean
}) {
  const btn = (
    <button
      className={cn(
        "group relative flex h-[34px] w-full items-center text-[13px] transition-colors duration-150",
        collapsed ? "justify-center" : "gap-3 pl-4 pr-3",
        active
          ? "bg-brand-tint font-semibold text-brand"
          : "font-medium text-body hover:bg-[rgba(21,26,38,0.05)] hover:text-ink",
      )}
    >
      {/* active top-level item → 3px brand rail flush to the sidebar's left edge */}
      {active && <span className="absolute left-0 top-0 h-full w-[3px] bg-brand" />}
      <span
        className={cn(
          "flex-none [&>svg]:size-[20px]",
          active
            ? "text-brand [&>svg]:stroke-[2.25]"
            : "text-faint [&>svg]:stroke-[1.75] group-hover:text-body",
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
    </button>
  )
  return (
    <RowTip collapsed={collapsed} label={label}>
      {btn}
    </RowTip>
  )
}
