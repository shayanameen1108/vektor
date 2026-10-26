import { useNavigate } from "@tanstack/react-router";
import { Building2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function NoCompanyEmpty({ testId }: { testId: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Empty
        className="max-w-md border border-solid border-border bg-card p-8"
        data-testid={testId}
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Company Profile Found</EmptyTitle>
          <EmptyDescription>
            Create your company profile to start analyzing tenders and managing compliance
            documents.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            data-testid="create-company-btn"
            onClick={() => void navigate({ to: "/setup" })}
            size="lg"
          >
            Create Company Profile
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

export function NoCompanyPage({
  overline,
  title,
  titleTestId,
  description,
  testId,
}: {
  overline: string;
  title: string;
  titleTestId?: string;
  description?: ReactNode;
  testId: string;
}) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <PageHeader
        overline={overline}
        title={title}
        titleTestId={titleTestId}
        description={description}
      />
      <NoCompanyEmpty testId={testId} />
    </div>
  );
}
