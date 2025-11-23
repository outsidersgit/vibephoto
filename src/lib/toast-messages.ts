/**
 * Mensagens padronizadas para toasts em todo o aplicativo
 * Garante consistência e facilita manutenção
 */

export const TOAST_MESSAGES = {
  // ==================== GERAÇÃO DE IMAGENS ====================
  IMAGE_GENERATION: {
    PROCESSING: {
      title: 'Processando...',
      description: 'Sua imagem está sendo gerada. Você será notificado quando estiver pronta.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Imagem gerada com sucesso!',
      description: 'Sua imagem está pronta e disponível na galeria.',
      type: 'success' as const
    },
    ERROR: {
      title: 'Erro ao gerar imagem',
      description: 'Não foi possível gerar sua imagem. Tente novamente.',
      type: 'error' as const
    },
    INSUFFICIENT_CREDITS: {
      title: 'Créditos insuficientes',
      description: 'Você não tem créditos suficientes para esta geração.',
      type: 'error' as const
    }
  },

  // ==================== EDIÇÃO DE IMAGENS ====================
  IMAGE_EDIT: {
    PROCESSING: {
      title: 'Processando edição...',
      description: 'Sua edição está sendo processada. Você será notificado quando estiver pronta.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Edição concluída com sucesso!',
      description: 'Sua imagem editada está pronta e disponível na galeria.',
      type: 'success' as const
    },
    ERROR: {
      title: 'Erro ao editar imagem',
      description: 'Não foi possível processar sua edição. Tente novamente.',
      type: 'error' as const
    }
  },

  // ==================== GERAÇÃO DE VÍDEOS ====================
  VIDEO_GENERATION: {
    PROCESSING: {
      title: 'Processando vídeo...',
      description: 'Seu vídeo está sendo gerado. Você será notificado quando estiver pronto.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Vídeo gerado com sucesso!',
      description: 'Seu vídeo está pronto e disponível na galeria.',
      type: 'success' as const
    },
    ERROR: {
      title: 'Erro ao gerar vídeo',
      description: 'Não foi possível gerar seu vídeo. Tente novamente.',
      type: 'error' as const
    },
    INVALID_PROMPT: {
      title: 'Prompt inválido',
      description: 'Por favor, forneça uma descrição válida para o vídeo.',
      type: 'error' as const
    }
  },

  // ==================== TREINAMENTO DE MODELOS ====================
  MODEL_TRAINING: {
    PROCESSING: {
      title: 'Treinando modelo...',
      description: 'Seu modelo está sendo treinado. Você será notificado quando estiver pronto.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Modelo treinado com sucesso!',
      description: 'Seu modelo está pronto e disponível para uso em gerações.',
      type: 'success' as const
    },
    ERROR: {
      title: 'Erro ao treinar modelo',
      description: 'Não foi possível treinar seu modelo. Revise as fotos e tente novamente.',
      type: 'error' as const
    },
    UPLOADING: {
      title: 'Enviando fotos...',
      description: 'Suas fotos estão sendo enviadas. Não feche esta janela.',
      type: 'default' as const
    },
    READY: {
      title: 'Modelo pronto!',
      description: 'Seu modelo foi treinado e está disponível para uso.',
      type: 'success' as const
    }
  },

  // ==================== UPSCALE ====================
  UPSCALE: {
    PROCESSING: {
      title: 'Processando upscale...',
      description: 'Sua imagem está sendo ampliada. Você será notificado quando estiver pronta.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Upscale concluído!',
      description: 'Sua imagem foi ampliada com sucesso.',
      type: 'success' as const
    },
    ERROR: {
      title: 'Erro ao fazer upscale',
      description: 'Não foi possível ampliar sua imagem. Tente novamente.',
      type: 'error' as const
    }
  },

  // ==================== PACOTES ====================
  PACKAGE: {
    GENERATING: {
      title: 'Gerando pacote...',
      description: 'Suas fotos estão sendo geradas. Acompanhe o progresso na galeria.',
      type: 'default' as const
    },
    SUCCESS: {
      title: 'Pacote gerado com sucesso!',
      description: 'Todas as fotos do pacote estão prontas na galeria.',
      type: 'success' as const
    },
    PARTIAL_SUCCESS: (completed: number, total: number) => ({
      title: 'Pacote parcialmente concluído',
      description: `${completed} de ${total} fotos foram geradas com sucesso.`,
      type: 'warning' as const
    }),
    ERROR: {
      title: 'Erro ao gerar pacote',
      description: 'Não foi possível gerar o pacote de fotos. Tente novamente.',
      type: 'error' as const
    }
  },

  // ==================== AÇÕES GERAIS ====================
  GENERAL: {
    COPIED: {
      title: 'Copiado!',
      description: 'Texto copiado para a área de transferência.',
      type: 'success' as const
    },
    DOWNLOAD_SUCCESS: {
      title: 'Download iniciado',
      description: 'O arquivo está sendo baixado.',
      type: 'success' as const
    },
    DOWNLOAD_ERROR: {
      title: 'Erro no download',
      description: 'Não foi possível baixar o arquivo. Tente novamente.',
      type: 'error' as const
    },
    DELETE_SUCCESS: {
      title: 'Excluído com sucesso',
      description: 'O item foi removido da galeria.',
      type: 'success' as const
    },
    DELETE_ERROR: {
      title: 'Erro ao excluir',
      description: 'Não foi possível excluir o item. Tente novamente.',
      type: 'error' as const
    }
  },

  // ==================== ERROS DE SISTEMA ====================
  SYSTEM: {
    NETWORK_ERROR: {
      title: 'Erro de conexão',
      description: 'Verifique sua conexão com a internet e tente novamente.',
      type: 'error' as const
    },
    UNEXPECTED_ERROR: {
      title: 'Erro inesperado',
      description: 'Algo deu errado. Por favor, tente novamente.',
      type: 'error' as const
    },
    UNAUTHORIZED: {
      title: 'Não autorizado',
      description: 'Você precisa estar conectado para realizar esta ação.',
      type: 'error' as const
    }
  }
} as const

/**
 * Helper para criar toasts customizados mantendo o padrão visual
 */
export function createCustomToast(title: string, description: string, type: 'default' | 'success' | 'error' | 'warning' = 'default') {
  return {
    title,
    description,
    type
  }
}

