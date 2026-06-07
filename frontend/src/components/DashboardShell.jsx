import TopNavbar from './TopNavbar.jsx'

// Shared chrome for all /dashboard/* pages: sticky navbar + centered content.
function DashboardShell({ userEmail, children }) {
  return (
    <div className="min-h-screen bg-bg">
      <TopNavbar userEmail={userEmail} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

export default DashboardShell
