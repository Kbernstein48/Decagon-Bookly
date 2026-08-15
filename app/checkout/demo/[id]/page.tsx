import { CheckoutExperience } from "@/components/CheckoutExperience";

export const dynamic = "force-dynamic";

export default async function DemoCheckout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutExperience checkoutId={id} />;
}
