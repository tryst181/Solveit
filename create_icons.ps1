Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\Yuval\.gemini\antigravity\brain\8bed8796-f527-42f6-a13a-ee03dffca17d\solveit_icon_1776743060970.png"
$outDir = "C:\Users\Yuval\.gemini\antigravity\scratch\solveit-ai\icons"
$sizes = @(16, 32, 48, 128)

foreach ($s in $sizes) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $s, $s)
    $g.Dispose()
    $outPath = Join-Path $outDir "icon$s.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $src.Dispose()
    Write-Host "Created icon$s.png"
}
Write-Host "All icons created!"
