import { redirect } from "next/navigation";

/** Product creation is inline (side panel) on /products — keep URL for old bookmarks. */
export default function NewProductPage() {
  redirect("/products");
}
