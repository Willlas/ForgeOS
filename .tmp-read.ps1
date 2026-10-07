$ErrorActionPreference = 'Stop'
$b = Get-Content 'c:\Proyects\MultiAgentDev\.ai\backlogs\014_sprint\backlog.md'
for ($i = 59; $i -lt 84; $i++) { Write-Output ("{0}| {1}" -f ($i + 1), $b[$i]) }
Write-Output '=====README014====='
$r = Get-Content 'c:\Proyects\MultiAgentDev\.ai\backlogs\014_sprint\README.md'
for ($i = 0; $i -lt $r.Count; $i++) { Write-Output ("{0}| {1}" -f ($i + 1), $r[$i]) }





