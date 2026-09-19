import type { ReactNode } from "react";

import { joinClassNames } from "@/shared/ui/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className={joinClassNames("segmented-control", className)}>
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => (
        <button
          className="segmented-control__item"
          data-active={option.value === value ? "true" : "false"}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
          aria-pressed={option.value === value}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
