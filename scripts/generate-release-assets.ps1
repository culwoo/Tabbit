Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ImageDir = Join-Path $Root "assets\images"
$StoreDir = Join-Path $Root "assets\store"

New-Item -ItemType Directory -Force -Path $ImageDir, $StoreDir | Out-Null

function New-Canvas($width, $height) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function New-RoundedRectPath($x, $y, $width, $height, $radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect($graphics, $brush, $x, $y, $width, $height, $radius) {
  $path = New-RoundedRectPath $x $y $width $height $radius
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundedRect($graphics, $pen, $x, $y, $width, $height, $radius) {
  $path = New-RoundedRectPath $x $y $width $height $radius
  $graphics.DrawPath($pen, $path)
  $path.Dispose()
}

function Save-Png($bitmap, $path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Resize-Png($sourcePath, $targetPath, $width, $height) {
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $canvas = New-Canvas $width $height
  $canvas.Graphics.DrawImage($source, 0, 0, $width, $height)
  Save-Png $canvas.Bitmap $targetPath
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
  $source.Dispose()
}

function Draw-SoftMark($graphics, $scale, $originX, $originY, [bool]$monochrome = $false) {
  $primary = if ($monochrome) { [System.Drawing.Color]::FromArgb(255, 0, 0, 0) } else { [System.Drawing.Color]::FromArgb(255, 155, 127, 212) }
  $primaryDark = if ($monochrome) { [System.Drawing.Color]::FromArgb(255, 0, 0, 0) } else { [System.Drawing.Color]::FromArgb(255, 93, 70, 143) }
  $teal = if ($monochrome) { [System.Drawing.Color]::FromArgb(255, 0, 0, 0) } else { [System.Drawing.Color]::FromArgb(255, 126, 196, 214) }
  $orange = if ($monochrome) { [System.Drawing.Color]::FromArgb(255, 0, 0, 0) } else { [System.Drawing.Color]::FromArgb(255, 232, 168, 109) }

  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($(if ($monochrome) { 0 } else { 28 }), 45, 36, 64))
  Fill-RoundedRect $graphics $shadow ($originX + 70 * $scale) ($originY + 312 * $scale) (372 * $scale) (82 * $scale) (41 * $scale)
  $shadow.Dispose()

  $leftBrush = New-Object System.Drawing.SolidBrush($primary)
  $rightBrush = New-Object System.Drawing.SolidBrush($teal)
  $topBrush = New-Object System.Drawing.SolidBrush($primaryDark)
  $sparkBrush = New-Object System.Drawing.SolidBrush($orange)
  $cutoutBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 252, 255))

  Fill-RoundedRect $graphics $leftBrush ($originX + 140 * $scale) ($originY + 174 * $scale) (94 * $scale) (252 * $scale) (47 * $scale)
  Fill-RoundedRect $graphics $rightBrush ($originX + 278 * $scale) ($originY + 174 * $scale) (94 * $scale) (252 * $scale) (47 * $scale)
  Fill-RoundedRect $graphics $topBrush ($originX + 112 * $scale) ($originY + 104 * $scale) (288 * $scale) (104 * $scale) (52 * $scale)

  $checkPen = New-Object System.Drawing.Pen -ArgumentList $cutoutBrush, (34 * $scale)
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = @(
    (New-Object System.Drawing.PointF(($originX + 178 * $scale), ($originY + 272 * $scale))),
    (New-Object System.Drawing.PointF(($originX + 242 * $scale), ($originY + 336 * $scale))),
    (New-Object System.Drawing.PointF(($originX + 340 * $scale), ($originY + 242 * $scale)))
  )
  $graphics.DrawLines($checkPen, $points)
  $checkPen.Dispose()

  $graphics.FillEllipse($sparkBrush, ($originX + 72 * $scale), ($originY + 224 * $scale), (54 * $scale), (54 * $scale))
  $graphics.FillEllipse($sparkBrush, ($originX + 386 * $scale), ($originY + 224 * $scale), (54 * $scale), (54 * $scale))
  $graphics.FillEllipse($sparkBrush, ($originX + 229 * $scale), ($originY + 48 * $scale), (54 * $scale), (54 * $scale))

  $leftBrush.Dispose()
  $rightBrush.Dispose()
  $topBrush.Dispose()
  $sparkBrush.Dispose()
  $cutoutBrush.Dispose()
}

function New-AppIcon($path, $size) {
  $canvas = New-Canvas $size $size
  $g = $canvas.Graphics

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
    [System.Drawing.Color]::FromArgb(255, 246, 243, 250),
    [System.Drawing.Color]::FromArgb(255, 228, 243, 247),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillRectangle($bgBrush, 0, 0, $size, $size)

  $ringPen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(72, 155, 127, 212)), ([Math]::Max(3, $size * 0.012))
  $g.DrawEllipse($ringPen, $size * 0.12, $size * 0.16, $size * 0.76, $size * 0.64)
  $g.DrawEllipse($ringPen, $size * 0.26, $size * 0.29, $size * 0.48, $size * 0.38)
  $ringPen.Dispose()

  Draw-SoftMark $g ($size / 640) ($size * 0.1) ($size * 0.12)

  $bgBrush.Dispose()
  Save-Png $canvas.Bitmap $path
  $g.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-AdaptiveForeground($path) {
  $canvas = New-Canvas 512 512
  Draw-SoftMark $canvas.Graphics 0.82 46 54
  Save-Png $canvas.Bitmap $path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-AdaptiveBackground($path) {
  $canvas = New-Canvas 512 512
  $g = $canvas.Graphics
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, 512, 512)),
    [System.Drawing.Color]::FromArgb(255, 246, 243, 250),
    [System.Drawing.Color]::FromArgb(255, 228, 243, 247),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillRectangle($brush, 0, 0, 512, 512)
  $pen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(62, 155, 127, 212)), 6
  $g.DrawEllipse($pen, 58, 84, 396, 312)
  $g.DrawEllipse($pen, 142, 148, 228, 178)
  $pen.Dispose()
  $brush.Dispose()
  Save-Png $canvas.Bitmap $path
  $g.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-Monochrome($path) {
  $canvas = New-Canvas 432 432
  Draw-SoftMark $canvas.Graphics 0.68 43 46 $true
  Save-Png $canvas.Bitmap $path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-SplashIcon($path) {
  $canvas = New-Canvas 1024 1024
  Draw-SoftMark $canvas.Graphics 1.15 216 220
  Save-Png $canvas.Bitmap $path
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-FeatureGraphic($path) {
  $canvas = New-Canvas 1024 500
  $g = $canvas.Graphics
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, 1024, 500)),
    [System.Drawing.Color]::FromArgb(255, 246, 243, 250),
    [System.Drawing.Color]::FromArgb(255, 228, 243, 247),
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
  )
  $g.FillRectangle($bgBrush, 0, 0, 1024, 500)

  $softPen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(66, 155, 127, 212)), 6
  $g.DrawEllipse($softPen, -80, 58, 540, 360)
  $g.DrawEllipse($softPen, 540, -88, 520, 360)
  $softPen.Dispose()

  Draw-SoftMark $g 0.62 110 76

  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 36, 27, 51))
  $subtitleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 107, 95, 123))
  $titleFont = New-Object System.Drawing.Font("Segoe UI", 74, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = New-Object System.Drawing.Font("Segoe UI", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString("Tabbit", $titleFont, $titleBrush, 510, 154)
  $g.DrawString("Small habits, unlocked together", $subtitleFont, $subtitleBrush, 514, 248)

  $chipBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 252, 255))
  $chipPen = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(255, 217, 197, 240)), 3
  Fill-RoundedRect $g $chipBrush 514 312 154 54 27
  Stroke-RoundedRect $g $chipPen 514 312 154 54 27
  $chipFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString("Morning", $chipFont, $subtitleBrush, 540, 325)

  Fill-RoundedRect $g $chipBrush 680 312 130 54 27
  Stroke-RoundedRect $g $chipPen 680 312 130 54 27
  $g.DrawString("Study", $chipFont, $subtitleBrush, 715, 325)

  Fill-RoundedRect $g $chipBrush 832 312 126 54 27
  Stroke-RoundedRect $g $chipPen 832 312 126 54 27
  $g.DrawString("Team", $chipFont, $subtitleBrush, 866, 325)

  $titleBrush.Dispose()
  $subtitleBrush.Dispose()
  $titleFont.Dispose()
  $subtitleFont.Dispose()
  $chipBrush.Dispose()
  $chipPen.Dispose()
  $chipFont.Dispose()
  $bgBrush.Dispose()
  Save-Png $canvas.Bitmap $path
  $g.Dispose()
  $canvas.Bitmap.Dispose()
}

function New-AndroidNativeResources() {
  $resDir = Join-Path $Root "android\app\src\main\res"
  if (-not (Test-Path -LiteralPath $resDir)) {
    return
  }

  $iconSource = Join-Path $ImageDir "icon.png"
  $backgroundSource = Join-Path $ImageDir "android-icon-background.png"
  $foregroundSource = Join-Path $ImageDir "android-icon-foreground.png"
  $monochromeSource = Join-Path $ImageDir "android-icon-monochrome.png"
  $splashSource = Join-Path $ImageDir "splash-icon.png"

  $legacyIconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
  }

  $adaptiveIconSizes = @{
    "mipmap-mdpi" = 108
    "mipmap-hdpi" = 162
    "mipmap-xhdpi" = 216
    "mipmap-xxhdpi" = 324
    "mipmap-xxxhdpi" = 432
  }

  foreach ($density in $legacyIconSizes.Keys) {
    $dir = Join-Path $resDir $density
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    foreach ($name in @("ic_launcher", "ic_launcher_round")) {
      Remove-Item -LiteralPath (Join-Path $dir "$name.webp") -ErrorAction SilentlyContinue
      Resize-Png $iconSource (Join-Path $dir "$name.png") $legacyIconSizes[$density] $legacyIconSizes[$density]
    }
  }

  foreach ($density in $adaptiveIconSizes.Keys) {
    $dir = Join-Path $resDir $density
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $size = $adaptiveIconSizes[$density]
    foreach ($name in @("ic_launcher_background", "ic_launcher_foreground", "ic_launcher_monochrome")) {
      Remove-Item -LiteralPath (Join-Path $dir "$name.webp") -ErrorAction SilentlyContinue
    }
    Resize-Png $backgroundSource (Join-Path $dir "ic_launcher_background.png") $size $size
    Resize-Png $foregroundSource (Join-Path $dir "ic_launcher_foreground.png") $size $size
    Resize-Png $monochromeSource (Join-Path $dir "ic_launcher_monochrome.png") $size $size
  }

  $splashSizes = @{
    "drawable-mdpi" = 288
    "drawable-hdpi" = 432
    "drawable-xhdpi" = 576
    "drawable-xxhdpi" = 864
    "drawable-xxxhdpi" = 1152
  }

  foreach ($density in $splashSizes.Keys) {
    $dir = Join-Path $resDir $density
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $size = $splashSizes[$density]
    Resize-Png $splashSource (Join-Path $dir "splashscreen_logo.png") $size $size
  }
}

New-AppIcon (Join-Path $ImageDir "icon.png") 1024
New-AppIcon (Join-Path $ImageDir "favicon.png") 48
New-AdaptiveBackground (Join-Path $ImageDir "android-icon-background.png")
New-AdaptiveForeground (Join-Path $ImageDir "android-icon-foreground.png")
New-Monochrome (Join-Path $ImageDir "android-icon-monochrome.png")
New-SplashIcon (Join-Path $ImageDir "splash-icon.png")
New-FeatureGraphic (Join-Path $StoreDir "play-feature-graphic.png")
New-AndroidNativeResources

Write-Host "Generated release assets in $ImageDir and $StoreDir"
