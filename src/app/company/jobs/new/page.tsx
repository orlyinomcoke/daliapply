import { requireRole } from "@/lib/session";
import { CompanyNav } from "@/components/Nav";
import { JobForm } from "../JobForm";

export default async function NewJob() {
  await requireRole("company");
  return (
    <div className="space-y-6">
      <CompanyNav />
      <JobForm />
    </div>
  );
}
