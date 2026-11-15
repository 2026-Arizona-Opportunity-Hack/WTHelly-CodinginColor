import { StaffArea } from "@/components/staff-area";

export default function InstructorLayout({ children }: LayoutProps<"/instructor">) {
  return <StaffArea allow={["instructor", "admin"]}>{children}</StaffArea>;
}
