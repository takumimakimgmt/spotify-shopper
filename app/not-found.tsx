import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-white/70">
        The page or shared snapshot might have expired. Please go back and re-share.
      </p>
      <Link href="/"  className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
        Go Home
      </Link>
    </main>
  );
}
