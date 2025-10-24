# Package Previews - Instruções para Upload de Imagens

## Estrutura Organizacional

Cada pacote que precisa de 4 imagens de preview diferentes tem seu próprio diretório:

### Novos Pacotes (necessitam 4 previews cada):
- `flight-mode/` - Vibes de viagem aérea, aeroporto, aventura
- `summer-vibes/` - Vibe tropical, praia, férias de verão
- `golden-hour/` - Luz dourada, pôr do sol, hora mágica
- `vintage/` - Estilo retrô, nostálgico, cores desbotadas
- `360-cam/` - Câmera 360°, perspectiva imersiva, tech
- `food-mood/` - Vibe gastronômica, culinária, restaurante
- `outfit/` - Looks coordenados, fashion, conjuntos
- `2000s-cam/` - Y2K, anos 2000, digital camera aesthetic
- `life-aesthetic/` - Lifestyle, aspiracional, cotidiano estético
- `pet-shot/` - Fotos com pets, animais de estimação, momentos fofos

### Pacotes com Imagens Existentes (mantém preview atual):
Os seguintes pacotes já têm imagens salvas em `/public/examples/` e não precisam de alteração:
- Quiet Luxury
- Executive Minimalist
- Nomade
- Fitness Aesthetic
- Conceitual
- Mirror Selfie
- Rebel
- Urban
- Soft Power
- Neo Casual

## Instruções de Upload

### Convenção de Nomenclatura:
Para cada pacote, carregar exatamente 4 imagens com os nomes:
- `preview-1.jpg`
- `preview-2.jpg`
- `preview-3.jpg` 
- `preview-4.jpg`

### Especificações Técnicas:
- **Formato**: JPG ou PNG (preferência JPG)
- **Tamanho**: Mínimo 512x512px (recomendado 1024x1024px)
- **Qualidade**: Alta resolução para melhores resultados
- **Proporção**: Quadrada (1:1) preferencial

### Exemplo de Estrutura Final:
```
public/packages/previews/
├── flight-mode/
│   ├── preview-1.jpg
│   ├── preview-2.jpg
│   ├── preview-3.jpg
│   └── preview-4.jpg
├── summer-vibes/
│   ├── preview-1.jpg
│   ├── preview-2.jpg
│   ├── preview-3.jpg
│   └── preview-4.jpg
└── [outros pacotes...]
```

## Após Upload das Imagens

Depois de fazer upload de todas as imagens, será necessário:
1. Atualizar o código dos pacotes para usar os novos caminhos
2. Testar se todas as imagens carregam corretamente
3. Verificar responsividade em diferentes tamanhos de tela

## Dicas para Seleção de Imagens:
- Escolher imagens que representem bem o estilo/vibe do pacote
- Variar entre diferentes ângulos e composições
- Manter consistência visual dentro de cada pacote
- Priorizar qualidade e resolução das imagens