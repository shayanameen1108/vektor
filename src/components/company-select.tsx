import type { Company } from "@/lib/api-client";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CompanySelect({
  companies,
  value,
  onValueChange,
  label = "Company",
  testId = "select-company",
  className,
}: {
  companies: Company[];
  value: string;
  onValueChange: (id: string) => void;
  label?: string;
  testId?: string;
  className?: string;
}) {
  if (companies.length < 2) return null;

  return (
    <Field className={className ?? "mt-4 max-w-sm"}>
      <FieldLabel className="label-caps">{label}</FieldLabel>
      <Select
        items={companies.map((company) => ({ value: company.id, label: company.company_name }))}
        value={value}
        onValueChange={(next) => onValueChange(next as string)}
      >
        <SelectTrigger data-testid={testId} aria-label={label} className="mt-2 bg-card">
          <SelectValue placeholder="Select company" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.company_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
