import { HomePage } from "@/components/pages/home";

// The status board probes every demo when the page renders: regenerate
// every 10 minutes so its numbers are never older than that.
export const revalidate = 600;

export default function Home() {
  return <HomePage locale="pt" />;
}
