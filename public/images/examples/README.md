# 📸 Repositório de Exemplos para Treinamento de Modelos

Esta pasta contém os exemplos visuais de **bons** e **maus** exemplos de fotos que são mostrados aos usuários durante o processo de criação de modelos de IA.

## 📁 Estrutura de Pastas

```
examples/
├── step-1-face/          # Exemplos para STEP 1 - Fotos de Rosto
│   ├── good-1.jpg        # Bom exemplo 1
│   ├── good-2.jpg        # Bom exemplo 2
│   ├── good-3.jpg        # Bom exemplo 3
│   ├── good-4.jpg        # Bom exemplo 4
│   ├── bad-1.jpg         # Mau exemplo 1
│   ├── bad-2.jpg         # Mau exemplo 2
│   ├── bad-3.jpg         # Mau exemplo 3
│   └── bad-4.jpg         # Mau exemplo 4
│
├── step-2-half-body/     # Exemplos para STEP 2 - Meio Corpo
│   ├── good-1.jpg        # Bom exemplo 1
│   ├── good-2.jpg        # Bom exemplo 2
│   ├── good-3.jpg        # Bom exemplo 3
│   ├── good-4.jpg        # Bom exemplo 4
│   ├── bad-1.jpg         # Mau exemplo 1
│   ├── bad-2.jpg         # Mau exemplo 2
│   ├── bad-3.jpg         # Mau exemplo 3
│   └── bad-4.jpg         # Mau exemplo 4
│
└── step-3-full-body/     # Exemplos para STEP 3 - Corpo Inteiro
    ├── good-1.jpg        # Bom exemplo 1
    ├── good-2.jpg        # Bom exemplo 2
    ├── good-3.jpg        # Bom exemplo 3
    ├── good-4.jpg        # Bom exemplo 4
    ├── bad-1.jpg         # Mau exemplo 1
    ├── bad-2.jpg         # Mau exemplo 2
    ├── bad-3.jpg         # Mau exemplo 3
    └── bad-4.jpg         # Mau exemplo 4
```

## 🎯 Guidelines por Etapa

### **Step 1 - Fotos de Rosto** (`step-1-face/`)

**Bons Exemplos devem mostrar:**
- ✅ Rosto bem enquadrado (ombros para cima)
- ✅ Olhando diretamente para a câmera
- ✅ Iluminação natural e uniforme no rosto
- ✅ Expressão neutra ou sorriso natural
- ✅ Fundo limpo e sem distrações

**Maus Exemplos devem mostrar:**
- ❌ Rosto cortado ou mal enquadrado
- ❌ Óculos escuros, chapéu ou acessórios no rosto
- ❌ Filtros, preto e branco ou efeitos
- ❌ Outras pessoas na foto
- ❌ Foto desfocada ou com baixa qualidade
- ❌ Imagens geradas por IA

---

### **Step 2 - Meio Corpo** (`step-2-half-body/`)

**Bons Exemplos devem mostrar:**
- ✅ Cintura para cima bem enquadrada
- ✅ Postura natural e relaxada
- ✅ Roupas variadas em diferentes fotos
- ✅ Fundos diversos (interno, externo)
- ✅ Iluminação adequada no corpo e rosto

**Maus Exemplos devem mostrar:**
- ❌ Corpo cortado de forma estranha
- ❌ Braços ou mãos cortadas
- ❌ Postura forçada ou não natural
- ❌ Outras pessoas visíveis
- ❌ Filtros ou edições pesadas
- ❌ Imagens geradas por IA

---

### **Step 3 - Corpo Inteiro** (`step-3-full-body/`)

**Bons Exemplos devem mostrar:**
- ✅ Corpo inteiro visível da cabeça aos pés
- ✅ Poses variadas (em pé, sentado, caminhando)
- ✅ Distância adequada da câmera
- ✅ Diferentes ambientes e cenários
- ✅ Corpo completo bem iluminado e nítido

**Maus Exemplos devem mostrar:**
- ❌ Pés ou cabeça cortados
- ❌ Muito longe (pessoa pequena na foto)
- ❌ Pose forçada ou não natural
- ❌ Outras pessoas na cena
- ❌ Filtros ou baixa qualidade
- ❌ Imagens geradas por IA

---

## 📝 Especificações Técnicas

- **Formato**: JPG ou JPEG
- **Aspect Ratio**: 3:4 (vertical/retrato)
- **Resolução mínima**: 800x1066 pixels
- **Resolução recomendada**: 1200x1600 pixels ou superior
- **Tamanho de arquivo**: Idealmente entre 200KB - 2MB

## 🔄 Como Atualizar os Exemplos

1. Prepare 8 imagens por etapa (4 boas + 4 ruins)
2. Nomeie as imagens corretamente: `good-1.jpg`, `good-2.jpg`, `good-3.jpg`, `good-4.jpg`, `bad-1.jpg`, `bad-2.jpg`, `bad-3.jpg`, `bad-4.jpg`
3. Coloque as imagens na pasta correspondente à etapa
4. As imagens serão automaticamente exibidas na interface de criação de modelos

## 📍 Onde são Usados

Estes exemplos são exibidos nos seguintes componentes:
- `src/components/models/creation/step-1-photos.tsx` - Usa `step-1-face/`
- `src/components/models/creation/step-2-half-body.tsx` - Usa `step-2-half-body/`
- `src/components/models/creation/step-3-full-body.tsx` - Usa `step-3-full-body/`

---

**Última atualização**: 15 de janeiro de 2026
