# push.ps1 — Nhập GitHub PAT 1 lần (ẩn, lưu mã hoá) rồi push lên origin/main.
# Token KHÔNG bị ghi ra file plaintext, KHÔNG hiện trên màn hình, KHÔNG vào git history.
#
# Dùng:  .\push.ps1                      (sẽ hỏi PAT)
#        .\push.ps1 -User manhdauvn09    (đổi username nếu cần)
#        .\push.ps1 -Pat "ghp_xxx"       (truyền thẳng - ít an toàn hơn)

param(
  [string]$User = "manhdauvn09-manhds",
  [string]$Pat  = "",
  [string]$Remote = "https://github.com/manhdauvn09-manhds/chess.git",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
# Hiển thị tiếng Việt đúng (UTF-8) cho cả Write-Host lẫn output của git.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# 1) Đảm bảo remote origin đúng
$existing = (git remote get-url origin 2>$null)
if (-not $existing) { git remote add origin $Remote }
elseif ($existing -ne $Remote) { git remote set-url origin $Remote }

# 2) Lấy PAT (ẩn) nếu chưa truyền
if ([string]::IsNullOrWhiteSpace($Pat)) {
  $sec = Read-Host "Nhập GitHub PAT (scope 'repo')" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $Pat = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ([string]::IsNullOrWhiteSpace($Pat)) { Write-Error "PAT trống."; exit 1 }

# 3) Lưu credential qua Git Credential Manager (mã hoá trong Windows Credential Manager).
#    Lần sau push sẽ tự dùng, không phải nhập lại.
try { git config --global credential.helper manager } catch {}
$cred = "protocol=https`nhost=github.com`nusername=$User`npassword=$Pat`n"
$cred | git credential approve
$cred = $null

# 4) Push
Write-Host "Đang push $Branch lên origin..." -ForegroundColor Cyan
git push -u origin $Branch
if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Push thành công. Lần sau chỉ cần: git push" -ForegroundColor Green
} else {
  Write-Host "❌ Push lỗi. Kiểm tra: PAT có scope 'repo'? username/owner repo đúng?" -ForegroundColor Red
}
$Pat = $null
[System.GC]::Collect()
