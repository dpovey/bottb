export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication is handled by middleware
  // No need to check auth here to avoid redirect loops
  return <>{children}</>
}
