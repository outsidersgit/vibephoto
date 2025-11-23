# Script para testar HTTP/2 e Cache Headers no CloudFront
$url = "https://d2df849qfdugnh.cloudfront.net/generated/cmf3555br0004qjk80pe9dhqr/videos/cmibt6fq20001jm041x8xt3xc_thumbnail.webp"

Write-Host "Testando CloudFront..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $url -Method Head
    
    Write-Host "STATUS: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host "HTTP VERSION: $($response.BaseResponse.ProtocolVersion)" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "HEADERS IMPORTANTES:" -ForegroundColor Cyan
    Write-Host "-----------------------------------"
    
    $importantHeaders = @(
        "Cache-Control",
        "Content-Type",
        "Access-Control-Allow-Origin",
        "X-Cache",
        "Age",
        "ETag"
    )
    
    foreach ($header in $importantHeaders) {
        if ($response.Headers.ContainsKey($header)) {
            $value = $response.Headers[$header]
            Write-Host "${header}: $value" -ForegroundColor White
        }
    }
    
    Write-Host ""
    Write-Host "ANALISE:" -ForegroundColor Cyan
    Write-Host "-----------------------------------"
    
    # Verificar HTTP/2
    $httpVersion = $response.BaseResponse.ProtocolVersion.ToString()
    if ($httpVersion -eq "2.0" -or $httpVersion -eq "2") {
        Write-Host "[OK] HTTP/2 esta HABILITADO" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] HTTP/2 NAO esta habilitado (usando $httpVersion)" -ForegroundColor Red
    }
    
    # Verificar Cache
    if ($response.Headers.ContainsKey("Cache-Control")) {
        $cacheControl = $response.Headers["Cache-Control"]
        if ($cacheControl -like "*max-age=31536000*" -or $cacheControl -like "*immutable*") {
            Write-Host "[OK] Cache configurado corretamente (1 ano)" -ForegroundColor Green
        } else {
            Write-Host "[AVISO] Cache configurado mas nao ideal: $cacheControl" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[ERRO] Cache NAO esta configurado" -ForegroundColor Red
    }
    
    # Verificar CORS
    if ($response.Headers.ContainsKey("Access-Control-Allow-Origin")) {
        Write-Host "[OK] CORS esta CONFIGURADO" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] CORS NAO esta configurado" -ForegroundColor Red
    }
    
    # Verificar se está vindo do cache
    if ($response.Headers.ContainsKey("X-Cache")) {
        $xCache = $response.Headers["X-Cache"]
        if ($xCache -like "*Hit*") {
            Write-Host "[OK] Servido do CACHE do CloudFront" -ForegroundColor Green
        } else {
            Write-Host "[INFO] MISS - Primeira requisicao (proxima vira do cache)" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "ERRO: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "DICA: Execute este script 2x - a segunda vez deve mostrar 'Hit from cloudfront'" -ForegroundColor Cyan
