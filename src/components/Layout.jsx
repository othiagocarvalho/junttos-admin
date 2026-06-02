import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F6F3FA]">
      <Sidebar />
      <main className="flex-1 ml-[240px] p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
