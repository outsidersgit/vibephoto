'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, AlertCircle, Send, Loader2, Paperclip, X } from 'lucide-react'
import { WhatsAppFloatingButton } from '@/components/ui/whatsapp-button'
import { WHATSAPP_CONFIG } from '@/lib/config/whatsapp'

export default function SupportPage() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const [formData, setFormData] = useState({
    account: '',
    email: '',
    subject: '',
    problemType: '',
    description: ''
  })
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      const formDataToSend = new FormData()

      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value) { // Only append non-empty values
          formDataToSend.append(key, value)
        }
      })
      
      // If user is authenticated, ensure email is sent even if not in formData
      if (session?.user?.email && !formData.email) {
        formDataToSend.append('email', session.user.email)
      }

      // Add files
      attachedFiles.forEach((file) => {
        formDataToSend.append('attachments', file)
      })

      const response = await fetch('/api/support/contact', {
        method: 'POST',
        body: formDataToSend,
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        // Reset form
        setFormData({
          account: session?.user?.name || session?.user?.email || '',
          email: session?.user?.email || '',
          subject: '',
          problemType: '',
          description: ''
        })
        setAttachedFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setSubmitStatus('error')
        setErrorMessage(result.error || 'Erro ao enviar mensagem')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setSubmitStatus('error')
      setErrorMessage('Erro de conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (submitStatus !== 'idle') {
      setSubmitStatus('idle')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert(`O arquivo ${file.name} é muito grande. Tamanho máximo: 10MB`)
        return false
      }
      return true
    })

    setAttachedFiles(prev => [...prev, ...validFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Preencher dados do formulário com informações da sessão se disponível
  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        account: session.user.name || session.user.email || '',
        email: session.user.email || ''
      }))
    }
  }, [session])

  // Mostrar loading apenas enquanto verifica sessão (opcional)
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Suporte
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="shadow-lg bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center text-xl text-white">
              Como podemos ajudar?
            </CardTitle>
            <p className="text-center text-sm text-slate-300 mt-2">
              Preencha o formulário para criar um tíquete de suporte. Responderemos por e-mail o mais breve possível.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Conta */}
              <div className="space-y-2">
                <Label htmlFor="account" className="text-sm font-medium text-white">
                  Nome {!session?.user && <span className="text-red-400">*</span>}
                </Label>
                {session?.user ? (
                  <Input
                    id="account"
                    value={formData.account || session.user.name || session.user.email || ''}
                    onChange={(e) => handleInputChange('account', e.target.value)}
                    placeholder="Seu nome"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                ) : (
                  <Input
                    id="account"
                    value={formData.account}
                    onChange={(e) => handleInputChange('account', e.target.value)}
                    placeholder="Seu nome"
                    required
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  />
                )}
              </div>

              {/* Endereço de e-mail */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white">
                  Endereço de e-mail {!session?.user && <span className="text-red-400">*</span>}
                </Label>
                {session?.user ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || session.user.email || ''}
                    disabled
                    className="bg-slate-700 border-slate-600 text-slate-400"
                  />
                ) : (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    required
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  />
                )}
              </div>

              {/* Assunto */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium text-white">
                  Assunto
                </Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="Descreva brevemente seu problema, pergunta ou feedback (máx. 75 caracteres)."
                  maxLength={75}
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* Com quais problemas você está tendo */}
              <div className="space-y-2">
                <Label htmlFor="problemType" className="text-sm font-medium text-white">
                  Com quais problemas você está tendo?
                </Label>
                <Select
                  value={formData.problemType}
                  onValueChange={(value) => handleInputChange('problemType', value)}
                >
                  <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="login" className="text-white hover:bg-slate-600">Problemas de login</SelectItem>
                    <SelectItem value="billing" className="text-white hover:bg-slate-600">Faturamento e pagamentos</SelectItem>
                    <SelectItem value="ai-generation" className="text-white hover:bg-slate-600">Geração de imagens IA</SelectItem>
                    <SelectItem value="model-training" className="text-white hover:bg-slate-600">Treinamento de modelos</SelectItem>
                    <SelectItem value="gallery" className="text-white hover:bg-slate-600">Galeria e imagens</SelectItem>
                    <SelectItem value="account" className="text-white hover:bg-slate-600">Configurações da conta</SelectItem>
                    <SelectItem value="performance" className="text-white hover:bg-slate-600">Performance da plataforma</SelectItem>
                    <SelectItem value="bug" className="text-white hover:bg-slate-600">Reportar bug</SelectItem>
                    <SelectItem value="feature" className="text-white hover:bg-slate-600">Sugestão de funcionalidade</SelectItem>
                    <SelectItem value="other" className="text-white hover:bg-slate-600">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Como podemos ajudar */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-white">
                  Como podemos ajudar?
                </Label>
                <Textarea
                  id="description"
                  placeholder="Descreva seu problema, pergunta ou feedback em detalhes (mín. 20 caracteres)"
                  rows={6}
                  className="resize-none bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                  minLength={20}
                />
              </div>

              {/* Anexar arquivos */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">
                  Anexar arquivos (opcional)
                </Label>
                <div className="space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Selecionar arquivos
                    </Button>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        {attachedFiles.length} arquivo(s) selecionado(s) (máx. 10MB cada)
                      </p>
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-slate-700 p-2 rounded border border-slate-600">
                          <div className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-white truncate">{file.name}</span>
                            <span className="text-xs text-slate-500">({formatFileSize(file.size)})</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-slate-400 hover:text-red-400 h-6 w-6 p-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="flex items-center space-x-2 text-green-400 bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Mensagem enviada com sucesso! Responderemos em breve.</span>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-500/30 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a67d8] hover:to-[#6c63ff] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Floating Button - Direct support contact */}
      <WhatsAppFloatingButton message={WHATSAPP_CONFIG.messages.support} />
    </div>
    </>
  )
}