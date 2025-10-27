'use client'

import Link from 'next/link'
import { Sparkles, Mail, FileText, Shield, Cookie, HelpCircle } from 'lucide-react'
import { VibePhotoLogo } from '@/components/ui/vibephoto-logo'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="mb-4">
              <VibePhotoLogo size="md" layout="horizontal" variant="monochrome" showText={true} />
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Transforme suas selfies em fotos profissionais com nossa tecnologia de IA avançada.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="w-4 h-4" />
              <a href="mailto:suporte@vibephoto.app" className="hover:text-purple-600 transition-colors">
                suporte@vibephoto.app
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 text-sm">Produto</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/models" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Modelos
                </Link>
              </li>
              <li>
                <Link href="/generate" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Gerar Fotos
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Galeria
                </Link>
              </li>
              <li>
                <Link href="/packages" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Pacotes
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 text-sm">Suporte</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link 
                  href="/legal/faq" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  FAQ
                </Link>
              </li>
              <li>
                <a href="mailto:suporte@vibephoto.app" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Entre em Contato
                </a>
              </li>
              <li>
                <Link href="/billing" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Minha Assinatura
                </Link>
              </li>
              <li>
                <Link href="mailto:dpo@vibephoto.com" className="text-gray-600 hover:text-purple-600 transition-colors">
                  Exercer Direitos LGPD
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 text-sm">Legal & Privacidade</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link 
                  href="/legal/terms" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/privacy" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link 
                  href="/legal/cookies" 
                  className="text-gray-600 hover:text-purple-600 transition-colors flex items-center gap-2"
                >
                  <Cookie className="w-4 h-4" />
                  Política de Cookies
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => {
                    // Trigger cookie preference modal
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('ensaio_fotos_consent')
                      window.location.reload()
                    }
                  }}
                  className="text-gray-600 hover:text-purple-600 transition-colors text-left"
                >
                  Gerenciar Cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500">
            © {currentYear} VibePhoto™. Todos os direitos reservados.
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              Conforme LGPD
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}