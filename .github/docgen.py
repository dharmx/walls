#!/usr/bin/env python

from configparser import ConfigParser
from json import dumps
from os import listdir
from os.path import isfile
from pathlib import Path
from random import choices
from typing import Callable


def get_config(config_path: Path = Path("./.github/config.ini")) -> dict[str, str]:
    parser = ConfigParser()
    parser.read_string(config_path.read_text())
    return dict(parser.defaults())


def categorical_wallpapers() -> dict[str, list[Path]]:
    return {
        # exclude categorical README.md
        str(category): [Path(picture) for picture in listdir(category) if picture != "README.md"]
        # exclude hidden directories and README.md
        for category in listdir(".")
        if not category.startswith(".") and not isfile(category)
    }


def get_templates() -> dict[str, str]:
    return {template: Path(f".github/templates/{template}").read_text() for template in listdir(".github/templates")}


def generate_shuffled(
    config: dict[str, str],
    categories: dict[str, list[Path]] = categorical_wallpapers()
) -> dict[str, list[Path]]:
    return {category: choices(pictures, k=int(config["choose"])) for category, pictures in categories.items()}


def prime_templates(
    config: dict[str, str],
    handlers: dict[str, Callable],
    templates: dict[str, str] = get_templates(),
):
    return {
        template: handlers[template](template, string, config) if template in handlers else string.format(**config)
        for template, string in templates.items()
    }


def transform_shuffled(category: str, shuffled_paths: list[Path]) -> dict[str, str]:
    results = {}
    for index in range(len(shuffled_paths)):
        results[f"shuffled_{index}"] = str(f"../{category}" / shuffled_paths[index])
        results[f"shuffled_{index}_stem"] = shuffled_paths[index].stem
    return results


# Handlers {{{
def handle_body(_, string: str, config: dict[str, str]) -> str:
    shuffled = generate_shuffled(config)
    results = []
    for category, pictures in shuffled.items():
        merged = {"category": category}
        merged = merged | config | transform_shuffled(category, pictures)
        results.append(string.format(**merged))
    return ("\n" * int(config["spacing"])).join(results)


def handle_category(_, string: str, config: dict[str, str]) -> dict[str, str]:
    results = {}
    spacing = "\n" * int(config["spacing"])
    for category, pictures in categorical_wallpapers().items():
        readme = f"{category}/README.md"
        results[readme] = f"# {category}\n\n"
        for picture in pictures:
            merged = config | {"filepath": str(picture), "filename": picture.stem}
            results[readme] = f"{results[readme]}{string.format(**merged)}{spacing}"
    return results


# }}}


if __name__ == "__main__":
    CONFIG = get_config()
    primed = prime_templates(CONFIG, {"body.category.md": handle_body, "category.md": handle_category})
    full_templates = ["heading", "body.heading", "body.category", "sources", "conclusion"] # ordered
    full_templates = [primed[f"{item}.md"] for item in full_templates]
    partial_template = primed["category.md"]

    if CONFIG["dry"].casefold() == "True".casefold():
        print(dumps({"full": full_templates, "partial": partial_template})) # use this with jq/fq
    else:
        Path(".github/README.md").write_text(("\n" * int(CONFIG["spacing"])).join(full_templates))
        for category, readme in partial_template.items():
            Path(category).write_text(readme)
