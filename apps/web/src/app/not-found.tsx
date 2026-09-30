import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <p className="eyebrow">404 / Not found</p>
      <h1>This route does not exist.</h1>
      <Link href="/">Return to Relay</Link>
    </main>
  );
}
