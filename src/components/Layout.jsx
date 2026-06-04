import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-[#F6F3FA]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto" style={{ marginLeft: 240 }}>
        {children}
      </main>
    </div>
  )
}
