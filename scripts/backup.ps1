# Dump Postgres and copy staff uploads. Run from any directory.
# Restore is documented in memory_context.md. This does not change Compose.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$sql = Join-Path $dest "db-$stamp.sql"
cmd /c "docker compose exec -T postgres sh -c `"PGPASSWORD=`$POSTGRES_PASSWORD pg_dump -U `$POSTGRES_USER --no-owner --no-acl `$POSTGRES_DB`" > `"$sql`""
if ($LASTEXITCODE -ne 0) { throw "pg_dump exited $LASTEXITCODE" }
if ((Get-Item $sql).Length -lt 100) { throw "pg_dump wrote an empty file" }
$uploads = Join-Path $dest "uploads-$stamp"
docker compose cp "backend:/app/uploads" $uploads
if ($LASTEXITCODE -ne 0) { throw "uploads copy exited $LASTEXITCODE" }
Write-Output "Database: $sql"
Write-Output "Uploads: $uploads"
