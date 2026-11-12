$key = "sk-fmvhyfzahwdurptqgrurnfaqfwbdesvncrxwwifqzulonlwr"
$adminB = "https://dsp.game.byboy.vip"

$buildings = @(
    @{ type = 'Miner';              prompt = 'cute chibi 3D game icon of a small yellow mining machine building with a big front drill and friendly cartoon eyes, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'Smelter';            prompt = 'cute chibi 3D game icon of a small red round smelter furnace with a glowing orange mouth opening and a small chimney, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'Assembler';          prompt = 'cute chibi 3D game icon of a small blue factory assembler machine with a tiny robotic arm and friendly cartoon eyes, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'Belt';               prompt = 'cute chibi 3D game icon of a short dark conveyor belt segment with a big yellow arrow pointing forward on top, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'Storage';            prompt = 'cute chibi 3D game icon of a small purple rounded storage barrel container with a lid, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'WindTurbine';        prompt = 'cute chibi 3D game icon of a small white wind power turbine with three rounded blades, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'PowerPylon';         prompt = 'cute chibi 3D game icon of a small gray power pylon tower with a glowing yellow orb on top, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'Substation';         prompt = 'cute chibi 3D game icon of a small tall gray electrical substation tower with a yellow crossarm and glowing lamp, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'ThermalPowerPlant';  prompt = 'cute chibi 3D game icon of a small dark factory power plant building with a chimney and orange glowing windows, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' },
    @{ type = 'SolarPanel';         prompt = 'cute chibi 3D game icon of a small tilted blue solar panel on a stand, rounded chunky shapes, soft studio lighting, centered on a plain dark navy background, no text, game asset icon' }
)

# 绠＄悊鍛樼櫥褰?$login = Invoke-RestMethod -Uri "$adminB/api/admin/login" -Method Post -ContentType 'application/json' -Body '{"pass":"admin123"}' -TimeoutSec 60
if (-not $login.ok) { Start-Sleep 5; $login = Invoke-RestMethod -Uri "$adminB/api/admin/login" -Method Post -ContentType 'application/json' -Body '{"pass":"admin123"}' -TimeoutSec 60; if (-not $login.ok) { throw "admin login failed again" } }
$tok = $login.token
Write-Output "admin login ok"

function Gen-Image($prompt) {
    $body = @{ model = 'Kwai-Kolors/Kolors'; prompt = $prompt; image_size = '1024x1024' } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri 'https://api.siliconflow.cn/v1/images/generations' -Method Post -Headers @{ Authorization = "Bearer $key" } -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 180
    return $r.images[0].url
}

function Upload-Icon($type, $pngPath, $tok) {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pngPath))
    $body = @{ token = $tok; type = $type; dataUrl = "data:image/png;base64,$b64" } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$adminB/api/admin/upload-icon" -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 120
    return $r
}

$i = 0
foreach ($b in $buildings) {
    $i++
    try {
        Write-Output "[$i/10] generating $($b.type)..."
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
}
Write-Output "ALL DONE"
