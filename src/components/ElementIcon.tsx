import { iconUrl } from "@/lib/config";

export default function ElementIcon({ icon, className }: { icon: string; className?: string }) {
  if (!icon) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`el-icon ${className ?? ""}`} src={iconUrl(icon)} alt="" draggable={false} />;
}
