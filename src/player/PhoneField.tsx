import { isSupportedCountry, type CountryCode } from "libphonenumber-js";
import { PhoneInput } from "@/components/reui/phone-input";

function localeCountry(): CountryCode {
  const region = typeof navigator === "undefined" ? undefined : navigator.language.split("-")[1]?.toUpperCase();
  return region && isSupportedCountry(region) ? region : "US";
}

export function PhoneField(props: {
  value: unknown;
  onChange: (v: string) => void;
  title: string;
  placeholder?: string;
}) {
  return (
    <PhoneInput
      value={typeof props.value === "string" ? props.value : ""}
      onChange={(v) => props.onChange(v ?? "")}
      defaultCountry={localeCountry()}
      placeholder={props.placeholder}
      aria-label={props.title}
      autoFocus
      className="w-full min-w-0 [&_button]:h-11 [&_input]:h-11 [&_input]:text-base"
    />
  );
}
