import { Library } from "@/components/bookmarks/library";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Library scope="archived" />;
}
