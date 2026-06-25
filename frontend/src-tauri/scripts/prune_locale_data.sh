#!/usr/bin/env bash
# Trim babel's CLDR locale-data (~31M, 1083 files) to a common set. babel is pulled only
# by courlan (trafilatura's URL language filter), which catches UnknownLocaleError — so a
# missing locale degrades gracefully (the URL-language heuristic just returns "implausible",
# never crashes; article extraction is unaffected). Keeping ~45 common locales saves ~29M.
set -euo pipefail

LD="${1:?usage: prune_locale_data.sh <babel/locale-data dir>}"
[ -d "${LD}" ] || { echo "prune_locale_data: no dir ${LD} (skip)"; exit 0; }

# Space-padded keep-list; matched with a portable `case` glob (works on macOS bash 3.2).
KEEP=" root en en_001 en_US en_GB zh zh_Hans zh_Hant zh_Hans_CN zh_Hant_TW zh_Hant_HK \
es es_419 es_ES fr fr_FR de de_DE ja ja_JP ko ko_KR ru ru_RU pt pt_BR pt_PT it it_IT \
ar nl nl_NL pl pl_PL tr hi id th vi sv da fi nb cs uk el he ms fa ro hu "

removed=0; kept=0
for f in "${LD}"/*.dat; do
    [ -e "${f}" ] || continue
    name="$(basename "${f}" .dat)"
    case "${KEEP}" in
        *" ${name} "*) kept=$((kept + 1)) ;;
        *) rm -f "${f}"; removed=$((removed + 1)) ;;
    esac
done
echo "babel locale-data: kept ${kept}, removed ${removed} -> $(du -sh "${LD}" | cut -f1)"
