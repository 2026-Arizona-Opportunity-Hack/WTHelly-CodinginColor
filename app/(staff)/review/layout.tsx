import { StaffArea } from "@/components/staff-area";

export default function ReviewLayout({ children }: LayoutProps<"/review">) {
  return <StaffArea allow={["reviewer", "admin"]}>{children}</StaffArea>;
}
