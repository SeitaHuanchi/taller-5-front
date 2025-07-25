# Comandos de Prueba para el Servidor de Sincronización Temporal

## PowerShell Commands para probar el API

### 1. Verificar que el servidor esté funcionando
```powershell
Invoke-RestMethod -Uri "http://localhost:4000" -Method GET
```

### 2. Verificar salud del sistema
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/time/health" -Method GET
```

### 3. Obtener tiempo actual del servidor
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/time" -Method GET
```

### 4. Sincronizar tiempo usando algoritmo de Cristian
```powershell
$clientTime = [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
$body = @{
    clientRequestTime = $clientTime.ToString()
} | ConvertTo-Json

$headers = @{
    'Content-Type' = 'application/json'
    'x-client-id' = 'test-powershell-client'
}

Invoke-RestMethod -Uri "http://localhost:4000/api/time/sync" -Method POST -Body $body -Headers $headers
```

### 5. Obtener métricas del sistema
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/time/metrics" -Method GET
```

### 6. Ver logs del sistema
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/time/logs?limit=10" -Method GET
```

## Comandos curl alternativos (si tienes curl instalado)

### 1. Health Check
```bash
curl http://localhost:4000/api/time/health
```

### 2. Obtener tiempo
```bash
curl http://localhost:4000/api/time
```

### 3. Sincronización (reemplaza TIMESTAMP con tiempo actual en nanosegundos)
```bash
curl -X POST http://localhost:4000/api/time/sync \
  -H "Content-Type: application/json" \
  -H "x-client-id: test-curl-client" \
  -d "{\"clientRequestTime\": \"$(date +%s%N)\"}"
```

### 4. Métricas
```bash
curl "http://localhost:4000/api/time/metrics?clientId=test-curl-client"
```

## Prueba de Estrés con PowerShell

### Múltiples sincronizaciones concurrentes
```powershell
# Ejecutar 10 sincronizaciones en paralelo
1..10 | ForEach-Object -Parallel {
    $clientTime = [System.DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $body = @{
        clientRequestTime = $clientTime.ToString()
    } | ConvertTo-Json
    
    $headers = @{
        'Content-Type' = 'application/json'
        'x-client-id' = "stress-test-client-$_"
    }
    
    try {
        $result = Invoke-RestMethod -Uri "http://localhost:4000/api/time/sync" -Method POST -Body $body -Headers $headers
        Write-Host "Cliente $_: Offset = $($result.syncResult.offset)ms, RTT = $($result.syncResult.roundTripTime)ms"
    } catch {
        Write-Host "Cliente $_: Error - $($_.Exception.Message)"
    }
} -ThrottleLimit 10
```

## Comandos de Monitoreo Continuo

### Verificar salud cada 10 segundos
```powershell
while ($true) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:4000/api/time/health" -Method GET
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] Estado: $($health.overall) | Clientes activos: $($health.activeClients)"
        Start-Sleep -Seconds 10
    } catch {
        Write-Host "Error verificando salud: $($_.Exception.Message)"
        Start-Sleep -Seconds 5
    }
}
```

### Monitor de logs en tiempo real
```powershell
$lastLogCount = 0
while ($true) {
    try {
        $logs = Invoke-RestMethod -Uri "http://localhost:4000/api/time/logs?limit=5" -Method GET
        $newLogs = $logs.logs | Select-Object -First ($logs.total - $lastLogCount)
        
        foreach ($log in $newLogs) {
            Write-Host "[$($log.timestamp)] [$($log.level)] $($log.message)"
        }
        
        $lastLogCount = $logs.total
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "Error obteniendo logs: $($_.Exception.Message)"
        Start-Sleep -Seconds 5
    }
}
```
