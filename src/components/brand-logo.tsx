import Image from "next/image";
import { brand } from "@/lib/branding";

export function BrandLogo({
  className,
  mark = false,
  priority = false,
}: {
  className?: string;
  mark?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src={mark ? "/merchantdesk-mark.png" : "/merchantdesk-logo.png"}
      alt={`${brand.productName} logo`}
      width={mark ? 640 : 1101}
      height={mark ? 640 : 499}
      priority={priority}
      className={className}
    />
  );
}
