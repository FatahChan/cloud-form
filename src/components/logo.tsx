import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import cloudFormLogoUrl from "./cloud-form-logo.svg?url";

export { cloudFormLogoUrl };

type Props = {
  className?: string;
  title?: string;
};

/** Uses src/components/cloud-form-logo.svg — edit that file, nowhere else. */
export function CloudFormLogo({ className, title = "Cloud Form" }: Props) {
  return (
    <img
      src={cloudFormLogoUrl}
      alt={title}
      className={cn("block size-8 shrink-0 object-contain dark:invert", className)}
    />
  );
}

export function CloudFormLogoLink({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 leading-none", className)}>
      <CloudFormLogo />
      {children ?? <span className="font-heading text-sm font-medium tracking-tight">Cloud Form</span>}
    </span>
  );
}
