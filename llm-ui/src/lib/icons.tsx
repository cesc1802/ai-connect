import {
  Bot, Briefcase, Bug, Building, ChartLine, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, CircleCheck, Code, Copy, Cpu, CreditCard, Crown, GitBranch, Globe, Grid3x3, HardDrive,
  Hash, History, Info, KeyRound, Layers, LayoutDashboard, Link, LogOut, Mail, MessageSquare,
  Moon, Paperclip, PanelLeftClose, PanelLeftOpen, Plus, ScrollText, Search, Send, Settings,
  ShieldCheck, SlidersHorizontal, Sparkles, SquarePen, Sun, Trash2, User, UserCog, UserPlus,
  Users, Wrench, X, Zap, Package,
  type LucideIcon,
} from "lucide-react";

const REGISTRY: Record<string, LucideIcon> = {
  bot: Bot,
  briefcase: Briefcase,
  bug: Bug,
  building: Building,
  "chart-line": ChartLine,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  code: Code,
  copy: Copy,
  cpu: Cpu,
  "credit-card": CreditCard,
  crown: Crown,
  "git-branch": GitBranch,
  globe: Globe,
  "grid-3x3": Grid3x3,
  "hard-drive": HardDrive,
  hash: Hash,
  history: History,
  info: Info,
  "key-round": KeyRound,
  layers: Layers,
  "layout-dashboard": LayoutDashboard,
  link: Link,
  "log-out": LogOut,
  mail: Mail,
  "message-square": MessageSquare,
  moon: Moon,
  paperclip: Paperclip,
  "panel-left-close": PanelLeftClose,
  "panel-left-open": PanelLeftOpen,
  plus: Plus,
  "scroll-text": ScrollText,
  search: Search,
  send: Send,
  settings: Settings,
  "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal,
  sparkles: Sparkles,
  "square-pen": SquarePen,
  sun: Sun,
  "trash-2": Trash2,
  user: User,
  "user-cog": UserCog,
  "user-plus": UserPlus,
  users: Users,
  wrench: Wrench,
  x: X,
  zap: Zap,
  package: Package,
};

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Icon({ name, size, className }: IconProps) {
  const C = REGISTRY[name] ?? Package;
  return <C size={size} className={className} aria-hidden="true" />;
}
