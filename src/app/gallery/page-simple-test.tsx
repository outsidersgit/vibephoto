import { requireAuth } from '@/lib/auth'

export default async function GalleryPage() {
  const session = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-4">Galeria (Modo Simplificado)</h1>
      <p>Usuário: {session.user.email}</p>
      <p>Esta é uma versão simplificada para testar se o problema está na query do banco.</p>

      <div className="mt-8">
        <a href="/generate" className="bg-purple-600 text-white px-6 py-2 rounded">
          Gerar Nova Foto
        </a>
      </div>
    </div>
  )
}