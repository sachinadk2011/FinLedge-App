$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\assets\finledge_icon.png"
$sourcePath = [System.IO.Path]::GetFullPath($sourcePath)
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\appx"))
$iconPath = [System.IO.Path]::GetFullPath((Join-Path $assetRoot "..\finledge_icon.ico"))

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "FinLedge icon not found: $sourcePath"
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
  New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null

  # Use the same canonical image for AppX logos and the EXE icon. The previous ICO
  # had square 16/32/48px frames while AppX used the round PNG.
  $iconFrames = @()
  foreach ($size in @(16, 32, 48, 256)) {
    $iconBitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
      try {
        $iconGraphics.Clear([System.Drawing.Color]::Transparent)
        $iconGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $iconGraphics.DrawImage($source, 0, 0, $size, $size)
      } finally {
        $iconGraphics.Dispose()
      }
      $iconStream = [System.IO.MemoryStream]::new()
      try {
        $iconBitmap.Save($iconStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $iconFrames += [pscustomobject]@{ Size = $size; Bytes = $iconStream.ToArray() }
      } finally {
        $iconStream.Dispose()
      }
    } finally {
      $iconBitmap.Dispose()
    }
  }
  $directoryOffset = 6 + (16 * $iconFrames.Count)
  $totalSize = $directoryOffset + (($iconFrames | ForEach-Object { $_.Bytes.Length } | Measure-Object -Sum).Sum)
  $icoBytes = New-Object byte[] $totalSize
  [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]0), 0, $icoBytes, 0, 2)
  [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]1), 0, $icoBytes, 2, 2)
  [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]$iconFrames.Count), 0, $icoBytes, 4, 2)
  $entryOffset = 6
  $imageOffset = $directoryOffset
  foreach ($frame in $iconFrames) {
    $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
    $icoBytes[$entryOffset] = [byte]$dimension
    $icoBytes[$entryOffset + 1] = [byte]$dimension
    [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]0), 0, $icoBytes, $entryOffset + 2, 2)
    [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]1), 0, $icoBytes, $entryOffset + 4, 2)
    [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt16]32), 0, $icoBytes, $entryOffset + 6, 2)
    [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt32]$frame.Bytes.Length), 0, $icoBytes, $entryOffset + 8, 4)
    [System.Buffer]::BlockCopy([BitConverter]::GetBytes([UInt32]$imageOffset), 0, $icoBytes, $entryOffset + 12, 4)
    [System.Buffer]::BlockCopy($frame.Bytes, 0, $icoBytes, $imageOffset, $frame.Bytes.Length)
    $entryOffset += 16
    $imageOffset += $frame.Bytes.Length
  }
  [System.IO.File]::WriteAllBytes($iconPath, $icoBytes)
  Write-Host "Generated matching executable icon $iconPath"

  $targets = @(
    @{ Name = "StoreLogo.png"; Width = 50; Height = 50 },
    @{ Name = "Square150x150Logo.png"; Width = 150; Height = 150 },
    @{ Name = "Square44x44Logo.png"; Width = 44; Height = 44 },
    @{ Name = "Wide310x150Logo.png"; Width = 310; Height = 150 }
  )

  foreach ($target in $targets) {
    $bitmap = [System.Drawing.Bitmap]::new($target.Width, $target.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $scale = [Math]::Min($target.Width / $source.Width, $target.Height / $source.Height)
        $width = [int][Math]::Round($source.Width * $scale)
        $height = [int][Math]::Round($source.Height * $scale)
        $x = [int][Math]::Floor(($target.Width - $width) / 2)
        $y = [int][Math]::Floor(($target.Height - $height) / 2)
        $graphics.DrawImage($source, $x, $y, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      $outputPath = Join-Path $assetRoot $target.Name
      $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Host "Generated $outputPath"
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}
