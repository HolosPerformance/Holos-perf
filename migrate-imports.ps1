# ============================================================
# migrate-imports.ps1
# Remplace tous les imports base44 par supabase dans le projet
# À lancer depuis la racine du projet : .\migrate-imports.ps1
# ============================================================

$srcPath = ".\src"
$files = Get-ChildItem -Path $srcPath -Recurse -Include "*.jsx","*.js","*.ts" | 
         Where-Object { $_.FullName -notlike "*node_modules*" }

$count = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $original = $content

    # Remplacer l'import base44Client par supabaseClient
    $content = $content -replace 
        "import \{ base44 \} from '@/api/base44Client';", 
        "import { supabase as base44 } from '@/api/supabaseClient';"

    $content = $content -replace 
        'import \{ base44 \} from "@/api/base44Client";', 
        'import { supabase as base44 } from "@/api/supabaseClient";'

    # Remplacer les imports relatifs (../../api/base44Client etc.)
    $content = $content -replace 
        "import \{ base44 \} from '.*base44Client';", 
        "import { supabase as base44 } from '@/api/supabaseClient';"

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "✓ Mis à jour : $($file.Name)" -ForegroundColor Green
        $count++
    }
}

Write-Host ""
Write-Host "Migration terminée : $count fichier(s) mis à jour." -ForegroundColor Cyan
