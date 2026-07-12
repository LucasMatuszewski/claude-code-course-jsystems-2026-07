# Publish course slide decks to the DevPowers site repo.
# Junctions/symlinks do not work across two git repos (git tracks the link,
# not content) - this explicit copy is the sync mechanism. Run after any
# deck change.
#
# Usage:
#   pwsh course-materials/slides/publish-slides.ps1          # copy only
#   pwsh course-materials/slides/publish-slides.ps1 -Push    # copy + commit + push DevPowers (deploys to production)
param([switch]$Push)

$slidesDir = $PSScriptRoot
$repoRoot  = Split-Path (Split-Path $slidesDir -Parent) -Parent
$devRepo   = "C:\Users\BiuroEdukey\DEV\Projects\DevPowers"
$dst = Join-Path $devRepo "szkolenia\claude-code-jsystems"

New-Item -ItemType Directory -Force -Path $dst | Out-Null
$copied = @()
foreach ($n in 1..3) {
    $from = Join-Path $slidesDir "day-$n.html"
    if (Test-Path $from) {
        $to = Join-Path $dst "Prezentacja_Dzien$n.html"
        $html = Get-Content $from -Raw -Encoding UTF8
        # On the published site the survey dashboard sits next to the decks
        $html = $html.Replace("../survey/dashboard/index.html", "ankieta.html")
        Set-Content -Path $to -Value $html -Encoding UTF8 -NoNewline
        $copied += "Prezentacja_Dzien$n.html"
    }
}
# Survey dashboard (anonymized) published next to the decks
$dash = Join-Path $repoRoot "course-materials\survey\dashboard\index.html"
if (Test-Path $dash) {
    Copy-Item $dash (Join-Path $dst "ankieta.html") -Force
    $copied += "ankieta.html"
}
Write-Host "Copied to ${dst}: $($copied -join ', ')"

if ($Push) {
    Push-Location $devRepo
    try {
        git add "szkolenia/claude-code-jsystems"
        $staged = git diff --cached --name-only
        if ($staged) {
            git commit -m "Szkolenia: Claude Code JSystems - sync slajdow z repo kursu"
            git push
            Write-Host "DevPowers committed and pushed (production deploy)."
        } else {
            Write-Host "No changes to publish - DevPowers already up to date."
        }
    } finally { Pop-Location }
} else {
    Write-Host "NEXT: review the diff in the DevPowers repo and commit, or rerun with -Push to auto commit+push."
}
