$ErrorActionPreference = 'Stop'
$demoPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.demo'
if (-not (Test-Path -LiteralPath $demoPath)) {
  throw 'File .env.demo tidak ditemukan.'
}

$lines = [System.IO.File]::ReadAllLines($demoPath)
$indices = @(for ($index = 0; $index -lt $lines.Length; $index++) {
  if ($lines[$index] -match '^DEMO_DATABASE_URL=') { $index }
})
if ($indices.Count -ne 1) {
  throw 'DEMO_DATABASE_URL harus muncul tepat satu kali dalam .env.demo.'
}

$index = $indices[0]
$pattern = '^(DEMO_DATABASE_URL=postgres(?:ql)?://postgres:)(.*)(@db\.[a-z0-9-]+\.supabase\.co:5432/postgres(?:\?.*)?)$'
$match = [regex]::Match($lines[$index], $pattern)
if (-not $match.Success) {
  throw 'Format URL Direct Supabase pada .env.demo belum cocok.'
}

$secure = Read-Host 'Masukkan password DATABASE Supabase (tidak terlihat)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ([string]::IsNullOrEmpty($plain)) { throw 'Password tidak boleh kosong.' }
  $encoded = [Uri]::EscapeDataString($plain)
  $lines[$index] = $match.Groups[1].Value + $encoded + $match.Groups[3].Value
  [System.IO.File]::WriteAllLines($demoPath, $lines, [System.Text.UTF8Encoding]::new($false))
  Write-Output 'Password database pada .env.demo berhasil diperbarui tanpa ditampilkan.'
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $plain = $null
  $encoded = $null
}
