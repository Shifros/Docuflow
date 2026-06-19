import { VendorsPageClient } from "@/app/dashboard/vendors/vendors-client";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string }>;
}) {
  const { vendor } = await searchParams;

  return <VendorsPageClient initialVendor={vendor} />;
}
