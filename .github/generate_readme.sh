#!/usr/bin/env bash

rm -rf README.md
find . -not -path '*/.*' | while read -r item
do
  if [[ -d "$item" ]]
  then
    if [[ "$item" == '.' ]]
    then
      echo '#' PREVIEWS
      echo
      echo 'This readme is auto-generated.'
    else
      read -r heading < <(tr '[:lower:]' '[:upper:]' <<< "$(tr -d '^\./' <<< "$item")")
      echo
      echo '##' "$heading"
    fi
  else
    echo
    printf '<img alt="%s" src="%s"></img>\n' "$heading" "$item"
  fi
done >> "README.md"
