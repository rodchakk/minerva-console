export default function EntryObservabilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7">
      <main className="min-w-0">{children}</main>
    </div>
  );
}
