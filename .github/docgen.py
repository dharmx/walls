#!/usr/bin/env python

from configparser import ConfigParser
from os import listdir
from os.path import isfile
from pathlib import Path
from random import choices
from typing import Callable


def get_config(config_path: Path = Path("./.github/config.ini")) -> dict[str, str]:
    parser = ConfigParser()
    parser.read_string(config_path.read_text())
    return dict(parser.defaults())


def categorical_wallpapers(repo: Path = Path(".")) -> dict[Path, list[Path]]:
    return {
        # exclude categorical README.md
        repo / category: [repo / category / picture for picture in listdir(repo / category) if picture != "README.md"]
        # exclude hidden directories and README.md
        for category in listdir(repo)
        if not category.startswith(".") and not isfile(repo / category)
    }


def get_templates(repo: Path = Path(".")) -> dict[str, str]:
    return {
        template: Path(repo / ".github" / "templates" / template).read_text()
        for template in listdir(repo / ".github" / "templates")
    }


def generate_shuffled(
    categories: dict[Path, list[Path]] = categorical_wallpapers(), config: dict[str, str] = get_config()
) -> dict[Path, list[Path]]:
    return {category: choices(pictures, k=int(config["choose"])) for category, pictures in categories.items()}


def prime_templates(
    handlers: dict[str, Callable],
    templates: dict[str, str] = get_templates(),
    config: dict[str, str] = get_config(),
):
    return {
        template: handlers[template](template, string, config)
        if template in handlers
        else string.format(**config)
        for template, string in templates.items()
    }


def transform_shuffled(shuffled_paths: list[Path]) -> dict[str, str]:
    results = {}
    for index in range(len(shuffled_paths)):
        results[f"shuffled_{index}"] = str(shuffled_paths[index])
        results[f"shuffled_{index}_stem"] = shuffled_paths[index].stem
    return results


def handle_body(_, string: str, config: dict[str, str]) -> str:
    shuffled = generate_shuffled()
    results = []
    for category, pictures in shuffled.items():
        merged = {"category": category.name}
        merged = merged | config | transform_shuffled(pictures)
        results.append(string.format(**merged))
    return ("\n" * int(config["spacing"])).join(results)


def handle_category(_, string: str, variables: dict[str, str]) -> dict[str, str]:
    results = {}
    for category, pictures in categorical_wallpapers().items():
        readme = category / "README.md"
        readme = str(readme)
        results[readme] = f"# {category.name}\n\n"
        for picture in pictures:
            merged = variables | {"filepath": str(picture), "filename": picture.stem}
            results[readme] += string.format(**merged) + "\n"
    return results


if __name__ == "__main__":
    primed = prime_templates({"body.category.md": handle_body, "category.md": handle_category})
    Path(".github/README.md").write_text("\n".join([
        # custom priority
        primed["heading.md"],
        primed["body.heading.md"],
        primed["body.category.md"],
        primed["sources.md"],
        primed["conclusion.md"],
    ]))

    for category, readme_string in primed["category.md"].items():
        Path(category).write_text(readme_string)
