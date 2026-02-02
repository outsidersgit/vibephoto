-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PREMIUM', 'GOLD');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'TRAINING', 'READY', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "ModelClass" AS ENUM ('MAN', 'WOMAN', 'BOY', 'GIRL', 'ANIMAL');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PackageCategory" AS ENUM ('LIFESTYLE', 'PROFESSIONAL', 'CREATIVE', 'FASHION', 'PREMIUM');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'BOTH');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'OVERDUE', 'REFUNDED', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('SUBSCRIPTION', 'CREDIT_PURCHASE', 'PHOTO_PACKAGE');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('EARNED', 'SPENT', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CreditTransactionSource" AS ENUM ('SUBSCRIPTION', 'PURCHASE', 'BONUS', 'GENERATION', 'TRAINING', 'REFUND', 'EXPIRATION', 'UPSCALE', 'EDIT', 'VIDEO', 'MODEL_CREATION');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('STARTING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VideoQuality" AS ENUM ('standard', 'pro');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('DISCOUNT', 'HYBRID');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "DurationType" AS ENUM ('RECURRENT', 'FIRST_CYCLE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "plan" "Plan",
    "billingCycle" TEXT,
    "asaasCustomerId" TEXT,
    "subscriptionId" TEXT,
    "asaasCreditCardToken" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "subscriptionCancelledAt" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3),
    "subscriptionStartedAt" TIMESTAMP(3),
    "lastCreditRenewalAt" TIMESTAMP(3),
    "creditsExpiresAt" TIMESTAMP(3),
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsLimit" INTEGER NOT NULL DEFAULT 0,
    "creditsBalance" INTEGER NOT NULL DEFAULT 0,
    "cpfCnpj" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "province" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "codigo_usado" TEXT,
    "influencer_id" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "influencers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "codigo_cupom" TEXT NOT NULL,
    "asaas_wallet_id" TEXT NOT NULL,
    "asaas_api_key" TEXT,
    "commission_percentage" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "valor_fixo" DECIMAL(10,2),
    "income_value" DECIMAL(12,2),
    "total_indicacoes" INTEGER NOT NULL DEFAULT 0,
    "total_comissoes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificationtokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'PAID',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "annualPrice" DOUBLE PRECISION NOT NULL,
    "monthlyEquivalent" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "models" INTEGER NOT NULL,
    "resolution" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "maxPhotos" INTEGER,
    "maxVideos" INTEGER,
    "maxModels" INTEGER,
    "maxStorage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" "ModelClass" NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'UPLOADING',
    "facePhotos" JSONB[],
    "halfBodyPhotos" JSONB[],
    "fullBodyPhotos" JSONB[],
    "trainingConfig" JSONB,
    "trainingLogs" JSONB,
    "errorMessage" TEXT,
    "modelUrl" TEXT,
    "sampleImages" JSONB[],
    "aiProvider" TEXT DEFAULT 'replicate',
    "trainingJobId" TEXT,
    "triggerWord" TEXT,
    "classWord" TEXT NOT NULL,
    "astriaModelType" TEXT,
    "astrisBaseTuneId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimatedTime" INTEGER,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "credits_refunded" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "totalPhotos" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
    "resolution" TEXT NOT NULL DEFAULT '512x512',
    "variations" INTEGER NOT NULL DEFAULT 1,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "seed" INTEGER,
    "style" TEXT,
    "aiProvider" TEXT DEFAULT 'replicate',
    "astriaEnhancements" JSONB,
    "steps" INTEGER,
    "guidanceScale" DOUBLE PRECISION,
    "scheduler" TEXT,
    "outputQuality" INTEGER,
    "outputFormat" TEXT,
    "rawMode" BOOLEAN,
    "packageId" TEXT,
    "packagePromptIndex" INTEGER,
    "packageVariationIndex" INTEGER,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "imageUrls" JSONB[],
    "thumbnailUrls" JSONB[],
    "storageProvider" TEXT,
    "storageBucket" TEXT,
    "storageKeys" JSONB NOT NULL DEFAULT '[]',
    "operationType" TEXT,
    "storageContext" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "errorMessage" TEXT,
    "failureReason" TEXT,
    "estimatedCompletionTime" TIMESTAMP(3),
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsRefunded" BOOLEAN NOT NULL DEFAULT false,
    "processingTime" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "modelId" TEXT,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "imageUrls" JSONB[],
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_image_url" TEXT NOT NULL,
    "edited_image_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "operation" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT DEFAULT 'COMPLETED',
    "job_id" TEXT,
    "error_message" TEXT,
    "failure_reason" TEXT,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "credits_refunded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "PackageCategory" NOT NULL,
    "gender" "Gender" DEFAULT 'BOTH',
    "promptsMale" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "promptsFemale" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "previewUrlsMale" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "previewUrlsFemale" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "prompts" JSONB[],
    "previewUrls" JSONB[],
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "price" DOUBLE PRECISION,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "selectedGender" "Gender",
    "totalImages" INTEGER NOT NULL,
    "generatedImages" INTEGER NOT NULL DEFAULT 0,
    "failedImages" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "successSeen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "functional" BOOLEAN NOT NULL DEFAULT false,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "isRevocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "asaasPaymentId" TEXT,
    "asaasCheckoutId" TEXT,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billingType" "BillingType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "confirmedDate" TIMESTAMP(3),
    "overdueDate" TIMESTAMP(3),
    "installmentCount" INTEGER,
    "installmentValue" DOUBLE PRECISION,
    "subscriptionId" TEXT,
    "externalReference" TEXT,
    "influencer_id" TEXT,
    "codigo_usado" TEXT,
    "coupon_code_used" TEXT,
    "discount_applied" DOUBLE PRECISION,
    "needs_price_update" BOOLEAN DEFAULT false,
    "original_price" DOUBLE PRECISION,
    "needs_split_removal" BOOLEAN DEFAULT false,
    "planType" "Plan",
    "billingCycle" TEXT,
    "creditAmount" INTEGER,
    "packageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" TEXT NOT NULL,
    "asaasPaymentId" TEXT,
    "asaasCheckoutId" TEXT,
    "packageId" TEXT,
    "packageName" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "usedCredits" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "asaasPaymentId" TEXT,
    "asaasSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "rawData" JSONB NOT NULL,
    "signature" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "asaasTokenId" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "cardHolderName" TEXT,
    "expiryMonth" TEXT,
    "expiryYear" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creditAmount" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "validityMonths" INTEGER NOT NULL DEFAULT 12,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "source" "CreditTransactionSource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "creditPurchaseId" TEXT,
    "metadata" JSONB,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_generations" (
    "id" TEXT NOT NULL,
    "sourceImageUrl" TEXT,
    "sourceGenerationId" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 5,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "quality" "VideoQuality" NOT NULL DEFAULT 'standard',
    "template" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'STARTING',
    "jobId" TEXT,
    "errorMessage" TEXT,
    "failureReason" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "storageProvider" TEXT,
    "storageBucket" TEXT,
    "storageKey" TEXT,
    "posterKey" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT DEFAULT 'video/mp4',
    "sizeBytes" BIGINT,
    "durationSec" INTEGER,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsRefunded" BOOLEAN NOT NULL DEFAULT false,
    "estimatedTimeRemaining" INTEGER DEFAULT 0,
    "progress" INTEGER DEFAULT 0,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "video_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL DEFAULT 'DISCOUNT',
    "discount_type" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discount_value" DECIMAL(10,2) NOT NULL,
    "duration_type" "DurationType" NOT NULL DEFAULT 'FIRST_CYCLE',
    "influencer_id" TEXT,
    "custom_commission_percentage" DECIMAL(5,2),
    "custom_commission_fixed_value" DECIMAL(10,2),
    "split_duration_type" "DurationType" NOT NULL DEFAULT 'FIRST_CYCLE',
    "applicable_plans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicable_cycles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "max_uses" INTEGER,
    "max_uses_per_user" INTEGER DEFAULT 1,
    "total_uses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usage" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "discount_applied" DECIMAL(10,2) NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_asaasCustomerId_key" ON "users"("asaasCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_subscriptionId_key" ON "users"("subscriptionId");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "users_plan_idx" ON "users"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "influencers_user_id_key" ON "influencers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "influencers_codigo_cupom_key" ON "influencers"("codigo_cupom");

-- CreateIndex
CREATE UNIQUE INDEX "influencers_asaas_wallet_id_key" ON "influencers"("asaas_wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verificationtokens_token_key" ON "verificationtokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verificationtokens_identifier_token_key" ON "verificationtokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_planId_key" ON "subscription_plans"("planId");

-- CreateIndex
CREATE INDEX "subscription_plans_planId_idx" ON "subscription_plans"("planId");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

-- CreateIndex
CREATE INDEX "edit_history_job_id_idx" ON "edit_history"("job_id");

-- CreateIndex
CREATE INDEX "user_packages_userId_idx" ON "user_packages"("userId");

-- CreateIndex
CREATE INDEX "user_packages_status_idx" ON "user_packages"("status");

-- CreateIndex
CREATE INDEX "user_packages_activatedAt_idx" ON "user_packages"("activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE INDEX "SystemLog_level_idx" ON "SystemLog"("level");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_requestId_idx" ON "SystemLog"("requestId");

-- CreateIndex
CREATE INDEX "user_consents_userId_idx" ON "user_consents"("userId");

-- CreateIndex
CREATE INDEX "user_consents_ipAddress_idx" ON "user_consents"("ipAddress");

-- CreateIndex
CREATE INDEX "user_consents_consentedAt_idx" ON "user_consents"("consentedAt");

-- CreateIndex
CREATE INDEX "user_consents_version_idx" ON "user_consents"("version");

-- CreateIndex
CREATE INDEX "user_consents_isRevocation_idx" ON "user_consents"("isRevocation");

-- CreateIndex
CREATE UNIQUE INDEX "payments_asaasPaymentId_key" ON "payments"("asaasPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_asaasCheckoutId_key" ON "payments"("asaasCheckoutId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_asaasPaymentId_idx" ON "payments"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_purchases_asaasPaymentId_key" ON "credit_purchases"("asaasPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_purchases_asaasCheckoutId_key" ON "credit_purchases"("asaasCheckoutId");

-- CreateIndex
CREATE INDEX "credit_purchases_userId_idx" ON "credit_purchases"("userId");

-- CreateIndex
CREATE INDEX "credit_purchases_status_idx" ON "credit_purchases"("status");

-- CreateIndex
CREATE INDEX "credit_purchases_validUntil_idx" ON "credit_purchases"("validUntil");

-- CreateIndex
CREATE INDEX "credit_purchases_isExpired_idx" ON "credit_purchases"("isExpired");

-- CreateIndex
CREATE INDEX "credit_purchases_packageId_idx" ON "credit_purchases"("packageId");

-- CreateIndex
CREATE INDEX "webhook_events_event_idx" ON "webhook_events"("event");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE INDEX "webhook_events_asaasPaymentId_idx" ON "webhook_events"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_asaasTokenId_key" ON "payment_methods"("asaasTokenId");

-- CreateIndex
CREATE INDEX "payment_methods_userId_idx" ON "payment_methods"("userId");

-- CreateIndex
CREATE INDEX "payment_methods_isActive_idx" ON "payment_methods"("isActive");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_idx" ON "credit_transactions"("userId");

-- CreateIndex
CREATE INDEX "credit_transactions_type_idx" ON "credit_transactions"("type");

-- CreateIndex
CREATE INDEX "credit_transactions_source_idx" ON "credit_transactions"("source");

-- CreateIndex
CREATE INDEX "credit_transactions_createdAt_idx" ON "credit_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_creditPurchaseId_idx" ON "credit_transactions"("creditPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "video_generations_jobId_key" ON "video_generations"("jobId");

-- CreateIndex
CREATE INDEX "video_generations_userId_idx" ON "video_generations"("userId");

-- CreateIndex
CREATE INDEX "video_generations_status_idx" ON "video_generations"("status");

-- CreateIndex
CREATE INDEX "video_generations_createdAt_idx" ON "video_generations"("createdAt");

-- CreateIndex
CREATE INDEX "video_generations_jobId_idx" ON "video_generations"("jobId");

-- CreateIndex
CREATE INDEX "video_generations_sourceGenerationId_idx" ON "video_generations"("sourceGenerationId");

-- CreateIndex
CREATE INDEX "video_generations_quality_idx" ON "video_generations"("quality");

-- CreateIndex
CREATE INDEX "video_generations_duration_idx" ON "video_generations"("duration");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_generation_id_key" ON "feedbacks"("generation_id");

-- CreateIndex
CREATE INDEX "feedbacks_user_id_idx" ON "feedbacks"("user_id");

-- CreateIndex
CREATE INDEX "feedbacks_rating_idx" ON "feedbacks"("rating");

-- CreateIndex
CREATE INDEX "feedbacks_created_at_idx" ON "feedbacks"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "discount_coupons_code_key" ON "discount_coupons"("code");

-- CreateIndex
CREATE INDEX "discount_coupons_code_idx" ON "discount_coupons"("code");

-- CreateIndex
CREATE INDEX "discount_coupons_influencer_id_idx" ON "discount_coupons"("influencer_id");

-- CreateIndex
CREATE INDEX "discount_coupons_is_active_idx" ON "discount_coupons"("is_active");

-- CreateIndex
CREATE INDEX "coupon_usage_coupon_id_idx" ON "coupon_usage"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_usage_user_id_idx" ON "coupon_usage"("user_id");

-- CreateIndex
CREATE INDEX "coupon_usage_payment_id_idx" ON "coupon_usage"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usage_coupon_id_user_id_payment_id_key" ON "coupon_usage"("coupon_id", "user_id", "payment_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "influencers" ADD CONSTRAINT "influencers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "user_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_history" ADD CONSTRAINT "edit_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "photo_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "credit_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_creditPurchaseId_fkey" FOREIGN KEY ("creditPurchaseId") REFERENCES "credit_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_generations" ADD CONSTRAINT "video_generations_sourceGenerationId_fkey" FOREIGN KEY ("sourceGenerationId") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_coupons" ADD CONSTRAINT "discount_coupons_influencer_id_fkey" FOREIGN KEY ("influencer_id") REFERENCES "influencers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "discount_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
