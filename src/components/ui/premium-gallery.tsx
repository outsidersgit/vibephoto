'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, Sparkles, X, ArrowRight } from 'lucide-react'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import Link from 'next/link'

interface PremiumGalleryProps {
  images: { src: string; alt: string; category?: string }[]
  onImageClick?: (image: { src: string; alt: string }) => void
}

export function PremiumGallery({ images, onImageClick }: PremiumGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null)

  const handleImageClick = (image: { src: string; alt: string }) => {
    setSelectedImage(image)
    if (onImageClick) {
      onImageClick(image)
    }
  }

  return (
    <>
      <section className="py-24 px-4 bg-gradient-to-br from-slate-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Galeria de Resultados Reais
            </div>
            
            <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
              Veja a <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Magia Acontecer</span>
            </h2>
            
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-4">
              Fotos profissionais criadas por nossa IA - estas são pessoas reais usando o VibePhoto
            </p>
            
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Cada foto foi gerada a partir de selfies simples, transformadas em imagens profissionais
            </p>
          </motion.div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-16">
            {images.map((image, index) => (
              <motion.div
                key={index}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transition-all duration-500"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => handleImageClick(image)}
              >
                <div className="relative overflow-hidden rounded-2xl">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-64 object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.parentElement!.parentElement!.style.display = 'none'
                    }}
                  />
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  
                  {/* Hover effects */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <motion.div
                      className="bg-white/20 backdrop-blur-sm rounded-full p-3 border border-white/30"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ZoomIn className="w-6 h-6 text-white drop-shadow-lg" />
                    </motion.div>
                  </div>

                  {/* AI Badge */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <motion.div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg backdrop-blur-sm"
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Sparkles className="w-3 h-3" />
                      IA
                    </motion.div>
                  </div>

                  {/* Bottom label */}
                  <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full text-center">
                      ✨ Gerado por IA
                    </div>
                  </div>
                </div>

                {/* Shine effect */}
                <div className="absolute inset-0 -top-2 -bottom-2 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transform -skew-x-12 group-hover:animate-shine transition-opacity duration-700" />
              </motion.div>
            ))}
          </div>

          {/* Call to Action */}
          <motion.div
            className="relative max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 rounded-3xl p-12 text-white overflow-hidden">
              {/* Background effects */}
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10" />
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent" />
              
              {/* Floating elements */}
              <motion.div
                className="absolute top-6 right-6 w-20 h-20 rounded-full bg-white/10"
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ duration: 10, repeat: Infinity }}
              />
              
              <motion.div
                className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-pink-400/20"
                animate={{ rotate: -360, y: [-10, 10, -10] }}
                transition={{ duration: 8, repeat: Infinity }}
              />

              <div className="relative z-10 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="w-20 h-20 mx-auto mb-6 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                
                <h3 className="text-3xl md:text-4xl font-bold mb-4">
                  Pronto para Criar Suas Próprias Fotos?
                </h3>
                
                <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                  Junte-se a milhares de pessoas que já transformaram suas selfies em fotos profissionais
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/auth/signup">
                    <ShimmerButton
                      className="px-8 py-4 text-lg font-semibold"
                      background="linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)"
                      shimmerColor="rgba(255,255,255,0.6)"
                    >
                      Começar Agora
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </ShimmerButton>
                  </Link>
                  
                  <motion.button
                    className="px-8 py-4 text-lg font-semibold border-2 border-white/30 bg-transparent text-white hover:bg-white/10 rounded-xl transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link href="/auth/signin">Já Tenho Conta</Link>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              className="relative w-full h-full flex items-center justify-center"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <motion.button
                className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-3 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedImage(null)
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6" />
              </motion.button>
              
              <motion.img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        
        .animate-shine {
          animation: shine 1.5s ease-out;
        }
      `}</style>
    </>
  )
}