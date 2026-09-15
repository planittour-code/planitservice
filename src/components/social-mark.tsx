import {
  Facebook,
  Globe,
  Home,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";
import type { SocialKey } from "@/lib/housefile/profile";

const ICONS: Record<SocialKey, typeof Globe> = {
  website: Globe,
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  linkedin: Linkedin,
  nextdoor: Home,
  youtube: Youtube,
};

export function SocialMark({ kind, className = "size-4" }: { kind: SocialKey; className?: string }) {
  const Icon = ICONS[kind] ?? Globe;
  return <Icon className={className} aria-hidden />;
}
