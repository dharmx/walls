#!/usr/bin/env bash
# shellcheck disable=2059

DIR_README_FMT='

<a href="%s"><img alt="%s" src="%s"></a>

<details>

<summary>EXIFTOOL OUTPUT</summary>

```text
%s
```

</details>
'

function traverse() {
  local buffered
  buffered="$(echo "# $1" | tr '[:lower:]' '[:upper:]')"

  pushd "$1" || exit
    local exiftool_output
    for image in *; do
      [[ "$image" == *"README.md" ]] && continue
      exiftool_output="$(exiftool "$image")"
      buffered+="$(printf "$DIR_README_FMT" "$image" "$image" "$image" "$exiftool_output")"
    done
    rm -f "README.md"
    echo "$buffered" > "README.md"
  popd || exit
}

MAIN_FMT='

## %s

%s

![See more.](%s)
'

main_buffered='# WALLS

This README is auto-generated. You may view its source code [here](./generate_readme.sh).'
for directory in **; do
  traverse "$directory"
  [[ "$directory" == "animated" ]] && continue

  favorites=""
  count=0
  for image in "$directory"/*; do
    [[ $count -eq 3 ]] && break
    [[ "$image" == *"README.md" ]] && continue
    favorites+="$(printf '<a href="../%s"><img alt="%s" src="../%s"></a><br/><br/>' "$image" "$image" "$image")"
    count=$((count+1))
  done
  
  upper_dir="$(echo "$directory" | tr '[:lower:]' '[:upper:]')"
  main_buffered+="$(printf "$MAIN_FMT" "$upper_dir" "$favorites" "../$directory/README.md")"
done

main_buffered+='

## ENDING NOTE

You may use [download-directory](https://download-directory.github.io) for downloading a specific
directory.

---

I do not own these images. All credits belong to the respective artists.'

rm -f ".github/README.md"
echo "$main_buffered" > ".github/README.md"
