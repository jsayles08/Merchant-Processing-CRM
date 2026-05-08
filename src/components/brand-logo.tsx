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
      width={mark ? 640 : 802}
      height={mark ? 640 : 444}
      priority={priority}
      className={className}
    />
  );
}
