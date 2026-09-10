import { redirect } from "next/navigation";

/** Old decoration-methods catalog replaced by screen-print pricing. */
export default function ApplicationsSettingsPage() {
  redirect("/settings/screen-print");
}
