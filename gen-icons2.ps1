$key = "sk-fmvhyfzahwdurptqgrurnfaqfwbdesvncrxwwifqzulonlwr"
$adminB = "https://dsp.game.byboy.vip"

$buildings = @(
    @{ type = 'Substation';        prompt = 'cute chibi 3D game icon of a small tall gray electrical substation tower with a yellow crossarm and glowing lamp, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'ThermalPowerPlant'; prompt = 'cute chibi 3D game icon of a small dark factory power plant building with a chimney and orange glowing windows, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'SolarPanel';        prompt = 'cute chibi 3D game icon of a small tilted blue solar panel on a stand, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' }
)

$login = Invoke-RestMethod -Uri "$adminB/api/admin/login" -Method Post -ContentType 'application/json' -Body '{"pass":"admin123"}' -TimeoutSec 60
if (-not $login.ok) { throw "admin login failed" }
$tok = $login.token
Write-Output "admin login ok"

function Gen-Image($prompt) {
    for ($try = 1; $try -le 4; $try++) {
        try {
            $body = @{ model = 'Kwai-Kolors/Kolors'; prompt = $prompt; image_size = '1024x1024' } | ConvertTo-Json
            $r = Invoke-RestMethod -Uri 'https://api.siliconflow.cn/v1/images/generations' -Method Post -Headers @{ Authorization = "Bearer $key" } -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
            return $r.images[0].url
        } catch {
            Write-Output "  gen attempt $try failed: $($_.Exception.Message)"
            Start-Sleep 25
        }
    }
    throw "generation failed after retries"
}

function Upload-Icon($type, $pngPath, $tok) {
    for ($try = 1; $try -le 3; $try++) {
        try {
            $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pngPath))
            $body = @{ token = $tok; type = $type; dataUrl = "data:image/png;base64,$b64" } | ConvertTo-Json
            $r = Invoke-RestMethod -Uri "$adminB/api/admin/upload-icon" -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 120
            return $r
        } catch { Write-Output "  upload attempt $try failed, retrying..."; Start-Sleep 8 }
    }
    throw "upload failed after retries"
}

$i = 0
foreach ($b in $buildings) {
    $i++
    try {
        Write-Output "[$i/3] generating $($b.type)..."
        $url = Gen-Image $b.prompt
        $png = "$env:TEMP\icon_$($b.type).png"
        Invoke-WebRequest -Uri $url -OutFile $png -TimeoutSec 120
        Write-Output "  downloaded $((Get-Item $png).Length) bytes"
        $r = Upload-Icon $b.type $png $tok
        if ($r.ok) { Write-Output "  uploaded -> $($r.url)" }
        else { Write-Output "  UPLOAD FAILED: $($r.msg)" }
    } catch {
        Write-Output "  [$($b.type)] ERROR: $($_.Exception.Message)"
    }
    Start-Sleep 15
}
Write-Output "ALL DONE"
