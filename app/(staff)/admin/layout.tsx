import { StaffArea } from "@/components/staff-area";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <StaffArea allow={["admin"]}>{children}</StaffArea>;
}
