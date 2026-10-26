import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/date";

// Compliance expiries are routinely years away or already past, so the picker
// navigates by month/year dropdown rather than arrow clicks.
const NAV_START = new Date(2000, 0, 1);
const NAV_END = new Date(2049, 11, 1);

function parseIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateField({
  id,
  value,
  onChange,
  testId,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  testId: string;
}) {
  const selected = parseIsoDate(value);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            data-testid={testId}
            data-empty={!selected}
            aria-haspopup="dialog"
            className="w-full justify-start font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        <CalendarIcon aria-hidden="true" />
        {selected ? formatDate(selected) : <span>Pick a date</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          captionLayout="dropdown"
          startMonth={NAV_START}
          endMonth={NAV_END}
          onSelect={(date) => onChange(date ? toIsoDate(date) : "")}
        />
      </PopoverContent>
    </Popover>
  );
}
