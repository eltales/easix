param([string]$ScriptPath)

$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($ScriptPath, [ref]$null, [ref]$parseErrors) | Out-Null

if ($parseErrors -and $parseErrors.Count -gt 0) {
    foreach ($e in $parseErrors) {
        Write-Output "[$($e.Extent.StartLineNumber)] $($e.Message)"
    }
} else {
    Write-Output "OK: no syntax errors found"
}
