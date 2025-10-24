import { revalidateTag } from 'next/cache'

/**
 * Utilitários para gerenciamento de cache da galeria
 *
 * Cache Strategy:
 * - Dados da galeria: 30 segundos (alta frequência de mudanças)
 * - Modelos do usuário: 5 minutos (mudam raramente)
 * - Stats globais: 1 minuto
 *
 * Tags usadas:
 * - `user-${userId}-gallery`: Todos os dados de galeria do usuário
 * - `user-${userId}-models`: Modelos do usuário
 * - `gallery-${tab}`: Dados específicos de uma aba
 * - `gallery-stats`: Estatísticas globais
 */

/**
 * Invalida o cache da galeria de um usuário
 * Usar após criar/editar/deletar gerações, vídeos ou fotos editadas
 */
export function revalidateUserGallery(userId: string) {
  console.log(`♻️ Revalidating gallery cache for user: ${userId}`)

  try {
    // Invalidar todos os dados de galeria do usuário
    revalidateTag(`user-${userId}-gallery`)

    // Invalidar stats globais também
    revalidateTag('gallery-stats')

    return { success: true }
  } catch (error) {
    console.error('❌ Error revalidating gallery cache:', error)
    return { success: false, error }
  }
}

/**
 * Invalida o cache de uma aba específica
 */
export function revalidateGalleryTab(userId: string, tab: 'generated' | 'edited' | 'videos' | 'packages') {
  console.log(`♻️ Revalidating gallery tab [${tab}] cache for user: ${userId}`)

  try {
    revalidateTag(`gallery-${tab}`)
    revalidateTag(`user-${userId}-gallery`)

    return { success: true }
  } catch (error) {
    console.error('❌ Error revalidating gallery tab cache:', error)
    return { success: false, error }
  }
}

/**
 * Invalida o cache de modelos do usuário
 * Usar após criar/treinar novo modelo
 */
export function revalidateUserModels(userId: string) {
  console.log(`♻️ Revalidating models cache for user: ${userId}`)

  try {
    revalidateTag(`user-${userId}-models`)

    return { success: true }
  } catch (error) {
    console.error('❌ Error revalidating models cache:', error)
    return { success: false, error }
  }
}

/**
 * Invalida todos os caches de um usuário
 * Usar em casos extremos ou logout
 */
export function revalidateAllUserData(userId: string) {
  console.log(`♻️ Revalidating ALL cache for user: ${userId}`)

  try {
    revalidateTag(`user-${userId}-gallery`)
    revalidateTag(`user-${userId}-models`)
    revalidateTag('gallery-stats')

    return { success: true }
  } catch (error) {
    console.error('❌ Error revalidating all user cache:', error)
    return { success: false, error }
  }
}
