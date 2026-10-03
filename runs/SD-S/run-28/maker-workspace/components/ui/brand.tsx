import Link from "next/link";
import { Bookmark } from "lucide-react";

export function Brand() {
  return <Link href="/bookmarks" className="brand"><span className="brand-mark"><Bookmark size={17} /></span>Lattice</Link>;
}
