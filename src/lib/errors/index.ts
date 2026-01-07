/**
 * Error Handling System - Export centralizado
 *
 * USO RECOMENDADO:
 *
 * ```typescript
 * import { notifyError, notifySuccess } from '@/lib/errors'
 *
 * try {
 *   await someApiCall()
 *   notifySuccess('Sucesso!', 'Operação concluída')
 * } catch (error) {
 *   notifyError(error, 'API_CALL') // ← Nunca mais toast(error.message)
 * }
 * ```
 */

export { translateError, type TranslatedError, type ErrorSeverity } from './translator'
export {
  notifyError,
  notifySuccess,
  notifyWarning,
  notifyInfo,
  configureErrorNotifications
} from './notify'
